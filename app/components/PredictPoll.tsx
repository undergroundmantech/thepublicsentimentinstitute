"use client";
// Call the next On Point poll: three toplines, a name for the board, and the crowd's average once you're in.
import { useEffect, useState } from "react";
import { currentContest, isOpen } from "@/app/lib/community/contests";
import { ev } from "@/app/lib/ev";
import "./community.css";

type Board = { rows: { name: string; miss: number; v: Record<string, number> }[]; n: number };
export default function PredictPoll() {
  const c = currentContest(); const open = isOpen(c);
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(c.fields.map((f) => [f.k, ""])));
  const [name, setName] = useState(""); const [n, setN] = useState(0); const [crowd, setCrowd] = useState<Record<string, number>>({});
  const [mine, setMine] = useState<{ name: string; v: Record<string, number> } | null>(null); const [board, setBoard] = useState<Board | null>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [edit, setEdit] = useState(false);
  useEffect(() => { fetch(`/api/community/predict?id=${c.id}`).then((r) => r.json()).then((j) => { if (!j.ok) return; setN(j.n); setCrowd(j.crowd); setBoard(j.board); if (j.mine) { setMine(j.mine); setName(j.mine.name); setVals(Object.fromEntries(Object.entries(j.mine.v).map(([k, v]) => [k, String(v)]))); } }).catch(() => {}); }, [c.id]);
  const go = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try { const j = await (await fetch("/api/community/predict", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id, name, v: Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, Number(v)])) }) })).json();
      if (j.ok) { setMine(j.mine); setN(j.n); setCrowd(j.crowd); setEdit(false); ev("Prediction entered", { contest: c.id }); } else setErr(j.error); } catch { setErr("That didn't go through. Try again."); } finally { setBusy(false); }
  };
  const fmt = (k: string, x: number) => { const f = c.fields.find((q) => q.k === k)!; return f.unit === "%" ? `${x.toFixed(1)}%` : `${x >= 0 ? "D +" : "R +"}${Math.abs(x).toFixed(1)}`; };
  return (
    <section className="cm-card" aria-labelledby="pp-h">
      <span className="eye g">Contest · {open ? `entries close ${new Date(c.closes).toLocaleDateString("en-US", { month: "long", day: "numeric" })}` : c.actual ? "results are in" : "entries closed"}</span>
      <h2 id="pp-h" style={{ fontSize: 21 }}>{c.title}</h2>
      <p className="cm-mute">{c.about}</p>
      {board ? (
        <div style={{ overflowX: "auto" }}><table className="cm-lb"><thead><tr><th>#</th><th>Name</th>{c.fields.map((f) => <th key={f.k} className="n">{f.label}</th>)}<th className="n">Total miss</th></tr></thead>
          <tbody><tr><td /><td><b>The poll</b></td>{c.fields.map((f) => <td key={f.k} className="n"><b>{fmt(f.k, c.actual![f.k])}</b></td>)}<td /></tr>
            {board.rows.slice(0, 25).map((r, i) => <tr key={i}><td>{i + 1}</td><td>{r.name}</td>{c.fields.map((f) => <td key={f.k} className="n">{fmt(f.k, r.v[f.k])}</td>)}<td className="n">{r.miss.toFixed(1)}</td></tr>)}</tbody></table>
          <p className="cm-mute">{board.n.toLocaleString()} entries. {c.resultUrl ? <a href={c.resultUrl}>Read the poll</a> : null}</p></div>
      ) : mine && !edit ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div className="cm-grid" style={{ gridTemplateColumns: `repeat(${c.fields.length}, minmax(0, 1fr))` }}>
            {c.fields.map((f) => <div key={f.k} className="hire-s" style={{ display: "block" }}><div><dt>{f.label}</dt><dd>{fmt(f.k, mine.v[f.k])}</dd><span className="cm-mute">Crowd {crowd[f.k] != null ? fmt(f.k, crowd[f.k]) : "…"}</span></div></div>)}
          </div>
          <p className="cm-mute">You're in as <b>{mine.name}</b>, one of {n.toLocaleString()} entries. The board goes up the day the poll is released.</p>
          {open ? <button type="button" className="btn" onClick={() => setEdit(true)} style={{ justifySelf: "start" }}>Change my guesses</button> : null}
        </div>
      ) : open ? (
        <form onSubmit={go} style={{ display: "grid", gap: 10 }}>
          {c.fields.map((f) => (
            <label key={f.k} htmlFor={`pp-${f.k}`} className="cm-row" style={{ justifyContent: "space-between" }}>
              <span><b>{f.label}</b><br /><span className="cm-mute">{f.hint}</span></span>
              <span className="cm-row"><input id={`pp-${f.k}`} className="cm-in" type="number" inputMode="decimal" step={f.step} min={f.min} max={f.max} required value={vals[f.k]} onChange={(e) => setVals({ ...vals, [f.k]: e.target.value })} style={{ width: 110 }} />{f.unit}</span>
            </label>))}
          <div className="cm-row"><label htmlFor="pp-name" className="oc-sr">Name for the leaderboard</label><input id="pp-name" className="cm-in" placeholder="Name for the leaderboard" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} style={{ flex: "1 1 200px" }} /><button className="btn g" type="submit" disabled={busy}>{busy ? "Saving" : mine ? "Update my entry" : "Lock in my call"}</button></div>
          {err ? <p className="oc-err" role="alert">{err}</p> : null}
          <p className="cm-mute">{n ? `${n.toLocaleString()} entries so far. ` : ""}Free to enter. One entry per reader; you can change it until entries close.</p>
        </form>
      ) : <p className="cm-mute">Entries are closed. The board goes up the day the poll is released.</p>}
    </section>
  );
}
