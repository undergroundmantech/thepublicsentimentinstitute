// PostgreSQL implementation of the recorder's ObjectStore, in database `oop`, schema `onpoint`
// (db/migrations/20261031_recorder_objects.sql). Server-only.
//
// Objects are written once (putIfAbsent). The only keys ever replaced are the derived, rebuildable ones in
// MUTABLE_PREFIXES: recorder heads and the per-race published timelines (publicSnapshot.ts). The database trigger
// enforces the same rule, so a bug here cannot overwrite or delete evidence.
//
// Every body is stored with its SHA-256 and checked again on read. A query that hangs is abandoned after
// QUERY_TIMEOUT_MS and its connection discarded; connection-level failures are retried a bounded number of times
// (every operation here is idempotent).

import { createHash } from "node:crypto";
import { Pool, type PoolConfig } from "pg";
import type { ObjectStore } from "./captureStore";

/** Keys that may be replaced. Must match onpoint.guard_recorder_object_mutation(). */
export const MUTABLE_PREFIXES = ["heads/", "public/timeline/"] as const;
export const isMutableKey = (key: string) => MUTABLE_PREFIXES.some((p) => key.startsWith(p));

export const QUERY_TIMEOUT_MS = 15_000;
const RETRIES = 2;
const BACKOFF_MS = [250, 1_000];

const sha256 = (body: Buffer) => createHash("sha256").update(body).digest("hex");
const fail = (code: string, message: string) => Object.assign(new Error(message), { code });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// connection-level failures worth one more try; a constraint or trigger error is never retried
const RETRYABLE = /^(ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE|ENOTFOUND|EAI_AGAIN|57P01|57P02|57P03|08\d{3})$/;
export const isRetryable = (e: unknown) => {
  const x = e as { code?: string; message?: string } | null;
  return !!x && ((typeof x.code === "string" && RETRYABLE.test(x.code)) || /Query read timeout|Connection terminated|timeout exceeded when trying to connect/i.test(x.message ?? ""));
};

const likePrefix = (prefix: string) => prefix.replace(/[\\%_]/g, (c) => "\\" + c) + "%";

export class PostgresStore implements ObjectStore {
  readonly kind = "postgres" as const;
  readonly durable = true;

  private readonly pool: Pool;
  private readonly valid: (key: string) => string;
  private readonly wait: (ms: number) => Promise<unknown>;

  constructor(pool: Pool, valid: (key: string) => string, wait: (ms: number) => Promise<unknown> = sleep) {
    this.pool = pool;
    this.valid = valid;
    this.wait = wait;
  }

  private async q<R extends object>(sql: string, args: unknown[], attempt = 0): Promise<{ rows: R[]; rowCount: number | null; attempt: number }> {
    try {
      const r = await this.pool.query<R & import("pg").QueryResultRow>(sql, args);
      return { rows: r.rows, rowCount: r.rowCount, attempt };
    } catch (e) {
      if (attempt >= RETRIES || !isRetryable(e)) throw e;
      await this.wait(BACKOFF_MS[attempt] ?? 1_000);
      return this.q<R>(sql, args, attempt + 1);
    }
  }

  async putIfAbsent(key: string, body: Buffer, contentType: string): Promise<"CREATED" | "EXISTS"> {
    key = this.valid(key);
    const sum = sha256(body);
    const r = await this.q<{ object_key: string }>(
      `INSERT INTO onpoint.recorder_objects (object_key, body, content_type, sha256) VALUES ($1, $2, $3, $4)
       ON CONFLICT (object_key) DO NOTHING RETURNING object_key`,
      [key, body, contentType, sum],
    );
    if (r.rowCount === 1) return "CREATED";
    // a retried insert whose first attempt committed before the connection dropped finds its own bytes: still ours
    if (r.attempt > 0) {
      const ex = await this.q<{ sha256: string }>("SELECT sha256 FROM onpoint.recorder_objects WHERE object_key = $1", [key]);
      if (ex.rows[0]?.sha256 === sum) return "CREATED";
    }
    return "EXISTS";
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    key = this.valid(key);
    if (!isMutableKey(key)) throw fail("IMMUTABLE_KEY", `only ${MUTABLE_PREFIXES.join(", ")} keys may be replaced`);
    await this.q(
      `INSERT INTO onpoint.recorder_objects (object_key, body, content_type, sha256) VALUES ($1, $2, $3, $4)
       ON CONFLICT (object_key) DO UPDATE SET body = EXCLUDED.body, content_type = EXCLUDED.content_type, sha256 = EXCLUDED.sha256`,
      [key, body, contentType, sha256(body)],
    );
  }

  async get(key: string): Promise<Buffer | null> {
    const r = await this.q<{ body: Buffer; sha256: string }>("SELECT body, sha256 FROM onpoint.recorder_objects WHERE object_key = $1", [this.valid(key)]);
    if (!r.rows.length) return null;
    const buf = Buffer.from(r.rows[0].body);
    if (sha256(buf) !== r.rows[0].sha256) throw fail("INTEGRITY", `stored object ${key.slice(0, 60)} does not match its SHA-256`);
    return buf;
  }

  async list(prefix: string): Promise<string[]> {
    const r = await this.q<{ object_key: string }>(
      String.raw`SELECT object_key FROM onpoint.recorder_objects WHERE object_key LIKE $1 ESCAPE '\' ORDER BY object_key COLLATE "C"`,
      [likePrefix(prefix)],
    );
    return r.rows.map((x) => x.object_key);
  }

  async readDir(dir: string): Promise<Map<string, Buffer>> {
    const prefix = dir.endsWith("/") ? dir : dir + "/";
    const r = await this.q<{ object_key: string; body: Buffer; sha256: string }>(
      String.raw`SELECT object_key, body, sha256 FROM onpoint.recorder_objects
                 WHERE object_key LIKE $1 ESCAPE '\' AND position('/' in substr(object_key, $2)) = 0
                 ORDER BY object_key COLLATE "C"`,
      [likePrefix(prefix), prefix.length + 1],
    );
    const out = new Map<string, Buffer>();
    for (const x of r.rows) {
      const buf = Buffer.from(x.body);
      if (sha256(buf) !== x.sha256) throw fail("INTEGRITY", `stored object ${x.object_key.slice(0, 60)} does not match its SHA-256`);
      out.set(x.object_key, buf);
    }
    return out;
  }
}

// One bounded pool per connection string per process; nothing connects at import time.
const pools = new Map<string, Pool>();

export function postgresPool(connectionString: string, extra: Partial<PoolConfig> = {}): Pool {
  const id = connectionString + JSON.stringify(extra);
  const cached = pools.get(id);
  if (cached) return cached;
  const pool = new Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
    // client-side: a query with no answer is abandoned and its connection discarded by the pool
    query_timeout: QUERY_TIMEOUT_MS,
    // server-side: the statement is cancelled even if the client has gone
    statement_timeout: QUERY_TIMEOUT_MS,
    keepAlive: true,
    application_name: "onpoint-recorder",
    allowExitOnIdle: true,
    ...extra,
  });
  // an idle client that loses its connection must not crash the process
  pool.on("error", () => {});
  pools.set(id, pool);
  return pool;
}

/**
 * Validate ONPOINT_DATABASE_URL for the recorder. Fails closed: the database must be `oop`, the password correctly
 * URL-encoded, and the connection encrypted (sslmode=require or verify-full) unless the host is the local machine or
 * ONPOINT_DATABASE_ALLOW_INSECURE=1 is set explicitly for a test. Never returns or logs the credential.
 */
export function checkDatabaseUrl(uri: string | undefined, env: Record<string, string | undefined>): string | null {
  if (!uri) return "INTELLIGENCE_CAPTURE_STORE=postgres but ONPOINT_DATABASE_URL is missing";
  if (/%(?![0-9a-fA-F]{2})/.test(uri)) return "ONPOINT_DATABASE_URL contains invalid percent-escapes; URL-encode the password";
  let u: URL;
  try { u = new URL(uri); decodeURIComponent(u.password); } catch { return "ONPOINT_DATABASE_URL is malformed"; }
  if (!["postgres:", "postgresql:"].includes(u.protocol) || !u.hostname) return "ONPOINT_DATABASE_URL is not a PostgreSQL URL";
  if (decodeURIComponent(u.pathname.slice(1)) !== "oop") return "ONPOINT_DATABASE_URL must point to the dedicated oop database";
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(u.hostname);
  const ssl = u.searchParams.get("sslmode");
  if (!local && env.ONPOINT_DATABASE_ALLOW_INSECURE !== "1" && !(ssl === "require" || ssl === "verify-full" || ssl === "verify-ca"))
    return "ONPOINT_DATABASE_URL must use TLS (sslmode=verify-full); the recorder does not send election data unencrypted";
  return null;
}
