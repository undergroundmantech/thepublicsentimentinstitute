// The sources this environment may serve: live, and recorded archives for replay. Simulated archives appear only
// where gate.ts allows them (operator switch AND not production).
import { NextResponse } from "next/server";
import { sources } from "@/app/lib/engine/serve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await sources(), { headers: { "cache-control": "private, max-age=30" } });
}
