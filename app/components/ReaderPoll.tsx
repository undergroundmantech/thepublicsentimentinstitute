"use client";
// This week's reader poll: one tap to vote, then the readers' split. Not a scientific poll, and it says so.
import { useEffect, useState } from "react";
import { currentPoll } from "@/app/lib/community/contests";
import { ev } from "@/app/lib/ev";
import "./community.css";

export default function ReaderPoll() {
  const p = currentPoll();
  const [t, setT] = useState<{ n: number; c: Record<string, number> } | null>(null); const [mine, setMine] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  useEffect(() => { fetch(`/api/community/poll?week=${p.week}`).then((r) => r.json()).then((j) => { if (j.ok) { setT(j.tally); setMine(j.mine); } }).catch(() => {}); }, [p.week]);
  const vote = async (k: string) => {
    if (mine || busy) return; setBusy(true); setErr("");
    try { const j = await (await fetch("/api/community/poll", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ week: p.week, k }) })).json();
      if (j.ok) { setT(j.tally); setMine(j.mine); ev("Reader poll vote", { week: p.week }); } else setErr(j.error); } catch { setErr("That didn't go through. Try again."); } finally { setBusy(false); }
  };
  const n = t?.n ?? 0;
  return (
    <section className="cm-card" aria-labelledby="rp-h">
      <span className="eye g">Reader poll · week of {new Date(p.week + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric" })}</span>
      <h2 id="rp-h" style={{ fontSize: 21 }}>{p.q}</h2>
      {p.note ? <p className="cm-mute">{p.note}</p> : null}
      <div style={{ display: "grid", gap: 8 }}>
        {p.options.map((o) => { const c = t?.c[o.k] ?? 0; const pct = n ? (c / n) * 100 : 0; return (
          <button key={o.k} type="button" className={`cm-opt${mine === o.k ? " mine" : ""}`} disabled={!!mine || busy} onClick={() => vote(o.k)} aria-pressed={mine === o.k}>
            {mine ? <i className="bar" style={{ width: `${pct}%` }} /> : null}
            <span>{o.label}{mine === o.k ? " · your pick" : ""}</span><span className="pct">{mine ? `${pct.toFixed(0)}%` : ""}</span>
          </button>); })}
      </div>
      {err ? <p className="oc-err" role="alert">{err}</p> : null}
      <p className="cm-mute">{mine ? `${n.toLocaleString()} readers have voted. ` : "Tap an answer to vote and see the split. "}A reader poll, not a scientific one: anyone can take it, so it measures our readers, not voters.</p>
    </section>
  );
}
