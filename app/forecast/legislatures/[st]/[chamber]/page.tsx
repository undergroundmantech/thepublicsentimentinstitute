import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Hemicycle, { type HemiSeat } from "@/app/components/opp/Hemicycle";
import SeatHist from "@/app/components/opp/SeatHist";
import { BAND_LABEL, controlBand, currentMajority, getStatehouse, slHref, type SLChamber } from "../../data";
import DistrictTable from "../../DistrictTable";
import "../../legislatures.css";

export const dynamicParams = false;
export function generateStaticParams() {
  return getStatehouse().chambers.map((c) => ({ st: c.st.toLowerCase(), chamber: c.chamber }));
}
const find = (st: string, ch: string): SLChamber | undefined => getStatehouse().chambers.find((c) => c.st === st.toUpperCase() && c.chamber === ch);

export async function generateMetadata({ params }: { params: Promise<{ st: string; chamber: string }> }): Promise<Metadata> {
  const { st, chamber } = await params;
  const c = find(st, chamber);
  if (!c) return {};
  return {
    title: `${c.name} forecast`,
    description: `District by district On Point Politics forecast for the 2026 ${c.name}: ${Math.round(c.demControl * 100)}% Democratic control, ${c.up} seats on the ballot.`,
    alternates: { canonical: slHref(c) },
  };
}

const pct = (p: number) => (p > 0.99 ? ">99%" : p < 0.01 ? "<1%" : `${Math.round(p * 100)}%`);

export default async function Page({ params }: { params: Promise<{ st: string; chamber: string }> }) {
  const { st, chamber } = await params;
  const c = find(st, chamber);
  if (!c) notFound();
  const data = getStatehouse();
  const other = data.chambers.find((x) => x.st === c.st && x.chamber !== c.chamber);
  const updated = new Date(data.meta.updated + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const label = c.chamber === "house" ? c.name.replace(c.state + " ", "") : "Senate";

  const seats: HemiSeat[] = [];
  for (const x of c.districts) for (let i = 0; i < x.seats; i++) seats.push({ p: x.probD ?? 0.5, label: `District ${x.d}: Democrats win ${x.probD == null ? "unknown" : pct(x.probD)}` });
  (["D", "R", "O"] as const).forEach((p) => { for (let i = 0; i < c.hold[p]; i++) seats.push({ p: null, hold: p, label: "Not on the 2026 ballot" }); });

  const fav = c.demControl >= c.gopControl ? "D" : "R";
  const favP = Math.max(c.demControl, c.gopControl);
  const cur = currentMajority(c);
  const band = controlBand(c.demControl);
  const flipD = c.districts.filter((x) => x.last?.won?.[0] === "R" && (x.probD ?? 0) > 0.5).length;
  const flipR = c.districts.filter((x) => x.last?.won?.[0] === "D" && (x.probD ?? 1) < 0.5).length;
  const toss = c.districts.filter((x) => x.probD != null && x.probD > 0.35 && x.probD < 0.65).length;
  const holdN = c.hold.D + c.hold.R + c.hold.O;
  const lede =
    `${fav === "D" ? "Democrats" : "Republicans"} win control of the ${c.name} in ${favP > 0.995 ? "nearly every one" : `${Math.round(favP * 100)}%`} of 2,000 simulations` +
    (cur ? `, against a ${cur === "D" ? "Democratic" : "Republican"} majority today` : "") +
    `. ${c.up === c.seats ? `All ${c.seats} seats are` : `${c.up} of the ${c.seats} seats are`} on the 2026 ballot${holdN ? ` and ${holdN} carry over until 2028` : ""}; ${toss} ${toss === 1 ? "race is" : "races are"} within a 35 to 65 split.`;

  return (
    <div className="opp sl">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="sep">/</span><Link href="/forecast">Forecast</Link><span className="sep">/</span>
        <Link href="/forecast/legislatures">State legislatures</Link><span className="sep">/</span><span>{c.name}</span>
      </nav>
      <header className="ph">
        <div className="eye g">2026 state legislative forecast</div>
        <h1>{c.name} <em>forecast</em></h1>
        <p className="lede">{lede}</p>
        <div className="pmeta">
          <span className={`pill ${band === "toss" ? "t" : band.endsWith("D") ? "d" : "r"}`}>{BAND_LABEL[band]}</span>
          <span>Updated <b>{updated}</b></span><span>Seats <b className="mono">{c.seats}</b></span><span>On the ballot <b className="mono">{c.up}</b></span>
          {other ? <Link href={slHref(other)} className="btn sm">{other.name}</Link> : null}
        </div>
      </header>

      <section className="sl-top">
        <div className="card sl-hemi">
          <div className="card-h"><h3>Every seat</h3><span className="eye" style={{ marginLeft: "auto" }}>Sorted by Democratic win odds</span></div>
          <div className="card-b">
            <Hemicycle seats={seats} majority={c.majority} size={640} />
            <div className="sl-hemi-mid">
              <div className="sl-big"><span className="d mono">{c.demSeats.toFixed(0)}</span><i>to</i><span className="r mono">{c.gopSeats.toFixed(0)}</span></div>
              <div className="eye">Average seats · {c.majority} for a majority</div>
            </div>
            <div className="sl-legend">
              <span><i style={{ background: "#1a3fb0" }} />Safe D</span><span><i style={{ background: "#a6c2ff" }} />Lean D</span><span><i style={{ background: "#e7b341" }} />Toss up</span>
              <span><i style={{ background: "#ffb3c0" }} />Lean R</span><span><i style={{ background: "#b0163a" }} />Safe R</span>{holdN ? <span><i className="ring" />Not up in 2026</span> : null}
            </div>
          </div>
        </div>
        <div className="kpi-stack">
          <div className="card kpi ctrl">
            <div>
              <div className="lab">Chance of control</div>
              <div className="odds">
                <div className="big d" style={{ color: "var(--dem2)" }}>{pct(c.demControl)}<small>Democrats</small></div>
                <div className="big r" style={{ color: "var(--gop2)", textAlign: "right" }}>{pct(c.gopControl)}<small>Republicans</small></div>
              </div>
              <div className="bar"><i style={{ width: `${c.demControl * 100}%`, background: "var(--dem)" }} /><i style={{ width: `${c.tie * 100}%`, background: "var(--gold)" }} /><i style={{ width: `${c.gopControl * 100}%`, background: "var(--gop)" }} /></div>
              {c.tie > 0.005 ? <div className="sub">Tied chamber or no majority in {pct(c.tie)}</div> : null}
            </div>
          </div>
          <div className="card kpi">
            <div><div className="lab">Democratic seats, 80% range</div><div className="v d mono">{c.p10} to {c.p90}</div><div className="sub">Median {c.median}. After 2024: {c.current.D} D, {c.current.R} R{c.current.O ? `, ${c.current.O} other` : ""}</div></div>
          </div>
          <div className="card kpi">
            <div><div className="lab">Seats favored to flip</div><div className="v mono sl-flips"><span><b className="d">{flipD}</b><small>to Democrats</small></span><span><b className="r">{flipR}</b><small>to Republicans</small></span></div><div className="sub">Against the party that won each seat last time</div></div>
          </div>
          <div className="card kpi">
            <div><div className="lab">Environment</div><div className="v mono" style={{ fontSize: 26 }}>{c.env.shift >= 0 ? "D" : "R"} +{Math.abs(c.env.shift).toFixed(1)}</div><div className="sub">Shift from the 2024 presidential vote, from the House forecast and the national generic ballot{c.env.genericPolls.length ? `, with ${c.env.genericPolls.length} legislative ballot ${c.env.genericPolls.length === 1 ? "poll" : "polls"}` : ""}</div></div>
          </div>
        </div>
      </section>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-h"><h3>Democratic seats across 2,000 simulations</h3><span className="eye" style={{ marginLeft: "auto" }}>Blue bars are Democratic majorities</span></div>
        <div className="card-b"><SeatHist hist={c.hist} majority={c.majority} total={c.seats} /></div>
      </div>

      <div style={{ marginTop: 16 }}><DistrictTable rows={c.districts} label={label} /></div>

      {c.env.genericPolls.length ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-h"><h3>Legislative ballot polls</h3><span className="eye" style={{ marginLeft: "auto" }}>Weight {Math.round(c.env.genericWeight * 100)}%</span></div>
          <div className="tblwrap"><table className="tbl"><thead><tr><th>Pollster</th><th>Field end</th><th style={{ textAlign: "right" }}>D</th><th style={{ textAlign: "right" }}>R</th></tr></thead>
            <tbody>{c.env.genericPolls.map((p, i) => <tr key={i}><td>{p.source.replace(/\s*\(.*?\)/g, "")}</td><td className="mono">{p.end}</td><td className="n d">{p.D}</td><td className="n r">{p.R}</td></tr>)}</tbody></table></div>
        </div>
      ) : null}

      <div className="callout" style={{ marginTop: 16 }}>
        <div className="eye">How this is built</div>
        Each district starts from its 2024 presidential vote, read off the precincts that voted in it, and moves with the state&apos;s
        2026 House forecast and the national generic ballot. Half of what the last legislative winner ran ahead of the district carries over,
        2026 primary turnout moves districts where it is posted, and district and statewide legislative polls count by recency and sample.
        A seat with no candidate from one party is called for the other. 2,000 simulations share a national, a state and a district shock.{" "}
        <Link href="/forecast/legislatures" style={{ textDecoration: "underline" }}>All chambers</Link>.
      </div>
    </div>
  );
}
