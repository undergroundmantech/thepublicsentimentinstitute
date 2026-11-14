"use client";
// The recorded replay pack under /replay/2026 (written by scripts/engine/export_static_replay.ts): compressed static
// files read straight from the site, so the replay works with no database and no server switch. Only recorded
// (HISTORICAL) nights are ever exported there. NEXT_PUBLIC_ONPOINT_STATIC_REPLAY=off hides it.
import type { SourceInfo } from "@/app/lib/engine/serve";

export const STATIC_REPLAY_ON = process.env.NEXT_PUBLIC_ONPOINT_STATIC_REPLAY !== "off";
const ROOT = "/replay/2026";

/** A .json.gz file, decompressed here unless the host already did (a host may serve .gz with Content-Encoding). */
export async function getGz<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url); if (!r.ok) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
      if (typeof DecompressionStream === "undefined") return null;
      const text = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
      return JSON.parse(text) as T;
    }
    return JSON.parse(new TextDecoder().decode(buf)) as T;
  } catch { return null; }
}

export async function staticSources(): Promise<SourceInfo[]> {
  // the pack is gzip read in the browser; a browser that cannot do that is not offered the replay
  if (!STATIC_REPLAY_ON || typeof DecompressionStream === "undefined") return [];
  try {
    const r = await fetch(`${ROOT}/index.json`); if (!r.ok) return [];
    const j = (await r.json()) as { sources?: SourceInfo[] };
    // a recorded night only: anything else in the file is ignored
    return (j.sources ?? []).filter((s) => s.mode === "HISTORICAL" && s.ns === "historical" && typeof s.base === "string" && s.base.startsWith(`${ROOT}/`) && s.times?.length);
  } catch { return []; }
}
