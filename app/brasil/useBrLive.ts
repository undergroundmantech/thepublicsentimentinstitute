"use client";
// The Brazil runoff is over: the results pages load the archived count once (the provider's last update, saved with
// its source and dates, see scripts/brasil/archive-results.ts) and never poll. Adding ?simular=1 to any Brazil page
// still plays the labelled simulation of election night from the model's own expectations.
import { useEffect, useState } from "react";
import type { Live, Exp } from "./project";

export const ARCHIVE_URL = "/brasil/archive/results.json";

export function useSim() {
  const [sim, setSim] = useState<boolean | null>(null);
  useEffect(() => { try { setSim(new URLSearchParams(location.search).has("simular")); } catch { setSim(false); } }, []);
  return sim;
}

export function useBrLive() {
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
    (async () => {
      try {
        const r = await fetch(ARCHIVE_URL);
        if (!r.ok) throw new Error();
        const j = (await r.json()) as Live;
        if (!dead) { setLive(j); setErr(false); }
      } catch { if (!dead) setErr(true); }
    })();
    return () => { dead = true; };
  }, [sim]);
  return { live, err, sim: !!sim };
}
