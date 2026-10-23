"use client";
// The race desk in brief, on the globe: everything the race page shows at a glance, the counted vote by candidate,
// the share reporting, the live win probability, the projected final margin and how many counties are in, with
// a button to the full desk. It reads the same returns and the same projection as the race page.
import React, { useEffect, useState } from "react";
import { STN, KIND_LABEL, civicRace, expSides, fmtM, isInd, liveOdds, project, sides, type CDetail, type CRace, type StFile, type XRace } from "../2026/live";

const last = (n: string) => n.split(" ").filter((w) => !/^(jr\.?|sr\.?|ii|iii|iv)$/i.test(w)).pop() ?? n;

export default function RaceBrief({ r, c, sf, at, onOpen, onClose }: { r: XRace; c?: CRace; sf: StFile | null; at: Date | null; onOpen: () => void; onClose: () => void }) {
  const [det, setDet] = useState<CDetail | null>(null);
  const reporting = !!c && (c.pr > 0 || c.c.some((x) => x[2] > 0));
  useEffect(() => {
    setDet(null); if (!c || !reporting) return; let dead = false;
    civicRace(c.id).then((d) => { if (!dead) setDet(d); }).catch(() => {});
    return () => { dead = true; };
  }, [c, reporting, at]);
  const exp = sf?.counties[r.id] ?? null;
  const P = project(exp, det?.regions ?? null, r, c?.c ?? null, r.tot);
  const odds = liveOdds(r, P);
  const ind = isInd(r), isM = r.k === "measure";
  const A = isM ? "Yes" : ind ? (r.c?.[0]?.[0] ?? "Independent") : (r.c?.find((x) => x[1] === "D")?.[0] ?? "Democrat");
  const B = isM ? "No" : (r.c?.find((x) => x[1] === "R")?.[0] ?? "Republican");
  const colA = isM ? "#2fbf9b" : ind ? "var(--ind)" : "var(--dem)", colB = isM ? "#e7794a" : "var(--gop)";
  const winner = c?.c.find((x) => x[4]);
  const leadA = odds.pA >= 0.5; const leadP = 100 * (leadA ? odds.pA : odds.pB);
  const projected = !winner && P.rep.t > 0 && P.pctIn >= 50 && leadP >= 99.5;
  const status = !c ? "Not linked to civicAPI" : winner ? `civicAPI call: ${winner[0]}` : projected ? `Projected: ${last(leadA ? A : B)}` : reporting ? "Counting" : "No returns yet";
  const es = expSides(r);
  // candidates: counted where there are returns, else expected
  const rows: { n: string; p: string; v: number; s: number; w?: boolean }[] = reporting
    ? (() => { const t = c!.c.reduce((s, x) => s + x[2], 0) || 1; return [...c!.c].sort((a, b) => b[2] - a[2]).slice(0, 5).map((x) => ({ n: x[0], p: (x[1] || "O")[0].toUpperCase(), v: x[2], s: (100 * x[2]) / t, w: !!x[4] })); })()
    : (() => { const t = (r.c ?? []).reduce((s, x) => s + x[2], 0) || 1; return (r.c ?? []).slice(0, 5).map((x) => ({ n: x[0], p: x[1], v: x[2], s: (100 * x[2]) / t })); })();
  const pc = (p: string) => (p === "D" ? "var(--dem)" : p === "R" ? "var(--gop)" : p === "I" ? "var(--ind)" : p === "Y" ? "#2fbf9b" : p === "N" ? "#e7794a" : "#8a84a3");
  const counted = reporting ? sides(r, c!.c).t : 0;
  return (
    <section className="mon-brief" aria-label={`${r.nm} at a glance`}>
      <div className="bh">
        <div><span className="k">{KIND_LABEL[r.k]} · {STN[r.st] ?? r.st}</span><h3>{r.nm}</h3></div>
        <button className="x" onClick={onClose} aria-label="Close this race">×</button>
      </div>
      <div className={`st ${winner ? "called" : projected ? "proj" : reporting ? "live" : ""}`}>{status}</div>
      <div className="nums">
        <div><b>{reporting ? `${P.pctIn.toFixed(0)}%` : "0%"}</b><span>estimated in</span></div>
        <div><b>{c ? `${c.pr.toFixed(0)}%` : "n/a"}</b><span>civicAPI reporting</span></div>
        <div><b>{counted ? counted.toLocaleString("en-US") : "0"}</b><span>votes counted{es.t ? ` of about ${Math.round(es.t).toLocaleString("en-US")}` : ""}</span></div>
      </div>
      <table className="cands">
        <thead><tr><th>{reporting ? "Reported" : "Expected"}</th><th>Votes</th><th>Share</th></tr></thead>
        <tbody>{rows.map((x) => (
          <tr key={x.n}><td><i style={{ background: pc(x.p) }} />{x.n}{x.w ? <em>Winner</em> : null}<span className="bar"><u style={{ width: `${x.s}%`, background: pc(x.p) }} /></span></td><td>{Math.round(x.v).toLocaleString("en-US")}</td><td>{x.s.toFixed(1)}%</td></tr>
        ))}</tbody>
      </table>
      <div className="odds">
        <div className="oh"><span>{reporting ? "Win probability now" : "Forecast win probability"}</span><span>{last(A)} {(100 * odds.pA).toFixed(odds.pA > 0.995 || odds.pA < 0.005 ? 0 : 1)}% · {last(B)} {(100 * odds.pB).toFixed(odds.pB > 0.995 || odds.pB < 0.005 ? 0 : 1)}%</span></div>
        <div className="ob"><i style={{ width: `${100 * odds.pA}%`, background: colA }} /><i style={{ width: `${100 * odds.pB}%`, background: colB }} /></div>
      </div>
      <div className="proj">
        <div><span>{reporting ? "Projected final margin" : "Forecast margin"}</span><b style={{ color: P.m < 0 ? colA : colB }}>{fmtM(reporting ? P.m : P.expM, r.k, ind)}</b></div>
        <div><span>95% range</span><b>{fmtM(odds.lo, r.k, ind)} to {fmtM(odds.hi, r.k, ind)}</b></div>
        <div><span>Counties in</span><b>{P.counties ? `${P.countiesIn} of ${P.counties}` : "n/a"}</b></div>
      </div>
      <button className="open" onClick={onOpen}>Open the full results desk</button>
    </section>
  );
}
