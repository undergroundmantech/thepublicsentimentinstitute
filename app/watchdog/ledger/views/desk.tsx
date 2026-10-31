"use client";

import Link from "@/app/components/Link";
import { useMemo, useState } from "react";
import { Card, EntityLink, Gate, Head, Kpis, Tape, Table, ago, day, href, int, side, usd, useLedger, officeLabel, type Row } from "../lib";
import { Pointy } from "@/app/components/home/Mascot";

type Summary = Record<string, { federal: number; superPac: number; campaigns: number; ie: number; state: number; lobbyist: number; bigGifts: number; filings: number; newCommittees: number; prevTotal: number } | null>;
type Flow = { width: number; height: number; total: number; nodes: { key: string; name: string; column: number; x0: number; x1: number; y0: number; y1: number; value: number; side?: string; kind?: string }[]; links: { source: string; target: string; value: number; width: number; path: string }[] } | null;
const WINS = [["24h", "24 hours"], ["7d", "7 days"], ["30d", "30 days"], ["cycle", "This cycle"]] as const;

export function FlowChart({ flow }: { flow: Flow }) {
  const [hot, setHot] = useState<string | null>(null);
  if (!flow || !flow.nodes?.length) return <div className="wd-empty">No money flow in this window.</div>;
  const col = (n: { side?: string; kind?: string; name: string }) => (side(n.side) === "d" || /democrat/i.test(n.name) ? "#3d7bff" : side(n.side) === "r" || /republican/i.test(n.name) ? "#ff3b5c" : n.kind === "super_pac" || /super pac/i.test(n.name) ? "#e7b341" : /donor/i.test(n.name) ? "#c9a86a" : "#8e86a3");
  const byKey = new Map(flow.nodes.map((n) => [n.key, n]));
  return (
    <div className="lg-flow">
      <svg viewBox={`0 0 ${flow.width} ${flow.height}`} role="img" aria-label="Where the money went">
        {flow.links.map((l, i) => {
          const on = !hot || l.source === hot || l.target === hot;
          return <path key={i} d={l.path} fill="none" stroke={col(byKey.get(l.source) ?? { name: "" })} strokeOpacity={on ? 0.38 : 0.06} strokeWidth={Math.max(1, l.width)} className="lg-flink"><title>{`${byKey.get(l.source)?.name} to ${byKey.get(l.target)?.name}: ${usd(l.value)}`}</title></path>;
        })}
        {flow.nodes.map((nd) => (
          <g key={nd.key} onMouseEnter={() => setHot(nd.key)} onMouseLeave={() => setHot(null)} className="lg-fnode">
            <rect x={nd.x0} y={nd.y0} width={Math.max(3, nd.x1 - nd.x0)} height={Math.max(2, nd.y1 - nd.y0)} rx="2" fill={col(nd)} />
            <text x={nd.x0 < flow.width / 2 ? nd.x1 + 6 : nd.x0 - 6} y={(nd.y0 + nd.y1) / 2 + 4} textAnchor={nd.x0 < flow.width / 2 ? "start" : "end"}>{nd.name}<tspan className="v"> {usd(nd.value)}</tspan></text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function LedgerDesk() {
  const [w, setW] = useState<(typeof WINS)[number][0]>("30d");
  const sum = useLedger<Summary>("summary.json");
  const flow = useLedger<Record<string, Flow>>("flow.json");
  const out = useLedger<Record<string, Row[]>>("outside.json");
  const tape = useLedger<Row[]>("tape_big.json");
  const alerts = useLedger<Row[]>("alerts.json");
  return (
    <>
      <Head eye="Watchdog · Ledger" title="Every reported dollar," em="as it lands."
        lede="Ledger follows FEC filings minutes after they post, lobbying reports and state campaign finance feeds, and turns them into one desk: what came in, where it went, who spent it on whom and what to watch next."
        right={<Pointy className="lg-pty keep" pose="point" prop="magnifier" size={108} look={-1} flip detective say={<>Big checks first. Click any name to follow it.</>} />} />
      <div className="wd-chips lg-wins" role="group" aria-label="Window">
        {WINS.map(([k, l]) => <button key={k} type="button" className={w === k ? "on" : ""} aria-pressed={w === k} onClick={() => setW(k)}>{l}</button>)}
      </div>
      <Gate r={sum}>{(s) => {
        const x = s[w];
        if (!x) return <div className="wd-empty">No totals for this window.</div>;
        const total = x.federal + x.ie + x.state;
        const ch = x.prevTotal > 0 ? (total - x.prevTotal) / x.prevTotal : null;
        return <Kpis items={[
          { k: "Reported", v: usd(total), s: ch == null ? "all reported money" : `${ch >= 0 ? "up" : "down"} ${Math.abs(Math.round(ch * 100))}% on the window before` },
          { k: "Into super PACs", v: usd(x.superPac), s: `${usd(x.campaigns)} to campaigns` },
          { k: "Outside spending", v: usd(x.ie), s: "for and against candidates" },
          { k: "Big gifts", v: int(x.bigGifts), s: `${int(x.newCommittees)} new committees, ${usd(x.state)} in state money` },
        ]} />;
      }}</Gate>
      <div className="lg-grid2">
        <Card title="Where the money went" right={w === "cycle" ? "This cycle" : "Last 30 days"}>
          <Gate r={flow}>{(f) => <FlowChart flow={f[w === "cycle" ? "cycle" : "30d"]} />}</Gate>
        </Card>
        <Card title="Biggest checks" right={<Link href="/watchdog/ledger/tape">The whole tape</Link>}>
          <Gate r={tape}>{(t) => <Tape items={t} limit={14} />}</Gate>
        </Card>
      </div>
      <div className="lg-grid2">
        <Card title="Outside money by candidate" right={<Link href="/watchdog/ledger/races">Every race</Link>}>
          <Gate r={out}>{(o) => (
            <Table rows={o[w === "cycle" ? "cycle" : "30d"] ?? []} initial="support" limit={15} cols={[
              { key: "candidate_name", label: "Candidate", render: (r) => <EntityLink kind="candidate" id={r.candidate_id as string} className={side(r.party)}>{String(r.candidate_name)}</EntityLink> },
              { key: "race", label: "Race", render: (r) => officeLabel(r.office, r.state, r.district), sort: (r) => String(r.state) },
              { key: "support", label: "For", num: true, render: (r) => usd(r.support) },
              { key: "oppose", label: "Against", num: true, render: (r) => usd(r.oppose) },
              { key: "spenders", label: "Groups", num: true },
            ]} />
          )}</Gate>
        </Card>
        <Card title="Alerts" right="Why each one matters">
          <Gate r={alerts}>{(a) => (
            <ul className="lg-alerts">{a.slice(0, 14).map((x, i) => (
              <li key={i} className={`sev-${String(x.severity)}`}><b>{String(x.title)}</b><span>{String(x.body ?? "")}</span><small>{ago(x.created_at)}</small></li>
            ))}</ul>
          )}</Gate>
        </Card>
      </div>
    </>
  );
}

const KINDS = [["all", "Everything"], ["contribution", "Gifts"], ["independent_expenditure", "Outside spending"], ["disbursement", "Payments"], ["lobbying", "Lobbying"], ["filing", "Filings"]] as const;
export function TapeView() {
  const a = useLedger<Row[]>("tape.json");
  const b = useLedger<Row[]>("tape_big.json");
  const [kind, setKind] = useState<string>("all");
  const [min, setMin] = useState(0);
  const [qq, setQ] = useState("");
  const all = useMemo(() => {
    const m = new Map<string, Row>();
    for (const t of [...(a.data ?? []), ...(b.data ?? [])]) m.set(String(t.id), t);
    return [...m.values()].sort((x, y) => String(y.at ?? "").localeCompare(String(x.at ?? "")));
  }, [a.data, b.data]);
  const shown = all.filter((t) => (kind === "all" || (kind === "lobbying" || kind === "filing" ? t.type === kind : t.kind === kind)) && Number(t.amount ?? 0) >= min
    && (!qq || JSON.stringify(t).toLowerCase().includes(qq.toLowerCase())));
  return (
    <>
      <Head eye="Watchdog · Ledger" title="The live" em="tape." lede="Every itemized gift, outside spending report, payment, lobbying report and new filing in the snapshot, newest first. Pass throughs and memo lines are left out so each dollar counts once." />
      <div className="en-bar">
        <div className="wd-chips" role="group" aria-label="Kind">{KINDS.map(([k, l]) => <button key={k} type="button" className={kind === k ? "on" : ""} aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}</div>
        <div className="wd-chips" role="group" aria-label="Smallest amount">{[0, 5000, 25000, 100000, 1000000].map((v) => <button key={v} type="button" className={min === v ? "on" : ""} onClick={() => setMin(v)}>{v ? `${usd(v)} and up` : "Any size"}</button>)}</div>
        <input className="wd-input en-q" value={qq} onChange={(e) => setQ(e.target.value)} placeholder="Search a name, employer or committee" aria-label="Search the tape" />
      </div>
      <Gate r={a}>{() => <Card title={`${shown.length.toLocaleString()} items`} right={all[0] ? `Newest ${day(all[0].at)}` : ""}><Tape items={shown} limit={300} /></Card>}</Gate>
    </>
  );
}
export { href };
