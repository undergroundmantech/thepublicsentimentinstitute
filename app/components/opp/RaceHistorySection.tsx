"use client";
// Loads race history only when the section nears the viewport, so the static race page is not slowed by the chart or its data.
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { PreparedHistory } from "@/app/lib/intelligence/raceHistory";

const RaceHistory = dynamic(() => import("./RaceHistory"), { ssr: false, loading: () => null });

type State = { s: "idle" } | { s: "ready"; history: PreparedHistory; nowMs: number } | { s: "error" };

export default function RaceHistorySection({ raceId, title }: { raceId: string; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [st, setSt] = useState<State>({ s: "idle" });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let live = true;
    const load = () =>
      fetch(`/api/race-history/${encodeURIComponent(raceId)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((j: { history: PreparedHistory; nowMs: number }) => { if (live) setSt({ s: "ready", history: j.history, nowMs: j.nowMs }); })
        .catch(() => { if (live) setSt({ s: "error" }); });
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); load(); } }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => { live = false; io.disconnect(); };
  }, [raceId]);

  return (
    <div ref={ref} style={{ minHeight: st.s === "ready" ? undefined : 420 }}>
      {st.s === "ready" ? <RaceHistory history={st.history} title={title} nowMs={st.nowMs} /> : (
        <p role="status" style={{ font: "500 13px/1.5 var(--font-m, monospace)", color: "var(--mute)", padding: "24px 0" }}>
          {st.s === "error" ? "Race history is unavailable right now. The rest of this page is unaffected." : "Loading race history\u2026"}
        </p>
      )}
    </div>
  );
}
