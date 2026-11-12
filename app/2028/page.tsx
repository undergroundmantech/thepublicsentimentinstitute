import type { Metadata } from "next";
import Link from "@/app/components/Link";
import Matchup, { EvBar } from "./Matchup";
import PrimView from "./PrimView";
import Method from "./Method";
import { getCands, getDefault, getGenBase, getGenNames, getGrid, getPrimSummary, getPrimVotes, top } from "./server";
import { fmtK, fmtMg, fmtPct, last, two } from "./lib";

export const metadata: Metadata = {
  title: "2028 Presidential Model | On Point Politics",
  description: "The On Point 2028 presidential model: both primaries, the general election and any ticket you pick, forecast in every county and added up to every state.",
  alternates: { canonical: "/2028" },
};

export default function Page2028() {
  const def = getDefault(); const s = getGenBase(); const grid = getGrid(); const ps = getPrimSummary(); const pv = getPrimVotes();
  const dT = top(ps.dem), rT = top(ps.gop); const nat = s.natM ?? two(s.VD, s.VR);
  const likely = [...grid].filter((g) => g.odds != null).sort((a, b) => (b.odds ?? 0) - (a.odds ?? 0)).slice(0, 3);
  const built = new Date(def.built + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return (
    <main className="wrap x28-main">
      <section className="x28-hero">
        <div>
          <div className="eye g">2028 presidential model · built {built}</div>
          <h1>The road to 2028, <span className="gt">county by county.</span></h1>
          <p className="lede">Every one of the 3,142 counties forecast for both primaries and the general election, then added up into every state. These are the On Point 2028 Forecast&apos;s own numbers. Pick any pairing, or build a full ticket and the forecast&apos;s ticket engine reruns every county in your browser.</p>
        </div>
        <div className="x28-kpis">
          <div className="card x28-k"><span className="lab">General election, headline</span><b className="d">{fmtPct(s.pD)}</b><em>{s.D} against {s.R} · {fmtMg(nat)} nationally</em><EvBar d={s.evD} r={s.evR} /></div>
          <div className="card x28-k"><span className="lab">Democratic nomination</span><b style={{ color: dT[0].color }}>{dT[0].name} {fmtPct(dT[0].p)}</b><em>{dT.slice(1).map((x) => `${x.name} ${fmtPct(x.p)}`).join(" · ")}</em></div>
          <div className="card x28-k"><span className="lab">Republican nomination</span><b style={{ color: rT[0].color }}>{rT[0].name} {fmtPct(rT[0].p)}</b><em>{rT.slice(1).map((x) => `${x.name} ${fmtPct(x.p)}`).join(" · ")}</em></div>
        </div>
      </section>

      <section className="x28-previews">
        <Link href="/2028/primaries" className="card x28-pv">
          <span className="eye">Preview · 2028 primaries</span><h2>Who comes out of the primaries</h2>
          <div className="x28-pvbars">{[...dT, ...rT].map((x) => <div key={x.name}><span>{x.name}</span><span className="bar"><b style={{ width: `${x.p * 100}%`, background: x.color }} /></span><em>{fmtPct(x.p)}</em></div>)}</div>
          <p>{fmtK(pv.D)} Democratic and {fmtK(pv.R)} Republican primary votes, state by state in calendar order, county by county.</p><span className="go">Open the primaries</span>
        </Link>
        <Link href="/2028/general" className="card x28-pv">
          <span className="eye">Preview · 2028 general</span><h2>The likeliest matchups</h2>
          <div className="x28-pvm">{likely.map((g) => <div key={g.d + g.r}><span>{last(g.d)} v {last(g.r)}</span><b className={g.pD >= 0.5 ? "d" : "r"}>{fmtPct(Math.max(g.pD, 1 - g.pD))} {g.pD >= 0.5 ? last(g.d) : last(g.r)}</b><em>{fmtMg(g.nat)} · {Math.round(g.evD)} EV</em></div>)}</div>
          <p>Pick both nominees and read the map, the electoral college and every state, all from the counties up.</p><span className="go">Open the general election</span>
        </Link>
        <Link href="/2028/ticket" className="card x28-pv">
          <span className="eye">Preview · pick a ticket</span><h2>Build your own ticket</h2>
          <p>Choose the nominees, their running mates and a third party candidate with their share of the vote. Each choice moves every county through its voter coalitions, issue positions, primary scars and home state pull.</p>
          {def.example && <div className="x28-pvm"><div><span>{def.example.label}</span><b className={def.example.pD >= 0.5 ? "d" : "r"}>{fmtPct(Math.max(def.example.pD, 1 - def.example.pD))} {def.example.pD >= 0.5 ? "D" : "R"}</b><em>{fmtMg(def.example.nat)} · {Math.round(def.example.evD)} EV · example ticket</em></div>
            <div><span>{def.example.label3}</span><b className={def.example.pD3 >= 0.5 ? "d" : "r"}>{fmtPct(Math.max(def.example.pD3, 1 - def.example.pD3))} {def.example.pD3 >= 0.5 ? "D" : "R"}</b><em>{fmtMg(def.example.nat3)} · with a third party at {def.example.tps3}%</em></div></div>}
          <span className="go">Pick a ticket</span>
        </Link>
      </section>

      <section className="x28-sec">
        <div className="x28-sech"><div><div className="eye g">General election</div><h2>{s.D} against {s.R}</h2>
          <p>Hover any state for its projected votes, added up from its county forecasts, and its win chance from the forecast&apos;s 20,000 simulations. Click a state to open its counties.</p></div>
          <Link className="btn" href="/2028/general">Change the nominees</Link></div>
        <Matchup base={s} cands={getCands()} mode="overview" grid={grid} gnames={getGenNames()} />
      </section>

      <section className="x28-sec">
        <div className="x28-sech"><div><div className="eye g">Primaries</div><h2>Both nominations, state by state</h2>
          <p>Each state shows its race as it typically stands on its date, after the early states have thinned the field. The state is the sum of its counties.</p></div>
          <Link className="btn" href="/2028/primaries">Every state</Link></div>
        <PrimView sum={ps} compact />
      </section>
      <Method />
    </main>
  );
}
