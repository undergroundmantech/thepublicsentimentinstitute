import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import Link from "@/app/components/Link";
import JsonLd from "@/app/components/JsonLd";
import { crumbsLd, graph, pageLd, seo } from "@/app/lib/seo";
import { ARCHIVE_2026, NIGHT_2026, buildAggregate, rMinusD, type AggregateDef } from "@/app/_polling/lib/aggregates";
import { ACCURACY_2026 } from "@/app/_polling/lib/ratings2026";
import { STATE_NAME } from "@/app/lib/opp";
import "../../2028/p2028.css";

// Nov 24 2026: the 2026 polling averages, archived. Every Senate and governor average and the national averages, read on
// Election Day from the polls that ended by November 3, under the 2026 ratings (aggregates.ts ARCHIVE_2026), next to the
// average as it stood on the night and the result.
const DESC = "The final 2026 polling averages for every Senate and governor race and the national generic ballot, Trump approval and right track, rerun under the 2026 pollster ratings and set against the results.";
export const metadata: Metadata = seo({ title: "2026 polling averages archive: every Senate and governor race against the result", description: DESC, path: "/polls/archive/2026", type: "article", modified: "2026-11-24" });

type Res = { id: string; act: number | null; fin: boolean; dn: string; rn: string; ind: boolean };
function results(): Record<string, Res> {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "accuracy", "2026.json"), "utf8")) as { races: Res[] };
    return Object.fromEntries(j.races.map((r) => [r.id, r]));
  } catch { return {}; }
}
const last = (d: AggregateDef) => { const b = buildAggregate(d); const x = b.latest; return x ? { net: x.net, n: b.polls.length } : null; };
const fmt = (m: number | null | undefined, ind = false) => (m == null || !Number.isFinite(m) ? "" : Math.abs(m) < 0.05 ? "Even" : `${m > 0 ? "R" : ind ? "I" : "D"} +${Math.abs(m).toFixed(1)}`);
const miss = (avg: number | null, act: number | null) => (avg == null || act == null ? null : avg - act);
const missTxt = (x: number | null) => (x == null ? "" : `${Math.abs(x).toFixed(1)} ${x > 0 ? "R" : "D"}`);

type Row = { key: string; office: "Senate" | "Governor"; st: string; name: string; matchup: string; n: number; now: number | null; night: number | null; act: number | null; ind: boolean; fin: boolean; href: string };

function build(): { rows: Row[]; nat: { id: string; label: string; now: number | null; night: number | null; n: number }[] } {
  const R = results();
  const pick = new Map<string, { a: AggregateDef; night: AggregateDef }>();
  for (const a of ARCHIVE_2026) {
    if (!a.stateAbbr) continue;
    const key = `${a.category === "2026 Senate" ? "sen" : "gov"}-${a.stateAbbr}`;
    const night = NIGHT_2026.find((x) => x.id === a.id)!;
    const cur = pick.get(key);
    if (!cur || a.polls.length > cur.a.polls.length) pick.set(key, { a, night });   // a state with more than one matchup keeps its best polled
  }
  const rows: Row[] = [];
  for (const [key, { a, night }] of pick) {
    if (!a.polls.length) continue;
    const L = last(a), N = last(night), r = R[key];
    const office = key.startsWith("sen") ? "Senate" : "Governor";
    rows.push({ key, office, st: a.stateAbbr!, name: `${STATE_NAME[a.stateAbbr!] ?? a.stateAbbr} ${office}`, matchup: a.label, n: L?.n ?? 0,
      now: L ? rMinusD(a, L.net) : null, night: N ? rMinusD(night, N.net) : null, act: r?.act ?? null, ind: !!r?.ind, fin: !!r?.fin,
      href: `/forecast/${a.stateAbbr!.toLowerCase()}/${office === "Senate" ? "senate" : "governor"}` });
  }
  rows.sort((x, y) => (x.office === y.office ? x.name.localeCompare(y.name) : x.office === "Senate" ? -1 : 1));
  const LBL: Record<string, string> = { "generic-ballot": "Generic ballot", "trump-approval": "Trump approval", "right-wrong-track": "Right track" };
  const nat = ARCHIVE_2026.filter((a) => LBL[a.id]).map((a) => {
    const L = last(a), N = last(NIGHT_2026.find((x) => x.id === a.id)!);
    return { id: a.id, label: LBL[a.id], now: L ? rMinusD(a, L.net) : null, night: N ? rMinusD(a, N.net) : null, n: L?.n ?? 0 };
  });
  return { rows, nat };
}

function stats(rows: Row[], k: "now" | "night") {
  const s = rows.filter((r) => r[k] != null && r.act != null);
  const e = s.map((r) => (r[k] as number) - (r.act as number));
  const n = e.length || 1;
  return { n: s.length, mae: e.reduce((a, x) => a + Math.abs(x), 0) / n, bias: e.reduce((a, x) => a + x, 0) / n,
    right: s.filter((r) => Math.sign(r[k] as number) === Math.sign(r.act as number)).length };
}

export default function Page() {
  const { rows, nat } = build();
  const A = stats(rows, "now"), B = stats(rows, "night");
  const gb = nat.find((x) => x.id === "generic-ballot");
  const genericResult = -ACCURACY_2026.generic.count;   // R minus D
  const natTxt = (id: string, v: number | null) => (v == null ? "" : id === "generic-ballot" ? fmt(v) : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)} net`);
  return (
    <div className="opp rt">
      <JsonLd data={graph(
        crumbsLd([["Home", "/"], ["Polls", "/polls"], ["2026 archive", "/polls/archive/2026"]]),
        pageLd({ name: "2026 polling averages archive", description: DESC, path: "/polls/archive/2026", modified: "2026-11-24", about: "Polling averages" }),
      )} />
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/polls">Polls</Link><span className="sep">/</span><span aria-current="page">2026 archive</span></nav>
      <header className="ph">
        <div className="eye g">Polling averages archive · 2026 midterms</div>
        <h1>The 2026 averages, <em>rerated</em></h1>
        <p className="lede">Every 2026 Senate and governor polling average, read on Election Day from the polls that ended by November 3, rerun under the 2026 pollster ratings: the 2026 grades, the 2026 Gold Standard at the top weight and the November 24 partisan corrections. Next to each is the average as it stood on the night and the result.</p>
      </header>

      <section className="card">
        <div className="card-h"><h3>How the averages did</h3><span className="eye" style={{ marginLeft: "auto" }}>{A.n} races with a result</span></div>
        <div className="rt-kpi">
          <div><span>Average miss, rerated</span><b>{A.mae.toFixed(1)}</b></div>
          <div><span>Average miss, on the night</span><b>{B.mae.toFixed(1)}</b></div>
          <div><span>Lean, rerated</span><b>{missTxt(A.bias)}</b></div>
          <div><span>Winner right, rerated</span><b>{A.right} of {A.n}</b></div>
        </div>
        <p className="pf-note">A miss is the average&apos;s margin less the result. On the night the averages leaned {missTxt(B.bias)} and named {B.right} of {B.n} winners. The whole field of 2026 polls missed toward Republicans, so the ratings move the averages toward the result but cannot close the shared miss.</p>
      </section>

      <section className="card">
        <div className="card-h"><h3>National averages on Election Day</h3></div>
        <div className="tblwrap">
          <table className="tbl rt-tbl">
            <thead><tr><th>Average</th><th className="n">Polls</th><th className="n">Rerated</th><th className="n">On the night</th><th className="n">Result</th></tr></thead>
            <tbody>
              {nat.map((x) => (
                <tr key={x.id}><td className="who">{x.label}</td><td className="n">{x.n}</td><td className="n mono">{natTxt(x.id, x.now)}</td><td className="n mono">{natTxt(x.id, x.night)}</td>
                  <td className="n mono">{x.id === "generic-ballot" ? fmt(genericResult) : ""}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {gb ? <p className="pf-note">The House vote came in at D +{ACCURACY_2026.generic.count.toFixed(1)}. Approval and right track are net figures, approve less disapprove and right less wrong.</p> : null}
      </section>

      {(["Senate", "Governor"] as const).map((o) => (
        <section className="card" key={o}>
          <div className="card-h"><h3>{o} races</h3><span className="eye" style={{ marginLeft: "auto" }}>{rows.filter((r) => r.office === o).length} averages</span></div>
          <div className="tblwrap">
            <table className="tbl rt-tbl">
              <thead><tr><th>Race</th><th className="n">Polls</th><th className="n">Rerated</th><th className="n">On the night</th><th className="n">Result</th><th className="n">Miss, rerated</th><th className="n">Winner</th></tr></thead>
              <tbody>
                {rows.filter((r) => r.office === o).map((r) => {
                  const m = miss(r.now, r.act);
                  const right = r.now != null && r.act != null && Math.abs(r.now) >= 0.05 ? Math.sign(r.now) === Math.sign(r.act) : null;
                  return (
                    <tr key={r.key}>
                      <td className="who"><Link href={r.href}>{r.name}</Link><span className="ty"> {r.matchup}</span></td>
                      <td className="n">{r.n}</td>
                      <td className="n mono">{fmt(r.now, r.ind)}</td>
                      <td className="n mono">{fmt(r.night, r.ind)}</td>
                      <td className="n mono">{fmt(r.act, r.ind)}{r.fin ? "" : " *"}</td>
                      <td className="n">{missTxt(m)}</td>
                      <td className={right == null ? "n" : right ? "n rt-up" : "n rt-dn"}>{right == null ? (r.now != null ? "Tied" : "") : right ? "Right" : "Wrong"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="pf-note">Each race links to its forecast page, which keeps the full average and every poll. A state with more than one polled matchup shows its best polled one. A result marked * was still being counted when it was recorded.</p>
        </section>
      ))}

      <section className="card">
        <div className="card-h"><h3>Method</h3></div>
        <div className="rt-prose">
          <p>Each average is the same robust LOWESS fit the polling desk runs, on the polls that ended by November 3. The rerated version weighs every firm by its grade on 2026 accuracy, gives the 2026 Gold Standard the top weight, and moves each partisan poll back by the November 24 corrections, firm by firm. See the <Link href="/polls/ratings">pollster ratings</Link> for the grades and corrections, and the <Link href="/polls/archive/2024">2024 archive</Link> for the last presidential race.</p>
        </div>
      </section>
    </div>
  );
}
