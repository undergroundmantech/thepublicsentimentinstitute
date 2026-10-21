import type { Metadata } from "next";
import Link from "next/link";
import ForecastNav from "@/app/components/opp/ForecastNav";
import { notFound } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import { RATING_LABEL, RAMP_CSS, fmtM, lastName, marginColor, rating, ratingPill, STATE_NAME } from "@/app/lib/opp";
import GeoMap, { type GeoTip } from "@/app/components/opp/GeoMap";
import { VoteSummary, CountyVotes, countyName } from "@/app/components/opp/VoteTables";
import CountyExplorer from "@/app/components/opp/CountyExplorer";
import { STORY_CSS, NightsGrid, phraseFor } from "@/app/components/opp/RaceStory";
import type { CountyPath } from "@/app/components/home/countyGeo";
import { dbHref, getDownballot, getDownballotCounties, type CountyRow, type DBRace } from "../../data";
import JsonLd from "@/app/components/JsonLd";
import { dbLd, dbMeta } from "../../../seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return getDownballot().races.map((r) => ({ st: r.st.toLowerCase(), office: r.slug ?? r.office }));
}

const find = (st: string, office: string): DBRace | undefined =>
  getDownballot().races.find((r) => r.st === st.toUpperCase() && (r.slug ?? r.office) === office);

export async function generateMetadata({ params }: { params: Promise<{ st: string; office: string }> }): Promise<Metadata> {
  const { st, office } = await params;
  const r = find(st, office);
  return r ? dbMeta(r) : {};
}

const LEG_NAME: Record<string, string> = { T: "Top of ticket", F: "Approval fundamentals", G: "Gallup, relaxed", H: "Down ballot history", P: "2026 primaries" };

export default async function Page({ params }: { params: Promise<{ st: string; office: string }> }) {
  const { st, office } = await params;
  const r = find(st, office);
  if (!r) notFound();
  const data = getDownballot();
  const title = `${r.state} ${r.officeLabel.replace(/\b\w/g, (c) => c.toUpperCase())}`;
  const updated = new Date(data.meta.updated + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const sibs = data.races.filter((x) => x.st === r.st && x.id !== r.id);

  if (r.uncontested) {
    const who = r.uncontested === "D" ? r.dem : r.gop;
    return (
      <div className="opp fc-xl">
        <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/forecast/statewide">Statewide offices</Link><span className="sep">/</span><span>{title}</span></nav>
        <header className="ph"><div className="eye g">2026 forecast</div><h1>{title} <em>forecast</em></h1>
          <p className="lede">{who} runs without a {r.uncontested === "D" ? "Republican" : "Democratic"} opponent, so the race is not modeled.{r.note ? ` ${r.note}` : ""}</p>
          <div className="pmeta"><span className={`pill ${r.uncontested === "D" ? "d" : "r"}`}>Uncontested</span><span>Updated <b>{updated}</b></span></div>
        </header>
      </div>
    );
  }

  const m = r.est.margin;
  const rt = rating(m);
  const lead = m < 0 ? r.dem! : r.gop!;
  const dWin = 1 - r.est.prob;
  const leadWin = m < 0 ? dWin : 1 - dWin;
  const geo = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "forecast", "states", `${r.st}.json`), "utf8")) as { counties: CountyPath[] };
  const all = getDownballotCounties();
  const rows = (all[r.id] ?? {}) as Record<string, CountyRow>;
  const names = (all._n ?? {}) as Record<string, string>;
  const paths = geo.counties.filter((p) => rows[p.id]);
  const unit = r.st === "LA" ? "parishes" : "counties";
  const fills: Record<string, string> = {}, tips: Record<string, GeoTip> = {};
  for (const p of paths) {
    const row = rows[p.id];
    fills[p.id] = marginColor(row[0]);
    const nm = names[p.id] ?? p.id;
    tips[p.id] = { title: /county|parish|city/i.test(nm) ? nm : `${nm} County`, rows: [
      [lastName(r.dem!), `${(row[4]?.[0] ?? 0).toFixed(1)}%`, "var(--dem2)"], [lastName(r.gop!), `${(row[4]?.[1] ?? 0).toFixed(1)}%`, "var(--gop2)"],
      ["Projected margin", fmtM(row[0]), row[0] < 0 ? "var(--dem2)" : "var(--gop2)"], ["Projected votes", Math.round(row[3]).toLocaleString()]] };
  }
  const flips = paths.filter((p) => rows[p.id][0] < 0).length;
  const L = r.legs;
  const v = r.votes;
  const pct = (x: number) => (v ? (100 * x / v.total).toFixed(1) : "");

  return (
    <div className="opp">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="sep">/</span><Link href="/forecast">Forecast</Link><span className="sep">/</span>
        <Link href="/forecast/statewide">Statewide offices</Link><span className="sep">/</span><span>{title}</span>
      </nav>
      <ForecastNav />
      <JsonLd data={dbLd(r)} />
      <style>{STORY_CSS}</style>
      <header className="ph st-hero">
        <div className="sx-rv-l">
          <div className="eye g">2026 forecast · {title}</div>
          <h1>{phraseFor(leadWin)
            ? <><span className="nm" style={{ color: m < 0 ? "#5b8fff" : "#ff4d6a" }}>{lead}</span> is <span className="ph-w">{phraseFor(leadWin)}</span> to win {r.state}&apos;s {r.officeLabel.toLowerCase()} race.</>
            : <><span className="nm" style={{ color: "#5b8fff" }}>{r.dem}</span> and <span className="nm" style={{ color: "#ff4d6a" }}>{r.gop}</span> are in a <span className="ph-w">toss up</span> for {r.state}&apos;s {r.officeLabel.toLowerCase()}.</>}</h1>
        <p className="lede">{r.dem} vs {r.gop}{!r.incRunning ? ", an open seat" : r.incumbent ? `, with ${r.incumbent} running again` : ""}. The model has {lastName(lead)} ahead by {Math.abs(m).toFixed(1)} points, with a {Math.round(leadWin * 100)} percent chance of winning.</p>
          <div className="st-pills">
            <span className={`pill ${ratingPill(rt)}`} style={{ border: 0 }}>{RATING_LABEL[rt]}</span>
            <span>Model <b className="mono">{fmtM(m)}</b></span>
            {r.pollAvg != null && <span>Polls <b className="mono">{fmtM(r.pollAvg)}</b></span>}
            <span>Updated <b>{updated}</b></span>
          </div>
        </div>
        <NightsGrid win={leadWin} leadName={lastName(lead)} otherName={lastName(m < 0 ? r.gop! : r.dem!)} leadColor={m < 0 ? "#5b8fff" : "#ff4d6a"} otherColor={m < 0 ? "#ff4d6a" : "#5b8fff"} sims={2000} />
      </header>

      {paths.length > 1 ? (
        <section style={{ marginBottom: 16 }} aria-label="County explorer">
          <CountyExplorer paths={paths} unit={unit} stateName={r.state} title={`${title} by ${unit === "parishes" ? "parish" : "county"}`}
            rows={paths.map((p) => { const row = rows[p.id]; return { id: p.id, name: countyName(names[p.id] ?? p.id, r.st), a: row[1], b: row[2], other: Math.max(0, row[3] - row[1] - row[2]), total: row[3] }; })}
            sides={[{ name: lastName(r.dem ?? "Democrat"), short: lastName(r.dem ?? "Democrat"), color: "#3d7bff", letter: "D" }, { name: lastName(r.gop ?? "Republican"), short: lastName(r.gop ?? "Republican"), color: "#ff3b5c", letter: "R" }]} />
        </section>
      ) : null}

      <div className="layout">
        <div style={{ display: "grid", gap: 16 }}>
          {v && v.total > 0 ? (
            <VoteSummary title="Projected statewide vote" total={v.total}
              cands={[{ name: r.dem ?? "Democrat", party: "D", votes: v.dem }, { name: r.gop ?? "Republican", party: "R", votes: v.rep },
                ...(v.other > 0 ? [{ name: (r.others ?? []).map((o) => o.name).join(", ") || "Other candidates", party: "", votes: v.other }] : [])]}
              note="Expected votes at the projected turnout for this office, which runs a little below the top of the ticket because some voters skip down ballot races." />
          ) : null}

          {paths.length > 0 && (
            <CountyVotes unit={unit} demName={lastName(r.dem ?? "Democrat")} repName={lastName(r.gop ?? "Republican")}
              rows={paths.map((p) => { const row = rows[p.id]; return { id: p.id, name: countyName(names[p.id] ?? p.id, r.st), dem: row[1], rep: row[2], other: Math.max(0, row[3] - row[1] - row[2]), total: row[3], margin: row[0] }; })} />
          )}

          {r.est.p10 != null && r.est.p90 != null && <div className="card">
            <div className="card-h"><h3>Range of outcomes</h3><span className="eye" style={{ marginLeft: "auto" }}>80 percent of simulations</span></div>
            <div className="card-b">
              {(() => { const lo = Math.min(r.est.p10!, r.est.p90!), hi = Math.max(r.est.p10!, r.est.p90!); const span = Math.max(10, Math.abs(lo), Math.abs(hi)) * 1.15;
                const X = (x: number) => 20 + ((x + span) / (2 * span)) * 560;
                return (
                  <svg viewBox="0 0 600 70" role="img" aria-label={`80 percent range from ${fmtM(lo)} to ${fmtM(hi)}`} style={{ width: "100%", height: "auto" }}>
                    <rect x={20} y={28} width={560} height={10} rx={5} fill="rgba(255,255,255,.06)" />
                    <rect x={X(lo)} y={28} width={Math.max(2, X(hi) - X(lo))} height={10} rx={5} fill={m < 0 ? "#3d7bff" : "#ff3b5c"} opacity={0.55} />
                    <line x1={X(0)} x2={X(0)} y1={18} y2={48} stroke="var(--hi)" strokeWidth={1.5} />
                    <circle cx={X(m)} cy={33} r={6} fill="#fff" />
                    <text x={X(lo)} y={64} textAnchor="middle" style={{ font: "500 11px var(--font-m)", fill: "#8e86a3" }}>{fmtM(lo)}</text>
                    <text x={X(hi)} y={64} textAnchor="middle" style={{ font: "500 11px var(--font-m)", fill: "#8e86a3" }}>{fmtM(hi)}</text>
                    <text x={X(m)} y={14} textAnchor="middle" style={{ font: "700 11px var(--font-m)", fill: "#f3eff8" }}>{fmtM(m)}</text>
                  </svg>
                ); })()}
              <p style={{ fontSize: 13, marginTop: 8 }}>80 percent of simulations fall between {fmtM(Math.min(r.est.p10!, r.est.p90!))} and {fmtM(Math.max(r.est.p10!, r.est.p90!))}. The white dot is the forecast; the line is a tie.</p>
            </div>
          </div>}

          <div className="card">
            <div className="card-h"><h3>How the model gets there</h3><span className="eye" style={{ marginLeft: "auto" }}>statewide margin at each step</span></div>
            <div className="tblwrap">
              <table className="tbl">
                <tbody>
                  {L.topOfTicket != null && <tr><td>Top of ticket{L.topRaces?.length ? `, ${L.topRaces.map((t) => (t.startsWith("sen") ? "Senate" : "governor")).join(" and ")}` : ""}</td><td className={`n ${L.topOfTicket < 0 ? "d" : "r"}`}>{fmtM(L.topOfTicket)}</td></tr>}
                  {L.history != null && <tr><td>Down ballot history, moved to 2026</td><td className={`n ${L.history < 0 ? "d" : "r"}`}>{fmtM(L.history)}</td></tr>}
                  {L.blend != null && <tr><td>Blend of every leg</td><td className={`n ${L.blend < 0 ? "d" : "r"}`}>{fmtM(L.blend)}</td></tr>}
                  {L.withCandidates != null && <tr><td>With incumbency and primary unity</td><td className={`n ${L.withCandidates < 0 ? "d" : "r"}`}>{fmtM(L.withCandidates)}</td></tr>}
                  <tr className="avg"><td>With polls{r.pollWeight ? `, ${Math.round(r.pollWeight * 100)}% weight` : ", none in the race"}</td><td className={`n ${m < 0 ? "d" : "r"}`}>{fmtM(m)}</td></tr>
                </tbody>
              </table>
            </div>
            {L.weights && <p style={{ fontSize: 13, padding: "10px 16px 14px", margin: 0, color: "var(--ink2)" }}>Leg weights: {Object.entries(L.weights).map(([k, w]) => `${LEG_NAME[k] ?? k} ${Math.round(w * 100)}%`).join(", ")}. 80 percent of outcomes fall between {fmtM(r.est.p10!)} and {fmtM(r.est.p90!)}.</p>}
          </div>

          <div className="card">
            <div className="card-h"><h3>Polls of the race</h3><span className="eye" style={{ marginLeft: "auto" }}>{r.polls.length || "no"} {r.polls.length === 1 ? "poll" : "polls"}</span></div>
            <div className="tblwrap">
              <table className="tbl">
                <thead><tr><th>Pollster</th><th>Sample</th><th style={{ textAlign: "right" }}>Ended</th><th style={{ textAlign: "right" }}>{lastName(r.dem!)}</th><th style={{ textAlign: "right" }}>{lastName(r.gop!)}</th><th style={{ textAlign: "right" }}>Margin</th></tr></thead>
                <tbody>
                  {r.polls.length ? r.polls.map((p, i) => (
                    <tr key={i}><td>{p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer">{p.pollster}</a> : p.pollster}</td><td className="mono" style={{ color: "var(--ink2)" }}>{p.n ? p.n.toLocaleString() : ""} {p.kind}</td><td className="n">{p.end}</td><td className="n d">{p.D}</td><td className="n r">{p.R}</td><td className={`n ${p.margin < 0 ? "d" : p.margin > 0 ? "r" : ""}`}>{fmtM(p.margin)}</td></tr>
                  )) : <tr><td colSpan={6} style={{ color: "var(--ink2)" }}>No public polls of this race. The forecast rests on the top of ticket, past results and the primaries.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="side">
          <div className="card">
            <div className="stat"><div className="k">Model margin</div><div className={`v ${m < 0 ? "d" : "r"}`}>{lastName(lead)} +{Math.abs(m).toFixed(1)}</div></div>
            <div className="stat"><div className="k">Chance of winning</div>
              <div className="cand"><i style={{ background: "var(--dem)" }} /><span>{r.dem}</span><span className="p">{Math.round(dWin * 100)}%</span></div>
              <div className="cand"><i style={{ background: "var(--gop)" }} /><span>{r.gop}</span><span className="p">{Math.round((1 - dWin) * 100)}%</span></div>
            </div>
            {v && <div className="stat"><div className="k">Projected vote</div>
              <div className="cand"><i style={{ background: "var(--dem)" }} /><span>{r.dem}</span><span className="p">{pct(v.dem)}%</span></div>
              <div className="cand"><i style={{ background: "var(--gop)" }} /><span>{r.gop}</span><span className="p">{pct(v.rep)}%</span></div>
              <div className="cand"><i style={{ background: "#6f6883" }} /><span>{r.others.length ? r.others.map((o) => o.name).join(", ") : "Others and write ins"}</span><span className="p">{pct(v.other)}%</span></div>
            </div>}
            {r.primary && <div className="stat"><div className="k">2026 primaries</div>
              {r.primary.dem_share != null && <div className="kv"><span>Democratic share of the two party primary vote</span><span>{r.primary.dem_share}%</span></div>}
              {r.primary.dem_nominee_share != null && <div className="kv"><span>{lastName(r.dem!)} in the primary</span><span>{r.primary.dem_nominee_share}%</span></div>}
              {(r.primary.rep_nominee_share ?? r.primary.r_nominee_share) != null && <div className="kv"><span>{lastName(r.gop!)} in the primary</span><span>{r.primary.rep_nominee_share ?? r.primary.r_nominee_share}%</span></div>}
              {r.primary.d_nominee_share != null && <div className="kv"><span>{lastName(r.dem!)} in the primary</span><span>{r.primary.d_nominee_share}%</span></div>}
            </div>}
            {Object.keys(r.history).length > 0 && <div className="stat"><div className="k">Down ballot Democratic share, two party</div>
              {Object.entries(r.history).sort((a, b) => Number(b[0]) - Number(a[0])).map(([y, d]) => <div className="kv" key={y}><span>{y}</span><span>{d}%</span></div>)}
            </div>}
          </div>
          {sibs.length > 0 && <div className="card">
            <div className="stat"><div className="k">Other {STATE_NAME[r.st]} statewide races</div>
              {sibs.map((x) => <div className="kv" key={x.id}><Link href={dbHref(x)}>{x.officeLabel}</Link><span>{x.uncontested ? "Uncontested" : fmtM(x.est.margin)}</span></div>)}
            </div>
          </div>}
          <div className="callout">
            <div className="eye">Methodology</div>
            The county forecast starts from {STATE_NAME[r.st]}&apos;s 2026 top of ticket and its past down ballot results, adds the approval
            fundamentals, a relaxed Gallup leg and this year&apos;s primaries, then moves each county by how loose its voters are in the
            ticket splitting model. <Link href="/forecast/statewide" style={{ textDecoration: "underline" }}>All statewide races</Link>.
          </div>
        </aside>
      </div>
    </div>
  );
}
