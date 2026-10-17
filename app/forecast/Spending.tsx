"use client";

import React, { useEffect, useMemo, useState } from "react";
import { type Office, type Race, fmtMargin, fmtPct, surname } from "./lib";

// ─────────────────────────────────────────────────────────────────────────────
// The spending tracker. Where the money is going in every race, and where each
// party is putting its weight, read straight off the filings: FEC campaign and
// independent expenditure reports for the Senate and House, state filings for
// governors. Data: /forecast/spending.json from scripts/forecast/build_spending.py.
// ─────────────────────────────────────────────────────────────────────────────

type Side = {
  total: number; campaign: number; outside: number; raised: number; cash: number;
  party: number; partyGroups: Record<string, number>; top: [string, number][];
};
type GovSide = { raised: number; cash: number; raisedLabel: string; googleAds: number; assoc: number };
type FedRow = {
  id: string; office: "senate" | "house"; st: string; name: string; dem: string; gop: string; margin: number; prob: number;
  D: Side; R: Side; total: number; perVoter: number | null; voters: number | null; shareD: number | null; asOf: string | null;
  focus: { D: number; R: number }; outsideFocus: { D: number; R: number }; partyFocus: { D: number; R: number }; oneParty: boolean;
  adimpact?: Record<string, number | string>;
};
type GovRow = {
  id: string; office: "governor"; st: string; name: string; dem: string; gop: string; margin: number; prob: number;
  D: GovSide; R: GovSide; total: number; perVoter: number | null; voters: number | null; shareD: number | null;
  basis?: string; checked?: string; source?: string; focus: { D: number; R: number };
};
type Summary = { D: number; R: number; races: number; partyD?: number; partyR?: number; outsideD?: number; outsideR?: number; groups?: { D: [string, number][]; R: [string, number][] } };
interface SpendingData {
  meta: { built: string; fecThrough: string | null; partyGroups: { D: string[]; R: string[] }; sources: string[] };
  summary: Record<Office, Summary>;
  races: { senate: FedRow[]; house: FedRow[]; governor: GovRow[] };
}

let cached: SpendingData | null = null;
function useSpending(): SpendingData | null {
  const [d, setD] = useState<SpendingData | null>(cached);
  useEffect(() => {
    if (cached) return;
    let live = true;
    fetch("/forecast/spending.json").then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) cached = j; if (live) setD(j); }).catch(() => undefined);
    return () => { live = false; };
  }, []);
  return d;
}

export const money = (n: number | null | undefined) => {
  if (n == null || !Number.isFinite(n)) return "None filed";
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(a >= 1e8 ? 0 : 1)}M`;
  if (a >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
};
const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
const fecDate = (d: string | null) => {
  if (!d) return "";
  const [m, day, y] = d.split("/");
  const MON = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];
  return `${MON[+m - 1]} ${+day}, ${y}`;
};
const CLOSE = 5;

function SplitBar({ d, r, h = 8 }: { d: number; r: number; h?: number }) {
  const t = d + r;
  const s = t > 0 ? d / t : 0.5;
  return (
    <span className="sp-split" style={{ height: h }} role="img" aria-label={`Democratic side ${pct(s, 0)}, Republican side ${pct(1 - s, 0)}`}>
      <i style={{ width: `${s * 100}%`, background: "var(--dem)" }} />
      <i style={{ width: `${(1 - s) * 100}%`, background: "var(--gop)" }} />
    </span>
  );
}

function MarginChip({ m }: { m: number }) {
  if (Math.abs(m) >= 99) return <em className="sp-chip">One party</em>;
  return <em className="sp-chip" style={{ color: m > 0 ? "var(--gop)" : "var(--dem)" }}>{fmtMargin(m)}</em>;
}

// What the money says against the forecast, in plain words.
function signal(r: FedRow | GovRow, medianPv: number): { label: string; tone: string } | null {
  if ((r as FedRow).oneParty) return null;
  const close = Math.abs(r.margin) <= CLOSE;
  const pv = r.perVoter ?? 0;
  if (close && pv < medianPv * 0.5) return { label: "Close, little money", tone: "var(--gold)" };
  if (close && pv >= medianPv * 1.5) return { label: "Battleground money", tone: "var(--hi)" };
  if (Math.abs(r.margin) >= 15 && pv >= medianPv * 2) return { label: "Money in a safe seat", tone: "var(--mute)" };
  if (r.shareD != null && r.shareD >= 0.7 && r.margin > 0) return { label: "Democrats outspending the leader", tone: "var(--dem)" };
  if (r.shareD != null && r.shareD <= 0.3 && r.margin < 0) return { label: "Republicans outspending the leader", tone: "var(--gop)" };
  return null;
}

const median = (xs: number[]) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

export default function SpendingTracker({ office, onPick }: { office: Office; onPick: (id: string) => void }) {
  const data = useSpending();
  const [sort, setSort] = useState<"total" | "pv" | "outside">("total");
  // "show all" belongs to the office it was opened on
  const [allFor, setAllFor] = useState<Office | null>(null);
  const all = allFor === office;
  const setAll = (f: (x: boolean) => boolean) => setAllFor(f(all) ? office : null);

  const rows = useMemo(() => (data ? (data.races[office] as (FedRow | GovRow)[]) : []), [data, office]);
  const fed = office !== "governor";
  const medPv = useMemo(() => median(rows.filter((r) => !(r as FedRow).oneParty).map((r) => r.perVoter ?? NaN)), [rows]);

  const focus = useMemo(() => {
    if (!fed) {
      const g = rows as GovRow[];
      return { D: [...g].sort((a, b) => b.focus.D - a.focus.D).slice(0, 6), R: [...g].sort((a, b) => b.focus.R - a.focus.R).slice(0, 6) };
    }
    // safe seats draw outside money mostly in primaries, so the focus lists hold the races
    // the forecast has within fifteen points, where general election money goes
    const f = (rows as FedRow[]).filter((r) => !r.oneParty && Math.abs(r.margin) <= 15);
    return { D: [...f].sort((a, b) => b.outsideFocus.D - a.outsideFocus.D).slice(0, 6), R: [...f].sort((a, b) => b.outsideFocus.R - a.outsideFocus.R).slice(0, 6) };
  }, [rows, fed]);

  const safeShare = useMemo(() => {
    if (!fed) return null;
    const out = { D: 0, R: 0 };
    for (const r of rows as FedRow[]) if (!r.oneParty && Math.abs(r.margin) > 15) { out.D += r.outsideFocus.D; out.R += r.outsideFocus.R; }
    return out;
  }, [rows, fed]);

  // the share of each side's outside money landing in races the forecast has within five points
  const inClose = useMemo(() => {
    if (!fed) return null;
    const f = rows as FedRow[];
    const out = { D: 0, R: 0, n: 0 };
    for (const r of f) if (!r.oneParty && Math.abs(r.margin) <= CLOSE) { out.D += r.outsideFocus.D; out.R += r.outsideFocus.R; out.n += 1; }
    return out;
  }, [rows, fed]);

  const sorted = useMemo(() => {
    const s = [...rows];
    if (sort === "pv") s.sort((a, b) => (b.perVoter ?? 0) - (a.perVoter ?? 0));
    else if (sort === "outside" && fed) s.sort((a, b) => ((b as FedRow).D.outside + (b as FedRow).R.outside) - ((a as FedRow).D.outside + (a as FedRow).R.outside));
    else s.sort((a, b) => b.total - a.total);
    return s;
  }, [rows, sort, fed]);
  const shown = all ? sorted : sorted.slice(0, 15);

  if (!data) {
    return <section className="card fc-card sp"><div className="card-h"><h3>Where the money is going</h3></div><div className="card-b"><div className="empty">Loading the filings</div></div></section>;
  }
  const S = data.summary[office];
  const noun = office === "house" ? "House" : office === "senate" ? "Senate" : "governor";

  return (
    <section className="card fc-card sp" aria-label="Spending tracker">
      <div className="card-h">
        <h3>Where the money is going</h3>
        <span className="eye" style={{ marginLeft: "auto" }}>{fed ? `FEC filings through ${fecDate(data.meta.fecThrough)}` : "State filings, periods vary"}</span>
      </div>
      <div className="card-b">
        <p className="sp-lede">
          {fed
            ? <>Every dollar working for each side in the {rows.length} {noun} races: the nominee&apos;s own spending plus outside money for the nominee or against the opponent. Outside groups move to the seats a party thinks are in play, so their money is the objective read of where each party is focusing.</>
            : <>What each governor nominee has reported raising in state filings. Governors do not file with the FEC and each state reports on its own calendar, so the period is printed with every figure.</>}
        </p>

        <div className="sp-kpis">
          <div className="sp-kpi"><span>For Democrats</span><b style={{ color: "var(--dem)" }}>{money(S.D)}</b><em>{fed ? `${money(S.outsideD)} of it outside money` : "reported raised"}</em></div>
          <div className="sp-kpi"><span>For Republicans</span><b style={{ color: "var(--gop)" }}>{money(S.R)}</b><em>{fed ? `${money(S.outsideR)} of it outside money` : "reported raised"}</em></div>
          {inClose ? (
            <div className="sp-kpi wide">
              <span>Outside money in the {inClose.n} races within {CLOSE} points</span>
              <div className="sp-kpi2">
                <b style={{ color: "var(--dem)" }}>{pct(inClose.D, 0)}</b><em>of Democratic</em>
                <b style={{ color: "var(--gop)" }}>{pct(inClose.R, 0)}</b><em>of Republican</em>
              </div>
            </div>
          ) : (
            <div className="sp-kpi wide"><span>Split of money reported</span><SplitBar d={S.D} r={S.R} h={10} /><em>{pct(S.D / Math.max(1, S.D + S.R), 0)} Democratic</em></div>
          )}
        </div>

        <div className="sp-focus">
          {(["D", "R"] as const).map((s) => (
            <div key={s} className="sp-fcol">
              <span className="sp-fh" style={{ color: s === "D" ? "var(--dem)" : "var(--gop)" }}>
                {fed ? `Where ${s === "D" ? "Democrats" : "Republicans"} are focusing` : `Where ${s === "D" ? "Democratic" : "Republican"} money is`}
              </span>
              {focus[s].map((r) => {
                const share = fed ? (r as FedRow).outsideFocus[s] : r.focus[s];
                const top = fed ? (focus[s][0] as FedRow).outsideFocus[s] : (focus[s][0] as GovRow).focus[s];
                const amt = fed ? (r as FedRow)[s].outside : (r as GovRow)[s].raised;
                return (
                  <button key={r.id} type="button" className="sp-frow" onClick={() => onPick(r.id)}>
                    <b>{r.name.replace(" Senate", "").replace(" Governor", "")}</b>
                    <span className="sp-ftrack"><i style={{ width: `${(share / Math.max(1e-9, top)) * 100}%`, background: s === "D" ? "var(--dem)" : "var(--gop)" }} /></span>
                    <span className="sp-fv">{pct(share)}</span>
                    <span className="sp-fa">{money(amt)}</span>
                    <MarginChip m={r.margin} />
                  </button>
                );
              })}
              <p className="sp-note">{fed
                ? `Share of every ${s === "D" ? "Democratic" : "Republican"} outside dollar in ${noun} races, among races within 15 points. Another ${pct(safeShare ? safeShare[s] : 0, 0)} went to seats further out, most of it in primaries.`
                : `Share of all ${s === "D" ? "Democratic" : "Republican"} governor money reported. Nominees raise their own money, so this follows fundraising more than party strategy.`}</p>
            </div>
          ))}
        </div>

        {fed && S.groups ? (
          <div className="sp-groups">
            <span className="sp-fh">Party leadership groups</span>
            <p className="sp-note">
              The super PACs each party&apos;s {office === "senate" ? "Senate" : "House"} leaders run or fund, as filed with the FEC: {" "}
              {(["D", "R"] as const).map((s, i) => (
                <React.Fragment key={s}>
                  {i ? "; " : ""}
                  <b style={{ color: s === "D" ? "var(--dem)" : "var(--gop)" }}>
                    {(S.groups![s].length ? S.groups![s] : [[s === "D" ? (office === "senate" ? "WinSenate" : "House Majority PAC") : (office === "senate" ? "Senate Leadership Fund" : "Congressional Leadership Fund"), 0] as [string, number]])
                      .map(([n, v]) => `${n} ${money(v)}`).join(", ")}
                  </b>
                </React.Fragment>
              ))}
              . Most fall money lands in October and reaches the FEC weeks later, so these trail the airwaves.
            </p>
          </div>
        ) : null}

        <div className="sp-tools">
          <span className="sp-fh">Every {noun} race</span>
          <div className="seg fc-segc sm" role="tablist" aria-label="Sort races by">
            {([["total", "Most money"], ["pv", "Per voter"], ...(fed ? [["outside", "Outside money"]] : [])] as [typeof sort, string][]).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={sort === k} className={sort === k ? "on" : ""} onClick={() => setSort(k)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="sp-tablewrap">
          <table className="sp-table">
            <thead>
              <tr>
                <th>Race</th><th className="num">All money</th><th>Democratic and Republican sides</th>
                {fed ? <><th className="num">Outside for D</th><th className="num">Outside for R</th></> : <><th className="num">D raised</th><th className="num">R raised</th></>}
                <th className="num">Per 2024 voter</th><th className="num">Forecast</th><th>What it says</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const sig = signal(r, medPv);
                const d = fed ? (r as FedRow).D.total : (r as GovRow).D.raised;
                const g = fed ? (r as FedRow).R.total : (r as GovRow).R.raised;
                return (
                  <tr key={r.id} className="clickable" tabIndex={0} onClick={() => onPick(r.id)} onKeyDown={(e) => { if (e.key === "Enter") onPick(r.id); }}>
                    <td className="name"><b>{r.name}</b><span>{surname(r.dem)} · {surname(r.gop)}</span></td>
                    <td className="num">{money(r.total)}</td>
                    <td className="bar"><SplitBar d={d} r={g} /><span className="sp-bl">{r.shareD == null ? "" : `${pct(r.shareD, 0)} D`}</span></td>
                    {fed ? <><td className="num">{money((r as FedRow).D.outside)}</td><td className="num">{money((r as FedRow).R.outside)}</td></>
                      : <><td className="num">{money((r as GovRow).D.raised)}</td><td className="num">{money((r as GovRow).R.raised)}</td></>}
                    <td className="num">{r.perVoter == null ? "No data" : `$${r.perVoter.toFixed(2)}`}</td>
                    <td className="num"><MarginChip m={r.margin} /></td>
                    <td>{sig ? <em className="sp-sig" style={{ color: sig.tone, borderColor: sig.tone }}>{sig.label}</em> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {sorted.length > 15 ? <button type="button" className="btn fc-more" onClick={() => setAll((x) => !x)}>{all ? "Show fewer" : `Show all ${sorted.length} races`}</button> : null}
        <p className="sp-foot">
          {fed
            ? <>Money for each side is the nominee&apos;s campaign spending, less self funding, plus outside money supporting the nominee or opposing the opponent, cycle to date. Per voter divides all money by the 2024 presidential vote. &ldquo;Close, little money&rdquo; marks a race within {CLOSE} points drawing under half the typical money per voter; &ldquo;Battleground money&rdquo; one within {CLOSE} points drawing one and a half times it or more.</>
            : <>Governor figures are the nominees&apos; own reported fundraising from state filings; periods differ by state and are printed in each race. Party governors associations file in the states, not with the FEC, so they are not counted here.</>}
          {" "}Sources: {data.meta.sources.join("; ")}.
        </p>
      </div>
    </section>
  );
}

const AD_LABEL: Record<string, string> = {
  d_candidate_aired: "Democratic nominee aired", r_aired_advantage: "Republican aired advantage, all groups",
  r_coordinated_aired: "Republican coordinated ads aired", slf_september_aired: "Senate Leadership Fund aired in September",
  no_going_back_september_aired: "No Going Back PAC aired in September", future_reserved_D: "Democratic ads reserved ahead",
  future_reserved_R: "Republican ads reserved ahead", future_r_advantage: "Republican advantage in reservations ahead",
};

// ── one race's money, inside the race view ───────────────────────────────────
export function RaceMoney({ race }: { race: Race }) {
  const data = useSpending();
  if (!data) return null;
  const office = race.office as Office;
  const list = data.races[office] as (FedRow | GovRow)[] | undefined;
  if (!list) return null;                         // statewide offices carry no spending file
  const r = list.find((x) => x.id === race.id);
  if (!r) return null;
  const fed = office !== "governor";
  const rank = (s: "D" | "R") => {
    const key = (x: FedRow | GovRow) => (fed ? (x as FedRow).outsideFocus[s] : x.focus[s]);
    return [...list].sort((a, b) => key(b) - key(a)).findIndex((x) => x.id === r.id) + 1;
  };
  const noun = office === "house" ? "House" : office === "senate" ? "Senate" : "governor";
  const ord = (n: number) => (n === 1 ? "the most" : `the ${n}${n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : n % 10 === 1 && n % 100 !== 11 ? "st" : "th"} most`);
  return (
    <section className="card fc-card sp">
      <div className="card-h">
        <h3>Money in this race</h3>
        <span className="eye" style={{ marginLeft: "auto" }}>{fed ? `FEC through ${fecDate((r as FedRow).asOf)}` : "State filings"}</span>
      </div>
      <div className="card-b">
        <div className="sp-race">
          {(["D", "R"] as const).map((s) => {
            const nm = s === "D" ? race.dem : race.gop;
            const col = s === "D" ? "var(--dem)" : "var(--gop)";
            if (!fed) {
              const g = (r as GovRow)[s];
              return (
                <div key={s} className="sp-rside">
                  <span className="sp-fh" style={{ color: col }}>{nm}</span>
                  <b className="sp-rbig">{money(g.raised)}</b>
                  <em>{g.raisedLabel}</em>
                  <dl>
                    <dt>Cash on hand</dt><dd>{g.cash ? money(g.cash) : "Not reported"}</dd>
                    <dt>Google ads, campaign</dt><dd>{money(g.googleAds)}</dd>
                    <dt>Share of party money</dt><dd>{pct((r as GovRow).focus[s])}, {ord(rank(s))}</dd>
                  </dl>
                </div>
              );
            }
            const x = (r as FedRow)[s];
            return (
              <div key={s} className="sp-rside">
                <span className="sp-fh" style={{ color: col }}>{nm}</span>
                <b className="sp-rbig">{money(x.total)}</b>
                <em>working for this side</em>
                <dl>
                  <dt>Campaign spending</dt><dd>{money(x.campaign)}</dd>
                  <dt>Outside money</dt><dd>{money(x.outside)}</dd>
                  <dt>Raised</dt><dd>{money(x.raised)}</dd>
                  <dt>Cash on hand</dt><dd>{money(x.cash)}</dd>
                  <dt>Share of party outside money</dt><dd>{pct((r as FedRow).outsideFocus[s])}, {ord(rank(s))} of any {noun} race</dd>
                </dl>
                {x.top.length ? (
                  <div className="sp-top">
                    <span>Biggest outside groups</span>
                    {x.top.map(([n, v]) => <div key={n}><b>{n}</b><em>{money(v)}</em></div>)}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        {fed && (r as FedRow).adimpact ? (
          <div className="sp-top sp-ads">
            <span>On the air, AdImpact through Sept. 30</span>
            {Object.entries((r as FedRow).adimpact!).filter(([k, v]) => AD_LABEL[k] && typeof v === "number").map(([k, v]) => (
              <div key={k}><b>{AD_LABEL[k]}</b><em>{money(v as number)}</em></div>
            ))}
            {typeof (r as FedRow).adimpact!.future_gap_note === "string" ? <div><b>Reservations ahead</b><em>{String((r as FedRow).adimpact!.future_gap_note).replace("R +", "Republicans hold ").replace(" percent of", "% more of")}</em></div> : null}
          </div>
        ) : null}
        <div className="sp-rfoot">
          <SplitBar d={fed ? (r as FedRow).D.total : (r as GovRow).D.raised} r={fed ? (r as FedRow).R.total : (r as GovRow).R.raised} h={10} />
          <p>
            {money(r.total)} in all{r.perVoter != null ? `, $${r.perVoter.toFixed(2)} for every 2024 voter` : ""}.{" "}
            {r.shareD != null ? `${pct(r.shareD, 0)} of it is working for ${surname(race.dem)}. ` : ""}
            The forecast has the race at {Math.abs(r.margin) >= 99 ? "one party" : fmtMargin(r.margin)}, {fmtPct(r.margin > 0 ? r.prob : 1 - r.prob)} for {surname(r.margin > 0 ? race.gop : race.dem)}.
            {fed ? " Outside money counts every dollar spent for a nominee or against the opponent this cycle, so money aimed at a nominee in the primary is counted for the other side." : ""}
          </p>
        </div>
      </div>
    </section>
  );
}

export const SPENDING_CSS = `
.sp .sp-lede { margin: 0; max-width: 72ch; color: var(--mute); font-size: 14px; line-height: 1.55; }
.sp .sp-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 16px; }
.sp .sp-kpi { display: grid; gap: 4px; padding: 14px 16px; border: 1px solid var(--line); border-radius: 14px; background: var(--glass); }
.sp .sp-kpi.wide { grid-column: span 2; }
.sp .sp-kpi span { font-family: var(--font-m); font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--mute); }
.sp .sp-kpi b { font-family: var(--font-d); font-weight: 800; font-size: 28px; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
.sp .sp-kpi em { font-style: normal; font-size: 12.5px; color: var(--mute); }
.sp .sp-kpi2 { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 10px; }
.sp .sp-kpi2 em { margin-right: 12px; }
.sp .sp-split { display: flex; width: 100%; border-radius: 99px; overflow: hidden; background: rgba(var(--line-rgb),.08); }
.sp .sp-split i { display: block; height: 100%; }
.sp .sp-focus { display: grid; grid-template-columns: 1fr 1fr; gap: 18px 28px; margin-top: 22px; }
.sp .sp-fh { font-family: var(--font-m); font-size: 10.5px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--mute); }
.sp .sp-fcol { display: grid; gap: 6px; align-content: start; }
.sp .sp-frow { display: grid; grid-template-columns: minmax(96px, 1.2fr) 2fr 52px 62px 62px; align-items: center; gap: 10px; padding: 6px 4px; border: 0; border-radius: 8px; background: none; color: var(--ink, var(--hi)); text-align: left; cursor: pointer; font: inherit; font-size: 13.5px; }
.sp .sp-frow:hover, .sp .sp-frow:focus-visible { background: var(--glass2); outline: none; }
.sp .sp-frow b { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sp .sp-ftrack { height: 8px; border-radius: 99px; background: rgba(var(--line-rgb),.08); overflow: hidden; }
.sp .sp-ftrack i { display: block; height: 100%; border-radius: 99px; }
.sp .sp-fv, .sp .sp-fa { font-family: var(--font-m); font-size: 12px; font-variant-numeric: tabular-nums; text-align: right; }
.sp .sp-fa { color: var(--mute); }
.sp .sp-chip { font-style: normal; font-family: var(--font-m); font-size: 11.5px; font-weight: 700; text-align: right; white-space: nowrap; color: var(--mute); }
.sp .sp-note { margin: 4px 0 0; font-size: 12px; line-height: 1.5; color: var(--mute); }
.sp .sp-groups { margin-top: 18px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 12px; }
.sp .sp-groups .sp-note b { font-weight: 700; }
.sp .sp-tools { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-top: 22px; }
.sp .sp-tools .seg { margin-left: 0; }
.sp .sp-tablewrap { margin-top: 10px; overflow-x: auto; }
.sp .sp-table { width: 100%; min-width: 860px; border-collapse: collapse; font-size: 13px; }
.sp .sp-table th { padding: 8px 10px; font-family: var(--font-m); font-size: 9.5px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--mute); text-align: left; border-bottom: 1px solid var(--line); white-space: nowrap; }
.sp .sp-table td { padding: 9px 10px; border-bottom: 1px solid rgba(var(--line-rgb),.06); vertical-align: middle; }
.sp .sp-table .num { text-align: right; font-family: var(--font-m); font-variant-numeric: tabular-nums; white-space: nowrap; }
.sp .sp-table td.name b { display: block; font-weight: 600; }
.sp .sp-table td.name span { font-size: 11.5px; color: var(--mute); }
.sp .sp-table td.bar { min-width: 150px; }
.sp .sp-table .sp-bl { display: block; margin-top: 4px; font-family: var(--font-m); font-size: 10.5px; color: var(--mute); }
.sp .sp-table tr.clickable { cursor: pointer; }
.sp .sp-table tr.clickable:hover td, .sp .sp-table tr.clickable:focus-visible td { background: var(--glass2); }
.sp .sp-table tr.clickable:focus-visible { outline: none; }
.sp .sp-sig { display: inline-block; font-style: normal; font-size: 11px; font-weight: 600; padding: 2px 8px; border: 1px solid; border-radius: 99px; white-space: nowrap; }
.sp .sp-foot { margin: 14px 0 0; font-size: 11.5px; line-height: 1.55; color: var(--mute); max-width: 110ch; }
.sp .fc-more { margin-top: 12px; }
.sp .sp-race { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
.sp .sp-rside { display: grid; gap: 4px; align-content: start; }
.sp .sp-rbig { font-family: var(--font-d); font-weight: 800; font-size: 30px; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
.sp .sp-rside > em { font-style: normal; font-size: 12px; color: var(--mute); }
.sp .sp-rside dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; margin: 10px 0 0; font-size: 13px; }
.sp .sp-rside dt { color: var(--mute); }
.sp .sp-rside dd { margin: 0; text-align: right; font-family: var(--font-m); font-size: 12.5px; font-variant-numeric: tabular-nums; }
.sp .sp-top { display: grid; gap: 4px; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--line); font-size: 12.5px; }
.sp .sp-top > span { font-family: var(--font-m); font-size: 9.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--mute); }
.sp .sp-top div { display: flex; justify-content: space-between; gap: 12px; }
.sp .sp-top b { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sp .sp-top em { font-style: normal; font-family: var(--font-m); font-variant-numeric: tabular-nums; }
.sp .sp-ads { margin-top: 18px; max-width: 560px; }
.sp .sp-rfoot { margin-top: 18px; display: grid; gap: 8px; }
.sp .sp-rfoot p { margin: 0; font-size: 13px; color: var(--mute); line-height: 1.5; }
@media (max-width: 760px) {
  .sp .sp-focus, .sp .sp-race { grid-template-columns: 1fr; }
  .sp .sp-kpi.wide { grid-column: auto; }
  .sp .sp-frow { grid-template-columns: minmax(80px, 1fr) 1.4fr 46px 56px; }
  .sp .sp-frow .sp-chip { display: none; }
  .sp .sp-frow b { white-space: normal; line-height: 1.25; }
}
`;
