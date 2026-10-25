// The home page's front door under the globe: one tile per section people come for, each with a live number
// from that section so the tile answers something before it is clicked. Brazil leads through its count, then the
// War Room, the forecasts, What If, the early vote, the news desk and the people web.
import Link from "next/link";
import { getModel } from "@/app/lib/forecastData";
import { getBr } from "@/app/brasil/data";
import { getWarIndex } from "@/app/watchdog/war-room/data";
import { healthTone, surname } from "@/app/watchdog/war-room/fmt";
import { getDesk } from "@/app/news/data";
import { getPeople } from "@/app/watchdog/data";
import "./home-deck.css";

const pc = (p: number) => `${Math.round(100 * p)}%`;

export default function HomeDeck() {
  const { chambers, meta } = getModel();
  const br = getBr().national;
  const war = getWarIndex();
  const desk = getDesk();
  const people = getPeople();
  const now = Date.now();
  const brLive = now >= Date.parse("2026-10-25T20:00:00Z"), brDone = now >= Date.parse("2026-10-27T12:00:00Z");
  const top = war.races.filter((r) => r.office === "senate" && r.hD != null && r.hR != null).sort((a, b) => Math.abs(a.p - 0.5) - Math.abs(b.p - 0.5)).slice(0, 3);
  const flags = war.races.filter((r) => r.p > 0.15 && r.p < 0.85 && r.hD != null && r.hR != null && Math.abs(r.hD - r.hR) >= 15 && (r.p < 0.5 ? r.hR! > r.hD! : r.hD! > r.hR!)).length;
  const ctl: [string, number, string][] = [
    ["Senate", chambers.senate.demControl, "control"],
    ["House", chambers.house.demControl, "control"],
    ["Governors", chambers.governor.demControl, "a majority"],
  ];
  return (
    <section className="sec hd" aria-label="Start here">
      <div className="hd-h">
        <div className="eye g">Start here</div>
        <h2>{meta.daysOut} days out. Everything on the desk.</h2>
      </div>
      <div className="hd-grid">
        <Link href={brLive && !brDone ? "/brasil/resultados" : "/brasil"} className="hd-t hd-br glass" data-ev="Home tile" data-ev-d='{"tile":"brazil"}'>
          <span className="hd-k">{brDone ? "Brazil 2026 · final count" : brLive ? "Brazil runoff · counting now" : "Brazil runoff · today"}</span>
          <b className="hd-title">Flávio Bolsonaro vs Lula</b>
          <span className="hd-p">{brLive ? "Live results for every state and municipality as Brazil's electoral court reports them, against our forecast." : "Polls close at 5 PM in Brasília. Our forecast, a map of all 5,570 municipalities and the live count at 4 PM Eastern."}</span>
          <span className="hd-odds"><span className="fl">Flávio {(100 * br.p_flavio).toFixed(1)}%</span><i style={{ ["--w" as string]: `${100 * br.p_flavio}%` }} /><span className="lu">Lula {(100 * br.p_lula).toFixed(1)}%</span></span>
          <span className="hd-links"><span>Forecast</span><span>Live results</span><span>States</span><span>In Portuguese</span></span>
        </Link>

        <Link href="/watchdog/war-room" className="hd-t hd-war glass" data-ev="Home tile" data-ev-d='{"tile":"war room"}'>
          <span className="hd-k">New · War Room</span>
          <b className="hd-title">Every campaign&apos;s vital signs</b>
          <span className="hd-p">A health score for both campaigns in {war.races.length} races and how each side wins, briefed for a Democratic or Republican operative. {flags} races where money and the polls disagree.</span>
          <span className="hd-vitals">
            {top.map((r) => (
              <span key={r.id} className="hd-v">
                <span className="nm">{r.st} Senate</span>
                <span className="bars"><i className={`d ${healthTone(r.hD)}`} style={{ width: `${r.hD}%` }} /><i className={`r ${healthTone(r.hR)}`} style={{ width: `${r.hR}%` }} /></span>
                <span className="sc">{surname(r.dem)} {r.hD} · {surname(r.gop)} {r.hR}</span>
              </span>
            ))}
          </span>
        </Link>

        <Link href="/forecast" className="hd-t glass" data-ev="Home tile" data-ev-d='{"tile":"forecast"}'>
          <span className="hd-k">Forecasts</span>
          <b className="hd-title">Who is favored</b>
          <span className="hd-ctl">
            {ctl.map(([l, p, w]) => (
              <span key={l}><span className="l">{l}</span><span className="bar"><i style={{ width: `${100 * p}%` }} /></span><span className="v"><b className="d">D {pc(p)}</b> <small>{w}</small></span></span>
            ))}
          </span>
          <span className="hd-p sm">{meta.sims.toLocaleString()} simulated elections, rerun twice a day.</span>
        </Link>

        <Link href="/what-if" className="hd-t glass" data-ev="Home tile" data-ev-d='{"tile":"what if"}'>
          <span className="hd-k">What If</span>
          <b className="hd-title">Call the races yourself</b>
          <span className="hd-p">Flip any Senate, House or governor race and the model reruns the rest around your calls, with the correlations between states kept.</span>
          <span className="hd-links"><span>What If</span><span>Swingometer</span><span>Scenarios</span></span>
        </Link>

        <Link href="/maps/early-vote" className="hd-t glass" data-ev="Home tile" data-ev-d='{"tile":"early vote"}'>
          <span className="hd-k">Early vote</span>
          <b className="hd-title hd-num">{war.ballots ? `${(war.ballots / 1e6).toFixed(1)}M` : "Tracker"}</b>
          <span className="hd-p">{war.ballots ? `ballots already cast in ${war.evStates} states through ${war.ev}, with party of the ballots where states report it, county and precinct reads.` : "Ballots cast so far, by state and party."}</span>
        </Link>

        <Link href="/news" className="hd-t hd-news glass" data-ev="Home tile" data-ev-d='{"tile":"news"}'>
          <span className="hd-k">News desk</span>
          <b className="hd-title">What happened today</b>
          <span className="hd-list">{desk.stories.slice(0, 3).map((s) => <span key={s.id}>{s.title}</span>)}</span>
        </Link>

        <Link href="/watchdog/people/web" className="hd-t hd-web glass" data-ev="Home tile" data-ev-d='{"tile":"people web"}'>
          <span className="hd-k">Watchdog · People files</span>
          <b className="hd-title">Who is tied to whom</b>
          <span className="hd-p">{people.n.toLocaleString()} files on every member of Congress, governor and nominee, wired by race, committee, delegation and shared donors. Put anyone at the center.</span>
          <svg className="hd-webart" viewBox="0 0 160 90" aria-hidden="true">
            <g className="e"><path d="M80 45 L30 20 M80 45 L130 18 M80 45 L28 72 M80 45 L134 70 M80 45 L80 8 M30 20 L130 18 M28 72 L134 70" /></g>
            <circle cx="80" cy="45" r="8" className="c" /><circle cx="30" cy="20" r="4.5" className="d" /><circle cx="130" cy="18" r="4.5" className="r" /><circle cx="28" cy="72" r="4.5" className="r" /><circle cx="134" cy="70" r="4.5" className="d" />
            <rect x="76" y="4" width="8" height="8" transform="rotate(45 80 8)" className="h" />
          </svg>
        </Link>
      </div>
      <p className="hd-foot"><Link href="/results">Election night results desk</Link> · <Link href="/polls">Polling averages</Link> · <Link href="/watchdog">Watchdog</Link> · <Link href="/forecast/changelog">What changed in the forecast</Link></p>
    </section>
  );
}
