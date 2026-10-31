import type { Metadata } from "next";
import Link from "@/app/components/Link";
import fs from "node:fs";
import path from "node:path";
import ForecastNav from "@/app/components/opp/ForecastNav";
import { seo } from "@/app/lib/seo";

// Every 2026 race the forecast does not model: nonpartisan and retention court seats, district elected utility
// commissions and education boards, the nonpartisan statewide offices, mayors and Washington DC, the Nebraska
// Legislature and the statewide measures decided earlier in the year. Built by scripts/forecast/other/build_other_races.py.
type Cand = { name: string | null; party: string | null; incumbent: boolean; note: string };
type Poll = { pollster: string | null; dates: string | null; end: string | null; n: number | null; pop: string | null; shares: Record<string, number>; url: string | null; note?: string | null };
type Other = {
  id: string; category: string; state: string; stateName: string; jurisdiction: string; office: string; seat: string | null;
  election_type: string | null; date: string | null; status: string; candidates: Cand[]; result: Record<string, unknown> | null;
  incumbent: string | null; primary: { date?: string; results?: { name: string; share: number }[] } | null; runoff: string | null;
  polls: Poll[]; sources: string[]; note: string; title?: string; threshold?: number; passed?: boolean | null;
};
type Data = { meta: { updated: string; races: number; counts: Record<string, number>; nebraska: { current?: { R: number; D: number; other: number; other_note?: string }; filibuster_line?: number; seats_up?: number } }; races: Other[] };

const getData = (): Data => JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "forecast", "other_races.json"), "utf8"));

export const metadata: Metadata = seo({
  title: "Every other 2026 race: supreme courts, mayors, Nebraska and more",
  description: "The 2026 races the On Point Politics forecast does not model: state supreme court seats, retention votes, district utility commissions, education boards, mayors, Washington DC, the Nebraska Legislature and the measures decided earlier in the year.",
  path: "/forecast/other",
});

const SECTIONS: { key: string; title: string; lede: string }[] = [
  { key: "court", title: "State supreme courts", lede: "Nonpartisan, retention and district seats, plus the seats already decided this year. The partisan statewide seats in Alabama, North Carolina, Ohio and Texas are forecast with the statewide offices." },
  { key: "office", title: "Other statewide and district offices", lede: "Nonpartisan statewide offices and the utility commissions elected by district." },
  { key: "board", title: "Education boards", lede: "State boards of education elected by district or without party labels. Michigan's four statewide boards are forecast with the statewide offices." },
  { key: "legislature", title: "Nebraska Legislature", lede: "The one house legislature, elected without party labels. Candidates are listed with the party they are known by." },
  { key: "mayor", title: "Mayors", lede: "Mayoral races on November 3 in large cities." },
  { key: "local", title: "Washington DC", lede: "The council, the delegate to the House and the attorney general. The mayor is listed with the mayors." },
  { key: "measure", title: "Ballot measures decided earlier in 2026", lede: "Statewide measures voters already settled this year. The November measures are forecast on the ballot measures page." },
];

const partyCls = (p: string | null) => { const x = (p || "").toUpperCase(); return x.startsWith("D") ? "d" : x.startsWith("R") ? "r" : ""; };
const partyTag = (p: string | null) => p ?? "";
const fmtDate = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
const TYPE: Record<string, string> = { nonpartisan: "Nonpartisan", retention: "Retention", partisan: "Partisan", measure: "Measure" };

function Cands({ r }: { r: Other }) {
  if (r.category === "measure") return <span style={{ color: "var(--ink2)" }}>{r.title ?? ""}</span>;
  if (!r.candidates.length) return <span style={{ color: "var(--mute)" }}>Candidates not confirmed</span>;
  return (
    <span>
      {r.candidates.map((c, i) => (
        <span key={(c.name ?? "") + i}>
          {i ? <span style={{ color: "var(--mute)" }}>{r.election_type === "retention" ? "" : " vs "}</span> : null}
          <span className={partyCls(c.party)}>{c.name ?? "Unconfirmed"}</span>
          {c.party ? <span style={{ color: "var(--mute)", fontSize: 12 }}> {partyTag(c.party)}</span> : null}
          {c.incumbent ? <span style={{ color: "var(--mute)", fontSize: 12 }}> · incumbent</span> : null}
        </span>
      ))}
    </span>
  );
}

function Outcome({ r }: { r: Other }) {
  if (r.status === "decided") {
    if (r.category === "measure") {
      const yes = Number((r.result as { yes?: number } | null)?.yes ?? NaN);
      return <span className={`pill ${r.passed ? "d" : "r"}`}>{r.passed ? "Passed" : "Failed"}{Number.isFinite(yes) ? ` · ${yes.toFixed(1)}% yes` : ""}</span>;
    }
    const w = r.result as { winner?: string; share?: number } | null;
    return <span className="pill">{w?.winner ? `${w.winner} won${w.share ? ` · ${Number(w.share).toFixed(1)}%` : ""}` : "Decided"}</span>;
  }
  if (r.election_type === "retention") return <span className="pill">Retain or not</span>;
  if (r.candidates.length === 1) return <span className="pill">Unopposed</span>;
  return <span style={{ color: "var(--mute)" }}>{fmtDate(r.date)}</span>;
}

function PollLine({ r }: { r: Other }) {
  if (!r.polls.length) return null;
  const p = [...r.polls].sort((a, b) => String(b.end).localeCompare(String(a.end)))[0];
  const sh = Object.entries(p.shares || {}).map(([k, v]) => `${k} ${v}`).join(", ");
  return (
    <div style={{ fontSize: 12, color: "var(--mute)", marginTop: 4 }}>
      Latest poll: {p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>{p.pollster}</a> : p.pollster}
      {p.dates ? `, ${p.dates}` : ""}{p.n ? `, ${p.n} ${p.pop ?? ""}` : ""}: {sh}{r.polls.length > 1 ? ` · ${r.polls.length} polls on file` : ""}
    </div>
  );
}

export default function OtherRacesPage() {
  const data = getData();
  const updated = new Date(data.meta.updated + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const ne = data.meta.nebraska?.current;
  return (
    <div className="opp">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="sep">/</span><Link href="/forecast">Forecast</Link><span className="sep">/</span><span>Every other race</span>
      </nav>
      <ForecastNav />
      <header className="ph">
        <div className="eye g">2026 elections</div>
        <h1>Every other race on the <em>ballot</em></h1>
        <p className="lede">
          The {data.meta.races} races the forecast does not model: court seats without party labels and retention votes, offices elected by
          district, mayors, Washington DC, the Nebraska Legislature and the ballot measures already decided this year. Each lists the
          candidates, the latest public poll where there is one, and the sources behind it.
        </p>
        <div className="pmeta">
          <span>Updated <b>{updated}</b></span>
          {SECTIONS.map((s) => data.meta.counts[s.key] ? <span key={s.key}><a href={`#${s.key}`} style={{ textDecoration: "underline" }}>{s.title}</a> <b className="mono">{data.meta.counts[s.key]}</b></span> : null)}
        </div>
      </header>
      <div style={{ display: "grid", gap: 16 }}>
        {SECTIONS.map((s) => {
          const rows = data.races.filter((r) => r.category === s.key);
          if (!rows.length) return null;
          return (
            <section className="card" key={s.key} id={s.key}>
              <div className="card-h"><h3>{s.title}</h3><span className="eye" style={{ marginLeft: "auto" }}>{rows.length} {rows.length === 1 ? "race" : "races"}</span></div>
              <p style={{ margin: "0 0 10px", color: "var(--ink2)", fontSize: 14 }}>
                {s.lede}
                {s.key === "legislature" && ne ? ` Today it seats ${ne.R} Republicans, ${ne.D} Democrats and ${ne.other} independent; ${data.meta.nebraska.filibuster_line ?? 33} votes end a filibuster.` : ""}
              </p>
              <div className="tblwrap">
                <table className="tbl">
                  <thead><tr><th>Where</th><th>Office</th><th>Type</th><th>Candidates</th><th>Status</th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} id={r.id}>
                        <td>{r.jurisdiction && r.jurisdiction !== r.state && r.jurisdiction !== r.stateName ? <>{r.jurisdiction}<span style={{ color: "var(--mute)", fontSize: 12 }}> · {r.state}</span></> : r.stateName}</td>
                        <td>{r.office}{r.seat ? <span style={{ color: "var(--mute)", fontSize: 12 }}> · {r.seat}</span> : null}</td>
                        <td><span className="eye">{TYPE[r.election_type ?? ""] ?? r.election_type ?? ""}</span></td>
                        <td>
                          <Cands r={r} />
                          <PollLine r={r} />
                          {r.note ? <div style={{ fontSize: 12, color: "var(--mute)", marginTop: 4 }}>{r.note}</div> : null}
                          {r.sources.length ? <div style={{ fontSize: 12, marginTop: 4 }}>{r.sources.slice(0, 3).map((u, i) => <a key={u} href={u} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline", color: "var(--mute)", marginRight: 8 }}>Source {i + 1}</a>)}</div> : null}
                        </td>
                        <td><Outcome r={r} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
        <div className="callout">
          <div className="eye">Why these are not forecast</div>
          The forecast models a race county by county from the party vote, so it covers every partisan statewide race:
          see <Link href="/forecast/statewide" style={{ textDecoration: "underline" }}>statewide offices</Link>, <Link href="/forecast/legislatures" style={{ textDecoration: "underline" }}>state legislatures</Link> and <Link href="/forecast/measures" style={{ textDecoration: "underline" }}>ballot measures</Link>.
          Races with no party label, retention votes and offices elected by district need their own models, so they are listed here with their candidates and polls.
        </div>
      </div>
    </div>
  );
}
