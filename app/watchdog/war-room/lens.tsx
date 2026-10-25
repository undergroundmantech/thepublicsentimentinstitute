"use client";
// "Brief me as": the War Room's point of view. Neutral, the Democratic operative or the Republican operative.
// The choice follows the reader from the board to every race page, kept in this browser only.
import React, { useCallback, useEffect, useState } from "react";
import { ev } from "@/app/lib/ev";

export type Lens = "N" | "D" | "R";
const KEY = "opp_wr_side";

export function useLens(fallback: Lens = "N"): [Lens, (s: Lens) => void] {
  const [side, setSide] = useState<Lens>(fallback);
  useEffect(() => {
    try { const v = localStorage.getItem(KEY); if (v === "D" || v === "R" || v === "N") setSide(v); } catch { /* storage blocked */ }
  }, []);
  const set = useCallback((s: Lens) => {
    setSide(s);
    try { localStorage.setItem(KEY, s); } catch { /* storage blocked */ }
    ev("War Room lens", { side: s });
  }, []);
  return [side, set];
}

export function LensToggle({ side, set, neutral = true }: { side: Lens; set: (s: Lens) => void; neutral?: boolean }) {
  const opts: [Lens, string][] = [...(neutral ? [["N", "Neutral"] as [Lens, string]] : []), ["D", "Democratic operative"], ["R", "Republican operative"]];
  return (
    <div className="wr-lens" role="group" aria-label="Brief me as">
      <span className="k">Brief me as</span>
      {opts.map(([k, l]) => (
        <button key={k} type="button" className={`${k.toLowerCase()}${side === k ? " on" : ""}`} aria-pressed={side === k} onClick={() => set(k)}>{l}</button>
      ))}
    </div>
  );
}
