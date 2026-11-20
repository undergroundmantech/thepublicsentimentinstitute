/**
 * Signed session cookie for the private Weighting Desk, separate from the client portal so a portal login never opens
 * the desk. One owner account. The password is never in the repo: only a PBKDF2 hash of it is, and DESK_USER plus
 * DESK_PASS in the deployment's settings replace the built in account when set.
 *
 * The cookie carries only an expiry and an HMAC over it, keyed by a deployment secret (DESK_SECRET, or the portal's
 * PORTAL_SECRET or PORTAL_PASS), never by anything in the repo, so a cookie cannot be minted from the source.
 */
export const DESK_COOKIE = "op_desk";
const TTL_MS = 12 * 60 * 60 * 1000;
const enc = new TextEncoder();

const OWNER = { user: "lester", salt: "g6HYu4iMhdF_P_jkwziPPw", hash: "jZ7VXQfjpvKWJXUNYGY_7RIKYnv5uWcDf2-xM4-nG5o", it: 210000 };

const b64url = (bytes: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => { const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };

function secret(): string | null { return process.env.DESK_SECRET || process.env.PORTAL_SECRET || process.env.PORTAL_PASS || null; }
export const deskConfigured = () => !!secret();

async function sign(payload: string, key: string) {
  const k = await crypto.subtle.importKey("raw", enc.encode("op-desk:" + key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", k, enc.encode(payload)));
}
function safeEqual(a: string, b: string) {
  const x = enc.encode(a), y = enc.encode(b); let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}
async function pbkdf2(pass: string, salt: string, it: number) {
  const k = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveBits"]);
  return b64url(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromB64url(salt), iterations: it }, k, 256));
}

export async function deskCredentialsMatch(user: string, pass: string): Promise<boolean> {
  const eu = process.env.DESK_USER, ep = process.env.DESK_PASS;
  if (eu && ep) { const a = safeEqual(user, eu), b = safeEqual(pass, ep); return a && b; }
  // work the hash every time, so a wrong user costs the same as a wrong password
  const h = await pbkdf2(pass, OWNER.salt, OWNER.it);
  const a = safeEqual(user.trim().toLowerCase(), OWNER.user), b = safeEqual(h, OWNER.hash);
  return a && b;
}
export async function issueDeskSession(): Promise<string | null> {
  const key = secret(); if (!key) return null;
  const exp = String(Date.now() + TTL_MS); return `${exp}.${await sign(exp, key)}`;
}
export async function verifyDeskSession(token: string | undefined): Promise<boolean> {
  const key = secret(); if (!key || !token) return false;
  const dot = token.lastIndexOf("."); if (dot < 1) return false;
  const exp = token.slice(0, dot), sig = token.slice(dot + 1);
  if (!/^\d+$/.test(exp)) return false;
  if (!safeEqual(sig, await sign(exp, key))) return false;
  return Number(exp) > Date.now();
}
export function deskCookie(token: string) {
  return { name: DESK_COOKIE, value: token, httpOnly: true, sameSite: "strict" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: TTL_MS / 1000 };
}
