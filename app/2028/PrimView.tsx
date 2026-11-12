"use client";
// Both 2028 primaries: the nomination odds from the calendar simulation, and each state's typical race spread over its
// counties, so a state on the map is exactly the sum of its counties.
import { useEffect, useMemo, useState } from "react";
import Map28 from "./Map28";
import { useJSON } from "./useX";
import { X, STATE_NAME, FIPS_ST, fmtN, fmtK, fmtPct, fmtSh, leaderColor, type PrimFile, type PrimField, type CountiesGeo } from "./lib";

export type PrimSummary = Record<"dem" | "dem_noharris" | "gop" | "gop_novance", { names: string[]; colors: string[]; nomination: number[] }>;
type FK = keyof PrimSummary;
const WIN = ["Early window", "Super Tuesday window", "Third window", "Final window"];

export default function PrimView({ sum, initial = "D", compact = false }: { sum: PrimSummary; initial?: "D" | "R"; compact?: boolean }) {
  const [party, setParty] = useState<"D" | "R">(initial);
  const [harris, setHarris] = useState(true);
  const [vance, setVance] = useState(true);
  const [view, setView] = useState<"states" | "counties">("states");
  const [focus, setFocus] = useState<string | null>(null);
  // /2028/primaries?st=NH&party=R opens New Hampshire's Republican counties
  useEffect(() => { const id = setTimeout(() => { try { const q = new URLSearchParams(window.location.search); const s = q.get("st"); if (q.get("party") === "R") setParty("R"); if (s && STATE_NAME[s.toUpperCase()]) setFocus(s.toUpperCase()); } catch { /* no query */ } }, 0); return () => clearTimeout(id); }, []);
  const fk: FK = party === "D" ? (harris ? "dem" : "dem_noharris") : (vance ? "gop" : "gop_novance");
  const P = useJSON<PrimFile>(`${X}/prim.json`);
  const cg = useJSON<CountiesGeo>(view === "counties" || focus ? `${X}/counties.json` : null);
  const F: PrimField | null = P ? P[fk] : null;
  const S = sum[fk];
  const col = (j: number) => (F ?? S).colors[j] ?? "#8f8a99";
  const stLead = (st: string) => { const s = F?.states[st]; if (!s) return null; let b = 0; s.votes.forEach((v, j) => { if (v > s.votes[b]) b = j; }); return { j: b, sh: s.votes[b] / s.total }; };
  const cLead = (f: string) => { const c = F?.counties[f]; if (!c || c.length < 2) return null; const [j, v] = c[1] as [number, number]; const tot = (c as unknown[]).slice(1).reduce((a: number, x) => a + (x as [number, number])[1], 0) + (c[0] as number); return { j, sh: v / tot }; };
  const nCty = useMemo(() => { const n: Record<string, number> = {}; if (F) for (const f of Object.keys(F.counties)) { const st = FIPS_ST[f.slice(0, 2)]; n[st] = (n[st] ?? 0) + 1; } return n; }, [F]);
  const stateFill = (st: string) => { const l = stLead(st); return l ? leaderColor(col(l.j), l.sh) : "rgba(var(--line-rgb),.08)"; };
  const countyFill = (f: string) => { const l = cLead(f); return l ? leaderColor(col(l.j), l.sh) : "rgba(var(--line-rgb),.08)"; };
  const rows = (pairs: [number, number][], tot: number, win?: number[]) => (
    <>
      {pairs.map(([j, v]) => (
        <div className={win ? "x28-trow w5" : "x28-trow"} key={j}><i style={{ background: col(j) }} /><span className="nm">{F!.names[j]}</span><span className="v">{fmtN(v)}</span><span className="p">{fmtSh(v / tot)}</span>
          {win ? <span className="w">{fmtPct(win[j])}</span> : <span className="bar"><b style={{ width: `${(100 * v) / tot}%`, background: col(j) }} /></span>}</div>
      ))}
    </>
  );
  const stateTip = (st: string) => {
    const s = F?.states[st]; if (!s) return <div className="x28-tiph"><b>{STATE_NAME[st]}</b><span>Loading</span></div>;
    const pairs = s.votes.map((v, j) => [j, v] as [number, number]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return (
      <>
        <div className="x28-tiph"><b>{STATE_NAME[st]}</b><span>{s.window ? WIN[s.window - 1] : ""}</span></div>
        <div className="x28-trow hd"><i /><span className="nm">Candidate</span><span className="v">Votes</span><span className="p">Share</span><span className="w">Wins</span></div>
        {rows(pairs, s.total, s.win)}
        <div className="x28-trow o"><i /><span className="nm">Everyone else</span><span className="v">{fmtN(s.total - pairs.reduce((a, x) => a + x[1], 0))}</span><span className="p">{fmtSh(1 - pairs.reduce((a, x) => a + x[1], 0) / s.total)}</span></div>
        <div className="x28-tipf">Votes added up from {nCty[st] ?? 0} {st === "AK" ? "borough" : "county"} forecasts · {fmtN(s.total)} primary votes · the race as it typically stands when {STATE_NAME[st]} votes, from {P?.sims.primary.toLocaleString("en-US")} calendar simulations{s.proxy ? ` · county pattern borrowed from ${s.proxy.join(", ")}` : ""}</div>
        {!focus && <div className="x28-tipc">Click to open its counties</div>}
      </>
    );
  };
  const countyTip = (f: string, st: string, name: string) => {
    const c = F?.counties[f]; if (!c) return <div className="x28-tiph"><b>{name}</b><span>{STATE_NAME[st]}</span></div>;
    const pairs = (c.slice(1) as [number, number][]).slice(0, 4); const tot = (c.slice(1) as [number, number][]).reduce((a, x) => a + x[1], 0) + (c[0] as number);
    return (
      <>
        <div className="x28-tiph"><b>{name}</b><span>{STATE_NAME[st]}</span></div>
        {rows(pairs, tot)}
        <div className="x28-tipf">{fmtN(tot)} projected primary votes</div>
      </>
    );
  };
  const nom = S.names.map((n, j) => [n, S.nomination[j], j] as [string, number, number]).sort((a, b) => b[1] - a[1]);
  const natTot = F ? F.votes.reduce((a, b) => a + b, 0) + F.other : 0;
  const stKeys = F ? Object.keys(F.states).sort((a, b) => (F.states[a].window ?? 4) - (F.states[b].window ?? 4) || a.localeCompare(b)) : [];
  const fcty = focus && cg && F ? cg.counties.filter((c) => c[1] === focus && F.counties[c[0]]).map((c) => ({ n: c[2], c: F.counties[c[0]] })).sort((a, b) => tt(b.c) - tt(a.c)) : [];
  return (
    <div className="x28-prim-view">
      <div className="x28-seg-row top">
        <div className="x28-seg big" role="group" aria-label="Party">
          <button type="button" aria-pressed={party === "D"} onClick={() => { setParty("D"); setFocus(null); }}>Democratic primary</button>
          <button type="button" aria-pressed={party === "R"} onClick={() => { setParty("R"); setFocus(null); }}>Republican primary</button>
        </div>
        <div className="x28-seg" role="group" aria-label="Field">
          {party === "D"
            ? <><button type="button" aria-pressed={harris} onClick={() => setHarris(true)}>Harris runs</button><button type="button" aria-pressed={!harris} onClick={() => setHarris(false)}>Harris does not run</button></>
            : <><button type="button" aria-pressed={vance} onClick={() => setVance(true)}>Vance runs</button><button type="button" aria-pressed={!vance} onClick={() => setVance(false)}>Vance does not run</button></>}
        </div>
      </div>
      <div className="x28-mapgrid">
        <div className="card x28-mapcard">
          <div className="x28-seg-row">
            <div className="x28-seg" role="group" aria-label="Map units">
              {(["states", "counties"] as const).map((v) => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>{v === "states" ? "States" : "Counties"}</button>)}
            </div>
          </div>
          <Map28 view={view} stateFill={stateFill} countyFill={countyFill} stateTip={stateTip} countyTip={countyTip} focus={focus} onFocus={setFocus} fkey={fk + (F ? "1" : "0")}
            label="Each state as its race typically stands on its date: hover for the votes, added up from its counties"
            legend={<>{nom.slice(0, 6).map(([n, , j]) => <span key={n} className="x28-key"><b style={{ background: col(j) }} />{n}</span>)}<span className="mute">Deeper color, bigger share</span></>} />
        </div>
        <aside className="x28-rail">
          {focus && F?.states[focus] ? (
            <div className="card x28-panel">
              <div className="card-h"><h3>{STATE_NAME[focus]}</h3><span className="pill">{F.states[focus].window ? WIN[F.states[focus].window! - 1] : ""}</span></div>
              <div className="x28-sum">{rows(F.states[focus].votes.map((v, j) => [j, v] as [number, number]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 5), F.states[focus].total)}</div>
              <div className="x28-clist">
                <div className="h"><span>Largest {focus === "AK" ? "boroughs" : "counties"}</span><span>Votes</span><span>Leader</span></div>
                {fcty.slice(0, 12).map((x) => { const [j, v] = x.c[1] as [number, number]; return <div key={x.n}><span>{x.n.replace(/ (County|Parish|Borough|Census Area|City and Borough|Municipality)$/, "")}</span><span>{fmtK(tt(x.c))}</span><span style={{ color: col(j) }}>{F.names[j].split(" ").slice(-1)[0]} {fmtSh(v / tt(x.c), 0)}</span></div>; })}
              </div>
              <p className="x28-note">The state above is the sum of these {nCty[focus]} {focus === "AK" ? "borough" : "county"} forecasts.</p>
            </div>
          ) : (
            <div className="card x28-panel">
              <div className="card-h"><h3>Who wins the nomination</h3><span className="eye">{P ? `${P.sims.primary.toLocaleString("en-US")} runs` : ""}</span></div>
              <div className="x28-nom">
                {nom.slice(0, compact ? 5 : 8).map(([n, p, j]) => (
                  <div key={n}><span className="nm"><i style={{ background: col(j) }} />{n}</span><b>{fmtPct(p)}</b><span className="bar"><b style={{ width: `${p * 100}%`, background: col(j) }} /></span>
                    {F && <em>{fmtK(F.expected?.[j] ?? F.votes[j])} expected votes</em>}</div>
                ))}
              </div>
              {F && <p className="x28-note">{fmtN(natTot)} projected primary votes, the sum of every state and so of every county.</p>}
            </div>
          )}
        </aside>
      </div>
      {!compact && F && (
        <div className="card x28-tbl">
          <div className="card-h"><h3>Every state, in calendar order</h3><span className="eye">Sum of its counties</span></div>
          <div className="x28-scroll"><table>
            <thead><tr><th>State</th><th>When</th><th>Favorite</th><th>Share</th><th>Wins</th><th>Runner up</th><th>Votes</th></tr></thead>
            <tbody>{stKeys.map((st) => { const s = F.states[st]; const o = s.votes.map((v, j) => [j, v]).sort((a, b) => b[1] - a[1]); const [a, b] = [o[0], o[1]]; return (
              <tr key={st} onClick={() => setFocus(st)}><td>{STATE_NAME[st]}</td><td>{s.window ? WIN[s.window - 1] : ""}</td><td><i className="dot" style={{ background: col(a[0]) }} />{F.names[a[0]]}</td><td>{fmtSh(a[1] / s.total)}</td><td>{fmtPct(s.win[a[0]])}</td>
                <td>{b && b[1] > 0 ? `${F.names[b[0]]} ${fmtSh(b[1] / s.total)}` : "Field has narrowed"}</td><td>{fmtN(s.total)}</td></tr>); })}</tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
function tt(c: (number | [number, number])[]) { return (c[0] as number) + (c.slice(1) as [number, number][]).reduce((a, x) => a + x[1], 0); }
