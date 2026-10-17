import type { Metadata } from "next";
import Link from "next/link";
import Hemicycle, { type HemiSeat } from "@/app/components/opp/Hemicycle";
import LegisTiles from "@/app/components/opp/LegisTiles";
import USLegisMap, { type USChamber } from "@/app/components/opp/USLegisMap";
import { BAND_LABEL, controlBand, currentMajority, getStatehouse, slHref, type SLChamber } from "./data";
import "./legislatures.css";

export const metadata: Metadata = {
  title: "2026 state legislative forecast",
  description: "District by district On Point Politics forecasts for all 87 partisan state legislative chambers on the 2026 ballot.",
  alternates: { canonical: "/forecast/legislatures" },
};

const pct = (p: number) => (p > 0.99 ? ">99%" : p < 0.01 ? "<1%" : `${Math.round(p * 100)}%`);

function seatsOf(c: SLChamber): HemiSeat[] {
  const s: HemiSeat[] = [];
  for (const x of c.districts) for (let i = 0; i < x.seats; i++) s.push({ p: x.probD ?? 0.5 });
  (["D", "R", "O"] as const).forEach((p) => { for (let i = 0; i < c.hold[p]; i++) s.push({ p: null, hold: p }); });
  return s;
}

export default function LegislaturesPage() {
  const data = getStatehouse();
  const ch = data.chambers;
  const updated = new Date(data.meta.updated + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const expD = ch.reduce((a, c) => a + c.demControl, 0);
  const curD = ch.filter((c) => currentMajority(c) === "D").length;
  const curR = ch.filter((c) => currentMajority(c) === "R").length;
  const favD = ch.filter((c) => c.demControl > c.gopControl).length;
  const flipsToD = ch.filter((c) => currentMajority(c) !== "D" && c.demControl > 0.5);
  const flipsToR = ch.filter((c) => currentMajority(c) !== "R" && c.gopControl > 0.5);
  const inPlay = ch.filter((c) => c.demControl > 0.08 && c.demControl < 0.92).sort((a, b) => Math.abs(a.demControl - 0.5) - Math.abs(b.demControl - 0.5));
  const us: USChamber[] = ch.map((c) => ({ id: c.id, st: c.st, chamber: c.chamber, name: c.name, demControl: c.demControl,
    d: c.districts.map((x) => [x.d, x.seats, x.probD, x.margin, x.last?.won?.[0] ?? null, x.indMain ? 1 : 0] as USChamber["d"][number]),
    holdD: c.holdD ?? [] }));
  const all = [...ch].sort((a, b) => a.state.localeCompare(b.state) || (a.chamber === "senate" ? -1 : 1));

  return (
    <div className="opp sl sl-wide fc-wide">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="sep">/</span><Link href="/forecast">Forecast</Link><span className="sep">/</span><span>State legislatures</span>
      </nav>
      <header className="ph">
        <div className="eye g">2026 forecast</div>
        <h1>State legislatures <em>forecast</em></h1>
        <p className="lede">
          All {ch.length} partisan chambers on the 2026 ballot, {data.meta.seatsUp.toLocaleString()} seats in {data.meta.districts.toLocaleString()} districts,
          forecast one district at a time. Democrats are favored to control {favD} chambers and hold a majority in {curD} today; Republicans hold {curR}.
        </p>
        <div className="pmeta"><span>Updated <b>{updated}</b></span><span>Chambers <b className="mono">{ch.length}</b></span><span>Seats up <b className="mono">{data.meta.seatsUp.toLocaleString()}</b></span><span>Simulations <b className="mono">2,000</b></span></div>
      </header>

      <section className="sl-kpis">
        <div className="card kpi"><div><div className="lab">Expected Democratic chambers</div><div className="v d mono">{expD.toFixed(1)}</div><div className="sub">Out of {ch.length}, {curD} today</div></div></div>
        <div className="card kpi"><div><div className="lab">Favored to flip to Democrats</div><div className="v d mono">{flipsToD.length}</div><div className="sub">{flipsToD.slice(0, 4).map((c) => c.name).join(", ") || "None"}{flipsToD.length > 4 ? " and more" : ""}</div></div></div>
        <div className="card kpi"><div><div className="lab">Favored to flip to Republicans</div><div className="v r mono">{flipsToR.length}</div><div className="sub">{flipsToR.slice(0, 4).map((c) => c.name).join(", ") || "None"}</div></div></div>
        <div className="card kpi"><div><div className="lab">Chambers in play</div><div className="v mono" style={{ color: "var(--gold)" }}>{inPlay.length}</div><div className="sub">Between 8% and 92% for either party</div></div></div>
      </section>

      <div className="card sl-map-us">
        <div className="card-h"><h3>Every district on the 2026 ballot</h3><span className="eye" style={{ marginLeft: "auto" }}>Hover a district · click to open its chamber</span></div>
        <div className="card-b"><USLegisMap chambers={us} /></div>
      </div>

      <div className="sl-pair">
        <div className="card">
          <div className="card-h"><h3>Control by state</h3><span className="eye" style={{ marginLeft: "auto" }}>Senate left · House right</span></div>
          <div className="card-b">
            <LegisTiles chambers={ch.map((c) => ({ st: c.st, chamber: c.chamber, demControl: c.demControl, name: c.name, href: slHref(c) }))} />
            <div className="sl-legend">
              <span><i style={{ background: "#1a3fb0" }} />Safe D</span><span><i style={{ background: "#3d7bff" }} />Likely D</span><span><i style={{ background: "#a6c2ff" }} />Lean D</span>
              <span><i style={{ background: "#e7b341" }} />Toss up</span><span><i style={{ background: "#ffb3c0" }} />Lean R</span><span><i style={{ background: "#ff3b5c" }} />Likely R</span><span><i style={{ background: "#b0163a" }} />Safe R</span><span><i className="hatch" />Not up</span>
            </div>
          </div>
        </div>
        <div>
          <h2 className="sl-h2" style={{ marginTop: 0 }}>Chambers in play</h2>
          <div className="sl-grid">
            {inPlay.map((c) => {
              const b = controlBand(c.demControl);
              const cur = currentMajority(c);
              return (
                <Link key={c.id} href={slHref(c)} className="card sl-cc">
                  <div className="card-h"><h3>{c.name}</h3><span className={`pill ${b === "toss" ? "t" : b.endsWith("D") ? "d" : "r"}`} style={{ marginLeft: "auto" }}>{BAND_LABEL[b]}</span></div>
                  <div className="card-b">
                    <Hemicycle seats={seatsOf(c)} majority={c.majority} size={300} />
                    <div className="sl-cc-odds"><span className="d mono">{pct(c.demControl)}</span><span className="eye">control</span><span className="r mono">{pct(c.gopControl)}</span></div>
                    <div className="sl-cc-sub">Average {c.demSeats.toFixed(0)} D to {c.gopSeats.toFixed(0)} R · {cur ? `${cur} majority today` : "no majority today"}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-h"><h3>Every chamber</h3><span className="eye" style={{ marginLeft: "auto" }}>{ch.length} chambers</span></div>
        <div className="tblwrap">
          <table className="tbl">
            <thead><tr><th>Chamber</th><th>Today</th><th>Control odds</th><th style={{ textAlign: "right" }}>Dem control</th><th style={{ textAlign: "right" }}>Avg seats</th><th style={{ textAlign: "right" }}>Up</th></tr></thead>
            <tbody>
              {all.map((c) => {
                const cur = currentMajority(c);
                return (
                  <tr key={c.id}>
                    <td><Link href={slHref(c)}>{c.name}</Link></td>
                    <td>{cur ? <span className={`pill ${cur === "D" ? "d" : "r"}`}>{cur === "D" ? "Dem" : "GOP"} {cur === "D" ? c.current.D : c.current.R}</span> : <span className="pill t">Split</span>}</td>
                    <td style={{ minWidth: 140 }}><div className="sl-odds"><i style={{ width: `${c.demControl * 100}%` }} /><b style={{ left: "50%" }} /></div></td>
                    <td className="n">{pct(c.demControl)}</td>
                    <td className="n"><span className="d">{c.demSeats.toFixed(0)}</span> <span style={{ color: "var(--mute)" }}>/</span> <span className="r">{c.gopSeats.toFixed(0)}</span></td>
                    <td className="n">{c.up} of {c.seats}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="callout" style={{ marginTop: 16 }}>
        <div className="eye">Not on the ballot</div>
        Nebraska&apos;s legislature is nonpartisan, Louisiana, Mississippi, New Jersey and Virginia elect their legislatures in odd years, and the Kansas,
        New Mexico and South Carolina senates are next elected in 2028. Seats in staggered senates that are not up this year keep the party that won them in 2024.
      </div>
    </div>
  );
}
