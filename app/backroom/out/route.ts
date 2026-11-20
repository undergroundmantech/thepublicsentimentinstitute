import { NextResponse, type NextRequest } from "next/server";
import { DESK_COOKIE } from "@/app/lib/deskSession";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/", req.url), { headers: { "Cache-Control": "no-store" } });
  res.cookies.set({ name: DESK_COOKIE, value: "", path: "/", maxAge: 0 });
  return res;
}
