import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import { RATING_LABEL, RAMP_CSS, fmtM, lastName, marginColor, rating, ratingPill, STATE_NAME } from "@/app/lib/opp";
import GeoMap, { type GeoTip } from "@/app/components/opp/GeoMap";
import type { CountyPath } from "@/app/components/home/countyGeo";
import { dbHref, getDownballot, getDownballotCounties, type CountyRow, type DBRace } from "../../data";

export const dynamicParams = false;

export function generateStaticParams() {
  return getDownballot().races.map((r) => ({ st: r.st.toLowerCase(), office: r.office }));
}

const find = (st: string, office: string): DBRace | undefined =>
  getDownballot().races.find((r) => r.st === st.toUpperCase() && r.office === office);

export async function generateMetadata({ params }: { params: Promise<{ st: string; office: string }> }): Promise<Metadata> {
  const { st, office } = await params;
  const r = find(st, office);
  if (!r) return {};
  return {
    title: `${r.state} ${r.officeLabel.toLowerCase()} forecast`,
    description: r.uncontested ? `${r.state} ${r.officeLabel.toLowerCase()}: uncontested in 2026.` : `${r.dem} vs ${r.gop}: the On Point Politics county by county forecast for ${r.state} ${r.officeLabel.toLowerCase()}.`,
    alternates: { canonical: dbHref(r) },
  };
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
      <div className="opp">
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
      <header className="ph">
        <div className="eye g">2026 forecast</div>
        <h1>{title} <em>forecast</em></h1>
        <p className="lede">{r.dem} vs {r.gop}{!r.incRunning ? ", an open seat" : r.incumbent ? `, with ${r.incumbent} running again` : ""}. The model has {lastName(lead)} ahead by {Math.abs(m).toFixed(1)} points, with a {Math.round(leadWin * 100)} percent chance of winning.</p>
        <div className="pmeta">
          <span className={`pill ${ratingPill(rt)}`}>{RATING_LABEL[rt]}</span>
          <span>Model <b className="mono">{fmtM(m)}</b></span>
          {r.pollAvg != null && <span>Polls <b className="mono">{fmtM(r.pollAvg)}</b></span>}
          <span>Updated <b>{updated}</b></span>
        </div>
      </header>

      <div className="layout">
        <div style={{ display: "grid", gap: 16 }}>
          <div className="card">
            <div className="card-h"><h3>County forecast</h3><span className="eye" style={{ marginLeft: "auto" }}>{paths.length} {unit} · {flips} lean Democratic</span></div>
            <div className="card-b" style={{ padding: 10 }}>
              {paths.length ? <GeoMap paths={paths} fills={fills} tips={tips} label={`${title} county forecast map`} /> : <div className="empty">No county build for this race.</div>}
              <div className="legend" style={{ paddingInline: 8 }}>
                <span>D +40</span><span className="ramp" style={{ flex: 1, maxWidth: 280, margin: 0, background: RAMP_CSS }} /><span>R +40</span><span style={{ marginLeft: "auto" }}>Hover a county for its projected vote</span>
              </div>
            </div>
          </div>

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
