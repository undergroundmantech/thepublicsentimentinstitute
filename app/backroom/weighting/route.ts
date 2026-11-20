import { NextResponse, type NextRequest } from "next/server";
import { DESK_COOKIE, verifyDeskSession } from "@/app/lib/deskSession";
import HTML from "./desk";

// The Weighting Dashboard, served only to a signed in owner. The page is the whole application in one document; it runs in
// the browser, so a poll file never leaves the machine it was opened on.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  if (!(await verifyDeskSession(req.cookies.get(DESK_COOKIE)?.value))) return NextResponse.redirect(new URL("/backroom", req.url), { headers: { "Cache-Control": "no-store" } });
  return new NextResponse(HTML, { headers: {
    "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive",
    "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff",
  } });
}
