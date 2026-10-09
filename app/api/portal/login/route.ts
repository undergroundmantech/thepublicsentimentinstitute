import { NextResponse, type NextRequest } from "next/server";
import {
  PORTAL_COOKIE,
  credentialsMatch,
  issueSession,
  sessionCookie,
} from "@/app/lib/portalSession";

export const runtime = "nodejs";

/** Slows down credential stuffing without being noticeable to a real person. */
const DELAY_MS = 400;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: NextRequest) {
  if (!process.env.PORTAL_USER || !process.env.PORTAL_PASS) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  let user = "";
  let pass = "";
  try {
    const body = await req.json();
    user = String(body?.user ?? "");
    pass = String(body?.pass ?? "");
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  await sleep(DELAY_MS);

  if (!credentialsMatch(user, pass)) {
    // One message for both failure modes: never confirm that a username exists.
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 401 });
  }

  const token = await issueSession();
  if (!token) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  res.cookies.set(sessionCookie(token));
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  res.cookies.set({ name: PORTAL_COOKIE, value: "", path: "/", maxAge: 0 });
  return res;
}
