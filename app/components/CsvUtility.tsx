"use client";
// TRANSPARENCY MONITOR: the emergency CSV download, as one compact button beside the time readouts (the header's "Forecast
// updated" strip and the Situation Monitor clock). It is the last manual archival fallback; the server and GitHub recorders are
// the real archive. The file is built on click from the public endpoints the pages already use (app/lib/csv/buildExport.ts).
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import "./csvUtility.css";

/** Pages that carry the button: the November 3 results and forecast pages, not the dated archive boards. */
export const csvPageIn = (path: string) => path === "/results" || /^\/results\/(2026|monitor|tonight)(\/|$)/.test(path) || /^\/forecast(\/|$)/.test(path);

type S = "idle" | "busy" | "done" | "error";

export default function TransparencyButton({ className = "" }: { className?: string }) {
  const path = usePathname() ?? "";
  const [st, setSt] = useState<S>("idle");
  const [msg, setMsg] = useState("");
  const busy = useRef(false), t = useRef<number | null>(null);
  useEffect(() => () => { if (t.current) window.clearTimeout(t.current); }, []);
  if (!csvPageIn(path)) return null;
  const settle = (s: S, m: string) => { setSt(s); setMsg(m); if (t.current) window.clearTimeout(t.current); t.current = window.setTimeout(() => { setSt("idle"); setMsg(""); }, 6000); };
  const go = async () => {
    if (busy.current) return; busy.current = true; setSt("busy"); setMsg("Building the CSV");
    try {
      const { buildExport } = await import("@/app/lib/csv/buildExport");
      const out = await buildExport(window.location.pathname);
      const url = URL.createObjectURL(new Blob(["﻿", out.csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = out.filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      settle("done", `Saved ${out.filename}. ${out.notes.slice(1).join(" ")}`);
    } catch { settle("error", "The export could not be built. Try again; if it keeps failing, use the server recorders."); }
    finally { busy.current = false; }
  };
  return (
    <span className={`tmon ${className}`}>
      <button type="button" className={`tmon-btn s-${st}`} onClick={go} disabled={st === "busy"}
        aria-label="Transparency Monitor: download this page's data as a CSV" title="Download a CSV of this page's data (reported votes, model projections and forecast, kept apart)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11" /><path d="m7 11 5 5 5-5" /><path d="M5 20h14" /></svg>
        <span>{st === "busy" ? "Building…" : st === "done" ? "Saved" : st === "error" ? "Retry" : "Transparency Monitor"}</span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">{msg}</span>
    </span>
  );
}
