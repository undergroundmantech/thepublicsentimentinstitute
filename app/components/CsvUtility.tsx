"use client";
// Emergency CSV download: a compact utility strip above the footer on every Results and Forecast page. It is the last
// manual archival fallback; the server and GitHub recorders are the real archive. The export is built on click from the
// public endpoints the pages already use (see app/lib/csv/buildExport.ts).
import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import "./csvUtility.css";

type S = { s: "idle" } | { s: "busy" } | { s: "done"; name: string; at: string; notes: string[] } | { s: "error" };

export default function CsvUtility() {
  const path = usePathname() ?? "";
  const [st, setSt] = useState<S>({ s: "idle" });
  const busy = useRef(false);
  if (!/^\/(results|forecast)(\/|$)/.test(path)) return null;
  const scope = /^\/results\/2026\/[^/]+/.test(path) || /^\/forecast\/[^/]+/.test(path) ? "this page" : "the national snapshot";
  const go = async () => {
    if (busy.current) return; busy.current = true; setSt({ s: "busy" });
    try {
      const { buildExport } = await import("@/app/lib/csv/buildExport");
      const out = await buildExport(window.location.pathname);
      const url = URL.createObjectURL(new Blob(["﻿", out.csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = out.filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setSt({ s: "done", name: out.filename, at: new Date().toISOString(), notes: out.notes.slice(1) });
    } catch { setSt({ s: "error" }); } finally { busy.current = false; }
  };
  return (
    <aside className="csvu" aria-label="Emergency data export">
      <div className="csvu-in">
        <div className="csvu-copy"><b>Emergency archive</b><span>Manual fallback. Raw reported votes, model projections and the forecast are kept apart in the file; blanks mean not available.</span></div>
        <button type="button" className="csvu-btn" onClick={go} disabled={st.s === "busy"} aria-describedby="csvu-status">{st.s === "busy" ? "Building CSV…" : `Download CSV · ${scope}`}</button>
      </div>
      <p id="csvu-status" className="csvu-st" role="status" aria-live="polite">
        {st.s === "done" ? <>Saved <code>{st.name}</code> at {st.at}.{st.notes.length ? ` ${st.notes.join(" ")}` : ""}</> : st.s === "error" ? "The export could not be built. Try again; if it keeps failing, use the server recorders." : ""}
      </p>
    </aside>
  );
}
