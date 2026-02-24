"use client";

import React, { useMemo } from "react";
import Link from "next/link";

/**
 * POLL META
 */
const POLL = {
  org: "Public Sentiment Institute",
  title: "Florida Governor 2026",
  releaseDate: "Feb 21, 2026",
  subtitle: "PSI Poll Release • First Read",
  sample: {
    adults: 200,
    registeredVoters: 183,
    likelyVoters: 124,
  },
  moe: {
    adults: "±6.9%",
    lv: "±8.8%",
  },
  links: {
    crosstabs:
      "https://docs.google.com/spreadsheets/d/1qY1iBVAwOUxLzO1xKJYk5PQp6II-lQCJ18hinhFLfyA/edit?usp=sharing",
    questionnaire:
      "https://docs.google.com/document/d/1GP7FdwNlE0cpCEufOH6e4QVvwt5m0U-YbuWFm2pn7FQ/edit?usp=sharing",
  },
};

type H2HRow = {
  matchup: string;
  dem: { name: string; pct: number };
  rep: { name: string; pct: number };
  third?: number;
  undecided: number;
};

type PrimaryRow = { name: string; pct: number };

type ApprovalRow = {
  name: string;
  approve: number;
  disapprove: number;
  neutral: number;
};

type IsraelPACRow = { label: string; pct: number };

type PolicyRow = {
  policy: string;
  approve: number;
  disapprove: number;
  neutral: number;
};

const GENERAL: H2HRow[] = [
  {
    matchup: "General Election (Test #1)",
    dem: { name: "David Jolly (D)", pct: 42.3 },
    rep: { name: "Byron Donalds (R)", pct: 35.8 },
    third: 0.5,
    undecided: 21.5,
  },
  {
    matchup: "General Election (Test #2)",
    dem: { name: "David Jolly (D)", pct: 40.1 },
    rep: { name: "James Fishback (R)", pct: 32.9 },
    third: 1.7,
    undecided: 25.3,
  },
];

const GOP_PRIMARY: PrimaryRow[] = [
  { name: "Byron Donalds", pct: 29.7 },
  { name: "Jay Collins", pct: 11.6 },
  { name: "James Fishback", pct: 7.7 },
  { name: "Paul Renner", pct: 2.3 },
  { name: "Charles Burkett", pct: 2.0 },
  { name: "Bobby Williams", pct: 0.0 },
];

const DEM_PRIMARY: PrimaryRow[] = [
  { name: "David Jolly", pct: 22.3 },
  { name: "Jerry Demings", pct: 16.2 },
  { name: "Dayna Marie Foster", pct: 8.7 },
];

const UNDECIDED = {
  gop: 46.7,
  dem: 52.8,
};

const COMMENTATOR_APPROVALS: ApprovalRow[] = [
  {
    name: `Trump handling of "The Epstein Files"`,
    approve: 40.5,
    disapprove: 49.5,
    neutral: 10.0,
  },
  { name: "Byron Donalds", approve: 45.6, disapprove: 25.5, neutral: 29.0 },
  { name: "James Fishback", approve: 32.6, disapprove: 15.8, neutral: 51.6 },
  { name: "Myron Gaines", approve: 20.4, disapprove: 15.9, neutral: 63.7 },
  { name: "Nick Fuentes", approve: 17.7, disapprove: 35.4, neutral: 47.0 },
];

const TRUMP_APPROVAL_BY_ISSUE: ApprovalRow[] = [
  { name: "Overall", approve: 45.4, disapprove: 52.5, neutral: 2.1 },
  { name: "Economy, Jobs & Cost of Living", approve: 43.3, disapprove: 49.6, neutral: 7.1 },
  { name: "Immigration & Border Security", approve: 59.7, disapprove: 39.8, neutral: 0.5 },
  { name: "Crime, Public Safety & Policing", approve: 50.4, disapprove: 41.2, neutral: 8.4 },
  { name: "Foreign Policy & National Security", approve: 50.6, disapprove: 43.2, neutral: 6.2 },
  { name: "Healthcare, Social Security & Medicare", approve: 49.1, disapprove: 43.5, neutral: 7.4 },
  { name: "Education, Housing & Family Issues", approve: 39.6, disapprove: 51.0, neutral: 9.4 },
  { name: "Energy, Climate & the Environment", approve: 48.2, disapprove: 45.8, neutral: 6.0 },
  { name: "Guns & Second Amendment Rights", approve: 46.1, disapprove: 38.9, neutral: 15.0 },
  { name: "Civil Rights, Personal Freedoms & Social Issues", approve: 42.3, disapprove: 47.5, neutral: 10.2 },
  { name: "Political Corruption, Lobbying & Money in Politics", approve: 39.3, disapprove: 52.7, neutral: 8.0 },
];

const DESANTIS_APPROVAL_BY_ISSUE: ApprovalRow[] = [
  { name: "Overall", approve: 52.5, disapprove: 45.4, neutral: 2.1 },
  { name: "Economy, Jobs & Cost of Living", approve: 51.8, disapprove: 39.4, neutral: 8.8 },
  { name: "Immigration & Border Security", approve: 50.7, disapprove: 42.0, neutral: 7.3 },
  { name: "Crime, Public Safety & Policing", approve: 56.0, disapprove: 37.7, neutral: 6.3 },
  { name: "Foreign Policy & National Security", approve: 44.6, disapprove: 39.2, neutral: 16.2 },
  { name: "Healthcare, Social Security & Medicare", approve: 42.1, disapprove: 47.0, neutral: 10.9 },
  { name: "Education, Housing & Family Issues", approve: 49.7, disapprove: 39.6, neutral: 10.7 },
  { name: "Energy, Climate & the Environment", approve: 47.3, disapprove: 40.8, neutral: 11.9 },
  { name: "Guns & Second Amendment Rights", approve: 51.3, disapprove: 42.5, neutral: 6.2 },
  { name: "Civil Rights, Personal Freedoms & Social Issues", approve: 53.7, disapprove: 38.2, neutral: 8.1 },
  { name: "Political Corruption, Lobbying & Money in Politics", approve: 37.1, disapprove: 46.9, neutral: 16.0 },
];

const POLICY_APPROVAL: PolicyRow[] = [
  { policy: "Eliminate property taxes on homestead properties", approve: 69.1, disapprove: 22.9, neutral: 8.1 },
  { policy: "Ban large investment firms from buying single-family homes", approve: 76.0, disapprove: 15.6, neutral: 8.5 },
  { policy: "Increase competition in the insurance market", approve: 71.9, disapprove: 18.5, neutral: 9.6 },
  { policy: "Remove homeless encampments using state resources", approve: 58.8, disapprove: 28.6, neutral: 12.5 },
  { policy: "End H-1B visas and remove foreign workers from state government jobs", approve: 50.7, disapprove: 27.5, neutral: 21.7 },
  { policy: "Raise tuition for foreign students at public universities", approve: 52.6, disapprove: 36.3, neutral: 11.0 },
  { policy: "Oppose construction of AI data centers in Florida", approve: 60.2, disapprove: 24.4, neutral: 15.3 },
  { policy: `Impose a 50% "sin tax" on OnlyFans creators`, approve: 35.7, disapprove: 29.5, neutral: 34.8 },
  { policy: "Mandate school uniforms in all public schools", approve: 43.6, disapprove: 45.0, neutral: 11.5 },
  { policy: "Divest Florida government funds from Israeli bonds", approve: 45.6, disapprove: 20.4, neutral: 34.0 },
  { policy: "Paid maternity leave for every mother in Florida", approve: 64.3, disapprove: 28.1, neutral: 7.5 },
  { policy: "Public execution for individuals guilty in Epstein Files crimes", approve: 45.7, disapprove: 41.0, neutral: 13.3 },
  { policy: "Allow parents to receive a state education stipend (school choice)", approve: 59.2, disapprove: 31.1, neutral: 9.7 },
  { policy: "Raise taxes on out-of-state visitors to offset Florida costs", approve: 61.9, disapprove: 25.2, neutral: 12.9 },
];

const ISRAEL_PAC: IsraelPACRow[] = [
  { label: "No difference / no opinion", pct: 49.1 },
  { label: "Less likely to vote for them", pct: 25.5 },
  { label: "More likely to vote for them", pct: 25.3 },
];

/* ---------- helpers (UNCHANGED behavior) ---------- */
function clampPct(v: number) {
  return Math.max(0, Math.min(100, v));
}

function formatSignedMargin(v: number) {
  const sign = v > 0 ? "+" : v < 0 ? "−" : "±";
  return `${sign}${Math.abs(v).toFixed(1)}`;
}

function decidedMargin(row: H2HRow) {
  const d = row.dem.pct;
  const r = row.rep.pct;
  const denom = d + r;
  if (!denom) return 0;
  const dShare = (d / denom) * 100;
  const rShare = (r / denom) * 100;
  return dShare - rShare;
}

function netApprove(row: ApprovalRow) {
  return row.approve - row.disapprove;
}

/* ---------- UI blocks (coded like your HomePage) ---------- */

function TriColorTop() {
  return (
    <div
      className="h-[3px] w-full"
      style={{
        background:
          "linear-gradient(90deg, var(--red) 0%, var(--red) 33%, var(--purple) 33%, var(--purple) 66%, var(--blue) 66%, var(--blue) 100%)",
      }}
    />
  );
}

function SectionHeader({
  kicker,
  title,
  sub,
}: {
  kicker: string;
  title: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="psi-animate-in">
      <div
        className="psi-mono"
        style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.28em", color: "var(--purple-soft)" }}
      >
        {kicker}
      </div>
      <h2
        className="mt-2"
        style={{
          fontFamily: "var(--font-display), ui-sans-serif, system-ui",
          fontSize: "clamp(28px, 4vw, 40px)",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "#fff",
          lineHeight: 1,
        }}
      >
        {title}
      </h2>
      {sub ? (
        <p className="mt-3 text-sm sm:text-base max-w-3xl" style={{ color: "var(--muted2)" }}>
          {sub}
        </p>
      ) : null}
    </div>
  );
}

function MetricCard({ k, v }: { k: string; v: string }) {
  return (
    <div className="border px-3 py-3" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
      <div className="psi-mono" style={{ fontSize: "8px", letterSpacing: "0.2em", color: "var(--muted3)" }}>
        {k}
      </div>
      <div
        className="mt-1"
        style={{
          fontFamily: "var(--font-display), ui-sans-serif, system-ui",
          fontSize: "13px",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.03em",
          color: "#fff",
        }}
      >
        {v}
      </div>
    </div>
  );
}

function CompactTable({
  columns,
  rows,
  rightAlignCols = [],
}: {
  columns: string[];
  rows: (string | number)[][];
  rightAlignCols?: number[];
}) {
  return (
    <div className="overflow-x-auto border" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
      <table className="min-w-[980px] w-full text-left">
        <thead style={{ background: "rgba(255,255,255,0.04)" }}>
          <tr>
            {columns.map((c, i) => (
              <th
                key={c}
                className={[
                  "px-4 py-3",
                  rightAlignCols.includes(i) ? "text-right" : "text-left",
                ].join(" ")}
              >
                <span className="psi-mono" style={{ fontSize: "9px", letterSpacing: "0.22em", color: "var(--muted3)" }}>
                  {c}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={idx} style={{ borderTop: "1px solid var(--border)" }}>
              {r.map((cell, i) => (
                <td
                  key={i}
                  className={[
                    "px-4 py-3 text-sm whitespace-nowrap",
                    rightAlignCols.includes(i) ? "text-right psi-mono font-semibold" : "text-left",
                  ].join(" ")}
                  style={{ color: "rgba(255,255,255,0.78)" }}
                >
                  {typeof cell === "number" ? cell.toFixed(1) : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InlineBar({
  leftLabel,
  leftPct,
  rightLabel,
  rightPct,
  undecidedPct,
}: {
  leftLabel: string;
  leftPct: number;
  rightLabel: string;
  rightPct: number;
  undecidedPct: number;
}) {
  const total = leftPct + rightPct + undecidedPct;
  const a = total ? (leftPct / total) * 100 : 0;
  const b = total ? (rightPct / total) * 100 : 0;
  const u = total ? (undecidedPct / total) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <span className="psi-mono" style={{ fontSize: "10px", letterSpacing: "0.18em", color: "var(--muted3)" }}>
          {leftLabel}: <span style={{ color: "#fff", fontWeight: 800 }}>{leftPct.toFixed(1)}%</span>
        </span>
        <span className="psi-mono" style={{ fontSize: "10px", letterSpacing: "0.18em", color: "var(--muted3)" }}>
          {rightLabel}: <span style={{ color: "#fff", fontWeight: 800 }}>{rightPct.toFixed(1)}%</span>
        </span>
      </div>

      <div className="h-[3px] w-full" style={{ background: "var(--border)" }}>
        <div className="h-full flex">
          <div className="h-full" style={{ width: `${clampPct(a)}%`, background: "var(--blue)" }} />
          <div className="h-full" style={{ width: `${clampPct(b)}%`, background: "var(--red)" }} />
          <div className="h-full" style={{ width: `${clampPct(u)}%`, background: "rgba(255,255,255,0.18)" }} />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="psi-mono" style={{ fontSize: "9px", letterSpacing: "0.18em", color: "var(--muted3)" }}>
          UNDECIDED {undecidedPct.toFixed(1)}%
        </span>
        <span className="psi-mono" style={{ fontSize: "9px", letterSpacing: "0.18em", color: "var(--muted3)" }}>
          TOTAL {(leftPct + rightPct + undecidedPct).toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

function RankedBars({ items, undecided }: { items: PrimaryRow[]; undecided: number }) {
  const max = Math.max(...items.map((x) => x.pct), undecided);
  return (
    <div className="space-y-4">
      {items.map((it) => {
        const w = max ? (it.pct / max) * 100 : 0;
        return (
          <div key={it.name}>
            <div className="flex items-center justify-between gap-4">
              <div style={{ color: "#fff", fontWeight: 700 }}>{it.name}</div>
              <div className="psi-mono" style={{ color: "var(--muted2)", fontWeight: 800 }}>
                {it.pct.toFixed(1)}%
              </div>
            </div>
            <div className="mt-2 h-[3px] w-full" style={{ background: "var(--border)" }}>
              <div className="h-full" style={{ width: `${clampPct(w)}%`, background: "var(--purple-soft)" }} />
            </div>
          </div>
        );
      })}

      <div style={{ borderTop: "1px solid var(--border)" }} className="pt-4">
        <div className="flex items-center justify-between gap-4">
          <div style={{ color: "var(--muted2)", fontWeight: 700 }}>Undecided</div>
          <div className="psi-mono" style={{ color: "var(--muted2)", fontWeight: 800 }}>
            {undecided.toFixed(1)}%
          </div>
        </div>
        <div className="mt-2 h-[3px] w-full" style={{ background: "var(--border)" }}>
          <div
            className="h-full"
            style={{ width: `${clampPct(max ? (undecided / max) * 100 : 0)}%`, background: "rgba(255,255,255,0.18)" }}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------- page (UPDATED to match HomePage code style) ---------- */

export default function PollReleasePage() {
  const generalDerived = useMemo(() => {
    return GENERAL.map((row) => {
      const raw = row.dem.pct - row.rep.pct;
      const dec = decidedMargin(row);
      return { ...row, rawMargin: raw, decidedOnlyMargin: dec };
    });
  }, []);

  const metrics = [
    { k: "RELEASED", v: POLL.releaseDate.toUpperCase() },
    { k: "ADULTS (N)", v: String(POLL.sample.adults) },
    { k: "REGISTERED (N)", v: String(POLL.sample.registeredVoters) },
    { k: "LIKELY (N)", v: String(POLL.sample.likelyVoters) },
    { k: "MOE (ADULTS)", v: POLL.moe.adults },
    { k: "MOE (LV)", v: POLL.moe.lv },
  ];

  return (
    <div className="space-y-12">
      {/* ── HERO ── */}
      <section className="grid gap-8 lg:grid-cols-2 lg:items-start">
        {/* Left — copy */}
        <div className="psi-animate-in max-w-prose lg:max-w-none">
          {/* Live badge */}
          <div
            className="mb-5 inline-flex items-center gap-3 border px-3 py-2"
            style={{ borderColor: "var(--border)", background: "var(--panel)" }}
          >
            <span className="psi-live-dot" />
            <span
              className="psi-mono"
              style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.28em", color: "var(--purple-soft)" }}
            >
              POLL RELEASE
            </span>
            <span className="h-3 w-px" style={{ background: "var(--border3)" }} />
            <span className="psi-mono" style={{ fontSize: "9px", letterSpacing: "0.22em", color: "var(--muted3)" }}>
              DISCLOSURE-FIRST
            </span>
          </div>

          {/* Headline */}
          <h1
            style={{
              fontFamily: "var(--font-display), ui-sans-serif, system-ui",
              fontSize: "clamp(32px, 3.8vw, 52px)",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.02em",
              lineHeight: 1.0,
              color: "#fff",
            }}
          >
            {POLL.title} <span className="psi-gradient-text">Toplines</span>
          </h1>

          <h2
            className="mt-4"
            style={{
              fontFamily: "var(--font-display), ui-sans-serif, system-ui",
              fontSize: "clamp(14px, 1.6vw, 18px)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--muted)",
            }}
          >
            {POLL.org} · <span className="psi-gradient-text">{POLL.subtitle}</span>
          </h2>

          <p className="mt-4 text-base sm:text-lg" style={{ color: "var(--muted)" }}>
            A statewide Florida survey of{" "}
            <span style={{ color: "#fff", fontWeight: 800 }}>{POLL.sample.adults} adults</span> (including{" "}
            <span style={{ color: "#fff", fontWeight: 800 }}>{POLL.sample.registeredVoters} registered voters</span> and a
            modeled universe of{" "}
            <span style={{ color: "#fff", fontWeight: 800 }}>{POLL.sample.likelyVoters} likely voters</span>) provides an
            early snapshot of the 2026 governor’s race, primaries, and the broader approval/policy climate.
          </p>

          <p className="mt-3 text-sm sm:text-base" style={{ color: "var(--muted2)" }}>
            We completely understand that a <span style={{ color: "#fff", fontWeight: 800 }}>200 adult</span> sample is low.
            We will return to the field in about <span style={{ color: "#fff", fontWeight: 800 }}>2 weeks</span> and poll{" "}
            <span style={{ color: "#fff", fontWeight: 800 }}>200 more</span>, releasing the second set and the combined{" "}
            <span style={{ color: "#fff", fontWeight: 800 }}>n=400</span>. Fielded on the{" "}
            <span style={{ color: "#fff", fontWeight: 800 }}>Pollfish IDE Panel</span>.
          </p>

          {/* Metrics strip */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-xl">
            {metrics.map((m) => (
              <MetricCard key={m.k} k={m.k} v={m.v} />
            ))}
          </div>

          {/* CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row flex-wrap gap-3">
            <Link
              href={POLL.links.crosstabs}
              className="psi-btn psi-btn-primary"
              style={{ padding: "12px 24px", fontSize: "11px", letterSpacing: "0.22em" }}
              target="_blank"
              rel="noreferrer"
            >
              VIEW CROSSTABS →
            </Link>
            <Link
              href={POLL.links.questionnaire}
              className="psi-btn psi-btn-ghost"
              style={{ padding: "12px 24px", fontSize: "11px", letterSpacing: "0.22em" }}
              target="_blank"
              rel="noreferrer"
            >
              VIEW QUESTIONNAIRE
            </Link>
          </div>
        </div>

        {/* Right — feature card (Key findings) */}
        <div
          className="psi-card w-full max-w-xl lg:max-w-none mx-auto overflow-hidden"
          style={{ border: "1px solid var(--border)", background: "var(--panel)" }}
        >
          <TriColorTop />
          <div className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div
                  className="psi-mono"
                  style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.25em", color: "var(--purple-soft)" }}
                >
                  QUICK READ
                </div>
                <div
                  className="mt-2"
                  style={{
                    fontFamily: "var(--font-display), ui-sans-serif, system-ui",
                    fontSize: "22px",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: "#fff",
                  }}
                >
                  What stands out
                </div>
              </div>
              <div className="psi-mono hidden sm:block" style={{ fontSize: "9px", letterSpacing: "0.22em", color: "var(--muted3)" }}>
                PSI · FL · v0.1
              </div>
            </div>

            <div className="my-5 psi-divider" />

            <ul className="space-y-4">
              {[
                {
                  title: "General ballots: Jolly ahead",
                  sub: `Both tests show Jolly leading with sizable undecided.`,
                  accent: "var(--blue2)",
                },
                {
                  title: "Primaries: big undecided",
                  sub: `Neither party close to consolidation; early sorting only.`,
                  accent: "var(--purple-soft)",
                },
                {
                  title: "Issue approvals: mixed environment",
                  sub: `Approval varies sharply by issue for Trump/DeSantis.`,
                  accent: "var(--red2)",
                },
                {
                  title: "Policy terrain: broad support on housing/insurance",
                  sub: `Several policies test strongly above 60% approval.`,
                  accent: "var(--purple-soft)",
                },
              ].map((f) => (
                <li key={f.title} className="flex gap-3">
                  <span
                    className="mt-[7px] h-2 w-2 rounded-full flex-none"
                    style={{
                      background: f.accent,
                      boxShadow: `0 0 10px rgba(124,58,237,0.30)`,
                    }}
                  />
                  <span className="min-w-0">
                    <span
                      style={{
                        fontFamily: "var(--font-display), ui-sans-serif, system-ui",
                        fontSize: "14px",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "#fff",
                        display: "block",
                      }}
                    >
                      {f.title}
                    </span>
                    <span
                      className="psi-mono block mt-[3px]"
                      style={{ fontSize: "10px", letterSpacing: "0.14em", color: "var(--muted3)" }}
                    >
                      {f.sub}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-6 pt-5" style={{ borderTop: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="psi-mono" style={{ fontSize: "9px", letterSpacing: "0.22em", color: "var(--muted3)" }}>
                  NOTE
                </div>
                <div className="psi-mono" style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.22em", color: "var(--purple-soft)" }}>
                  SMALL N · EARLY READ
                </div>
              </div>
              <div className="h-[3px] w-full" style={{ background: "var(--border)" }}>
                <div
                  className="h-full"
                  style={{
                    width: "50%",
                    background: "linear-gradient(90deg, var(--red), var(--purple), var(--blue))",
                    boxShadow: "0 0 12px rgba(124,58,237,0.35)",
                  }}
                />
              </div>
              <div className="psi-mono mt-2" style={{ fontSize: "9px", letterSpacing: "0.18em", color: "var(--muted3)" }}>
                Next wave planned ~2 weeks; combined n=400 release.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PARTY BARS — visual split (like your homepage) ── */}
      <section className="grid grid-cols-2 gap-1">
        {[
          { label: "DEMOCRATIC VOTE (TEST #1)", color: "var(--blue)", pct: `${GENERAL[0].dem.pct.toFixed(1)}%` },
          { label: "REPUBLICAN VOTE (TEST #1)", color: "var(--red)", pct: `${GENERAL[0].rep.pct.toFixed(1)}%` },
        ].map((bar) => (
          <div key={bar.label} className="border p-4" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
            <div className="psi-mono" style={{ fontSize: "9px", letterSpacing: "0.24em", color: "var(--muted3)" }}>
              {bar.label}
            </div>
            <div className="mt-2 h-[3px] w-full" style={{ background: "var(--border)" }}>
              <div className="h-full" style={{ width: bar.pct, background: bar.color }} />
            </div>
            <div
              className="mt-2"
              style={{
                fontFamily: "var(--font-display), ui-sans-serif, system-ui",
                fontSize: "28px",
                fontWeight: 800,
                color: bar.color,
                lineHeight: 1,
              }}
            >
              {bar.pct}
            </div>
          </div>
        ))}
      </section>

      {/* ── GENERAL ELECTION ── */}
      <section
        className="psi-card overflow-hidden"
        style={{ border: "1px solid var(--border)", background: "var(--panel)" }}
      >
        <TriColorTop />
        <div className="p-5 sm:p-8 space-y-6">
          <SectionHeader
            kicker="TOPLINES"
            title="General Election Ballots"
            sub="Both tested matchups show Jolly leading, with a large undecided bloc keeping the race fluid."
          />

          <div className="grid gap-4 lg:grid-cols-2">
            {GENERAL.map((row, i) => (
              <div key={row.matchup} className="border p-5" style={{ borderColor: "var(--border)", background: "var(--panel2)" }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="psi-mono" style={{ fontSize: "9px", letterSpacing: "0.22em", color: "var(--muted3)" }}>
                      {row.matchup.toUpperCase()}
                    </div>
                    <div
                      className="mt-2"
                      style={{
                        fontFamily: "var(--font-display), ui-sans-serif, system-ui",
                        fontSize: "18px",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: "#fff",
                      }}
                    >
                      Margin: {formatSignedMargin(generalDerived[i].rawMargin)} <span style={{ color: "var(--muted2)" }}> (D−R)</span>
                    </div>
                    <div className="psi-mono mt-1" style={{ fontSize: "9px", letterSpacing: "0.18em", color: "var(--muted3)" }}>
                      Decided-only: {formatSignedMargin(generalDerived[i].decidedOnlyMargin)}
                    </div>
                  </div>
                  <span className="psi-badge psi-badge-amber">LV Model</span>
                </div>

                <div className="mt-5">
                  <InlineBar
                    leftLabel={row.dem.name}
                    leftPct={row.dem.pct}
                    rightLabel={row.rep.name}
                    rightPct={row.rep.pct}
                    undecidedPct={row.undecided}
                  />
                </div>

                <div className="mt-6">
                  <CompactTable
                    columns={["Matchup", "Dem", "Dem %", "Rep", "Rep %", "3rd %", "Und %", "Margin (D−R)"]}
                    rows={[
                      [row.matchup, row.dem.name, row.dem.pct, row.rep.name, row.rep.pct, row.third ?? 0, row.undecided, generalDerived[i].rawMargin],
                    ]}
                    rightAlignCols={[2, 4, 5, 6, 7]}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRIMARIES ── */}
      <section
        className="psi-card overflow-hidden"
        style={{ border: "1px solid var(--border)", background: "var(--panel)" }}
      >
        <TriColorTop />
        <div className="p-5 sm:p-8 space-y-6">
          <SectionHeader
            kicker="PARTY PRIMARIES"
            title="High Undecided, Early Sorting"
            sub="Donalds is the early GOP leader, but neither party is close to consolidation."
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="border p-5" style={{ borderColor: "var(--border)", background: "var(--panel2)" }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="psi-mono" style={{ fontSize: "9px", letterSpacing: "0.22em", color: "var(--muted3)" }}>
                    REPUBLICAN PRIMARY
                  </div>
                  <div
                    className="mt-2"
                    style={{
                      fontFamily: "var(--font-display), ui-sans-serif, system-ui",
                      fontSize: "18px",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: "#fff",
                    }}
                  >
                    Undecided {UNDECIDED.gop.toFixed(1)}%
                  </div>
                </div>
                <span className="psi-badge">GOP</span>
              </div>

              <div className="mt-5">
                <RankedBars items={GOP_PRIMARY} undecided={UNDECIDED.gop} />
              </div>

              <div className="mt-6">
                <CompactTable
                  columns={["Candidate", "%"]}
                  rows={[...GOP_PRIMARY.map((x) => [x.name, x.pct]), ["Undecided", UNDECIDED.gop]]}
                  rightAlignCols={[1]}
                />
              </div>
            </div>

            <div className="border p-5" style={{ borderColor: "var(--border)", background: "var(--panel2)" }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="psi-mono" style={{ fontSize: "9px", letterSpacing: "0.22em", color: "var(--muted3)" }}>
                    DEMOCRATIC PRIMARY
                  </div>
                  <div
                    className="mt-2"
                    style={{
                      fontFamily: "var(--font-display), ui-sans-serif, system-ui",
                      fontSize: "18px",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: "#fff",
                    }}
                  >
                    Undecided {UNDECIDED.dem.toFixed(1)}%
                  </div>
                </div>
                <span className="psi-badge">DEM</span>
              </div>

              <div className="mt-5">
                <RankedBars items={DEM_PRIMARY} undecided={UNDECIDED.dem} />
              </div>

              <div className="mt-6">
                <CompactTable
                  columns={["Candidate", "%"]}
                  rows={[...DEM_PRIMARY.map((x) => [x.name, x.pct]), ["Undecided", UNDECIDED.dem]]}
                  rightAlignCols={[1]}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── APPROVALS ── */}
      <section className="psi-card overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--panel)" }}>
        <TriColorTop />
        <div className="p-5 sm:p-8 space-y-6">
          <SectionHeader kicker="APPROVAL" title="Commentators & Candidate Ratings" sub="Net shows whether approval exceeds disapproval." />

          <CompactTable
            columns={["Subject", "Approve", "Disapprove", "Neutral", "Net"]}
            rows={COMMENTATOR_APPROVALS.map((r) => [r.name, r.approve, r.disapprove, r.neutral, netApprove(r)])}
            rightAlignCols={[1, 2, 3, 4]}
          />
        </div>
      </section>

      {/* ── ISSUE APPROVALS ── */}
      <section className="psi-card overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--panel)" }}>
        <TriColorTop />
        <div className="p-5 sm:p-8 space-y-6">
          <SectionHeader
            kicker="EXECUTIVE ENVIRONMENT"
            title="Trump & DeSantis Approval By Issue"
            sub="Two side-by-side tables on desktop, stacked on mobile."
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="border p-5" style={{ borderColor: "var(--border)", background: "var(--panel2)" }}>
              <div className="psi-mono" style={{ fontSize: "9px", letterSpacing: "0.22em", color: "var(--muted3)" }}>
                TRUMP APPROVAL BY ISSUE
              </div>
              <div className="mt-4">
                <CompactTable
                  columns={["Issue", "Approve", "Disapprove", "Neutral", "Net"]}
                  rows={TRUMP_APPROVAL_BY_ISSUE.map((r) => [r.name, r.approve, r.disapprove, r.neutral, netApprove(r)])}
                  rightAlignCols={[1, 2, 3, 4]}
                />
              </div>
            </div>

            <div className="border p-5" style={{ borderColor: "var(--border)", background: "var(--panel2)" }}>
              <div className="psi-mono" style={{ fontSize: "9px", letterSpacing: "0.22em", color: "var(--muted3)" }}>
                DESANTIS APPROVAL BY ISSUE
              </div>
              <div className="mt-4">
                <CompactTable
                  columns={["Issue", "Approve", "Disapprove", "Neutral", "Net"]}
                  rows={DESANTIS_APPROVAL_BY_ISSUE.map((r) => [r.name, r.approve, r.disapprove, r.neutral, netApprove(r)])}
                  rightAlignCols={[1, 2, 3, 4]}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── POLICY APPROVAL ── */}
      <section className="psi-card overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--panel)" }}>
        <TriColorTop />
        <div className="p-5 sm:p-8 space-y-6">
          <SectionHeader kicker="ISSUE TERRAIN" title="Policy Approval" sub="Toplines across tested policies." />

          <CompactTable
            columns={["Policy", "Approve", "Disapprove", "Neutral", "Net"]}
            rows={POLICY_APPROVAL.map((r) => [r.policy, r.approve, r.disapprove, r.neutral, r.approve - r.disapprove])}
            rightAlignCols={[1, 2, 3, 4]}
          />
        </div>
      </section>

      {/* ── ISRAEL PAC ── */}
      <section className="psi-card overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--panel)" }}>
        <TriColorTop />
        <div className="p-5 sm:p-8 space-y-6">
          <SectionHeader
            kicker="ATTITUDES"
            title="Israel-Supporting PAC Donation Effect"
            sub="Nearly half say it makes no difference; the remainder is split."
          />

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <CompactTable columns={["Response", "%"]} rows={ISRAEL_PAC.map((r) => [r.label, r.pct])} rightAlignCols={[1]} />
            </div>

            <div className="border p-5" style={{ borderColor: "var(--border)", background: "var(--panel2)", borderLeft: "2px solid var(--purple-soft)" }}>
              <div className="psi-mono" style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.22em", color: "var(--purple-soft)" }}>
                QUICK READ
              </div>
              <p className="mt-3 text-sm sm:text-base" style={{ color: "var(--muted2)" }}>
                Net impact is essentially neutral:{" "}
                <span style={{ color: "#fff", fontWeight: 800 }}>25.3%</span> more likely vs{" "}
                <span style={{ color: "#fff", fontWeight: 800 }}>25.5%</span> less likely, while{" "}
                <span style={{ color: "#fff", fontWeight: 800 }}>49.1%</span> say no difference.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER CTA (coded like your “Get involved” block) ── */}
      <section className="psi-card overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--panel)" }}>
        <TriColorTop />
        <div className="p-5 sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="psi-mono" style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.28em", color: "var(--purple-soft)" }}>
                NEXT STEPS
              </div>
              <h2
                className="mt-2"
                style={{
                  fontFamily: "var(--font-display), ui-sans-serif, system-ui",
                  fontSize: "clamp(28px, 4vw, 40px)",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "#fff",
                  lineHeight: 1,
                }}
              >
                Full Disclosure Materials
              </h2>
            </div>
            <div className="psi-mono" style={{ fontSize: "9px", letterSpacing: "0.22em", color: "var(--muted3)" }}>
              CROSSTABS · QUESTIONNAIRE
            </div>
          </div>

          <div className="my-5 psi-divider" />

          <p className="text-sm sm:text-base max-w-3xl" style={{ color: "var(--muted2)" }}>
            Use the underlying tables for deeper analysis. We publish crosstabs and the exact questionnaire for transparency.
          </p>

          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            {[
              { color: "var(--blue)", label: "VIEW CROSSTABS", desc: "Full tables and slices for verification + analysis", href: POLL.links.crosstabs },
              { color: "var(--purple)", label: "VIEW QUESTIONNAIRE", desc: "Exact wording and ordering used in the field", href: POLL.links.questionnaire },
            ].map((c) => (
              <Link
                key={c.label}
                href={c.href}
                target="_blank"
                rel="noreferrer"
                className="border p-4 block"
                style={{ borderColor: "var(--border)", background: "var(--panel2)", borderLeft: `2px solid ${c.color}` }}
              >
                <div className="psi-mono" style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.22em", color: c.color }}>
                  {c.label}
                </div>
                <p className="mt-2 text-sm" style={{ color: "var(--muted2)" }}>
                  {c.desc}
                </p>
              </Link>
            ))}
          </div>

          <div className="mt-8 flex flex-col sm:flex-row flex-wrap gap-3">
            <Link
              href={POLL.links.crosstabs}
              className="psi-btn psi-btn-primary w-full sm:w-auto justify-center"
              style={{ padding: "13px 28px", fontSize: "11px", letterSpacing: "0.22em" }}
              target="_blank"
              rel="noreferrer"
            >
              VIEW CROSSTABS →
            </Link>
            <Link
              href={POLL.links.questionnaire}
              className="psi-btn psi-btn-ghost w-full sm:w-auto justify-center"
              style={{ padding: "13px 28px", fontSize: "11px", letterSpacing: "0.22em" }}
              target="_blank"
              rel="noreferrer"
            >
              VIEW QUESTIONNAIRE
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}