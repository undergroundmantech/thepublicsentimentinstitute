// Oct 31 2026: the L2 county early vote file, modeled with the On Point national dataset. Each state's returned ballots are
// raked to their county's L2 party, age, race and sex mix and given the dataset's vote for voters like them, which gives
// a modeled margin among ballots already cast and what the rest of the vote has to do for the forecast to hold.
import fs from "node:fs";
import path from "node:path";
import Link from "@/app/components/Link";

type L2State = { state: string; returned: number; modeled_early_margin: number; race?: string; forecast_margin?: number; share_cast?: number;
  rest_needed_margin?: number; ground_eday_margin?: number; ground_early_margin?: number };
type L2 = { asOf: string; summary: { ballots_in_l2: number; states: number; national_modeled_early_margin: number; dataset_early_and_mail_voters_margin: number; dataset_already_voted_margin: number;
  makeup: Record<string, { D: number; R: number; age65: number; age18_29: number; hispanic: number; black: number; female: number }> }; states: L2State[] };

const fm = (x: number | undefined | null) => (x == null || !Number.isFinite(x) ? "n/a" : Math.abs(x) < 0.05 ? "Even" : `${x >= 0 ? "D" : "R"} +${Math.abs(x).toFixed(1)}`);
const cls = (x: number | undefined | null) => (x == null || !Number.isFinite(x) ? "" : x >= 0 ? "d" : "r");
const ALL_MAIL = new Set(["CO", "OR", "WA", "UT", "VT", "HI", "NV", "CA"]);
const STATE_SLUG = (n: string) => n.toLowerCase().replace(/[^a-z]+/g, "-");

export default function L2Panel({ names }: { names: Record<string, string> }) {
  let d: L2 | null = null;
  try { d = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "earlyvote", "l2_model.json"), "utf8")); } catch { d = null; }
  if (!d) return null;
  const S = d.summary;
  const rows = d.states.filter((s) => s.forecast_margin != null && Number.isFinite(s.forecast_margin)).sort((a, b) => b.returned - a.returned);
  const mk = S.makeup;
  const pc = (x: number) => `${Math.round(x * 100)}%`;
  return (
    <section className="card" style={{ marginTop: 18 }} aria-label="Modeled early vote from L2">
      <div className="card-h"><h3>Who has voted, modeled</h3><span className="eye" style={{ marginLeft: "auto" }}>L2 county files · {S.ballots_in_l2.toLocaleString("en-US")} ballots</span></div>
      <div className="card-b" style={{ display: "grid", gap: 14 }}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, maxWidth: 900 }}>
          Every county&apos;s returned ballots in the L2 voter file, given the vote of voters like them in the On Point national dataset. Across {S.states} states the
          ballots already cast model to <b className={cls(S.national_modeled_early_margin)}>{fm(S.national_modeled_early_margin)}</b>. The dataset&apos;s own early and mail voters
          run <b className="d">{fm(S.dataset_early_and_mail_voters_margin)}</b> and those who say they already voted <b className="d">{fm(S.dataset_already_voted_margin)}</b>, so the two
          agree on direction; the voter file is older and less Democratic than the survey&apos;s early voters, which pulls its margin in.
        </p>
        <div className="tblwrap">
          <table className="tbl">
            <thead><tr><th>Who</th><th style={{ textAlign: "right" }}>Democrats</th><th style={{ textAlign: "right" }}>Republicans</th><th style={{ textAlign: "right" }}>65 and up</th><th style={{ textAlign: "right" }}>18 to 29</th><th style={{ textAlign: "right" }}>Hispanic</th><th style={{ textAlign: "right" }}>Black</th><th style={{ textAlign: "right" }}>Women</th></tr></thead>
            <tbody>{Object.entries(mk).map(([k, v]) => <tr key={k}><td>{k.replace(/^L2/, "L2")}</td><td className="n d">{pc(v.D)}</td><td className="n r">{pc(v.R)}</td><td className="n">{pc(v.age65)}</td><td className="n">{pc(v.age18_29)}</td><td className="n">{pc(v.hispanic)}</td><td className="n">{pc(v.black)}</td><td className="n">{pc(v.female)}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="tblwrap">
          <table className="tbl">
            <thead><tr><th>State</th><th style={{ textAlign: "right" }}>Ballots</th><th style={{ textAlign: "right" }}>Share of the vote in</th><th style={{ textAlign: "right" }}>Cast so far, modeled</th><th style={{ textAlign: "right" }}>Forecast</th><th style={{ textAlign: "right" }}>The rest must go</th><th style={{ textAlign: "right" }}>Simulated Election Day</th></tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.state}>
                  <td><Link href={`/maps/early-vote/${STATE_SLUG(names[s.state] ?? s.state)}`}>{names[s.state] ?? s.state}</Link>{ALL_MAIL.has(s.state) ? <small style={{ color: "var(--mute)" }}> · mostly mail</small> : null}</td>
                  <td className="n">{s.returned.toLocaleString("en-US")}</td>
                  <td className="n">{s.share_cast != null ? `${Math.round(s.share_cast * 100)}%` : ""}</td>
                  <td className={`n ${cls(s.modeled_early_margin)}`}>{fm(s.modeled_early_margin)}</td>
                  <td className={`n ${cls(s.forecast_margin)}`}>{fm(s.forecast_margin)}</td>
                  <td className={`n ${cls(s.rest_needed_margin)}`}>{fm(s.rest_needed_margin)}</td>
                  <td className={`n ${cls(s.ground_eday_margin)}`}>{fm(s.ground_eday_margin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--mute)", lineHeight: 1.5 }}>
          Modeled margins are party composition read through the dataset, not counted votes. Where a state registers by party the L2 party is registration; elsewhere the
          county&apos;s 2024 result and who turns out early stand in for it. The rest must go column is what the ballots still to come need for the forecast to hold, beside the
          On Point voter simulation&apos;s Election Day vote. Mostly mail states have little Election Day vote, and races with a strong crossover candidate, such as a popular
          incumbent governor, run apart from party composition. As of {d.asOf}.
        </p>
      </div>
    </section>
  );
}
