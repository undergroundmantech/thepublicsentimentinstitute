import type { Metadata } from "next";
import Link from "@/app/components/Link";
import PollsterList from "./PollsterList";
import { seo } from "@/app/lib/seo";
import { RECENCY_HALF_LIFE_DAYS } from "@/app/_polling/lib/buildDailyModel";

export const metadata: Metadata = seo({"title": "On Point Polling methodology", "description": "How On Point Polling fields and weights its polls with the DSMeridian likely voter model, and how On Point Politics weights Gold Standard pollsters in its averages.", "path": "/on-point-polling/methodology", "type": "article"});

// kept in sync with the POLLSTERS list in ./PollsterList (a server page cannot read values out of a client module)
const POLLSTER_COUNT = 8;

const STAGES: [string, string, string][] = [
  ["01", "Build the electorate", "Each sample is weighted to the registered population on the state voter file: age and gender always, race and education where the sample supports it, region where every mode carries geography."],
  ["02", "Likely voter model", "DSMeridian scores every respondent on two parts, survey engagement and validated vote history, and turns the combined score into a probability of voting."],
  ["03", "Meridian allocation", "Respondents are segmented into Meridian coalitions by their voting behavior, the lens used to read primaries and crossover voters."],
  ["04", "Turnout projection", "Expected turnout follows from the fitted likely voter curve, bounded by the voter file, past turnout in the same kind of election and early ballots cast."],
];

const CRITERIA: [string, string, string[]][] = [
  ["ACC", "Accuracy", ["Repeatable performance across electoral environments", "Stable, trackable readings suitable for time series modeling", "No extreme methodological drift without disclosure"]],
  ["TRN", "Transparency", ["Field dates and sample size published", "Defined universe (A/RV/LV) and mode when available", "Sponsor disclosure or full release notes when applicable"]],
  ["STD", "Standards", ["Clear toplines and consistent formatting across releases", "Question wording consistency preferred for trackers", "Auditable, public facing or verifiable releases"]],
];

export default function Page() {
  return (
    <div className="opp">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/on-point-polling">On Point Polling</Link><span className="sep">/</span><span>Methodology</span></nav>
      <header className="ph">
        <div className="eye g">Methodology</div>
        <h1>How the numbers are <em>weighted</em></h1>
        <p className="lede">On Point Polling fields dual panel surveys and weights them with the DSMeridian likely voter model. On Point Politics averages add a Gold Standard upweight for a curated set of pollsters that meet criteria for consistency, transparency and real world accuracy.</p>
        <div className="pmeta">
          <span>Gold Standard pollsters <b className="mono">{POLLSTER_COUNT}</b></span>
          <span>Upweight <b className="mono">x2.00</b></span>
          <span>Effective √n <b className="mono">x2.00</b></span>
        </div>
      </header>

      <div className="layout">
        <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
          <div className="card">
            <div className="card-h"><h3>How On Point Polling polls</h3><span className="eye" style={{ marginLeft: "auto" }}>DSMeridian</span></div>
            <div>
              {STAGES.map(([n, t, s]) => (
                <div key={n} className="gs-stage"><span className="mono">{n}</span><div><b>{t}</b><p>{s}</p></div></div>
              ))}
            </div>
          </div>

          <div>
            <div className="eye" style={{ margin: "8px 0 10px" }}>Gold Standard designation criteria</div>
            <div className="grid3">
              {CRITERIA.map(([code, label, items]) => (
                <div key={code} className="card">
                  <div className="card-h"><h3>{label}</h3><span className="eye mono" style={{ marginLeft: "auto" }}>{code}</span></div>
                  <ul className="card-b gs-crit">{items.map((it) => <li key={it}>{it}</li>)}</ul>
                </div>
              ))}
            </div>
          </div>

          <PollsterList />
        </div>

        <aside className="side">
          <div className="card">
            <div className="card-h"><h3>How the average is fit</h3><span className="eye">Robust LOWESS</span></div>
            <div className="card-b">
              <p style={{ fontSize: 13.5 }}>Every On Point average is a robust LOWESS fit, the locally weighted regression of Cleveland 1979, rebuilt for every day of the race. The LOWESS is the average itself, not a line drawn beside it.</p>
              <ol className="lw-steps">
                <li><b>Weigh each poll.</b> Sample size, voter screen, pollster grade, a {RECENCY_HALF_LIFE_DAYS} day recency half life and repeat and undecided discounts set each poll&rsquo;s weight, no poll may carry more than 15 percent, and polls older than 150 days drop out.</li>
                <li><b>Fit a local line.</b> Those weights are the LOWESS kernel for a weighted straight line through time, read at the day itself, so a steady move in the newest polls shows up on the day instead of lagging a week behind.</li>
                <li><b>Keep the slope honest.</b> The slope is shrunk toward flat when only a few polls carry the weight and the lift it can add is capped at 1.5 points, so one fresh poll cannot tilt the line.</li>
                <li><b>Three robustness passes.</b> Each poll&rsquo;s distance from the fit is scored against the weighted median miss with bisquare weights, and the line is refit three times. A poll far from the rest is weighed down in proportion to how far out it sits, and ordinary sampling noise of a point or so is never cut.</li>
              </ol>
              <p style={{ fontSize: 13.5 }}>Excluded firms are dropped before the fit and the measured lean of a Republican or Democratic leaning firm comes off before the fit, so the robustness passes judge every poll on the same footing.</p>
            </div>
          </div>
          <div className="card">
            <div className="card-h"><h3>How upweighting works</h3></div>
            <div className="card-b">
              <p style={{ fontSize: 13.5 }}>Gold Standard pollsters carry the top pollster grade, <span className="mono">6×</span> the weight of a baseline B grade firm, in every Senate, governor, House and national average. In the national generic ballot, approval and right track averages they also get an effective sample size inflation of <span className="mono">n′ = n × m²</span> where <span className="mono">m = 2</span>.</p>
              <p style={{ fontSize: 13.5 }}>Rasmussen Reports and ActiVote are not counted in any average. Trafalgar and InsiderAdvantage are labelled Republican leaning, and Democratic firms such as Public Policy Polling, Change Research, Global Strategy Group, GBAO, Data for Progress, GQR, Hart Research, Lake Research, Civiqs and Navigator are labelled Democratic leaning. Each of their polls is compared with the other polls of the same race ended within three weeks of it, the gap is pooled across every race and shrunk toward zero, and that many points come off the margin toward the other side before the poll enters the average. A firm whose polls do not actually run toward its side is not moved. Joint releases by a Democratic and a Republican firm are not moved. The poll tables show every poll as published, marked R lean or D lean, and the chart draws the published poll as a hollow dot joined to the point the average counts.</p>
            </div>
          </div>
          <div className="card"><div className="card-b">
            <div className="eye">Submit a pollster</div>
            <p style={{ fontSize: 14, margin: "8px 0 12px" }}>Have a release with field dates, sample details and documentation? Send it over. Every submission is reviewed against the criteria.</p>
            <Link className="btn g" href="/contact">Contact the desk</Link>
          </div></div>
          <div className="callout"><div className="eye">See it applied</div>The upweight feeds every <Link href="/polls" style={{ textDecoration: "underline" }}>On Point average</Link>; On Point Polling&rsquo;s own surveys are on the <Link href="/on-point-polling/polls" style={{ textDecoration: "underline" }}>releases page</Link>.</div>
        </aside>
      </div>
      <style>{`
        .opp .gs-stage { display: grid; grid-template-columns: 36px 1fr; gap: 12px; padding: 14px 18px; border-top: 1px solid var(--line); }
        .opp .gs-stage:first-child { border-top: 0; }
        .opp .lw-steps { margin: 10px 0; padding-left: 18px; display: grid; gap: 8px; font-size: 13.5px; }
        .opp .lw-steps b { color: var(--hi); }
        .opp .gs-stage > .mono { color: var(--mute); font-weight: 700; font-size: 12px; padding-top: 2px; }
        .opp .gs-stage b { font: 700 15px var(--font-d); }
        .opp .gs-stage p { font-size: 14px; margin: 4px 0 0; }
        .opp .gs-crit { margin: 0; padding: 14px 18px 16px 34px; display: grid; gap: 6px; font-size: 13.5px; }
        .opp .gs-crit li { margin: 0; }
        .opp .gs-row { border-top: 1px solid var(--line); }
        .opp .gs-row:first-child { border-top: 0; }
        .opp .gs-head { width: 100%; display: grid; grid-template-columns: 26px 44px minmax(0,1fr) auto 40px 52px 40px; gap: 12px; align-items: center; padding: 12px 18px; background: none; border: 0; cursor: pointer; text-align: left; color: var(--ink); transition: background .15s; }
        .opp .gs-head:hover, .opp .gs-row.open .gs-head { background: var(--glass2); }
        .opp .gs-head:focus-visible { outline: 2px solid var(--hi); outline-offset: -2px; }
        .opp .gs-idx { color: var(--mute2); font-size: 12px; }
        .opp .gs-abbr { color: var(--mute); font-size: 12px; font-weight: 700; }
        .opp .gs-name { font-weight: 700; font-size: 14px; }
        .opp .gs-dots, .opp .gs-key { display: flex; gap: 4px; align-items: center; }
        .opp .gs-dots i, .opp .gs-key i { width: 8px; height: 8px; border-radius: 50%; background: rgba(var(--line-rgb),.12); display: inline-block; }
        .opp .gs-dots i.on, .opp .gs-key i.on { background: var(--ink2); }
        .opp .gs-disc { font-size: 12px; color: var(--mute); text-align: right; }
        .opp .gs-mult { font-size: 13px; font-weight: 700; text-align: right; }
        .opp .gs-chev { font-size: 11.5px; color: var(--mute); text-align: right; }
        .opp .gs-detail { display: grid; grid-template-columns: 1.3fr 1fr; gap: 20px; padding: 6px 18px 18px 56px; }
        .opp .gs-why { list-style: none; padding: 0; margin: 8px 0 0; display: grid; gap: 8px; font-size: 13.5px; color: var(--ink2); }
        .opp .gs-why li { margin: 0; display: grid; grid-template-columns: 26px 1fr; }
        .opp .gs-why .mono { color: var(--mute); font-size: 12px; }
        .opp .gs-checks { margin-top: 4px; }
        .opp .gs-key { flex-wrap: wrap; gap: 8px 16px; padding: 12px 18px; border-top: 1px solid var(--line); font-size: 12px; color: var(--mute); }
        .opp .gs-key span { display: inline-flex; align-items: center; gap: 6px; }
        @media (max-width: 700px) {
          .opp .gs-head { grid-template-columns: 26px minmax(0,1fr) 52px; }
          .opp .gs-abbr, .opp .gs-dots, .opp .gs-disc, .opp .gs-chev { display: none; }
          .opp .gs-detail { grid-template-columns: 1fr; padding-left: 18px; }
        }
      `}</style>
    </div>
  );
}
