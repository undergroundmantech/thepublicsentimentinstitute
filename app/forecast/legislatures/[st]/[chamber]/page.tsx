import type { Metadata } from "next";
import Link from "@/app/components/Link";
import ForecastNav from "@/app/components/opp/ForecastNav";
import { notFound } from "next/navigation";
import Hemicycle, { type HemiSeat } from "@/app/components/opp/Hemicycle";
import SeatHist from "@/app/components/opp/SeatHist";
import { BAND_LABEL, controlBand, currentMajority, getStatehouse, slHref, type SLChamber } from "../../data";
import ChamberExplorer, { type ChamberMapData } from "../../ChamberExplorer";
import fs from "node:fs";
import path from "node:path";
import "../../legislatures.css";
import { STORY_CSS, ShareBars, SecTitle, phraseFor } from "@/app/components/opp/RaceStory";
import StageHero from "@/app/components/opp/StageHero";
import Ambient from "@/app/components/opp/Ambient";
import SectionNav from "@/app/components/opp/SectionNav";
import { FX_CSS } from "@/app/components/opp/fxCss";
import { RATE } from "@/app/lib/opp";
import JsonLd from "@/app/components/JsonLd";
import { chamberLd, chamberMeta } from "../../../seo";

export const dynamicParams = false;
export function generateStaticParams() {
  return getStatehouse().chambers.map((c) => ({ st: c.st.toLowerCase(), chamber: c.chamber }));
}
const find = (st: string, ch: string): SLChamber | undefined => getStatehouse().chambers.find((c) => c.st === st.toUpperCase() && c.chamber === ch);

export async function generateMetadata({ params }: { params: Promise<{ st: string; chamber: string }> }): Promise<Metadata> {
  const { st, chamber } = await params;
  const c = find(st, chamber);
  return c ? chamberMeta(c) : {};
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
  let map: ChamberMapData | null = null;
  try {
    const sm = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "forecast", "statehouse_map", `${c.st}.json`), "utf8"));
    const m = sm.chambers?.[c.chamber];
    if (m) map = { box: sm.box, outline: sm.outline, d: m.d, hold: m.hold ?? {} };
  } catch { map = null; }
  const lede =
    `${fav === "D" ? "Democrats" : "Republicans"} win control of the ${c.name} in ${favP > 0.995 ? "nearly every one" : `${Math.round(favP * 100)}%`} of 2,000 simulations` +
    (cur ? `, against a ${cur === "D" ? "Democratic" : "Republican"} majority today` : "") +
    `. ${c.up === c.seats ? `All ${c.seats} seats are` : `${c.up} of the ${c.seats} seats are`} on the 2026 ballot${holdN ? ` and ${holdN} carry over until 2028` : ""}; ${toss} ${toss === 1 ? "race is" : "races are"} within a 35 to 65 split.`;

  const DEM = "#5b8fff", GOP = "#ff4d6a";
  const phrase = phraseFor(favP);
  const favWord = fav === "D" ? "Democrats" : "Republicans";
  const stagePaths = map ? Object.entries(map.d).map(([id, v]) => ({ id, d: v[0] })) : [];
  const byD = new Map(c.districts.map((x) => [String(x.d), x]));
  const stageFills: Record<string, string> = {}, stageLabels: Record<string, { t: string; s: string; c: string }> = {};
  for (const sp of stagePaths) {
    const x = byD.get(sp.id); const pD = x?.probD;
    stageFills[sp.id] = pD == null ? (map?.hold?.[sp.id] === "D" ? "#2b3f7a" : map?.hold?.[sp.id] === "R" ? "#7a2b3a" : "#3a3448") : RATE[controlBand(pD)];
    stageLabels[sp.id] = { t: `District ${sp.id}`, s: pD == null ? "Not on the 2026 ballot" : `Democrats win ${pct(pD)}`, c: pD == null ? "#a79fbd" : pD >= 0.5 ? "#7fa6ff" : "#ff8399" };
  }
  const vt = c.votes && c.votes.total > 0 ? c.votes : null;
  const half = Math.max(0.6, ((c.p90 - c.p10) / Math.max(1, c.seats)) * 25);
  const navItems = [
    { id: "map", label: "District map" }, { id: "seats", label: "Seats" }, ...(vt ? [{ id: "vote", label: "Vote share" }] : []),
    ...(c.env.genericPolls.length ? [{ id: "polls", label: "Polling" }] : []), { id: "how", label: "How we got here" },
  ];

  return (
    <div className="opp sl fc-xl fx fx-dark">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="sep">/</span><Link href="/forecast">Forecast</Link><span className="sep">/</span>
        <Link href="/forecast/legislatures">State legislatures</Link><span className="sep">/</span><span>{c.name}</span>
      </nav>
      <ForecastNav />
      <JsonLd data={chamberLd(c)} />
      <style>{STORY_CSS}</style>
      <Ambient />
      <StageHero
        eyebrow={`2026 state legislature · ${c.name}`}
        title={phrase
          ? <><span className="nm" style={{ color: fav === "D" ? "#7fa6ff" : "#ff8399" }}>{favWord}</span> are <span className="ph-w">{phrase}</span> to control the {c.name}.</>
          : <>Control of the <span className="nm" style={{ color: "#f3eff8" }}>{c.name}</span> is a <span className="ph-w">toss up</span>.</>}
        lede={<>{lede}</>}
        pills={<>
          <span className={`pill ${band === "toss" ? "t" : band.endsWith("D") ? "d" : "r"}`}>{BAND_LABEL[band]}</span>
          <span>Seats <b className="mono">{c.seats}</b></span><span>On the ballot <b className="mono">{c.up}</b></span>
          <span>Majority <b className="mono">{c.majority}</b></span><span>Updated <b>{updated}</b></span>
        </>}
        cands={[{ name: "Democrats", label: `Median ${c.median} seats`, pct: vt ? (100 * vt.dem) / vt.total : (100 * c.demSeats) / c.seats, votes: vt?.dem ?? 0, color: DEM },
          { name: "Republicans", label: `Median ${c.seats - c.median} seats`, pct: vt ? (100 * vt.rep) / vt.total : (100 * c.gopSeats) / c.seats, votes: vt?.rep ?? 0, color: GOP }]}
        paths={stagePaths} fills={stageFills} labels={stageLabels} mapLabel={`${c.name} districts drawn in pixels, shaded by each seat's forecast`}
        win={favP} lead={{ name: favWord, color: fav === "D" ? DEM : GOP }} other={{ name: fav === "D" ? "Republicans" : "Democrats", color: fav === "D" ? GOP : DEM }} />

      <style>{FX_CSS}</style>
      <div className="fx-kpis">
        <div className="card fx-k"><span>Chance of control</span><b className="mono"><span className="d">{pct(c.demControl)}</span> <small style={{ fontSize: 13 }}>D</small> · <span className="r">{pct(c.gopControl)}</span> <small style={{ fontSize: 13 }}>R</small></b><small>{c.tie > 0.005 ? `Tied chamber in ${pct(c.tie)}` : BAND_LABEL[band]}</small></div>
        <div className="card fx-k"><span>Democratic seats, 80% range</span><b className="mono d">{c.p10} to {c.p90}</b><small>Median {c.median}, {c.majority} for a majority</small></div>
        <div className="card fx-k"><span>Favored to flip</span><b className="mono"><span className="d">{flipD}</span> to D · <span className="r">{flipR}</span> to R</b><small>After 2024: {c.current.D} D, {c.current.R} R{c.current.O ? `, ${c.current.O} other` : ""}</small></div>
        <div className="card fx-k"><span>Environment</span><b className="mono">{c.env.shift >= 0 ? "D" : "R"} +{Math.abs(c.env.shift).toFixed(1)}</b><small>Shift from the 2024 presidential vote</small></div>
      </div>

      <div className="fx-body">
        <SectionNav items={navItems} />
        <div style={{ display: "grid", gap: 56, minWidth: 0 }}>
          <section id="map" className="st-sec">
            <SecTitle title="The district map" sub={`Every ${label === "Senate" ? "Senate" : label} district, shaded by its forecast. ${toss} ${toss === 1 ? "seat is" : "seats are"} within a 35 to 65 split`} />
            <ChamberExplorer districts={c.districts} map={map} label={label} chamberName={c.name} aside={
              <div className="card sl-hemi">
                <div className="card-h"><h3>Every seat</h3><span className="eye" style={{ marginLeft: "auto" }}>Average {c.demSeats.toFixed(0)} D to {c.gopSeats.toFixed(0)} R</span></div>
                <div className="card-b">
                  <Hemicycle seats={seats} majority={c.majority} size={560} />
                  <div className="sl-legend">
                    <span><i style={{ background: "#1a3fb0" }} />Safe D</span><span><i style={{ background: "#a6c2ff" }} />Lean D</span><span><i style={{ background: "#e7b341" }} />Toss up</span>
                    <span><i style={{ background: "#ffb3c0" }} />Lean R</span><span><i style={{ background: "#b0163a" }} />Safe R</span>{holdN ? <span><i className="ring" />Not up</span> : null}
                  </div>
                </div>
              </div>
            } />
            <div className="rx-play">
              <div className="rx-ph"><span className="eye">Keep going</span><b>More of {c.state}</b></div>
              {other ? <Link className="rx-pl" href={slHref(other)}><b>{other.name}</b><span>The other chamber, seat by seat</span></Link> : null}
              <Link className="rx-pl" href={`/forecast/statewide`}><b>Statewide offices</b><span>Every down ballot race on the 2026 ballot</span></Link>
              <Link className="rx-pl" href="/forecast/legislatures"><b>All chambers</b><span>Every legislature with a 2026 election</span></Link>
            </div>
          </section>

          <section id="seats" className="st-sec">
            <SecTitle title="Seats" sub="How many seats Democrats win across 2,000 simulations" />
            <div className="card">
              <div className="card-h"><h3>Every simulated chamber</h3><span className="eye" style={{ marginLeft: "auto" }}>{c.majority} for a majority</span></div>
              <div className="card-b">
                <SeatHist hist={c.hist} majority={c.majority} total={c.seats} height={170} />
                <p style={{ fontSize: 13, marginTop: 8 }}>Democrats win {c.p10} to {c.p90} seats in 80 percent of simulations, {c.median} in the middle one. Bars past the majority line are Democratic chambers.</p>
              </div>
            </div>
          </section>

          {vt ? (
            <section id="vote" className="st-sec">
              <SecTitle title="Vote share" sub={`The sum of every ${c.name} district on the ballot`} />
              <ShareBars half={half} cands={[{ name: "Democrats", party: "Every Democratic candidate", pct: (100 * vt.dem) / vt.total, color: DEM, win: c.demControl }, { name: "Republicans", party: "Every Republican candidate", pct: (100 * vt.rep) / vt.total, color: GOP, win: c.gopControl }]} />
              <div className="card">
                <div className="card-h"><h3>Projected {c.name} vote</h3><span className="eye" style={{ marginLeft: "auto" }}>{c.up} seats on the ballot</span></div>
                <div className="tblwrap">
                  <table className="tbl">
                    <thead><tr><th>Party</th><th style={{ textAlign: "right" }}>Votes</th><th style={{ textAlign: "right" }}>Share</th></tr></thead>
                    <tbody>
                      <tr><td className="d">Democrats</td><td className="n">{vt.dem.toLocaleString("en-US")}</td><td className="n">{((100 * vt.dem) / vt.total).toFixed(1)}%</td></tr>
                      <tr><td className="r">Republicans</td><td className="n">{vt.rep.toLocaleString("en-US")}</td><td className="n">{((100 * vt.rep) / vt.total).toFixed(1)}%</td></tr>
                      <tr><td>Independents and others</td><td className="n">{vt.other.toLocaleString("en-US")}</td><td className="n">{((100 * vt.other) / vt.total).toFixed(1)}%</td></tr>
                      <tr style={{ fontWeight: 700 }}><td>Total</td><td className="n">{vt.total.toLocaleString("en-US")}</td><td className="n">100%</td></tr>
                    </tbody>
                  </table>
                </div>
                <p style={{ fontSize: 12.5, color: "var(--mute)", padding: "8px 14px 14px", margin: 0 }}>Each district&apos;s turnout is its 2024 top of ticket vote on today&apos;s lines, scaled to the forecast&apos;s 2026 statewide vote less a small share who skip legislative races, split by the district forecast. A district with no candidate from one party gives all its votes to the other.</p>
              </div>
            </section>
          ) : null}

          {c.env.genericPolls.length ? (
            <section id="polls" className="st-sec">
              <SecTitle title="Polling" sub="Legislative ballot polls of the state, as published" />
              <div className="card">
                <div className="card-h"><h3>Legislative ballot polls</h3><span className="eye" style={{ marginLeft: "auto" }}>Weight {Math.round(c.env.genericWeight * 100)}%</span></div>
                <div className="tblwrap"><table className="tbl"><thead><tr><th>Pollster</th><th>Field end</th><th style={{ textAlign: "right" }}>D</th><th style={{ textAlign: "right" }}>R</th></tr></thead>
                  <tbody>{c.env.genericPolls.map((p, i) => <tr key={i}><td>{p.source}</td><td className="mono">{p.end}</td><td className="n d">{p.D}</td><td className="n r">{p.R}</td></tr>)}</tbody></table></div>
              </div>
            </section>
          ) : null}

          <section id="how" className="st-sec">
            <SecTitle title="How we got here" sub="From the 2024 presidential vote to the 2026 chamber" />
            <div className="fx-kpis">
              <div className="card fx-k"><span>2024 president</span><b className="mono">{c.env.pres24.toFixed(1)}% D</b><small>Democratic share of the two party vote</small></div>
              <div className="card fx-k"><span>2026 House forecast</span><b className="mono">{c.env.house26.toFixed(1)}% D</b><small>The state&apos;s House vote in the model, two party</small></div>
              <div className="card fx-k"><span>Shift applied</span><b className="mono">{c.env.shift >= 0 ? "D" : "R"} +{Math.abs(c.env.shift).toFixed(1)}</b><small>Every district moves with it, then by its own race</small></div>
              <div className="card fx-k"><span>Toss up seats</span><b className="mono">{toss}</b><small>Within a 35 to 65 split</small></div>
            </div>
            <div className="callout">
              <div className="eye">How this is built</div>
              Each district starts from its 2024 presidential vote, read off the precincts that voted in it, and moves with the state&apos;s
              2026 House forecast and the national generic ballot. Half of what the last legislative winner ran ahead of the district carries over,
              2026 primary turnout moves districts where it is posted, and district and statewide legislative polls count by recency and sample.
              A seat with no candidate from one party is called for the other. 2,000 simulations share a national, a state and a district shock.
              The map&apos;s district shapes are estimated from where each district&apos;s voters are in the precinct returns.{" "}
              {c.note ? <>{c.note}{" "}</> : null}
              <Link href="/forecast/legislatures" style={{ textDecoration: "underline" }}>All chambers</Link>.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
