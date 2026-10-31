// /api/brasil/live: the Brazil 2026 runoff is over and its pages are an archive, so this route no longer calls civicAPI.
// It answers with the archived count (public/brasil/archive/results.json, built from the saved provider records by
// scripts/brasil/archive-results.ts), prerendered at build. The Brazil pages read that file directly.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-static";

export function GET() {
  const archived = JSON.parse(readFileSync(join(process.cwd(), "public/brasil/archive/results.json"), "utf8"));
  return NextResponse.json(archived, { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } });
}
