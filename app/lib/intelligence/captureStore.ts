// Object storage for the evidence recorder. Records are immutable objects written once under a unique key; the only
// objects ever overwritten are small "heads" (pointers and counters) that can be rebuilt from the immutable ones.
//
// Backends
//   fs      a directory on a persistent disk. Durable only where the host keeps the disk (never a serverless function).
//   blob    Vercel Blob, private access. Durable, and the only backend that survives a serverless deployment.
//   memory  tests.
//
// Server-only: uses node:fs.

import { randomBytes } from "node:crypto";
import { link, mkdir, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export interface ObjectStore {
  readonly kind: "fs" | "blob" | "memory";
  /** True when objects survive a process restart and a new deployment. */
  readonly durable: boolean;
  /** Create only when absent. Never replaces an existing object. */
  putIfAbsent(key: string, body: Buffer, contentType: string): Promise<"CREATED" | "EXISTS">;
  /** Create or replace. Only for heads. */
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  /** Keys that start with `prefix`, ascending. */
  list(prefix: string): Promise<string[]>;
}

export class StoreError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

const KEY = /^[A-Za-z0-9][A-Za-z0-9._=/-]{0,240}$/;
export function checkKey(key: string): string {
  if (!KEY.test(key) || key.includes("..") || key.includes("//") || key.endsWith("/")) throw new StoreError("INVALID_KEY", `"${key.slice(0, 60)}" is not a valid object key`);
  return key;
}

// ---- memory ------------------------------------------------------------------------------------------------------------

export class MemoryStore implements ObjectStore {
  readonly kind = "memory" as const;
  readonly durable = false;
  readonly objects = new Map<string, Buffer>();
  async putIfAbsent(key: string, body: Buffer) { checkKey(key); if (this.objects.has(key)) return "EXISTS" as const; this.objects.set(key, Buffer.from(body)); return "CREATED" as const; }
  async put(key: string, body: Buffer) { checkKey(key); this.objects.set(key, Buffer.from(body)); }
  async get(key: string) { checkKey(key); const b = this.objects.get(key); return b ? Buffer.from(b) : null; }
  async list(prefix: string) { return [...this.objects.keys()].filter((k) => k.startsWith(prefix)).sort(); }
}

// ---- filesystem --------------------------------------------------------------------------------------------------------

const isCode = (e: unknown, code: string) => (e as NodeJS.ErrnoException)?.code === code;

export class FsStore implements ObjectStore {
  readonly kind = "fs" as const;
  readonly durable: boolean;
  readonly root: string;
  constructor(root: string, opts: { durable?: boolean } = {}) { this.root = path.resolve(root); this.durable = opts.durable ?? true; }
  private file(key: string) { return path.join(this.root, ...checkKey(key).split("/")); }
  private async stage(file: string, body: Buffer) {
    await mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
    await writeFile(tmp, body);
    return tmp;
  }
  async putIfAbsent(key: string, body: Buffer) {
    const file = this.file(key);
    const tmp = await this.stage(file, body);
    try {
      // a hard link fails when the target exists, so creation is atomic and never replaces an object
      await link(tmp, file);
      return "CREATED" as const;
    } catch (e) {
      if (isCode(e, "EEXIST")) return "EXISTS" as const;
      throw e;
    } finally {
      await unlink(tmp).catch(() => undefined);
    }
  }
  async put(key: string, body: Buffer) {
    const file = this.file(key);
    await rename(await this.stage(file, body), file);
  }
  async get(key: string) {
    try { return await readFile(this.file(key)); } catch (e) { if (isCode(e, "ENOENT")) return null; throw e; }
  }
  async list(prefix: string) {
    const out: string[] = [];
    const walk = async (dir: string, rel: string) => {
      let entries;
      try { entries = await readdir(dir, { withFileTypes: true }); } catch (e) { if (isCode(e, "ENOENT")) return; throw e; }
      for (const d of entries) {
        const r = rel ? `${rel}/${d.name}` : d.name;
        if (d.isDirectory()) { if (r.startsWith(prefix) || prefix.startsWith(`${r}/`)) await walk(path.join(dir, d.name), r); }
        else if (!d.name.endsWith(".tmp") && r.startsWith(prefix)) out.push(r);
      }
    };
    await walk(this.root, "");
    return out.sort();
  }
}

// ---- Vercel Blob -------------------------------------------------------------------------------------------------------

type BlobSdk = typeof import("@vercel/blob");

/** Private Vercel Blob store. Reads the token from BLOB_READ_WRITE_TOKEN, as the SDK does. */
export class BlobStore implements ObjectStore {
  readonly kind = "blob" as const;
  readonly durable = true;
  private sdk: Promise<BlobSdk> | null = null;
  private load() { return (this.sdk ??= import("@vercel/blob")); }

  async putIfAbsent(key: string, body: Buffer, contentType: string) {
    const { put } = await this.load();
    try {
      await put(checkKey(key), body, { access: "private", addRandomSuffix: false, allowOverwrite: false, contentType });
      return "CREATED" as const;
    } catch (e) {
      if (/already exists/i.test(String((e as Error)?.message))) return "EXISTS" as const;
      throw e;
    }
  }
  async put(key: string, body: Buffer, contentType: string) {
    const { put } = await this.load();
    await put(checkKey(key), body, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType });
  }
  async get(key: string) {
    const { get } = await this.load();
    const r = await get(checkKey(key), { access: "private", useCache: false });
    if (!r || r.statusCode !== 200 || !r.stream) return null;
    return Buffer.from(await new Response(r.stream).arrayBuffer());
  }
  async list(prefix: string) {
    const { list } = await this.load();
    const out: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor, limit: 1000 });
      for (const b of page.blobs) out.push(b.pathname);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return out.sort();
  }
}

// ---- configuration -----------------------------------------------------------------------------------------------------

export interface StoreChoice { store: ObjectStore | null; problem: string | null }

/**
 * Pick the store from the environment, failing closed. On Vercel the local disk is not durable, so it is never chosen
 * by default: INTELLIGENCE_CAPTURE_STORE=blob and a Blob token are required. Elsewhere the default is a local directory.
 */
export function resolveStore(env: Record<string, string | undefined> = process.env): StoreChoice {
  const want = env.INTELLIGENCE_CAPTURE_STORE;
  const onVercel = !!env.VERCEL;
  if (want === "blob") {
    if (!env.BLOB_READ_WRITE_TOKEN && !env.BLOB_STORE_ID) return { store: null, problem: "INTELLIGENCE_CAPTURE_STORE=blob but no Blob credentials are configured" };
    return { store: new BlobStore(), problem: null };
  }
  if (want === "fs" || (!want && !onVercel)) {
    const dir = env.INTELLIGENCE_CAPTURE_DIR ?? path.join(process.cwd(), "data", "intelligence-capture");
    // a serverless disk is explicitly not durable; the health page says so
    return { store: new FsStore(dir, { durable: !onVercel || env.INTELLIGENCE_CAPTURE_DISK_IS_PERSISTENT === "1" }), problem: null };
  }
  if (want) return { store: null, problem: `INTELLIGENCE_CAPTURE_STORE="${want}" is not a known store` };
  return { store: null, problem: "no durable store is configured: set INTELLIGENCE_CAPTURE_STORE=blob on Vercel" };
}
