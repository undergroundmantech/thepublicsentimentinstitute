import type { Metadata } from "next";
import Link from "next/link";
import { getHomeStats } from "@/app/_polling/lib/homeStats";
import { RAW_POLLS as APPROVAL_POLLS } from "@/app/_polling/donaldtrumpapproval/data";
import { RAW_POLLS as GENERIC_POLLS } from "@/app/_polling/genericballot/data";
import { getModel, miniRaces, isInd } from "@/app/lib/forecastData";
import { fmtM, lastName, raceHref } from "@/app/lib/opp";
import ForecastDeskHome, { type CountyBuild } from "@/app/components/home/ForecastDeskHome";
import AveragePanel, { type TableRow } from "@/app/components/home/AveragePanel";
import ResultCard from "@/app/components/home/ResultCard";
import Countdown from "@/app/components/home/Countdown";
import MiniMap from "@/app/components/home/MiniMap";
import { CountUp, Grow } from "@/app/components/home/motion";
import { Icon } from "@/app/components/opp/Logo";
import fs from "node:fs";
import path from "node:path";

export const metadata: Metadata = {
  title: { absolute: "OnPoint Politics | Polling averages, forecasts and live results" },
  description: "Polling averages, county level forecasts and live election results for the 2026 midterms, built on TPSI's own surveys and a transparent public poll feed.",
  alternates: { canonical: "/" },
};

type RawPoll = { pollster: string; startDate?: string; endDate: string; sampleSize?: number; sampleType?: string; results: Record<string, number> };

const md = (iso: string) => { const d = new Date(iso + "T00:00:00"); return `${d.getMonth() + 1}/${d.getDate()}`; };
const r1 = (n: number) => Math.round(n * 10) / 10;
const pts = (a: { t: number; net: number }[]) => a.map((p) => ({ t: p.t, v: p.net }));

function latestRows(polls: RawPoll[], ka: string, kb: string, gb: boolean): TableRow[] {
  return polls.slice().filter((p) => Number.isFinite(p.results?.[ka]) && Number.isFinite(p.results?.[kb]))
    .sort((a, b) => b.endDate.localeCompare(a.endDate)).slice(0, 4).map((p) => {
      const a = p.results[ka], b = p.results[kb], net = r1(a - b);
      return {
        pollster: p.pollster.replace(/\*+$/, ""), dates: p.startDate ? `${md(p.startDate)} to ${md(p.endDate)}` : md(p.endDate),
        sample: p.sampleSize ? `${p.sampleSize.toLocaleString()} ${p.sampleType ?? ""}`.trim() : p.sampleType ?? "",
        a: String(a), b: String(b),
        net: gb ? (net === 0 ? "Even" : net > 0 ? `D +${net}` : `R +${-net}`) : (net > 0 ? `+${net}` : `${net}`),
        cls: gb ? (net > 0 ? "d" : net < 0 ? "r" : "") : (net < 0 ? "r" : ""),
      };
    });
}

function countyBuild(raceId: string): CountyBuild {
  const st = raceId.split("-")[1];
  const dir = path.join(process.cwd(), "public", "forecast");
  const s = JSON.parse(fs.readFileSync(path.join(dir, "states", `${st}.json`), "utf8"));
  const c = JSON.parse(fs.readFileSync(path.join(dir, "counties.json"), "utf8"));
  const rows = c[raceId] ?? {};
  const names: Record<string, string> = {};
  for (const k of Object.keys(rows)) names[k] = c._n?.[k] ?? k;
  return { raceId, st, paths: s.counties, rows, names };
}

export default function Home() {
  const stats = getHomeStats();
  const model = getModel();
  const { chambers, meta } = model;
  const races = { senate: miniRaces("senate"), governor: miniRaces("governor") };

  // county simulation picks: the four closest Senate races and the closest governor's race
  const byClose = (o: "senate" | "governor") => Object.values(races[o]).sort((a, b) => Math.abs(a.m) - Math.abs(b.m));
  const picks = [...byClose("senate").slice(0, 4), ...byClose("governor").slice(0, 1)]
    .map((r) => ({ raceId: r.id, label: `${r.st} ${r.id.startsWith("gov") ? "Governor" : "Senate"}` }));
  const initial = countyBuild(picks[0].raceId);

  const ap = stats.approval, gb = stats.generic;
  const gbD = r1(50 + gb.net / 2), gbR = r1(100 - gbD);
  const updated = new Date(meta.updated + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const spark = (vals: number[], color: string) => {
    const v = vals.slice(-60); if (v.length < 2) return null;
    const mn = Math.min(...v), mx = Math.max(...v), sp = mx - mn || 1;
    const p = v.map((x, i) => `${(2 + (i / (v.length - 1)) * 106).toFixed(1)},${(40 - ((x - mn) / sp) * 34).toFixed(1)}`);
    const [lx, ly] = p[p.length - 1].split(",");
    return (<svg viewBox="0 0 110 44" aria-hidden="true"><polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" points={p.join(" ")} /><circle cx={lx} cy={ly} r="3" fill={color} /></svg>);
  };

  const sen = chambers.senate, house = chambers.house, gov = chambers.governor;
  const oh = model.races.find((r) => r.id === picks[0].raceId)!;
  const govPick = model.races.find((r) => r.id === picks[4].raceId)!;
  const storyRace = (r: typeof oh) => {
    const lead = r.stages.rate < 0 ? r.dem : r.gop, trail = r.stages.rate < 0 ? r.gop : r.dem;
    return `${lastName(lead)} leads ${lastName(trail)} by ${Math.abs(r.stages.rate).toFixed(1)} in the model`;
  };

  return (
    <div className="opp">
      <section className="hero">
        <div className="hero-grid">
          <div>
            <span className="chip"><i />Fieldwork and modeling by The Public Sentiment Institute</span>
            <h1>Every race.<br />Every county.<br /><em>On point.</em></h1>
            <p>Polling averages, county level forecasts and live election results for the 2026 midterms, built on TPSI&apos;s own surveys and a transparent public poll feed.</p>
            <div className="cta">
              <Link className="btn g" href="/forecast">Open the forecast</Link>
              <Link className="btn" href="/polls">Polling averages</Link>
              <span style={{ fontSize: 12, color: "var(--mute)", marginLeft: 6 }}>Forecast updated {updated}</span>
            </div>
          </div>
          <div className="hero-panel kpi-stack">
            <Link href="/polls/approval" className="glass kpi">
              <div>
                <div className="lab">Trump job approval</div>
                <div className="v r"><CountUp value={r1(ap.approve)} suffix="%" /></div>
                <div className="sub">Net <span className="mono" style={{ color: "var(--gop2)" }}>{ap.net > 0 ? "+" : ""}{ap.net.toFixed(1)}</span> · daily average, {ap.count} polls</div>
                <div className="bar"><Grow w={ap.approve} color="var(--win)" /><Grow w={ap.disapprove} color="var(--gop)" /></div>
              </div>
              {spark(ap.daily.map((d) => d.net), "#ff3b5c")}
            </Link>
            <Link href="/polls/generic-ballot" className="glass kpi">
              <div>
                <div className="lab">Generic ballot</div>
                <div className={`v ${gb.net >= 0 ? "d" : "r"}`}>{gb.net >= 0 ? "D " : "R "}<CountUp value={r1(Math.abs(gb.net))} prefix="+" /></div>
                <div className="sub">{gbD} D · {gbR} R two party · {gb.count} polls</div>
                <div className="bar"><Grow w={gbD} color="var(--dem)" /><Grow w={gbR} color="var(--gop)" /></div>
              </div>
              {spark(gb.daily.map((d) => d.net), "#3d7bff")}
            </Link>
            <Link href="/forecast" className="glass kpi ctrl">
              <div className="lab">Chance of control, {meta.sims.toLocaleString()} simulations</div>
              <div className="odds">
                {([["Senate", sen], ["House", house], ["Governors", gov]] as const).map(([l, c]) => {
                  const d = c.demControl >= 0.5;
                  return (<div key={l}><div className="big" style={{ color: d ? "var(--dem2)" : "var(--gop2)" }}><CountUp value={Math.round((d ? c.demControl : c.gopControl) * 100)} suffix="%" /><small>{l}</small></div></div>);
                })}
              </div>
              <div className="sub">Chance Democrats {sen.demControl >= 0.5 ? "control" : "win"} each; Senate counts Nebraska&apos;s Osborn with the Democrats</div>
            </Link>
          </div>
        </div>
      </section>

      <ForecastDeskHome races={races} chambers={{ senate: sen, governor: gov }} initialCounty={initial} picks={picks}
        notUp={{ senD: meta.senNotUpD, senR: meta.senNotUpR, govD: meta.govNotUpD, govR: meta.govNotUpR }} />

      <section className="sec">
        <div className="sec-h">
          <div><div className="eye g">Polling averages</div><h2>Trends that see past the noise</h2>
            <p>Every public poll, weighted by recency, sample, voter screen and pollster grade. Race pages add robust LOWESS trend lines at three spans and an Election Day projection.</p></div>
          <Link className="btn more" href="/polls">All averages</Link>
        </div>
        <div className="grid2">
          <AveragePanel title="Trump job approval" href="/polls/approval" pill={`net ${ap.net.toFixed(1)}`} pillCls="r" color="#ff3b5c" fmt="net"
            series={pts(ap.daily)} polls={(APPROVAL_POLLS as RawPoll[]).filter((p) => Number.isFinite(p.results?.Approve)).map((p) => ({ t: new Date(p.endDate + "T00:00:00").getTime(), v: p.results.Approve - p.results.Disapprove }))}
            cols={["App", "Dis", "Net"]}
            avgRow={{ pollster: "OnPoint average", dates: "", sample: "", a: ap.approve.toFixed(1), b: ap.disapprove.toFixed(1), net: ap.net.toFixed(1), cls: "r" }}
            rows={latestRows(APPROVAL_POLLS as RawPoll[], "Approve", "Disapprove", false)} />
          <AveragePanel title="Generic congressional ballot" href="/polls/generic-ballot" pill={`${gb.net >= 0 ? "D" : "R"} +${Math.abs(gb.net).toFixed(1)}`} pillCls={gb.net >= 0 ? "d" : "r"} color="#3d7bff" fmt="gb"
            series={pts(gb.daily)} polls={gb.polls.map((p) => ({ t: p.t, v: p.net }))}
            cols={["Dem", "GOP", "Margin"]}
            avgRow={{ pollster: "OnPoint average", dates: "", sample: "", a: (gb.daily.at(-1)?.a ?? 0).toFixed(1), b: (gb.daily.at(-1)?.b ?? 0).toFixed(1), net: `${gb.net >= 0 ? "D" : "R"} +${Math.abs(gb.net).toFixed(1)}`, cls: gb.net >= 0 ? "d" : "r" }}
            rows={latestRows(GENERIC_POLLS as RawPoll[], "Democrats", "Republicans", true)} />
        </div>
      </section>

      <section className="sec">
        <div className="sec-h"><div><div className="eye g">Results desk</div><h2>Live returns, called by the desk</h2></div><span className="pill live" style={{ marginBottom: 6 }}>Election night ready</span></div>
        <div className="grid3">
          <ResultCard raceId={86349} title="Florida Governor, GOP primary" date="Aug 18" href="/results/2026-08-18/florida-governor-republican-primary" names={["Byron Donalds", "James Fishback", "Jay Collins"]} />
          <ResultCard raceId={87529} title="Oklahoma Governor, GOP runoff" date="Aug 25" href="/results/2026-08-25/oklahoma-governor-republican-runoff" names={["Gentner Drummond", "Mike Mazzei"]} />
          <Countdown />
        </div>
      </section>

      <section className="sec">
        <div className="sec-h"><div><div className="eye g">From TPSI</div><h2>Latest releases and model notes</h2></div><Link className="btn more" href="/tpsi/polls">All releases</Link></div>
        <div className="grid4">
          <Link href="/tpsi/polls/national-2026" className="card story">
            <div className="thumb"><svg viewBox="0 0 320 180" aria-hidden="true"><defs><linearGradient id="t1" x1="0" x2="1"><stop offset="0" stopColor="#064bf9" /><stop offset="1" stopColor="#83449c" /></linearGradient></defs><rect width="320" height="180" fill="#120820" /><path d="M0,140 C60,120 90,150 140,110 S240,60 320,50" fill="none" stroke="url(#t1)" strokeWidth="3" /><path d="M0,140 C60,120 90,150 140,110 S240,60 320,50 L320,180 L0,180Z" fill="url(#t1)" opacity=".18" /></svg><span className="lab">National · TPSI poll</span></div>
            <div className="card-b"><h3>The 2026 national poll: ballot, approval and the mood</h3><p>Registered and likely voters, weighted with the DSMeridian likely voter model.</p><div className="meta">Topline, crosstabs, methodology</div></div>
          </Link>
          <Link href={raceHref(oh.id)} className="card story">
            <div className="thumb"><svg viewBox="0 0 320 180" aria-hidden="true"><rect width="320" height="180" fill="#120820" /><MiniMap raceId={oh.id} /></svg><span className="lab">{oh.name}</span></div>
            <div className="card-b"><h3>{storyRace(oh)}</h3><p>{oh.office === "senate" ? "Senate" : "Governor"} Mode county model, {meta.sims.toLocaleString()} simulated elections.</p><div className="meta">{updated} · Forecast note</div></div>
          </Link>
          <Link href={raceHref(govPick.id)} className="card story">
            <div className="thumb"><svg viewBox="0 0 320 180" aria-hidden="true"><rect width="320" height="180" fill="#120820" /><MiniMap raceId={govPick.id} /></svg><span className="lab">{govPick.name}</span></div>
            <div className="card-b"><h3>{storyRace(govPick)}</h3><p>The closest governor&apos;s race in the model, {fmtM(govPick.stages.rate, isInd(govPick))}.</p><div className="meta">{updated} · Forecast note</div></div>
          </Link>
          <Link href="/forecast/methodology" className="card story">
            <div className="thumb"><svg viewBox="0 0 320 180" aria-hidden="true"><rect width="320" height="180" fill="#120820" /><g fill="none" stroke="#e7b341" strokeWidth="2" opacity=".9"><path d="M20,120 Q80,40 160,90 T300,70" /></g><g fill="#e7b341" opacity=".5"><circle cx="40" cy="110" r="3" /><circle cx="90" cy="70" r="3" /><circle cx="130" cy="95" r="3" /><circle cx="200" cy="80" r="3" /><circle cx="250" cy="60" r="3" /><circle cx="285" cy="75" r="3" /></g></svg><span className="lab">Methods</span></div>
            <div className="card-b"><h3>How OnPoint averages polls: robust LOWESS at three spans</h3><p>Every poll is one observation at its field midpoint.</p><div className="meta">Sep 28 · Methodology</div></div>
          </Link>
        </div>
      </section>

      <section className="sec">
        <div className="band">
          <div>
            <div className="eye" style={{ color: "var(--gold)" }}>Commission fieldwork</div>
            <h2 style={{ marginTop: 8 }}>Statewide, district or national polling with full crosstabs.</h2>
            <p>TPSI runs dual panel surveys weighted with the DSMeridian likely voter model. Campaigns, PACs and newsrooms get a topline in days, not weeks.</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Link className="btn white" href="/tpsi/services">Partner with TPSI</Link>
            <Link className="btn" href="/contact">Contact the desk</Link>
          </div>
          <Icon className="icon" size={260} gradient />
        </div>
      </section>
    </div>
  );
}
