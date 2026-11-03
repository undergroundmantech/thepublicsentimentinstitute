"use client";
// Read-only election calls board for an operator or a broadcast producer. Reads the same shared civicAPI observation as
// the rest of /results/2026. Official calls are civicAPI's; a projection is On Point's own estimate and says so.
import { useEffect, useMemo, useState } from "react";
import Link from "@/app/components/Link";
import { useSharedLive } from "../LiveProvider";
import { FIRST_CLOSE, STN, KIND_LABEL, civicRace, liveOdds, project, showTest, type CRace, type StFile, type XRace } from "../live";
import { CHAMBER_LABEL, callRow, isStale, partyOf, passes, sortRows, type CallRow, type CallState, type Chamber, type Filters, type Party, type Proj } from "./calls";

const ET = "America/New_York";
const clock = (d: Date | null) => (d ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone: ET }) + " ET" : "—");
const hasFc = (r: XRace) => (r.k === "measure" ? r.pPass != null : r.k === "leg" ? false : r.pR != null);
const last = (n: string) => n.split(" ").filter((w) => !/^(jr\.?|sr\.?|ii|iii|iv)$/i.test(w)).pop() ?? n;
const STATE_FILES = new Map<string, Promise<StFile | null>>();
const stateFile = (st: string) => { let p = STATE_FILES.get(st); if (!p) { p = fetch(`/results/2026/st/${st}.json`).then((x) => (x.ok ? (x.json() as Promise<StFile>) : null)).catch(() => null); STATE_FILES.set(st, p); } return p; };

/** On Point projections, using exactly the rule the race desk uses: a published forecast behind it, at least half the estimated vote
 *  counted and a 99.5% chance. Only races civicAPI has not called are tried, and only those at 50%+ reporting. */
function useProjections(races: XRace[], byId: Record<string, CRace>, readKey: string) {
  const [out, setOut] = useState<Record<string, Proj>>({});
  useEffect(() => {
    let dead = false;
    const todo = races.filter((r) => { const c = byId[r.id]; return c && hasFc(r) && !c.c.some((x) => x[4]) && c.pr >= 50 && c.c.some((x) => x[2] > 0); });
    (async () => {
      const next: Record<string, Proj> = {}; let i = 0;
      const worker = async () => {
        while (i < todo.length && !dead) {
          const r = todo[i++]; const c = byId[r.id];
          try {
            const det = await civicRace(c.id); if (det.test && !showTest()) continue;
            const sf = await stateFile(r.st);
            const P = project(sf?.counties?.[r.id] ?? null, det.regions ?? null, r, c.c, r.tot); const o = liveOdds(r, P);
            const leadP = 100 * Math.max(o.pA, o.pB);
            if (P.rep.t > 0 && P.pctIn >= 50 && leadP >= 99.5) {
              const side = o.pA >= 0.5 ? "A" : "B";
              const cand = r.k === "measure" ? (side === "A" ? ["Yes", "Y"] : ["No", "N"]) : side === "A" ? (r.c?.find((x) => x[1] === "D") ?? r.c?.find((x) => x[1] === "I") ?? []) : (r.c?.find((x) => x[1] === "R") ?? []);
              if (cand[0]) next[r.id] = { name: cand[0], party: cand[1] ?? "", side };
            }
          } catch { /* a failed read leaves the race uncalled; it is never guessed */ }
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
      if (!dead) setOut(next);
    })();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readKey, races]);
  return out;
}

const STATE_LABEL: Record<CallState, string> = { official: "Official call", projected: "On Point projection", uncalled: "Not called" };
const PARTY_LABEL: Record<Party, string> = { D: "Democratic", R: "Republican", O: "Other" };

function Who({ r }: { r: XRace }) {
  if (r.k === "measure") return <>{r.off || "Ballot measure"}</>;
  if (r.k === "leg") return <>{r.up ?? r.seats} of {r.seats} seats up</>;
  const cs = (r.c ?? []).slice(0, 3);
  return <>{cs.map((x, i) => <span key={x[0]}>{i ? " · " : ""}{last(x[0])} <i className={`cb-p p-${partyOf(x[1]) ?? "x"}`}>{x[1]}</i></span>)}</>;
}

export default function CallsBoard() {
  const sh = useSharedLive();
  const ix = sh?.ix ?? null, live = sh?.live;
  const [f, setF] = useState<Filters>({ chamber: "all", st: "all", party: "all", state: "all" });
  const [q, setQ] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(t); }, []);
  const races = useMemo(() => ix?.races ?? [], [ix]);
  const byId = useMemo(() => live?.byId ?? {}, [live?.byId]);
  const proj = useProjections(races, byId, `${live?.at?.getTime() ?? 0}`);
  const all = useMemo<CallRow[]>(() => sortRows(races.map((r) => callRow(r, byId[r.id], proj[r.id]))), [races, byId, proj]);
  const ql = q.trim().toLowerCase();
  const shown = useMemo(() => all.filter((x) => passes(x, f) && (!ql || `${x.r.nm} ${STN[x.r.st] ?? ""} ${(x.r.c ?? []).map((c) => c[0]).join(" ")} ${x.winner?.name ?? ""}`.toLowerCase().includes(ql))), [all, f, ql]);
  const n = useMemo(() => {
    const o = { official: 0, projected: 0, uncalled: 0, byP: { D: 0, R: 0, O: 0 } as Record<Party, number> };
    for (const x of all) { o[x.state]++; if (x.state === "official") { const p = partyOf(x.winner?.party); if (p) o.byP[p]++; } }
    return o;
  }, [all]);
  const states = useMemo(() => [...new Set(races.map((r) => r.st))].filter((s) => STN[s]).sort((a, b) => STN[a].localeCompare(STN[b])), [races]);
  const stale = live ? isStale(live.stale, live.at, now) : false;
  const preClose = now < FIRST_CLOSE;
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((p) => ({ ...p, [k]: v }));
  const chambers = (Object.keys(CHAMBER_LABEL) as Chamber[]).filter((k) => races.some((r) => r.k === k));

  return (
    <section className="cb" aria-labelledby="cb-h">
      <header className="cb-head">
        <div>
          <span className="eye">Election calls · read-only</span>
          <h1 id="cb-h">Every call, <em>one board.</em></h1>
          <p>Official calls come from civicAPI. An On Point projection is our own estimate and is never an official call.</p>
        </div>
        <dl className="cb-fresh" aria-live="polite">
          <div><dt>Last civicAPI read</dt><dd>{live?.loading ? "Connecting…" : clock(live?.at ?? null)}</dd></div>
          <div><dt>Checked</dt><dd>{clock(new Date(now))}</dd></div>
        </dl>
      </header>

      {stale ? <p className="cb-warn" role="alert"><b>Stale feed.</b> {live?.error ?? "civicAPI data is more than five minutes old or a read failed."} Calls shown may be behind; do not treat the absence of a call as a result.</p> : null}
      {live?.test && live.hidden > 0 ? <p className="cb-note">civicAPI is publishing test returns before polls close. They are hidden here, so no calls will appear until real results arrive.</p> : null}
      {live?.test && live.hidden === 0 && live.raw.some((c) => c.c.some((x) => x[4])) ? <p className="cb-warn" role="alert"><b>Test preview.</b> Calls shown are civicAPI test returns, not real results.</p> : null}

      <div className="cb-tiles" role="group" aria-label="Call totals">
        <div className="t off"><span>Official calls</span><b>{n.official}</b><small>D {n.byP.D} · R {n.byP.R} · other {n.byP.O}</small></div>
        <div className="t prj"><span>On Point projections</span><b>{n.projected}</b><small>not official calls</small></div>
        <div className="t unc"><span>Not called</span><b>{n.uncalled}</b><small>of {all.length} races tracked</small></div>
      </div>

      <div className="cb-filters" role="group" aria-label="Filters">
        <label><span>Chamber</span><select value={f.chamber} onChange={(e) => set("chamber", e.target.value as Filters["chamber"])}><option value="all">All</option>{chambers.map((k) => <option key={k} value={k}>{CHAMBER_LABEL[k]}</option>)}</select></label>
        <label><span>State</span><select value={f.st} onChange={(e) => set("st", e.target.value)}><option value="all">All states</option>{states.map((s) => <option key={s} value={s}>{STN[s]}</option>)}</select></label>
        <label><span>Winner party</span><select value={f.party} onChange={(e) => set("party", e.target.value as Filters["party"])}><option value="all">Any</option>{(["D", "R", "O"] as Party[]).map((p) => <option key={p} value={p}>{PARTY_LABEL[p]}</option>)}</select></label>
        <label><span>Call status</span><select value={f.state} onChange={(e) => set("state", e.target.value as Filters["state"])}><option value="all">All</option>{(["official", "projected", "uncalled"] as CallState[]).map((s) => <option key={s} value={s}>{STATE_LABEL[s]}</option>)}</select></label>
        <label className="grow"><span>Search</span><input type="search" value={q} placeholder="Race, state or candidate" onChange={(e) => setQ(e.target.value)} /></label>
        <button type="button" className="cb-reset" onClick={() => { setF({ chamber: "all", st: "all", party: "all", state: "all" }); setQ(""); }}>Reset</button>
      </div>

      {!ix ? <div className="cb-load sx-skel" /> : null}
      {ix && n.official + n.projected === 0 ? (
        <p className="cb-empty" role="status">{preClose ? "Polls have not closed. No calls yet." : "No calls yet. Races appear here as civicAPI calls them or as our projection clears its threshold."}</p>
      ) : null}

      {ix ? (
        <div className="cb-table" role="table" aria-label="Election calls" aria-rowcount={shown.length + 1}>
          <div className="cb-row cb-hd" role="row"><span role="columnheader">Race</span><span role="columnheader">Candidates</span><span role="columnheader">Call</span><span role="columnheader">Winner</span><span role="columnheader">Reporting</span><span role="columnheader">Source</span></div>
          {shown.length === 0 ? <p className="cb-empty" role="status">No races match these filters.</p> : null}
          {shown.map((x) => (
            <div key={x.r.id} className={`cb-row s-${x.state}`} role="row">
              <span role="cell" className="rc"><Link href={`/results/2026/${encodeURIComponent(x.r.id)}`}>{x.r.nm}</Link><small>{STN[x.r.st]} · {KIND_LABEL[x.r.k]}</small></span>
              <span role="cell" className="cd"><Who r={x.r} /></span>
              <span role="cell" className="st"><em className={`cb-chip c-${x.state}`}>{STATE_LABEL[x.state]}</em></span>
              <span role="cell" className="wn">{x.winner ? <><b>{x.winner.name}</b><i className={`cb-p p-${partyOf(x.winner.party) ?? "x"}`}>{x.winner.party}</i></> : <span className="mute">—</span>}</span>
              <span role="cell" className="rp">{x.reporting == null ? <span className="mute">{x.c ? "No votes yet" : "—"}</span> : <><b>{x.reporting.toFixed(x.reporting >= 99.95 ? 0 : 1)}%</b><i className="bar"><u style={{ width: `${Math.min(100, x.reporting)}%` }} /></i></>}</span>
              <span role="cell" className="sr">{x.source}</span>
            </div>
          ))}
        </div>
      ) : null}
      <p className="cb-foot">{shown.length} of {all.length} races. Reading civicAPI through the site cache about once a minute. This page is public but not linked from the site.</p>
    </section>
  );
}
