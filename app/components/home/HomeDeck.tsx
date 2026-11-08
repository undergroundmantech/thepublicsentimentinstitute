// The home page's front door under the globe: one tile per section people come for, each with a live number
// from that section so the tile answers something before it is clicked. The accuracy report leads, then the
// War Room, the forecasts, What If, On Point Polling, the news desk and the people web.
import Link from "@/app/components/Link";
import { getModel } from "@/app/lib/forecastData";
import { getBench, getPolling } from "@/app/accuracy/bench";
import { getWarIndex } from "@/app/watchdog/war-room/data";
import { healthTone, surname } from "@/app/watchdog/war-room/fmt";
import { getDesk } from "@/app/news/data";
import { getPeople } from "@/app/watchdog/data";
import "./home-deck.css";

const pc = (p: number) => `${Math.round(100 * p)}%`;

export default function HomeDeck() {
  const { chambers, meta } = getModel();
  const B = getBench(), P = getPolling();
  const war = getWarIndex();
  const desk = getDesk();
  const people = getPeople();
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
        <h2>After the midterms. Everything on the desk.</h2>
      </div>
      <div className="hd-grid">
        <Link href="/accuracy" className="hd-t hd-acc glass" data-ev="Home tile" data-ev-d='{"tile":"accuracy"}'>
          <span className="hd-k">The 2026 accuracy report</span>
          <b className="hd-title">The most accurate poll in America</b>
          <span className="hd-p">Our final national poll had Democrats up {B.generic.us.margin.toFixed(1)}. The result: D +{B.generic.result.margin.toFixed(1)}. Then every race, county and district against the count.</span>
          <span className="hd-links"><span>The poll</span><span>Every pollster</span><span>Our polls</span><span>The forecast</span></span>
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
          <span className="hd-k">Final forecast</span>
          <b className="hd-title">Who was favored</b>
          <span className="hd-ctl">
            {ctl.map(([l, p, w]) => (
              <span key={l}><span className="l">{l}</span><span className="bar"><i style={{ width: `${100 * p}%` }} /></span><span className="v"><b className="d">D {pc(p)}</b> <small>{w}</small></span></span>
            ))}
          </span>
          <span className="hd-p sm">{meta.sims.toLocaleString()} simulated elections, frozen November 3.</span>
        </Link>

        <Link href="/what-if" className="hd-t glass" data-ev="Home tile" data-ev-d='{"tile":"what if"}'>
          <span className="hd-k">What If</span>
          <b className="hd-title">Call the races yourself</b>
          <span className="hd-p">Flip any Senate, House or governor race and the model reruns the rest around your calls, with the correlations between states kept.</span>
          <span className="hd-links"><span>What If</span><span>Swingometer</span><span>Scenarios</span></span>
        </Link>

        <Link href="/on-point-polling" className="hd-t glass" data-ev="Home tile" data-ev-d='{"tile":"on point polling"}'>
          <span className="hd-k">On Point Polling</span>
          <b className="hd-title hd-num">{P.summary.all.right} of {P.summary.all.n}</b>
          <span className="hd-p">race winners called by our final state and district polls, with a {P.summary.senate.mae.toFixed(1)} point average miss in Senate races. Commission a poll.</span>
        </Link>

        <Link href="/news" className="hd-t hd-news glass" data-ev="Home tile" data-ev-d='{"tile":"news"}'>
          <span className="hd-k">News desk</span>
          <b className="hd-title">What happened today</b>
          <span className="hd-list">{desk.stories.slice(0, 3).map((s) => <span key={s.id}>{s.title}</span>)}</span>
        </Link>

        <Link href="/play" className="hd-t hd-play glass" data-ev="Home tile" data-ev-d='{"tile":"play"}'>
          <span className="hd-k">New · Play</span>
          <b className="hd-title">Campaign 2026: run the race yourself</b>
          <span className="hd-p">Take over a real Senate or governor campaign on Labor Day: raise the money, work the counties, hire your pollster, fight the air war and answer the news. Voters react the way our data says they would. Then watch your election night.</span>
          <span className="hd-links"><span>{war.races.filter((r) => r.office !== "house" && Math.abs(r.m) < 15).length} close races</span><span>Four levels</span><span>Election night</span></span>
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
