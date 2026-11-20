import type { Metadata } from "next";
import Link from "@/app/components/Link";
import { getHomeStats } from "@/app/_polling/lib/homeStats";
import { aggPolls } from "@/app/_polling/lib/aggregates";
import { getModel, miniRaces, isInd } from "@/app/lib/forecastData";
import { fmtM, lastName, raceHref } from "@/app/lib/opp";
import HomeGlobe, { type GRace } from "@/app/components/home/HomeGlobe";
import { STATE_POLLS } from "@/app/on-point-polling/polls/pollMapData";
import HomeWhatIf from "@/app/components/home/HomeWhatIf";
import "@/app/components/home/home2.css";
import AveragePanel, { type TableRow } from "@/app/components/home/AveragePanel";
import ResultCard from "@/app/components/home/ResultCard";
import MiniMap from "@/app/components/home/MiniMap";
import { CountUp, Grow } from "@/app/components/home/motion";
import { Icon } from "@/app/components/opp/Logo";
import { Pointy } from "@/app/components/home/Mascot";
import { seo } from "@/app/lib/seo";
import HomeDeck from "@/app/components/home/HomeDeck";
import ResultsBand from "@/app/components/home/ResultsBand";
import HomeNext from "@/app/components/home/HomeNext";
import { featured } from "@/app/2028/data28";
import { STATE_NAME } from "@/app/2028/lib";
import { STATES as ST27, stateModel } from "@/app/2027/data27";
import { getAcc } from "@/app/accuracy/data";
import AdUnit from "@/app/components/AdUnit";
const APPROVAL_POLLS = aggPolls("trump-approval");
const GENERIC_POLLS = aggPolls("generic-ballot");

export const metadata: Metadata = seo({"title": "On Point Politics: 2028 election forecast, polls and results from On Point Polling", "description": "The 2028 presidential forecast and electoral map, every 2028 candidate, the Trump approval and generic ballot averages and the Senate leader race, from On Point Polling, whose final 2026 national poll was D +13.1 against a D +14.0 count.", "path": "/", "absoluteTitle": true});

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

export default function Home() {
  const stats = getHomeStats();
  const acc = getAcc();
  const model = getModel();
  const { chambers, meta } = model;
  const races = { senate: miniRaces("senate"), governor: miniRaces("governor") };

  // county simulation picks: the four closest Senate races and the closest governor's race
  const byClose = (o: "senate" | "governor") => Object.values(races[o]).sort((a, b) => Math.abs(a.m) - Math.abs(b.m));
  const picks = [...byClose("senate").slice(0, 4), ...byClose("governor").slice(0, 1)]
    .map((r) => ({ raceId: r.id, label: `${r.st} ${r.id.startsWith("gov") ? "Governor" : "Senate"}` }));

  const toG = (r: (typeof model.races)[number]): GRace => ({ id: r.id, st: r.st, name: r.name, dem: r.dem, gop: r.gop, m: r.est.margin, p: r.est.prob, ind: isInd(r), href: raceHref(r.id),
    pl: (r.polls ?? []).slice(0, 30).map((x) => [x.age, Math.round(x.margin * 10) / 10, x.n || 600] as [number, number, number]) });
  // the globe now shows what is next: the likeliest 2028 matchup state by state, and the three 2027 governor races
  const pair = featured(1)[0];
  const last28 = (n: string) => n.split(" ").slice(-1)[0];
  const g27 = ST27.map((s) => stateModel(s.code));
  const nextRaces: Record<string, GRace[]> = {
    p28: Object.entries(pair.st).filter(([k]) => !k.includes("-") && STATE_NAME[k]).map(([st, v]) => ({ id: `p28-${st}`, st, name: STATE_NAME[st], dem: pair.d, gop: pair.r, m: v[0], p: 1 - v[1], ind: false, href: `/2028/${st.toLowerCase()}`, label: STATE_NAME[st] })),
    g27: g27.map((S) => { const t = S.pairs[0]; return { id: `g27-${S.code}`, st: S.code, name: `${S.name} governor`, dem: t?.d ?? "Democrat", gop: t?.r ?? "Republican", m: t?.margin ?? S.margin, p: t?.pR ?? S.pR, ind: false, href: `/2027/${S.slug}` }; }),
  };
  const globeRaces: Record<"senate" | "governor", GRace[]> = {
    senate: model.races.filter((r) => r.office === "senate").map(toG),
    governor: model.races.filter((r) => r.office === "governor").map(toG),
  };
  const latestOp = STATE_POLLS.filter((s) => s.status === "released").slice(-2).map((s) => s.name).join(" and ");
  const ap = stats.approval, gb = stats.generic;
  const gbD = r1(50 + gb.net / 2), gbR = r1(100 - gbD);
  void globeRaces; // the 2026 globe data, kept for the forecast cards below
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
      <HomeGlobe races={nextRaces} tabs={[{ key: "p28", label: "2028 President", eyebrow: `Closest states, ${last28(pair.d)} v ${last28(pair.r)}` }, { key: "g27", label: "2027 Governors", eyebrow: "The 2027 governor races" }]}
        copy={{ aria: "The 2028 forecast and the 2027 governors on a globe", chip: { text: `The 2028 forecast · ${last28(pair.d)} v ${last28(pair.r)}, the likeliest matchup`, href: "/2028" },
          lede: "The 2028 presidential race and the three 2027 governor races on one globe. Spin it, hover a state for the odds, click it for the full forecast, county by county.",
          odds: [{ l: "White House 2028", v: pair.pD, href: "/2028" }, ...g27.map((S) => ({ l: S.name, v: 1 - S.pR, href: `/2027/${S.slug}` }))],
          cta: [{ label: "The 2028 forecast", href: "/2028" }, { label: "2027 governors", href: "/2027" }, { label: "Play Campaign 2028", href: "/play" }] }} />
      <HomeNext />
      <ResultsBand />
      <HomeDeck />
      <HomeWhatIf />

      <section className="sec">
        <div className="hero-panel kpi-stack home-kpis">
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
        </div>
      </section>

      <section className="sec">
        <div className="sec-h home-ph">
          <Pointy className="home-pty pa pty-side" pose="point" prop="chart" size={112} look={-1} flip say={<>Generic ballot: <span className={gb.net >= 0 ? "d" : "r"}><b>{gb.net >= 0 ? "D" : "R"} +{Math.abs(gb.net).toFixed(1)}</b></span> across {gb.count} polls.</>} />
          <div><div className="eye g">Polling averages</div><h2>Trends that see past the noise</h2>
            <p>One line per race: a robust local trend fit through every public poll, weighted by recency with a 16 day half life, sample, voter screen and pollster grade. Hover any day to read it.</p></div>
          <Link className="btn more" href="/polls">All averages</Link>
        </div>
        <div className="grid2">
          <AveragePanel title="Trump job approval" href="/polls/approval" pill={`net ${ap.net.toFixed(1)}`} pillCls="r" color="#ff3b5c" fmt="net"
            series={pts(ap.daily)} polls={(APPROVAL_POLLS as RawPoll[]).filter((p) => Number.isFinite(p.results?.Approve)).map((p) => ({ t: new Date(p.endDate + "T00:00:00").getTime(), v: p.results.Approve - p.results.Disapprove }))}
            cols={["App", "Dis", "Net"]}
            avgRow={{ pollster: "On Point average", dates: "", sample: "", a: ap.approve.toFixed(1), b: ap.disapprove.toFixed(1), net: ap.net.toFixed(1), cls: "r" }}
            rows={latestRows(APPROVAL_POLLS as RawPoll[], "Approve", "Disapprove", false)} />
          <AveragePanel title="Generic congressional ballot" href="/polls/generic-ballot" pill={`${gb.net >= 0 ? "D" : "R"} +${Math.abs(gb.net).toFixed(1)}`} pillCls={gb.net >= 0 ? "d" : "r"} color="#3d7bff" fmt="gb"
            series={pts(gb.daily)} polls={gb.polls.map((p) => ({ t: p.t, v: p.net }))}
            cols={["Dem", "GOP", "Margin"]}
            avgRow={{ pollster: "On Point average", dates: "", sample: "", a: (gb.daily.at(-1)?.a ?? 0).toFixed(1), b: (gb.daily.at(-1)?.b ?? 0).toFixed(1), net: `${gb.net >= 0 ? "D" : "R"} +${Math.abs(gb.net).toFixed(1)}`, cls: gb.net >= 0 ? "d" : "r" }}
            rows={latestRows(GENERIC_POLLS as RawPoll[], "Democrats", "Republicans", true)} />
        </div>
      </section>

      <AdUnit />

      <section className="sec">
        <div className="sec-h home-ph"><Pointy className="home-pty rd pty-side" pose="wave" prop="megaphone" size={104} look={1} say={<>{acc.headline.all.called_right} of {acc.headline.all.races} races called right.</>} /><div><div className="eye g">Results desk</div><h2>The returns, county by county</h2></div><span className="pill d" style={{ marginBottom: 6 }}>Results are in</span></div>
        <div className="grid3">
          <ResultCard raceId={86349} title="Florida Governor, GOP primary" date="Aug 18" href="/results/2026-08-18/florida-governor-republican-primary" names={["Byron Donalds", "James Fishback", "Jay Collins"]} />
          <ResultCard raceId={87529} title="Oklahoma Governor, GOP runoff" date="Aug 25" href="/results/2026-08-25/oklahoma-governor-republican-runoff" names={["Gentner Drummond", "Mike Mazzei"]} />
          <div className="card count post">
            <div className="card-b">
              <div className="eye">November 3</div>
              <div className="bignum" style={{ marginTop: 8 }}>Results in</div>
              <div style={{ fontSize: 13, color: "var(--ink2)", marginTop: 12 }}>Every Senate, House and governor race, county by county, with the final forecast beside the count. {acc.headline.all.counting ? `${acc.headline.all.counting} races were still counting at the last read.` : ""}</div>
              <Link className="btn white" style={{ marginTop: 14 }} href="/results/2026">Every result</Link>
              <Link className="btn" style={{ marginTop: 10 }} href="/accuracy">How the forecast did</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="sec-h home-ph"><Pointy className="home-pty op pty-side" pose="idle" prop="clipboard" size={104} look={-1} flip cap say={<>Fresh from the field: <b>{latestOp}</b>.</>} /><div><div className="eye g">From On Point Polling</div><h2>Latest releases and model notes</h2></div><Link className="btn more" href="/on-point-polling/polls">All releases</Link></div>
        <div className="grid4">
          <Link href="/on-point-polling/polls/texas-2026" className="card story">
            <div className="thumb"><svg viewBox="0 0 320 180" aria-hidden="true"><rect className="thb-bg" width="320" height="180" /><g className="thb-tx" fontFamily="var(--font-m)" fontSize="11"><text x="20" y="44">SENATE</text><text x="20" y="104">GOVERNOR</text></g><rect x="20" y="54" width="280" height="14" rx="7" className="thb-tr" /><rect x="20" y="54" width="137" height="14" rx="7" fill="#3d7bff" /><rect x="180" y="54" width="120" height="14" rx="7" fill="#ff3b5c" /><rect x="20" y="114" width="280" height="14" rx="7" className="thb-tr" /><rect x="20" y="114" width="127" height="14" rx="7" fill="#3d7bff" /><rect x="166" y="114" width="134" height="14" rx="7" fill="#ff3b5c" /></svg><span className="lab">On Point Polling · Texas</span></div>
            <div className="card-b"><h3>Texas poll: Talarico +5.8 over Paxton as Abbott holds on, +2.5</h3><p>661 Texas voters, October 17 to 18, with crossover, age, regions and how Texans plan to vote.</p><div className="meta">Oct 18 · Poll release</div></div>
          </Link>
          <Link href={raceHref(oh.id)} className="card story">
            <div className="thumb"><svg viewBox="0 0 320 180" aria-hidden="true"><rect className="thb-bg" width="320" height="180" /><MiniMap raceId={oh.id} /></svg><span className="lab">{oh.name}</span></div>
            <div className="card-b"><h3>{storyRace(oh)}</h3><p>{oh.office === "senate" ? "Senate" : "Governor"} Mode county model, {meta.sims.toLocaleString()} simulated elections.</p><div className="meta">{updated} · Forecast note</div></div>
          </Link>
          <Link href={raceHref(govPick.id)} className="card story">
            <div className="thumb"><svg viewBox="0 0 320 180" aria-hidden="true"><rect className="thb-bg" width="320" height="180" /><MiniMap raceId={govPick.id} /></svg><span className="lab">{govPick.name}</span></div>
            <div className="card-b"><h3>{storyRace(govPick)}</h3><p>The closest governor&apos;s race in the model, {fmtM(govPick.stages.rate, isInd(govPick))}.</p><div className="meta">{updated} · Forecast note</div></div>
          </Link>
          <Link href="/forecast/methodology" className="card story">
            <div className="thumb"><svg viewBox="0 0 320 180" aria-hidden="true"><rect className="thb-bg" width="320" height="180" /><g fill="none" stroke="#e7b341" strokeWidth="2" opacity=".9"><path d="M20,120 Q80,40 160,90 T300,70" /></g><g fill="#e7b341" opacity=".5"><circle cx="40" cy="110" r="3" /><circle cx="90" cy="70" r="3" /><circle cx="130" cy="95" r="3" /><circle cx="200" cy="80" r="3" /><circle cx="250" cy="60" r="3" /><circle cx="285" cy="75" r="3" /></g></svg><span className="lab">Methods</span></div>
            <div className="card-b"><h3>How On Point averages polls: one robust LOWESS line, weighted</h3><p>The trend fit is now the average itself, with a 16 day recency half life.</p><div className="meta">Oct 22 · Methodology</div></div>
          </Link>
        </div>
      </section>

      <section className="sec">
        <div className="band">
          <div>
            <div className="eye" style={{ color: "var(--gold)" }}>Commission fieldwork</div>
            <h2 style={{ marginTop: 8 }}>Statewide, district or national polling with full crosstabs.</h2>
            <p>On Point Polling runs dual panel surveys weighted with the DSMeridian likely voter model. Campaigns, PACs and newsrooms get a topline in days, not weeks.</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Link className="btn white" href="/on-point-polling/services">Partner with On Point Polling</Link>
            <Link className="btn" href="/contact">Contact the desk</Link>
          </div>
          <Icon className="icon" size={260} gradient />
          <Pointy className="home-pty band" pose="cheer" prop="megaphone" size={120} look={-1} flip />
        </div>
      </section>
    </div>
  );
}
