"use client";
// Polls the live Brazil returns every 30 seconds while the tab is open. Adding ?simular=1 to any Brazil page plays a
// labelled simulation of election night from the model's own expectations instead, so the pages can be previewed.
import { useEffect, useState } from "react";
import type { Live, Exp } from "./project";

export function useSim() {
  const [sim, setSim] = useState<boolean | null>(null);
  useEffect(() => { try { setSim(new URLSearchParams(location.search).has("simular")); } catch { setSim(false); } }, []);
  return sim;
}

export function useBrLive(every = 30000) {
  const sim = useSim();
  const [live, setLive] = useState<Live | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let dead = false, timer: ReturnType<typeof setTimeout> | undefined;
    if (sim === null) return;
    if (sim) {
      let prog = 0.04, exp: Exp | null = null;
      const step = async () => {
        if (!exp) exp = (await import("./exp.json")).default as unknown as Exp;
        const { simulate } = await import("./project");
        if (dead) return;
        setLive(simulate(exp, prog)); prog = Math.min(1, prog + 0.035);
        if (prog < 1) timer = setTimeout(step, 2600);
      };
      step();
      return () => { dead = true; clearTimeout(timer); };
    }
    const load = async () => {
      if (document.visibilityState === "hidden") { timer = setTimeout(load, every); return; }
      try {
        const r = await fetch("/api/brasil/live", { cache: "no-store" });
        if (!r.ok) throw new Error();
        const j = (await r.json()) as Live;
        if (!dead) { setLive(j); setErr(false); }
      } catch { if (!dead) setErr(true); }
      if (!dead) timer = setTimeout(load, every);
    };
    load();
    return () => { dead = true; clearTimeout(timer); };
  }, [sim, every]);
  return { live, err, sim: !!sim };
}

export function useCountdown(iso: string) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (now == null) return null;
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return { done: true, h: 0, m: 0, s: 0, d: 0 };
  const s = Math.floor(ms / 1000);
  return { done: false, d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
