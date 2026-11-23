// The community's small store: private Vercel Blob objects on Vercel, a local folder in development. Every object is
// JSON under one prefix, and none of it is ever public: subscriber contacts, votes and predictions stay server side.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = "community/";
const onBlob = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const localDir = () => process.env.COMMUNITY_DIR ?? path.join(process.cwd(), "data", "community");
const clean = (k: string) => { if (!/^[a-z0-9][a-z0-9/_.-]{0,200}$/i.test(k) || k.includes("..")) throw new Error("bad key"); return ROOT + k; };

export const storeReady = () => onBlob() || !process.env.VERCEL;

export async function putJson(key: string, value: unknown, opts: { ifAbsent?: boolean } = {}): Promise<"CREATED" | "EXISTS" | "WRITTEN"> {
  const k = clean(key); const body = JSON.stringify(value);
  if (onBlob()) {
    const { put } = await import("@vercel/blob");
    try { await put(k, body, { access: "private", addRandomSuffix: false, allowOverwrite: !opts.ifAbsent, contentType: "application/json" }); return opts.ifAbsent ? "CREATED" : "WRITTEN"; }
    catch (e) { if (opts.ifAbsent && /already exists/i.test(String((e as Error)?.message))) return "EXISTS"; throw e; }
  }
  const f = path.join(localDir(), k); await fs.mkdir(path.dirname(f), { recursive: true });
  if (opts.ifAbsent) { try { await fs.writeFile(f, body, { flag: "wx" }); return "CREATED"; } catch { return "EXISTS"; } }
  await fs.writeFile(f, body); return "WRITTEN";
}

export async function getJson<T>(key: string): Promise<T | null> {
  const k = clean(key);
  if (onBlob()) {
    const { get } = await import("@vercel/blob");
    try { const r = await get(k, { access: "private", useCache: false }); if (!r || r.statusCode !== 200 || !r.stream) return null; return JSON.parse(await new Response(r.stream).text()) as T; }
    catch { return null; }
  }
  try { return JSON.parse(await fs.readFile(path.join(localDir(), k), "utf8")) as T; } catch { return null; }
}

/** every key under a prefix, without the community root */
export async function listKeys(prefix: string): Promise<string[]> {
  const p = clean(prefix);
  if (onBlob()) {
    const { list } = await import("@vercel/blob");
    const out: string[] = []; let cursor: string | undefined;
    do { const page = await list({ prefix: p, cursor, limit: 1000 }); for (const b of page.blobs) out.push(b.pathname.slice(ROOT.length)); cursor = page.hasMore ? page.cursor : undefined; } while (cursor);
    return out;
  }
  const base = path.join(localDir(), p); const out: string[] = [];
  const walk = async (d: string) => { let es: import("node:fs").Dirent[] = []; try { es = await fs.readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of es) { const f = path.join(d, e.name); if (e.isDirectory()) await walk(f); else out.push(path.relative(path.join(localDir(), ROOT), f).split(path.sep).join("/")); } };
  await walk(base); return out;
}

/** a stable, private id for a contact or a browser: a keyed hash, so stored keys never show an address or a number */
export function hid(s: string) { return crypto.createHmac("sha256", process.env.COMMUNITY_SECRET || process.env.DESK_SECRET || "onpoint-community").update(s.trim().toLowerCase()).digest("hex").slice(0, 32); }
export function sign(s: string) { return hid("sig:" + s).slice(0, 20); }
export const adminOk = (key: string | null) => { const want = process.env.ALERTS_ADMIN_KEY || process.env.DESK_SECRET; return !!want && !!key && crypto.timingSafeEqual(Buffer.from(hid(key)), Buffer.from(hid(want))); };
