// GitHub as the primary durable store (INTELLIGENCE_CAPTURE_STORE=github): no Blob needed to record.
//
// One instance serves one invocation. Reads come from the commit the instance started on. Writes are buffered and land
// in ONE commit (tree → commit → non-force ref update), so a checkpoint and its publication are wholly durable or
// absent. If another writer committed first, the ref update is refused (GITHUB_CONFLICT) and everything buffered is
// dropped: overlapping captures cannot interleave, and a failed checkpoint is never half-written or replayed later.
//
// putIfAbsent is provisional until commit, when one GraphQL query looks up every new path in the base commit:
// identical content is skipped, different content aborts the commit (IMMUTABLE_CONFLICT). All heads/* objects live in
// one file, heads.json, so a run reads them with a single request. *.gz objects are stored as base64 at <path>.b64.
// The token is sent only to the GitHub API, and is never logged or returned.

import { createHash } from "node:crypto";
import { StoreError, checkKey, type CommitResult, type ObjectStore } from "./captureStore";

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
export interface GitHubTarget { repo: string; branch: string; token: string; apiBase: string; fetch: Fetch }

const REPO_RE = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const BRANCH_RE = /^[A-Za-z0-9_./-]{1,100}$/;

/** Null unless a repository and a token are both configured. */
export function githubTargetFrom(env: Record<string, string | undefined>, f: Fetch = fetch): GitHubTarget | null {
  const repo = env.ONPOINT_ARCHIVE_REPO ?? "", token = env.ONPOINT_ARCHIVE_TOKEN ?? "", branch = env.ONPOINT_ARCHIVE_BRANCH || "main";
  if (!REPO_RE.test(repo) || repo.includes("..") || token.length < 20 || !BRANCH_RE.test(branch) || branch.includes("..")) return null;
  return { repo, branch, token, apiBase: "https://api.github.com", fetch: f };
}

const HEADS_FILE = "heads.json";
const GRAPHQL_BATCH = 100;
const isHead = (k: string) => k.startsWith("heads/");
const isBinary = (k: string) => k.endsWith(".gz");
const pathOf = (k: string) => (isBinary(k) ? `${k}.b64` : k);
const keyOf = (p: string) => (p.endsWith(".gz.b64") ? p.slice(0, -4) : p);
const encode = (k: string, b: Buffer) => (isBinary(k) ? Buffer.from(b.toString("base64"), "utf8") : b);
const decode = (k: string, b: Buffer) => (isBinary(k) ? Buffer.from(b.toString("utf8"), "base64") : b);
export const gitBlobSha = (b: Buffer) => createHash("sha1").update(`blob ${b.length}\0`).update(b).digest("hex");

function text(key: string, b: Buffer): string {
  const s = b.toString("utf8");
  if (!Buffer.from(s, "utf8").equals(b)) throw new StoreError("NOT_TEXT", `${key} is not UTF-8 text`);
  return s;
}

export class GitHubStore implements ObjectStore {
  readonly kind = "github" as const;
  readonly durable = true;
  /** GitHub requests made by this instance. */
  calls = 0;
  private base: Promise<{ commit: string; tree: string }> | null = null;
  private heads: Promise<Map<string, string>> | null = null;
  private headsDirty = false;
  private writes = new Map<string, Buffer>();
  private provisional = new Set<string>();
  private cache = new Map<string, Buffer | null>();
  private trees = new Map<string, Promise<string | null>>();
  private readonly t: GitHubTarget;
  constructor(t: GitHubTarget) { this.t = t; }

  private req(method: string, path: string, body?: unknown, accept = "application/vnd.github+json"): Promise<Response> {
    this.calls++;
    return this.t.fetch(`${this.t.apiBase}${path}`, {
      method, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15_000),
      headers: { authorization: `Bearer ${this.t.token}`, accept, "x-github-api-version": "2022-11-28", ...(body === undefined ? {} : { "content-type": "application/json" }) },
    });
  }
  private async json<T>(method: string, path: string, body?: unknown): Promise<T> {
    const r = await this.req(method, path, body);
    if (!r.ok) throw new StoreError(r.status === 422 && method === "PATCH" ? "GITHUB_CONFLICT" : `GITHUB_${r.status}`, `GitHub answered ${r.status}`);
    return (await r.json()) as T;
  }
  private repo = (p: string) => `/repos/${this.t.repo}${p}`;

  private baseRef() {
    return (this.base ??= (async () => {
      const ref = await this.json<{ object: { sha: string } }>("GET", this.repo(`/git/ref/heads/${this.t.branch}`));
      const c = await this.json<{ tree: { sha: string } }>("GET", this.repo(`/git/commits/${ref.object.sha}`));
      return { commit: ref.object.sha, tree: c.tree.sha };
    })());
  }
  private async file(path: string): Promise<Buffer | null> {
    const { commit } = await this.baseRef();
    const r = await this.req("GET", this.repo(`/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${commit}`), undefined, "application/vnd.github.raw");
    if (r.status === 404) return null;
    if (!r.ok) throw new StoreError(`GITHUB_${r.status}`, `GitHub answered ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  }
  private loadHeads() {
    return (this.heads ??= (async () => {
      const b = await this.file(HEADS_FILE);
      return new Map(Object.entries(b ? (JSON.parse(b.toString("utf8")) as Record<string, string>) : {}));
    })());
  }
  private treeSha(dir: string): Promise<string | null> {
    let p = this.trees.get(dir);
    if (!p) {
      p = (async () => {
        if (!dir) return (await this.baseRef()).tree;
        const cut = dir.lastIndexOf("/");
        const parent = await this.treeSha(cut < 0 ? "" : dir.slice(0, cut));
        if (!parent) return null;
        const r = await this.json<{ tree: { path: string; type: string; sha: string }[] }>("GET", this.repo(`/git/trees/${parent}`));
        return r.tree.find((e) => e.type === "tree" && e.path === dir.slice(cut + 1))?.sha ?? null;
      })();
      this.trees.set(dir, p);
    }
    return p;
  }

  async get(key: string): Promise<Buffer | null> {
    checkKey(key);
    if (isHead(key)) { const v = (await this.loadHeads()).get(key); return v === undefined ? null : Buffer.from(v, "utf8"); }
    const w = this.writes.get(key);
    if (w) return Buffer.from(w);
    if (!this.cache.has(key)) { const b = await this.file(pathOf(key)); this.cache.set(key, b && decode(key, b)); }
    const v = this.cache.get(key);
    return v ? Buffer.from(v) : null;
  }

  async put(key: string, body: Buffer): Promise<void> {
    checkKey(key);
    if (isHead(key)) { (await this.loadHeads()).set(key, text(key, body)); this.headsDirty = true; return; }
    if (!isBinary(key)) text(key, body);
    this.writes.set(key, Buffer.from(body));
    this.provisional.delete(key);
  }

  async putIfAbsent(key: string, body: Buffer): Promise<"CREATED" | "EXISTS"> {
    checkKey(key);
    if (isHead(key)) {
      const h = await this.loadHeads();
      if (h.has(key)) return "EXISTS";
      h.set(key, text(key, body)); this.headsDirty = true;
      return "CREATED";
    }
    if (this.writes.has(key) || this.cache.get(key)) return "EXISTS";
    if (!isBinary(key)) text(key, body);
    this.writes.set(key, Buffer.from(body));
    this.provisional.add(key);
    return "CREATED";
  }

  async list(prefix: string): Promise<string[]> {
    if (isHead(prefix)) return [...(await this.loadHeads()).keys()].filter((k) => k.startsWith(prefix)).sort();
    const cut = prefix.lastIndexOf("/");
    const dir = cut < 0 ? "" : prefix.slice(0, cut);
    const out = new Set<string>();
    const sha = await this.treeSha(dir);
    if (sha) {
      const r = await this.json<{ tree: { path: string; type: string }[]; truncated?: boolean }>("GET", this.repo(`/git/trees/${sha}?recursive=1`));
      if (r.truncated) throw new StoreError("GITHUB_TREE_TRUNCATED", "the directory listing was truncated");
      for (const e of r.tree) {
        const k = keyOf(dir ? `${dir}/${e.path}` : e.path);
        if (e.type === "blob" && k.startsWith(prefix) && k !== HEADS_FILE) out.add(k);
      }
    }
    for (const k of this.writes.keys()) if (k.startsWith(prefix)) out.add(k);
    return [...out].sort();
  }

  /** One GraphQL request for a flat directory and its contents; also fills the read cache. */
  async readDir(dir: string): Promise<Map<string, Buffer>> {
    checkKey(`${dir}x`);
    const { commit } = await this.baseRef();
    const [owner, name] = this.t.repo.split("/");
    const path = dir.replace(/\/$/, "");
    const r = await this.req("POST", "/graphql", { query: `query{repository(owner:${JSON.stringify(owner)},name:${JSON.stringify(name)}){object(expression:${JSON.stringify(`${commit}:${path}`)}){... on Tree{entries{name type object{... on Blob{text isTruncated}}}}}}}` });
    if (!r.ok) throw new StoreError(`GITHUB_${r.status}`, `GitHub answered ${r.status}`);
    const j = (await r.json()) as { data?: { repository?: { object: { entries?: { name: string; type: string; object: { text: string | null; isTruncated: boolean } | null }[] } | null } | null }; errors?: unknown[] };
    if (j.errors?.length || !j.data?.repository) throw new StoreError("GITHUB_GRAPHQL", "the directory read failed");
    const out = new Map<string, Buffer>();
    for (const e of j.data.repository.object?.entries ?? []) {
      if (e.type !== "blob") continue;
      const k = keyOf(`${path}/${e.name}`);
      if (k === HEADS_FILE) continue;
      const b = e.object?.text != null && !e.object.isTruncated ? decode(k, Buffer.from(e.object.text, "utf8")) : await this.get(k);
      if (!b) continue;
      this.cache.set(k, b);
      out.set(k, b);
    }
    for (const [k, b] of this.writes) if (k.startsWith(dir) && !k.slice(dir.length).includes("/")) out.set(k, Buffer.from(b));
    return out;
  }

  /** Makes everything buffered durable in one commit, or nothing. */
  async commit(message: string): Promise<CommitResult> {
    if (!this.writes.size && !this.headsDirty) return { commit: null, files: 0, bytes: 0, calls: this.calls };
    try {
      const base = await this.baseRef();
      await this.dropExisting(base.commit);
      const tree = [...this.writes].map(([k, b]) => ({ path: pathOf(k), mode: "100644", type: "blob", content: encode(k, b).toString("utf8") }));
      if (this.headsDirty) tree.push({ path: HEADS_FILE, mode: "100644", type: "blob", content: JSON.stringify(Object.fromEntries([...(await this.loadHeads())].sort(([a], [b]) => a.localeCompare(b)))) });
      if (!tree.length) return { commit: null, files: 0, bytes: 0, calls: this.calls };
      const bytes = tree.reduce((n, e) => n + Buffer.byteLength(e.content, "utf8"), 0);
      const nt = await this.json<{ sha: string }>("POST", this.repo("/git/trees"), { base_tree: base.tree, tree });
      const c = await this.json<{ sha: string }>("POST", this.repo("/git/commits"), { message, tree: nt.sha, parents: [base.commit] });
      await this.json("PATCH", this.repo(`/git/refs/heads/${this.t.branch}`), { sha: c.sha, force: false });
      for (const [k, b] of this.writes) this.cache.set(k, b);
      this.writes.clear(); this.provisional.clear(); this.headsDirty = false; this.trees.clear();
      this.base = Promise.resolve({ commit: c.sha, tree: nt.sha });
      return { commit: c.sha, files: tree.length, bytes, calls: this.calls };
    } catch (e) {
      this.discard();
      if (e instanceof StoreError) throw e;
      throw new StoreError((e as Error)?.name === "TimeoutError" ? "GITHUB_TIMEOUT" : "GITHUB_UNREACHABLE", "GitHub could not be reached");
    }
  }

  /** Drops everything uncommitted; the next operation starts from the branch as it is then. */
  discard(): void {
    this.writes.clear(); this.provisional.clear(); this.headsDirty = false;
    this.heads = null; this.base = null; this.cache.clear(); this.trees.clear();
  }

  private async dropExisting(commit: string): Promise<void> {
    const keys = [...this.provisional];
    const [owner, name] = this.t.repo.split("/");
    for (let i = 0; i < keys.length; i += GRAPHQL_BATCH) {
      const chunk = keys.slice(i, i + GRAPHQL_BATCH);
      const fields = chunk.map((k, j) => `k${j}:object(expression:${JSON.stringify(`${commit}:${pathOf(k)}`)}){oid}`).join(" ");
      const r = await this.req("POST", "/graphql", { query: `query{repository(owner:${JSON.stringify(owner)},name:${JSON.stringify(name)}){${fields}}}` });
      if (!r.ok) throw new StoreError(`GITHUB_${r.status}`, `GitHub answered ${r.status}`);
      const j = (await r.json()) as { data?: { repository?: Record<string, { oid: string } | null> | null }; errors?: unknown[] };
      const found = j.data?.repository;
      if (j.errors?.length || !found) throw new StoreError("GITHUB_GRAPHQL", "the existence check failed");
      chunk.forEach((k, n) => {
        const hit = found[`k${n}`];
        if (!hit) return;
        if (hit.oid !== gitBlobSha(encode(k, this.writes.get(k)!))) throw new StoreError("IMMUTABLE_CONFLICT", `${k} already exists with different content`);
        this.writes.delete(k);
      });
    }
  }
}
