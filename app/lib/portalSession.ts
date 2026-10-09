/**
 * Signed session cookie for the internal portal.
 *
 * Basic auth was the first cut and it forced the browser's own credential
 * dialog, which we cannot style, cannot brand, and which pops over whatever
 * page triggered it. This replaces it with an ordinary login form backed by an
 * HMAC-signed cookie.
 *
 * The cookie carries only an expiry and a signature over it — no username, no
 * password, nothing an attacker could lift and reuse elsewhere. It is signed,
 * not encrypted, because there is nothing secret in the payload; the signature
 * is what stops someone minting their own.
 *
 * Web Crypto is used throughout so this runs unchanged in Edge middleware and
 * in a route handler.
 */

export const PORTAL_COOKIE = "tpsi_portal";
const TTL_MS = 12 * 60 * 60 * 1000;

const enc = new TextEncoder();

const b64url = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/** Prefer a dedicated secret; fall back to the password so setup stays one step. */
function secret(): string | null {
  return process.env.PORTAL_SECRET || process.env.PORTAL_PASS || null;
}

async function sign(payload: string, key: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    "raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return b64url(await crypto.subtle.sign("HMAC", k, enc.encode(payload)));
}

/** Constant-time compare. Length may leak; content may not. */
function safeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export async function issueSession(): Promise<string | null> {
  const key = secret();
  if (!key) return null;
  const exp = String(Date.now() + TTL_MS);
  return `${exp}.${await sign(exp, key)}`;
}

export async function verifySession(token: string | undefined): Promise<boolean> {
  const key = secret();
  if (!key || !token) return false;

  const dot = token.lastIndexOf(".");
  if (dot < 1) return false;

  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^\d+$/.test(exp)) return false;

  // Check the signature before trusting the expiry it covers.
  if (!safeEqual(sig, await sign(exp, key))) return false;
  return Number(exp) > Date.now();
}

export function credentialsMatch(user: string, pass: string): boolean {
  const u = process.env.PORTAL_USER;
  const p = process.env.PORTAL_PASS;
  if (!u || !p) return false;
  // Evaluate both halves every time so a wrong user costs the same as a wrong
  // password.
  const okUser = safeEqual(user, u);
  const okPass = safeEqual(pass, p);
  return okUser && okPass;
}

export function sessionCookie(token: string) {
  return {
    name: PORTAL_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MS / 1000,
  };
}
