// Projected vote tables shared by every forecast page: the race's statewide or district vote by candidate, and the
// county by county vote. Server rendered, so every number is in the page for readers, search engines and AI answers.
import React from "react";

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : "");
/** margin in R minus D points, the site's convention */
const mLabel = (m: number, demLetter = "D", repLetter = "R") => (Math.abs(m) < 0.05 ? "Even" : `${m < 0 ? demLetter : repLetter} +${Math.abs(m).toFixed(1)}`);

export const VOTE_CSS = `
.opp .vt-scroll{max-height:560px;overflow:auto}
.opp .vt-scroll thead th{position:sticky;top:0;background:var(--bg2);z-index:1}
.opp .vt-tot td{font-weight:700;color:var(--ink);background:rgba(var(--line-rgb),.03)}
.opp .vt-name{white-space:nowrap;color:var(--ink)}
.opp .vt-bar{display:block;height:4px;border-radius:2px;margin-top:5px;background:rgba(var(--line-rgb),.08);overflow:hidden;min-width:80px}
.opp .vt-bar i{display:block;height:100%}
.opp .vt-note{font-size:12.5px;color:var(--mute);margin:10px 2px 0;line-height:1.55}
.opp .tbl td.d{color:var(--dem2)} .opp .tbl td.r{color:var(--gop2)} .opp .tbl td.y{color:#3fd7a0} .opp .tbl td.no{color:#ff8a6b}
`;

export type CandVote = { name: string; party: string; votes: number };

/** One card: each candidate's projected vote and share, and the total. */
export function VoteSummary({ title = "Projected vote", cands, total, note }: { title?: string; cands: CandVote[]; total: number; note?: string }) {
  const rows = [...cands].filter((c) => c.votes > 0 || cands.length <= 2).sort((a, b) => b.votes - a.votes);
  const color = (p: string) => (p === "D" ? "var(--dem)" : p === "R" ? "var(--gop)" : "var(--ind, #a78bfa)");
  return (
    <div className="card">
      <style>{VOTE_CSS}</style>
      <div className="card-h"><h3>{title}</h3><span className="eye" style={{ marginLeft: "auto" }}>{fmt(total)} votes</span></div>
      <div className="tblwrap">
        <table className="tbl">
          <thead><tr><th>Candidate</th><th style={{ textAlign: "right" }}>Votes</th><th style={{ textAlign: "right" }}>Share</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.name + c.party}>
                <td><span className="vt-name">{c.name}</span>{c.party ? <span style={{ color: "var(--mute)" }}> {c.party}</span> : null}
                  <span className="vt-bar"><i style={{ width: pct(c.votes, total) || "0%", background: color(c.party) }} /></span></td>
                <td className="n">{fmt(c.votes)}</td><td className="n">{pct(c.votes, total)}</td>
              </tr>
            ))}
            <tr className="vt-tot"><td>Total</td><td className="n">{fmt(total)}</td><td className="n">100%</td></tr>
          </tbody>
        </table>
      </div>
      {note ? <p className="vt-note" style={{ padding: "0 14px 12px" }}>{note}</p> : null}
    </div>
  );
}

export type CountyVote = { id: string; name: string; dem: number; rep: number; other: number; total: number; margin: number };

/** Every county's projected vote, largest first, with the statewide total on top. */
export function CountyVotes({ rows, demName, repName, unit = "counties", title, note, demLetter = "D", repLetter = "R" }:
  { rows: CountyVote[]; demName: string; repName: string; unit?: string; title?: string; note?: string; demLetter?: string; repLetter?: string }) {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  const T = sorted.reduce((s, r) => ({ dem: s.dem + r.dem, rep: s.rep + r.rep, other: s.other + r.other, total: s.total + r.total }), { dem: 0, rep: 0, other: 0, total: 0 });
  const tm = T.total ? ((T.rep - T.dem) / T.total) * 100 : 0;
  const one = ({ counties: "county", parishes: "parish", boroughs: "borough", districts: "district", towns: "town" } as Record<string, string>)[unit] ?? unit.replace(/s$/, "");
  const Unit = one.charAt(0).toUpperCase() + one.slice(1);
  return (
    <div className="card">
      <style>{VOTE_CSS}</style>
      <div className="card-h"><h3>{title ?? `Projected vote by ${one}`}</h3><span className="eye" style={{ marginLeft: "auto" }}>{sorted.length} {unit}</span></div>
      <div className="tblwrap vt-scroll">
        <table className="tbl">
          <thead><tr><th>{Unit}</th><th style={{ textAlign: "right" }}>{demName}</th><th style={{ textAlign: "right" }}>{repName}</th><th style={{ textAlign: "right" }}>Other</th><th style={{ textAlign: "right" }}>Total</th><th style={{ textAlign: "right" }}>Margin</th></tr></thead>
          <tbody>
            <tr className="vt-tot"><td>Statewide</td><td className="n">{fmt(T.dem)}</td><td className="n">{fmt(T.rep)}</td><td className="n">{fmt(T.other)}</td><td className="n">{fmt(T.total)}</td><td className={`n ${tm < 0 ? "d" : "r"}`}>{mLabel(tm, demLetter, repLetter)}</td></tr>
            {sorted.map((r) => (
              <tr key={r.id}>
                <td className="vt-name">{r.name}</td>
                <td className="n">{fmt(r.dem)}</td><td className="n">{fmt(r.rep)}</td><td className="n">{fmt(r.other)}</td><td className="n">{fmt(r.total)}</td>
                <td className={`n ${r.margin < 0 ? "d" : r.margin > 0 ? "r" : ""}`}>{mLabel(r.margin, demLetter, repLetter)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="vt-note" style={{ padding: "0 14px 12px" }}>{note ?? "Projected 2026 votes from the On Point simulation: each county's expected turnout times its simulated vote share. Totals may differ from the race total by rounding."}</p>
    </div>
  );
}

/** County names as they read on a map: "Fulton County", "Orleans Parish", "Anchorage". */
export function countyName(raw: string, st: string) {
  if (/county|parish|borough|city|census area|municipality|district/i.test(raw)) return raw;
  if (st === "LA") return `${raw} Parish`;
  if (st === "AK") return raw;
  if (/^[0-9]/.test(raw)) return raw;
  return `${raw} County`;
}

export type MeasureCountyVote = { id: string; name: string; yes: number; no: number };

/** A ballot measure's projected Yes and No votes statewide and in every county. */
export function MeasureVotes({ rows, yes, no, unit = "counties", needs }: { rows: MeasureCountyVote[]; yes: number; no: number; unit?: string; needs?: number }) {
  const total = yes + no;
  const sorted = [...rows].sort((a, b) => b.yes + b.no - (a.yes + a.no));
  const one = ({ counties: "county", parishes: "parish", boroughs: "borough" } as Record<string, string>)[unit] ?? "county";
  return (
    <div className="card">
      <style>{VOTE_CSS}</style>
      <div className="card-h"><h3>Projected vote</h3><span className="eye" style={{ marginLeft: "auto" }}>{fmt(total)} votes on the question</span></div>
      <div className="tblwrap">
        <table className="tbl">
          <thead><tr><th>Choice</th><th style={{ textAlign: "right" }}>Votes</th><th style={{ textAlign: "right" }}>Share</th></tr></thead>
          <tbody>
            <tr><td><span className="vt-name">Yes</span><span className="vt-bar"><i style={{ width: pct(yes, total), background: "#2fbf9b" }} /></span></td><td className="n">{fmt(yes)}</td><td className="n">{pct(yes, total)}</td></tr>
            <tr><td><span className="vt-name">No</span><span className="vt-bar"><i style={{ width: pct(no, total), background: "#e8794a" }} /></span></td><td className="n">{fmt(no)}</td><td className="n">{pct(no, total)}</td></tr>
            <tr className="vt-tot"><td>Total</td><td className="n">{fmt(total)}</td><td className="n">100%</td></tr>
          </tbody>
        </table>
      </div>
      {sorted.length > 1 ? (
        <div className="tblwrap vt-scroll" style={{ borderTop: "1px solid var(--line)" }}>
          <table className="tbl">
            <thead><tr><th>{one.charAt(0).toUpperCase() + one.slice(1)}</th><th style={{ textAlign: "right" }}>Yes</th><th style={{ textAlign: "right" }}>No</th><th style={{ textAlign: "right" }}>Total</th><th style={{ textAlign: "right" }}>Yes share</th></tr></thead>
            <tbody>
              {sorted.map((r) => { const t2 = r.yes + r.no; const y = t2 ? (100 * r.yes) / t2 : 0;
                return <tr key={r.id}><td className="vt-name">{r.name}</td><td className="n">{fmt(r.yes)}</td><td className="n">{fmt(r.no)}</td><td className="n">{fmt(t2)}</td><td className={`n ${y >= 50 ? "y" : "no"}`}>{y.toFixed(1)}%</td></tr>; })}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="vt-note" style={{ padding: "0 14px 12px" }}>Projected 2026 votes: each {one}&apos;s expected turnout, less the roughly 6 percent of voters who skip a ballot question, times its forecast Yes share.{needs ? ` The measure needs ${needs.toFixed(1)} percent Yes to pass.` : ""}</p>
    </div>
  );
}
