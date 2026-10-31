"use client";

// Shared pieces for the Ledger records inside Watchdog. Everything here reads the snapshot that
// scripts/watchdog/ledger/export-onpoint.ts writes to public/watchdog/ledger-data, in the browser,
// so a new export shows up on the next deploy with no rebuild of these pages.
import Link from "@/app/components/Link";
import { usePathname } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";

export const DATA = "/watchdog/ledger-data";
type Any = Record<string, unknown>;
export type Row = Any;

const cache = new Map<string, Promise<unknown>>();
export function loadLedger<T>(file: string): Promise<T | null> {
  if (!cache.has(file)) cache.set(file, fetch(`${DATA}/${file}`).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  return cache.get(file) as Promise<T | null>;
}
export function useLedger<T>(file: string | null): { data: T | null; state: "loading" | "ok" | "missing" } {
  const [s, set] = useState<{ data: T | null; state: "loading" | "ok" | "missing" }>({ data: null, state: "loading" });
  useEffect(() => {
    let dead = false;
    if (!file) { set({ data: null, state: "missing" }); return; }
    set({ data: null, state: "loading" });
    loadLedger<T>(file).then((d) => { if (!dead) set({ data: d, state: d == null ? "missing" : "ok" }); });
    return () => { dead = true; };
  }, [file]);
  return s;
}
export const safeName = (s: string) => s.replace(/[^A-Za-z0-9_.-]+/g, "_").slice(0, 120);

/* ------------------------------------------------------------------ formatting */
export const n = (v: unknown) => (v == null || v === "" ? null : Number(v));
export const usd = (v: unknown) => {
  const x = n(v);
  if (x == null || !Number.isFinite(x)) return "n/a";
  const a = Math.abs(x), s = x < 0 ? "-" : "";
  return a >= 1e9 ? `${s}$${(a / 1e9).toFixed(2)}B` : a >= 1e6 ? `${s}$${(a / 1e6).toFixed(a >= 1e8 ? 0 : 1)}M` : a >= 1e3 ? `${s}$${Math.round(a / 1e3)}K` : `${s}$${Math.round(a)}`;
};
export const int = (v: unknown) => { const x = n(v); return x == null ? "n/a" : Math.round(x).toLocaleString("en-US"); };
export const pct = (v: unknown, d = 0) => { const x = n(v); return x == null ? "n/a" : `${(x * 100).toFixed(d)}%`; };
export const day = (v: unknown) => {
  if (!v) return "";
  const d = new Date(String(v).length === 10 ? `${v}T12:00:00Z` : String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
export const ago = (v: unknown) => {
  if (!v) return "";
  const t = new Date(String(v)).getTime(); if (!Number.isFinite(t)) return "";
  const m = Math.round((Date.now() - t) / 60000);
  return m < 60 ? `${Math.max(1, m)} min ago` : m < 2880 ? `${Math.round(m / 60)} hr ago` : `${Math.round(m / 1440)} days ago`;
};
export function side(p: unknown): "d" | "r" | "i" | "" {
  const s = String(p ?? "").toUpperCase();
  if (s.startsWith("DEM") || s === "D" || s === "DFL") return "d";
  if (s.startsWith("REP") || s === "R" || s === "GOP") return "r";
  if (s.startsWith("IND") || s === "I") return "i";
  return "";
}
export const partyShort = (p: unknown) => ({ d: "D", r: "R", i: "I", "": "" } as const)[side(p)] || (p ? String(p).slice(0, 3) : "");
export const OFFICE: Record<string, string> = { S: "Senate", H: "House", G: "Governor", P: "President" };
export const officeLabel = (o: unknown, st: unknown, dist: unknown) => {
  const off = OFFICE[String(o)] ?? String(o ?? "");
  if (o === "H") return `${st ?? ""}-${String(dist ?? "").padStart(2, "0")} House`;
  if (o === "P") return "President";
  return `${st ?? ""} ${off}`.trim();
};
export const KIND_LABEL: Record<string, string> = {
  super_pac: "Super PAC", hybrid_pac: "Hybrid PAC", pac: "PAC", candidate: "Campaign", party: "Party committee", leadership_pac: "Leadership PAC", jfc: "Joint fundraising", state: "State committee",
  contribution: "Gift", independent_expenditure: "Outside spending", disbursement: "Payment", lobbying: "Lobbying", filing: "Filing", news: "Headline",
};
export const CAT_LABEL: Record<string, string> = {
  tv_media: "TV and radio", digital_ads: "Digital", mail: "Mail", signs_printing: "Signs and printing", production: "Production", polling: "Polling", consulting: "Consulting", field: "Field",
  texts_calls: "Texts and calls", data: "Data", travel: "Travel", staff: "Staff", fundraising: "Fundraising", events: "Events", legal: "Legal", other: "Other",
};

/* ------------------------------------------------------------------ links */
const q = (s: string) => encodeURIComponent(s);
export const href = {
  candidate: (id: string) => `/watchdog/ledger/candidate?id=${q(id)}`,
  committee: (id: string) => `/watchdog/ledger/committee?id=${q(id)}`,
  donor: (id: string) => `/watchdog/ledger/donor?id=${q(id)}`,
  vendor: (id: string) => `/watchdog/ledger/vendor?id=${q(id)}`,
  group: (id: string) => `/watchdog/ledger/group?id=${q(id)}`,
  race: (key: string) => `/watchdog/ledger/race?key=${q(key)}`,
  state: (code: string) => `/watchdog/ledger/state?code=${q(code)}`,
  web: (ref: string) => `/watchdog/ledger/web?ref=${q(ref)}`,
};
export function EntityLink({ kind, id, children, className }: { kind: keyof typeof href; id?: string | null; children: React.ReactNode; className?: string }) {
  if (!id) return <span className={className}>{children}</span>;
  return <Link href={href[kind](id)} className={`lg-link ${className ?? ""}`}>{children}</Link>;
}

/* ------------------------------------------------------------------ navigation and states */
export const LEDGER_TABS = [
  { href: "/watchdog/ledger", label: "Money desk" },
  { href: "/watchdog/ledger/tape", label: "Live tape" },
  { href: "/watchdog/ledger/races", label: "Races" },
  { href: "/watchdog/ledger/candidates", label: "Candidates" },
  { href: "/watchdog/ledger/committees", label: "Committees" },
  { href: "/watchdog/ledger/donors", label: "Donors" },
  { href: "/watchdog/ledger/vendors", label: "Vendors" },
  { href: "/watchdog/ledger/groups", label: "Groups" },
  { href: "/watchdog/ledger/signals", label: "Signals" },
  { href: "/watchdog/ledger/scores", label: "Scores" },
  { href: "/watchdog/ledger/foreign", label: "Foreign and cases" },
  { href: "/watchdog/ledger/lobbying", label: "Lobbying" },
  { href: "/watchdog/ledger/ads", label: "Ads" },
  { href: "/watchdog/ledger/events", label: "Events" },
  { href: "/watchdog/ledger/states", label: "States" },
  { href: "/watchdog/ledger/web", label: "Money web" },
];
export function LedgerNav() {
  const path = usePathname() || "";
  const meta = useLedger<{ exportedAt: string; demo: boolean | null }>("meta.json");
  // detail pages light up their list tab
  const alias: Record<string, string> = { "/watchdog/ledger/candidate": "/watchdog/ledger/candidates", "/watchdog/ledger/race": "/watchdog/ledger/races", "/watchdog/ledger/committee": "/watchdog/ledger/committees",
    "/watchdog/ledger/donor": "/watchdog/ledger/donors", "/watchdog/ledger/vendor": "/watchdog/ledger/vendors", "/watchdog/ledger/group": "/watchdog/ledger/groups", "/watchdog/ledger/state": "/watchdog/ledger/states" };
  const cur = alias[path.replace(/\/$/, "")] ?? path.replace(/\/$/, "");
  return (
    <div className="lg-top">
      <nav className="lg-nav" aria-label="Ledger records">
        {LEDGER_TABS.map((t) => <Link key={t.href} href={t.href} className={`lg-tab${t.href === cur ? " on" : ""}`}>{t.label}</Link>)}
      </nav>
      <div className="lg-fresh">
        {meta.state === "ok" && meta.data ? (
          <><i className="live" /> Ledger snapshot {ago(meta.data.exportedAt)}{meta.data.demo ? <b className="demo"> · demo data, every name invented</b> : null}</>
        ) : meta.state === "missing" ? <><i /> No Ledger snapshot loaded yet</> : <><i /> Loading the Ledger snapshot</>}
      </div>
    </div>
  );
}
export function Missing({ what }: { what?: string }) {
  return (
    <div className="card lg-missing">
      <b>{what ? `${what} is not in the Ledger snapshot yet.` : "The Ledger snapshot is not loaded yet."}</b>
      <p>These pages read the export from Ledger. Run the export in your Codespace and deploy, and every page fills in: candidates, races, donors, committees, vendors, groups, signals, scores, foreign agents and enforcement cases, lobbying, ads, events and the live tape.</p>
      <code>cd your Ledger folder, then: npx tsx scripts/export-onpoint.ts --out /workspaces/thepublicsentimentinstitute/public/watchdog/ledger-data</code>
    </div>
  );
}
export function Loading() { return <div className="lg-loading" aria-busy="true"><i /><i /><i /></div>; }
export function Gate<T>({ r, what, children }: { r: { data: T | null; state: string }; what?: string; children: (d: T) => React.ReactNode }) {
  if (r.state === "loading") return <Loading />;
  if (r.state === "missing" || r.data == null) return <Missing what={what} />;
  return <>{children(r.data)}</>;
}

/* ------------------------------------------------------------------ building blocks */
export function Head({ eye, title, em, lede, right }: { eye: string; title: string; em?: string; lede?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <header className="lg-head">
      <div><div className="eye gold">{eye}</div><h1>{title}{em ? <> <em>{em}</em></> : null}</h1>{lede ? <p className="lede">{lede}</p> : null}</div>
      {right ? <div className="lg-head-r">{right}</div> : null}
    </header>
  );
}
export function Kpis({ items }: { items: { k: string; v: React.ReactNode; s?: React.ReactNode }[] }) {
  return <div className="wd-kpis lg-kpis">{items.map((x) => <div key={x.k} className="wd-kpi"><span>{x.k}</span><b>{x.v}</b>{x.s ? <small>{x.s}</small> : null}</div>)}</div>;
}
export function Card({ title, right, children, className }: { title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={`card lg-card ${className ?? ""}`}><div className="card-h"><h3>{title}</h3>{right ? <span className="eye" style={{ marginLeft: "auto" }}>{right}</span> : null}</div><div className="lg-body">{children}</div></section>;
}
export function Bar({ v, max, cls }: { v: number; max: number; cls?: string }) {
  return <span className="lg-bar"><i className={cls} style={{ width: `${max > 0 ? Math.max(2, (v / max) * 100) : 0}%` }} /></span>;
}
export function SideSplit({ dem, rep, other }: { dem: number; rep: number; other?: number }) {
  const t = dem + rep + (other ?? 0) || 1;
  return <span className="lg-split"><i className="d" style={{ flex: dem / t }} /><i className="o" style={{ flex: (other ?? 0) / t }} /><i className="r" style={{ flex: rep / t }} /></span>;
}

export type Col<T> = { key: string; label: string; num?: boolean; render?: (r: T) => React.ReactNode; sort?: (r: T) => number | string };
export function Table<T extends Any>({ rows, cols, initial, limit = 60, empty = "Nothing here yet." }: { rows: T[]; cols: Col<T>[]; initial?: string; limit?: number; empty?: string }) {
  const [sk, setSk] = useState<{ k: string; d: 1 | -1 }>({ k: initial ?? "", d: -1 });
  const [all, setAll] = useState(false);
  const sorted = useMemo(() => {
    if (!sk.k) return rows;
    const c = cols.find((x) => x.key === sk.k);
    const f = c?.sort ?? ((r: T) => { const v = r[sk.k]; const x = Number(v); return v != null && v !== "" && Number.isFinite(x) ? x : String(v ?? ""); });
    return [...rows].sort((a, b) => { const x = f(a), y = f(b); return (x < y ? -1 : x > y ? 1 : 0) * sk.d; });
  }, [rows, cols, sk]);
  if (!rows.length) return <div className="wd-empty">{empty}</div>;
  const shown = all ? sorted : sorted.slice(0, limit);
  return (
    <div className="lg-tbl-wrap">
      <table className="lg-tbl">
        <thead><tr>{cols.map((c) => (
          <th key={c.key} className={c.num ? "n" : ""} aria-sort={sk.k === c.key ? (sk.d === 1 ? "ascending" : "descending") : undefined}>
            <button type="button" onClick={() => setSk((s) => ({ k: c.key, d: s.k === c.key ? (s.d === 1 ? -1 : 1) : -1 }))}>{c.label}{sk.k === c.key ? (sk.d === 1 ? " ▲" : " ▼") : ""}</button>
          </th>))}</tr></thead>
        <tbody>{shown.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c.key} className={c.num ? "n mono" : ""}>{c.render ? c.render(r) : String(r[c.key] ?? "")}</td>)}</tr>)}</tbody>
      </table>
      {sorted.length > limit ? <button type="button" className="wd-btn lg-more" onClick={() => setAll((a) => !a)}>{all ? "Show fewer" : `Show all ${sorted.length}`}</button> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ the tape */
export function TapeItem({ t }: { t: Any }) {
  const type = String(t.type ?? "tx");
  if (type === "tx") {
    const kind = String(t.kind ?? "");
    const so = t.support_oppose === "S" ? "for" : t.support_oppose === "O" ? "against" : "";
    return (
      <li className={`lg-tape k-${kind}`}>
        <span className="amt mono">{usd(t.amount)}</span>
        <span className="txt">
          {kind === "contribution" ? <><EntityLink kind="donor" id={t.donor_id as string}>{String(t.donor_name ?? "A donor")}</EntityLink>{t.donor_employer ? <small> of {String(t.donor_employer)}</small> : null} gave to <EntityLink kind="committee" id={t.recipient_id as string}>{String(t.recipient_name ?? "")}</EntityLink></>
            : kind === "independent_expenditure" ? <><EntityLink kind="committee" id={t.recipient_id as string}>{String(t.recipient_name ?? "")}</EntityLink> spent {so} <EntityLink kind="candidate" id={t.candidate_id as string} className={side(t.candidate_party)}>{String(t.candidate_name ?? "")}</EntityLink>{t.vendor_name ? <small> through <EntityLink kind="vendor" id={t.vendor_id as string}>{String(t.vendor_name)}</EntityLink></small> : null}</>
            : kind === "disbursement" ? <><EntityLink kind="committee" id={t.recipient_id as string}>{String(t.recipient_name ?? "")}</EntityLink> paid <EntityLink kind="vendor" id={t.vendor_id as string}>{String(t.vendor_name ?? "a vendor")}</EntityLink>{t.category ? <small> for {CAT_LABEL[String(t.category)] ?? String(t.category)}</small> : null}</>
            : <>{String(t.description ?? kind)}</>}
          {t.description && kind !== "contribution" ? <em>{String(t.description)}</em> : null}
        </span>
        <span className="when">{t.jurisdiction && t.jurisdiction !== "US" ? <b className="st">{String(t.jurisdiction)}</b> : null}{day(t.date ?? t.at)}</span>
      </li>
    );
  }
  if (type === "lobbying") return <li className="lg-tape k-lobbying"><span className="amt mono">{usd(t.amount)}</span><span className="txt"><b>{String(t.client ?? "")}</b> lobbying through {String(t.registrant ?? "")}<em>{(t.issues as string[] | undefined)?.join(", ")}</em></span><span className="when">{day(t.at)}</span></li>;
  if (type === "filing") return <li className="lg-tape k-filing"><span className="amt mono">{String(t.form_type ?? "Filing")}</span><span className="txt"><EntityLink kind="committee" id={t.committee_id as string}>{String(t.committee_name ?? t.title ?? "")}</EntityLink><em>{String(t.description ?? t.title ?? "")}</em></span><span className="when">{day(t.at)}</span></li>;
  return <li className="lg-tape"><span className="amt mono">{KIND_LABEL[type] ?? type}</span><span className="txt">{String(t.title ?? t.description ?? "")}{t.url ? <> <a href={String(t.url)} target="_blank" rel="noreferrer">source</a></> : null}</span><span className="when">{day(t.at)}</span></li>;
}
export function Tape({ items, limit = 40 }: { items: Any[]; limit?: number }) {
  if (!items?.length) return <div className="wd-empty">No money on the tape yet.</div>;
  return <ul className="lg-tapes">{items.slice(0, limit).map((t, i) => <TapeItem key={String(t.id ?? i)} t={t} />)}</ul>;
}

/* ------------------------------------------------------------------ scores */
export function Meter({ score, label, kind }: { score: number | null | undefined; label?: string | null; kind: "health" | "ledger" }) {
  const s = score == null ? null : Math.round(Number(score));
  const col = s == null ? "#6b6480" : s >= 75 ? "#3fd07a" : s >= 55 ? "#e7b341" : s >= 35 ? "#ff9a5c" : "#ff3b5c";
  const R = 34, C = 2 * Math.PI * R;
  return (
    <div className="lg-meter" title={kind === "health" ? "Campaign health, 0 to 100" : "Ledger Score, 0 to 100, higher is cleaner"}>
      <svg viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r={R} className="bg" /><circle cx="42" cy="42" r={R} className="fg" style={{ stroke: col, strokeDasharray: `${s == null ? 0 : (C * s) / 100} ${C}` }} /></svg>
      <b style={{ color: col }}>{s == null ? "n/a" : s}</b>
      <span>{kind === "health" ? "Health" : "Ledger Score"}</span>
      {label ? <small>{label}</small> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ tables for records whose shape varies */
const MONEY_KEY = /(total|amount|spend|spent|raised|receipts|cash|income|expenses|revenue|assets|ie|support|oppose|paid|gave|value|usd|penalty)/i;
const SKIP_KEY = /^(id|key|url|pdf_url|_.*|recipient_id|candidate_id|committee_id|donor_id|vendor_id|advertiser_id|client_key)$/;
const LABEL = (k: string) => k.replace(/_/g, " ").replace(/\b(ie)\b/i, "outside").replace(/^./, (c) => c.toUpperCase());
export function autoCols(rows: Any[], prefer: string[] = []): Col<Any>[] {
  const keys = new Set<string>();
  for (const r of rows.slice(0, 20)) for (const [k, v] of Object.entries(r)) if (!SKIP_KEY.test(k) && (v == null || typeof v !== "object" || Array.isArray(v))) keys.add(k);
  const ordered = [...prefer.filter((k) => keys.has(k)), ...[...keys].filter((k) => !prefer.includes(k))].slice(0, 7);
  return ordered.map((k) => {
    const sample = rows.find((r) => r[k] != null)?.[k];
    const isNum = typeof sample === "number" || (typeof sample === "string" && sample !== "" && Number.isFinite(Number(sample)) && !/date|year|period|fips|zip/i.test(k));
    const money = isNum && MONEY_KEY.test(k);
    return {
      key: k, label: LABEL(k), num: isNum,
      render: (r: Any) => {
        const v = r[k];
        if (v == null || v === "") return "";
        if (Array.isArray(v)) return v.slice(0, 4).join(", ");
        if (money) return usd(v);
        if (isNum) return int(v);
        if (/(^|_)(date|at|posted_at|created_at|last|first_date|last_date)$/.test(k)) return day(v);
        if (k === "name" || k === "client" || k === "registrant") {
          const id = (r.id ?? r.recipient_id ?? r.candidate_id ?? r.donor_id ?? r.vendor_id) as string | undefined;
          const kind = r.candidate_id && k === "name" ? "candidate" : r.recipient_id ? "committee" : r.donor_id ? "donor" : r.vendor_id ? "vendor" : null;
          return kind && id ? <EntityLink kind={kind as keyof typeof href} id={id}>{String(v)}</EntityLink> : String(v);
        }
        if (r.url && (k === "title" || k === "description")) return <a href={String(r.url)} target="_blank" rel="noreferrer" className="lg-link">{String(v)}</a>;
        return String(v);
      },
    };
  });
}
export function AutoTable({ rows, prefer, limit, empty }: { rows: Any[] | null | undefined; prefer?: string[]; limit?: number; empty?: string }) {
  const r = (rows ?? []) as Any[];
  return <Table rows={r} cols={autoCols(r, prefer)} limit={limit} empty={empty} />;
}
export function useMeta() { return useLedger<{ exportedAt: string; demo: boolean | null; pages: Record<string, string[]>; counts: Record<string, number>; errors: { what: string; error: string }[] }>("meta.json"); }
export function hasPage(meta: { pages?: Record<string, string[]> } | null, kind: string, id: string) { return !!meta?.pages?.[kind]?.includes(safeName(id)); }
