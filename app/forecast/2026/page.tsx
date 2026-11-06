import fs from "node:fs";
import path from "node:path";
import Link from "@/app/components/Link";
import ForecastNav from "@/app/components/opp/ForecastNav";
import { raceHref, STATE_NAME } from "@/app/lib/opp";
import { seo } from "@/app/lib/seo";
import { PathChart } from "@/app/accuracy/Charts";
import { calledSeats, seatMiss, cls, FROZEN_DIR, getAcc, getManifest, historyHref, mg, pc, PROOF_REPO, WAYBACK, type Office } from "@/app/accuracy/data";
import "@/app/accuracy/acc.css";

export const metadata = seo({
  title: "The final 2026 forecast, as published",
  description: "The On Point Politics 2026 midterm forecast exactly as the site served it on November 3, 2026, before the first polls closed: every file copied byte for byte with its SHA-256 fingerprint, so anyone can check it was never changed.",
  path: "/forecast/2026",
});

type FChamber = { demControl: number; demSeats: number; demP10: number; demP90: number; median: number; seatsTotal: number; trend: { t: number; dem: number }[] };
type FRace = { id: string; office: string; st: string; district: number; name: string; dem: string; gop: string; est: { margin: number; prob: number }; cands?: { name: string; party: string }[] };

const et = (iso: string, opt: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", ...opt }) + " ET";
const kb = (b: number) => (b >= 1e6 ? `${(b / 1e6).toFixed(2)} MB` : `${Math.round(b / 1e3)} KB`);

export default function FinalForecastPage() {
  const man = getManifest();
  const A = getAcc();
  const model = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", FROZEN_DIR, "model.json"), "utf8")) as { meta: { updated: string; sims: number }; chambers: Record<Office, FChamber>; races: FRace[] };
  const res = new Map(A.races.map((r) => [r.id, r]));
  const hrs = (new Date(man.polls_first_close_utc).getTime() - new Date(man.last_written_utc).getTime()) / 36e5;
  const hh = Math.floor(hrs), mm = Math.round((hrs - hh) * 60);
  const days = model.chambers.senate.trend.map((s, i) => {
    const d = new Date(Date.UTC(2026, 10, 3) - (model.chambers.senate.trend.length - 1 - i) * 864e5).toISOString().slice(0, 10);
    return { date: d, sen: s.dem * 100, house: (model.chambers.house.trend[i]?.dem ?? 0) * 100, gov: (model.chambers.governor.trend[i]?.dem ?? 0) * 100 };
  });
  const statewide = (o: "senate" | "governor") => model.races.filter((r) => r.office === o).sort((a, b) => (STATE_NAME[a.st] ?? a.st).localeCompare(STATE_NAME[b.st] ?? b.st));
  const ind = (r: FRace) => !!r.cands?.some((c) => c.party === "IND" && c.name === r.dem);

  return (
    <div className="opp acc">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/forecast">Forecast</Link><span className="sep">/</span><span>Final 2026 forecast</span></nav>
      <ForecastNav />

      <header className="acc-hero">
        <p className="eye g">Final forecast archive · frozen November 3, 2026</p>
        <h1>The 2026 forecast, <em>exactly as published</em>.</h1>
        <p className="lede">
          These are the files the site served on Election Day, copied byte for byte and never edited since. The last one was written at {et(man.last_written_utc, { hour: "numeric", minute: "2-digit" })} on November 3,
          {" "}{hh} hours and {mm} minutes before the first polls closed. Each file carries a SHA-256 fingerprint: change a single character and the fingerprint changes, so anyone can check that what is here is what we published.
        </p>
        <div className="acc-cta">
          <Link className="btn g" href="/accuracy">How the forecast did</Link>
          <a className="btn" href={`${FROZEN_DIR}/manifest.json`}>The manifest</a>
          <a className="btn" href={`${FROZEN_DIR}/SHA256SUMS`}>Fingerprints</a>
        </div>
      </header>

      <section className="acc-proof">
        <div className="card">
          <div className="card-h"><h3>The timestamp</h3><span className="pill ok">Before the polls closed</span></div>
          <div className="card-b acc-stamp">
            <div className="acc-dl" style={{ marginTop: 0 }}>
              <div><dt>Forecast updated</dt><dd>{new Date(model.meta.updated + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</dd></div>
              <div><dt>Last file written</dt><dd>{et(man.last_written_utc)}</dd></div>
              <div><dt>First polls closed</dt><dd>{et(man.polls_first_close_utc)}</dd></div>
              <div><dt>Files frozen</dt><dd>{man.files.length}</dd></div>
              <div><dt>Simulations per race</dt><dd>{model.meta.sims.toLocaleString("en-US")}</dd></div>
            </div>
            <div><p className="eye" style={{ marginBottom: 6 }}>Fingerprint of the whole archive</p><div className="acc-hash">{man.bundle_sha256}</div>
              <p className="acc-note" style={{ marginTop: 6 }}>The SHA-256 of the fingerprint list, one line per file in the order below.</p></div>
          </div>
        </div>
        <div className="card">
          <div className="card-h"><h3>Check it yourself</h3></div>
          <div className="card-b">
            <ol className="steps">
              <li>Download any file in the table below.</li>
              <li>Fingerprint it: <code>sha256sum model.json</code> on Linux or <code>shasum -a 256 model.json</code> on a Mac. It matches the table.</li>
              {PROOF_REPO ? <li>Open the file&apos;s history on GitHub. The commit from November 3 holds the same bytes, with the commit time on it, and the live copy on the forecast pages has not changed since.</li> : null}
              <li>Look up <a href={WAYBACK}>the forecast pages on the Internet Archive</a>, an outside copy of what the site showed before Election Day.</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="acc-sec">
        <div className="sec-h"><div><p className="eye">The final call</p><h2>Democrats favored for the Senate, the House and most governorships</h2>
          <p>The Democratic chance of control on every update from October 4 to Election Day, as the forecast pages showed it.</p></div></div>
        <div className="acc-kpis">
          {(["senate", "house", "governor"] as Office[]).map((o) => {
            const c = model.chambers[o], a = A.chambers[o];
            return (
              <div key={o}>
                <span className="l">{o === "governor" ? "Governors" : o === "senate" ? "Senate" : "House"}</span>
                <span className="v d">{calledSeats(a)}</span>
                <span className="s">The winner picked in every race plus seats not up, with D {pc(c.demControl)} to win control. Count {a.actualD} D · {a.actualR} R, seat miss {seatMiss(a.seat_err)}, control {a.right ? "called right" : "missed"}.</span>
              </div>
            );
          })}
          <div><span className="l">Races in the archive</span><span className="v">{model.races.length}</span><span className="s">Senate, House and governor, plus every legislative chamber, statewide office and ballot measure in the files below</span></div>
        </div>
        <div className="card" style={{ marginTop: 16 }}><div className="card-h"><h3>Chance of Democratic control, October 4 to November 3</h3></div><div className="card-b"><PathChart days={days} /></div></div>
      </section>

      {(["senate", "governor"] as const).map((o) => (
        <section key={o} className="acc-sec">
          <div className="sec-h"><div><p className="eye">{o === "senate" ? "Senate" : "Governors"}</p><h2>Every {o === "senate" ? "Senate" : "governor"} race, final forecast and result</h2></div></div>
          <div className="acc-races">
            {statewide(o).map((r) => {
              const x = res.get(r.id); const i = ind(r); const m = r.est.margin; const fav = r.est.prob >= 0.5 ? "R" : i ? "I" : "D";
              return (
                <Link key={r.id} href={raceHref(r.id)} className="acc-race">
                  <span className="rt"><span>{STATE_NAME[r.st] ?? r.st}</span>{x ? (x.excl ? <span className="call x">Not scored</span> : x.right ? <span className="call ok">Right</span> : <span className="call no">Missed</span>) : null}</span>
                  <span className="row"><span>Forecast</span><b className={cls(m, i)}>{Math.abs(m) >= 99 ? "Unopposed" : `${mg(m, i)} · ${fav} ${pc(Math.max(r.est.prob, 1 - r.est.prob))}`}</b></span>
                  {x && x.act != null ? <span className="row"><span>Result{x.fin ? "" : ", counting"}</span><b className={cls(x.act, i)}>{mg(x.act, i)}</b></span> : null}
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      <section className="acc-sec">
        <div className="sec-h"><div><p className="eye">The files</p><h2>Every file, with its fingerprint</h2>
          <p>Open reads the frozen copy. History opens the live file&apos;s commits, where the November 3 version carries the same fingerprint.</p></div></div>
        <div className="card"><div className="acc-tbl"><table className="tbl">
          <thead><tr><th>File</th><th>What it holds</th><th className="n">Size</th><th className="n">Written</th><th>SHA-256</th><th>Links</th></tr></thead>
          <tbody>{man.files.map((f) => {
            const h = historyHref(f.live_path);
            return (
              <tr key={f.file}>
                <td className="mono">{f.file}</td><td>{f.what}</td><td className="n">{kb(f.bytes)}</td><td className="n">{et(f.written_utc, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                <td className="h">{f.sha256}</td>
                <td style={{ whiteSpace: "nowrap" }}><a href={`${FROZEN_DIR}/${f.file}`}>Open</a>{h ? <> · <a href={h}>History</a></> : null}</td>
              </tr>
            );
          })}</tbody>
        </table></div></div>
        <p className="acc-note" style={{ marginTop: 12 }}>The courts, mayors and local file shows October 19 because those forecasts were final then and were not rebuilt on Election Day. The House, legislative and county results are graded in <Link href="/accuracy">the accuracy report</Link>.</p>
      </section>
    </div>
  );
}
