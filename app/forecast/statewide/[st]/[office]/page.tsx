import type { Metadata } from "next";
import Link from "@/app/components/Link";
import ForecastNav from "@/app/components/opp/ForecastNav";
import { notFound } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import { RATING_LABEL, RAMP_CSS, fmtM, lastName, marginColor, rating, ratingPill, STATE_NAME } from "@/app/lib/opp";
import GeoMap, { type GeoTip } from "@/app/components/opp/GeoMap";
import { VoteSummary, CountyVotes, countyName } from "@/app/components/opp/VoteTables";
import CountyExplorer from "@/app/components/opp/CountyExplorer";
import { STORY_CSS, phraseFor, ShareBars, SecTitle, ModelPath } from "@/app/components/opp/RaceStory";
import SectionNav from "@/app/components/opp/SectionNav";
import OutcomeHist from "@/app/components/opp/OutcomeHist";
import { FX_CSS } from "@/app/components/opp/fxCss";
import StageHero from "@/app/components/opp/StageHero";
import Ambient from "@/app/components/opp/Ambient";
import PollTrail from "@/app/components/opp/PollTrail";
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
  const p10 = r.est.p10 ?? m - 8, p90 = r.est.p90 ?? m + 8;
  const half = Math.max(0.5, Math.abs(p90 - p10) / 4);
  const shareCands = v && v.total > 0 ? [
    { name: r.dem ?? "Democrat", party: "Democrat", pct: (100 * v.dem) / v.total, color: "#5b8fff", win: dWin },
    { name: r.gop ?? "Republican", party: "Republican", pct: (100 * v.rep) / v.total, color: "#ff4d6a", win: 1 - dWin },
    ...(r.others ?? []).length && v.other / v.total >= 0.03 ? [{ name: r.others.map((o) => o.name).join(", "), party: r.others.map((o) => o.party).join(", ") || "Others", pct: (100 * v.other) / v.total, color: "#b78cff" }] : [],
  ] : [];
  const steps = [
    ...(L.topOfTicket != null ? [{ label: "Top of ticket", m: L.topOfTicket, note: L.topRaces?.length ? L.topRaces.map((t) => (t.startsWith("sen") ? "Senate" : "governor")).join(" and ") : "the 2026 statewide races" }] : []),
    ...(L.history != null ? [{ label: "Down ballot history", m: L.history, note: "this office's past results, moved to 2026" }] : []),
    ...(L.blend != null ? [{ label: "Blend of every leg", m: L.blend, note: "with approval, Gallup and the primaries" }] : []),
    ...(L.withCandidates != null ? [{ label: "Candidates", m: L.withCandidates, note: "incumbency and primary unity" }] : []),
    { label: "With polls", m, note: r.pollWeight ? `polls carry ${Math.round(r.pollWeight * 100)} percent` : "no polls in the race" },
  ].filter((x) => Number.isFinite(x.m) && Math.abs(x.m) < 99);
  const navItems = [
    { id: "map", label: "Counties map" }, { id: "vote", label: "Vote share" }, { id: "polls", label: "Polling" }, { id: "path", label: "How we got here" },
    ...(r.primary || Object.keys(r.history).length ? [{ id: "context", label: "Primaries and history" }] : []),
    ...(sibs.length ? [{ id: "ballot", label: "Other statewide races" }] : []), ...(paths.length ? [{ id: "counties", label: "Every county" }] : []),
  ];

  return (
    <div className="opp fc-xl fx fx-dark">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="sep">/</span><Link href="/forecast">Forecast</Link><span className="sep">/</span>
        <Link href="/forecast/statewide">Statewide offices</Link><span className="sep">/</span><span>{title}</span>
      </nav>
      <ForecastNav />
      <JsonLd data={dbLd(r)} />
      <style>{STORY_CSS}</style>
      <Ambient />
      <StageHero
        eyebrow={`2026 forecast · ${title}`}
        title={phraseFor(leadWin)
          ? <><span className="nm" style={{ color: m < 0 ? "#7fa6ff" : "#ff8399" }}>{lead}</span> is <span className="ph-w">{phraseFor(leadWin)}</span> to win {r.state}&apos;s {r.officeLabel.toLowerCase()} race.</>
          : <><span className="nm" style={{ color: "#7fa6ff" }}>{r.dem}</span> and <span className="nm" style={{ color: "#ff8399" }}>{r.gop}</span> are in a <span className="ph-w">toss up</span> for {r.state}&apos;s {r.officeLabel.toLowerCase()}.</>}
        lede={<>{r.dem} vs {r.gop}{!r.incRunning ? ", an open seat" : r.incumbent ? `, with ${r.incumbent} running again` : ""}. The model has {lastName(lead)} ahead by {Math.abs(m).toFixed(1)} points, with a {Math.round(leadWin * 100)} percent chance of winning.</>}
        pills={<>
          <span className={`pill ${ratingPill(rt)}`}>{RATING_LABEL[rt]}</span>
          <span>Model <b className="mono">{fmtM(m)}</b></span>
          {r.pollAvg != null && <span>Polls <b className="mono">{fmtM(r.pollAvg)}</b></span>}
          <span>Updated <b>{updated}</b></span>
        </>}
        cands={v && v.total > 0 ? [{ name: r.dem ?? "Democrat", label: "Democrat", pct: (100 * v.dem) / v.total, votes: v.dem, color: "#5b8fff" }, { name: r.gop ?? "Republican", label: "Republican", pct: (100 * v.rep) / v.total, votes: v.rep, color: "#ff4d6a" }] : []}
        paths={paths} fills={fills} mapLabel={`${title} drawn in pixels, shaded by the forecast`}
        labels={Object.fromEntries(paths.map((p) => { const row = rows[p.id]; return [p.id, { t: tips[p.id]?.title ?? p.id, s: `Projected margin ${fmtM(row[0])}`, c: row[0] < 0 ? "#7fa6ff" : "#ff8399" }]; }))}
        win={leadWin}
        lead={{ name: lastName(lead), color: m < 0 ? "#5b8fff" : "#ff4d6a" }} other={{ name: lastName(m < 0 ? r.gop! : r.dem!), color: m < 0 ? "#ff4d6a" : "#5b8fff" }} />

      <style>{FX_CSS}</style>
      <div className="fx-kpis">
        <div className="card fx-k"><span>Rating</span><b style={{ color: m < 0 ? "var(--dem2)" : "var(--gop2)" }}>{RATING_LABEL[rt]}</b><small>{Math.round(leadWin * 100)}% chance for {lastName(lead)}</small></div>
        <div className="card fx-k"><span>Model margin</span><b className="mono">{fmtM(m)}</b><small>{r.pollAvg != null ? `Polls ${fmtM(r.pollAvg)}` : "No polls in the race"}</small></div>
        <div className="card fx-k"><span>80 percent range</span><b className="mono">{fmtM(Math.min(p10, p90))} to {fmtM(Math.max(p10, p90))}</b><small>{flips} of {paths.length} {unit} lean Democratic</small></div>
        <div className="card fx-k"><span>Projected votes</span><b className="mono">{v ? v.total.toLocaleString("en-US") : "n/a"}</b><small>{v && v.total ? `${lastName(lead)} ${(Math.max(v.dem, v.rep) / v.total * 100).toFixed(1)}%` : ""}</small></div>
      </div>

      <div className="fx-body">
        <SectionNav items={navItems} />
        <div style={{ display: "grid", gap: 56, minWidth: 0 }}>
          <section id="map" className="st-sec">
            <SecTitle title="The county map" sub="Four ways to read the state: margin, shift from 2024, vote bubbles and turnout" />
            {paths.length > 1 ? (
              <section className="fx-sec" aria-label="County explorer">
                <CountyExplorer paths={paths} unit={unit} stateName={r.state} title={`${title} by ${unit === "parishes" ? "parish" : "county"}`}
                  rows={paths.map((p) => { const row = rows[p.id]; return { id: p.id, name: countyName(names[p.id] ?? p.id, r.st), a: row[1], b: row[2], other: Math.max(0, row[3] - row[1] - row[2]), total: row[3] }; })}
                  sides={[{ name: lastName(r.dem ?? "Democrat"), short: lastName(r.dem ?? "Democrat"), color: "#3d7bff", letter: "D" }, { name: lastName(r.gop ?? "Republican"), short: lastName(r.gop ?? "Republican"), color: "#ff3b5c", letter: "R" }]} />
              </section>
            ) : paths.length ? (
              <div className="card"><div className="card-b" style={{ padding: 10 }}><GeoMap paths={paths} fills={fills} tips={tips} label={`${title} map`} />
                <div className="legend" style={{ paddingInline: 8 }}><span>D +40</span><span className="ramp" style={{ flex: 1, maxWidth: 280, margin: 0, background: RAMP_CSS }} /><span>R +40</span></div></div></div>
            ) : null}
          </section>

          <section id="vote" className="st-sec">
            <SecTitle title="Vote share" sub="Each candidate's projected share and the range of 80 percent of simulations" />
            {shareCands.length ? <ShareBars cands={shareCands} half={half} /> : null}
            <div className="fx-grid2">
              {v && v.total > 0 ? (
                <VoteSummary title="Projected statewide vote" total={v.total}
                  cands={[{ name: r.dem ?? "Democrat", party: "D", votes: v.dem }, { name: r.gop ?? "Republican", party: "R", votes: v.rep },
                    ...(v.other > 0 ? [{ name: (r.others ?? []).map((o) => o.name).join(", ") || "Other candidates", party: "", votes: v.other }] : [])]}
                  note="Expected votes at the projected turnout for this office, which runs a little below the top of the ticket because some voters skip down ballot races." />
              ) : null}
              <OutcomeHist title="Every simulated outcome" eye="2,000 sims" center={m} p10={p10} p90={p90} line={0} below="#3d7bff" above="#ff3b5c" fmt={(x) => fmtM(x)}
                note={<>80 percent of simulations fall between {fmtM(Math.min(p10, p90))} and {fmtM(Math.max(p10, p90))}. Bars left of the white line are Democratic wins.</>} />
            </div>
          </section>

          <section id="polls" className="st-sec">
            <SecTitle title="Polling" sub="Every public poll of the race, and how the model reads it" />
            <div className="card ptr-card">
              <div className="card-h"><h3>Polls of the race</h3><span className="eye" style={{ marginLeft: "auto" }}>{r.polls.length || "no"} {r.polls.length === 1 ? "poll" : "polls"}</span></div>
              {r.polls.length ? <div className="ptr-wrap"><PollTrail polls={r.polls.map((p) => ({ age: p.age, margin: p.margin, n: p.n ?? undefined, pollster: p.pollster, op: p.pollster.startsWith("On Point") }))} avg={r.pollAvg ?? null} asOf={data.meta.updated} dem={r.dem ? lastName(r.dem) : "Democrat"} gop={r.gop ? lastName(r.gop) : "Republican"} height={230} /></div> : null}
              <div className="tblwrap">
                <table className="tbl">
                  <thead><tr><th>Pollster</th><th>Sample</th><th style={{ textAlign: "right" }}>Ended</th><th style={{ textAlign: "right" }}>{lastName(r.dem!)}</th><th style={{ textAlign: "right" }}>{lastName(r.gop!)}</th><th style={{ textAlign: "right" }}>Margin</th></tr></thead>
                  <tbody>
                    {r.pollAvg != null ? <tr className="avg"><td>On Point average</td><td>Recency and size weighted</td><td className="n" /><td className="n" /><td className="n" /><td className={`n ${r.pollAvg < 0 ? "d" : "r"}`}>{fmtM(r.pollAvg)}</td></tr> : null}
                    {r.polls.length ? r.polls.map((p, i) => (
                      <tr key={i}><td>{p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer">{p.pollster}</a> : p.pollster}</td><td className="mono" style={{ color: "var(--ink2)" }}>{p.n ? p.n.toLocaleString() : ""} {p.kind}</td><td className="n">{p.end}</td><td className="n d">{p.D}</td><td className="n r">{p.R}</td><td className={`n ${p.margin < 0 ? "d" : p.margin > 0 ? "r" : ""}`}>{fmtM(p.margin)}</td></tr>
                    )) : <tr><td colSpan={6} style={{ color: "var(--ink2)" }}>No public polls of this race. The forecast rests on the top of ticket, past results and the primaries.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section id="path" className="st-sec">
            <SecTitle title="How we got here" sub="From the top of the ticket to the forecast, one stage at a time" />
            <ModelPath steps={steps} />
            {L.weights && <p style={{ fontSize: 13, margin: 0, color: "var(--ink2)" }}>Leg weights: {Object.entries(L.weights).map(([k, w]) => `${LEG_NAME[k] ?? k} ${Math.round(w * 100)}%`).join(", ")}.</p>}
          </section>

          {r.primary || Object.keys(r.history).length ? (
            <section id="context" className="st-sec">
              <SecTitle title="Primaries and history" sub="What this year's primaries and the office's past races say" />
              <div className="fx-grid2">
                {r.primary ? <div className="card"><div className="stat"><div className="k">2026 primaries</div>
                  {r.primary.dem_share != null && <div className="kv"><span>Democratic share of the two party primary vote</span><span>{r.primary.dem_share}%</span></div>}
                  {r.primary.dem_nominee_share != null && <div className="kv"><span>{lastName(r.dem!)} in the primary</span><span>{r.primary.dem_nominee_share}%</span></div>}
                  {(r.primary.rep_nominee_share ?? r.primary.r_nominee_share) != null && <div className="kv"><span>{lastName(r.gop!)} in the primary</span><span>{r.primary.rep_nominee_share ?? r.primary.r_nominee_share}%</span></div>}
                  {r.primary.d_nominee_share != null && <div className="kv"><span>{lastName(r.dem!)} in the primary</span><span>{r.primary.d_nominee_share}%</span></div>}
                </div></div> : null}
                {Object.keys(r.history).length > 0 ? <div className="card"><div className="stat"><div className="k">Down ballot Democratic share, two party</div>
                  {Object.entries(r.history).sort((a, b) => Number(b[0]) - Number(a[0])).map(([y, d]) => <div className="kv" key={y}><span>{y}</span><span>{d}%</span></div>)}
                </div></div> : null}
              </div>
            </section>
          ) : null}

          {sibs.length > 0 ? (
            <section id="ballot" className="st-sec">
              <SecTitle title={`Other ${STATE_NAME[r.st]} statewide races`} sub="Every other office on the ballot, with the model margin" />
              <div className="card"><div className="stat">
                {sibs.map((x) => <div className="kv" key={x.id}><Link href={dbHref(x)}>{x.officeLabel}</Link><span className={x.uncontested ? "" : x.est.margin < 0 ? "d" : "r"}>{x.uncontested ? "Uncontested" : fmtM(x.est.margin)}</span></div>)}
              </div></div>
            </section>
          ) : null}

          {paths.length > 0 ? (
            <section id="counties" className="st-sec">
              <SecTitle title="Every county" sub="The projected vote in each county, largest first" />
              <CountyVotes unit={unit} demName={lastName(r.dem ?? "Democrat")} repName={lastName(r.gop ?? "Republican")}
                rows={paths.map((p) => { const row = rows[p.id]; return { id: p.id, name: countyName(names[p.id] ?? p.id, r.st), dem: row[1], rep: row[2], other: Math.max(0, row[3] - row[1] - row[2]), total: row[3], margin: row[0] }; })} />
            </section>
          ) : null}

          <div className="callout">
            <div className="eye">Methodology</div>
            The county forecast starts from {STATE_NAME[r.st]}&apos;s 2026 top of ticket and this office&apos;s own past county results, adds the approval
            fundamentals, a relaxed Gallup leg and this year&apos;s primaries, then moves each county by how loose its voters are in the
            ticket splitting model. <Link href="/forecast/statewide" style={{ textDecoration: "underline" }}>All statewide races</Link>.
          </div>
        </div>
      </div>
    </div>
  );
}
