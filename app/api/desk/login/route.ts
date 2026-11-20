import { NextResponse, type NextRequest } from "next/server";
import { deskConfigured, deskCookie, deskCredentialsMatch, issueDeskSession } from "@/app/lib/deskSession";

export const runtime = "nodejs";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// a small, flat delay slows guessing without a real person noticing
export async function POST(req: NextRequest) {
  if (!deskConfigured()) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  let user = "", pass = "";
  try { const b = await req.json(); user = String(b?.user ?? "").slice(0, 200); pass = String(b?.pass ?? "").slice(0, 200); } catch { return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 }); }
  await sleep(600);
  if (!(await deskCredentialsMatch(user, pass))) return NextResponse.json({ ok: false, error: "invalid" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const token = await issueDeskSession();
  if (!token) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  res.cookies.set(deskCookie(token));
  return res;
}
