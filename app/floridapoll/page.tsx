"use client";

import { useMemo } from "react";

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

/* ---------- helpers ---------- */

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

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/35">
        {label}
      </span>
      <span className="font-mono text-sm font-black text-white/80">{value}</span>
    </div>
  );
}

function SectionTitle({
  kicker,
  title,
  desc,
}: {
  kicker?: string;
  title: string;
  desc?: string;
}) {
  return (
    <div className="space-y-2 border-l-4 border-blue-600 pl-6">
      {kicker ? (
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-blue-400/80">
          {kicker}
        </p>
      ) : null}
      <h2 className="text-3xl font-black tracking-tight uppercase">{title}</h2>
      {desc ? <p className="text-white/50 text-lg">{desc}</p> : null}
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
  const d = total ? (leftPct / total) * 100 : 0;
  const r = total ? (rightPct / total) * 100 : 0;
  const u = total ? (undecidedPct / total) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] font-bold text-white/70">
        <span className="text-blue-300">
          {leftLabel}: {leftPct.toFixed(1)}%
        </span>
        <span className="text-red-300">
          {rightLabel}: {rightPct.toFixed(1)}%
        </span>
      </div>

      <div className="h-3 w-full overflow-hidden rounded-full border border-white/10 bg-white/[0.03]">
        <div className="flex h-full w-full">
          <div className="h-full bg-blue-600/80" style={{ width: `${clampPct(d)}%` }} />
          <div className="h-full bg-red-600/80" style={{ width: `${clampPct(r)}%` }} />
          <div className="h-full bg-white/20" style={{ width: `${clampPct(u)}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.28em] text-white/30">
        <span>Undecided: {undecidedPct.toFixed(1)}%</span>
        <span>Total: {(leftPct + rightPct + undecidedPct).toFixed(1)}%</span>
      </div>
    </div>
  );
}

function Card({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.02] p-6 backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h3 className="text-sm font-black uppercase tracking-[0.25em] text-white/70">
          {title}
        </h3>
        {note ? (
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white/25">
            {note}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
      {children}
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
    <TableWrap>
      <table className="min-w-[760px] w-full text-left">
        <thead className="bg-white/[0.04]">
          <tr>
            {columns.map((c, i) => (
              <th
                key={c}
                className={[
                  "px-4 py-3 text-[10px] font-black uppercase tracking-[0.28em] text-white/60",
                  rightAlignCols.includes(i) ? "text-right" : "text-left",
                ].join(" ")}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={idx} className="border-t border-white/10">
              {r.map((cell, i) => (
                <td
                  key={i}
                  className={[
                    "px-4 py-3 text-sm text-white/80 whitespace-nowrap",
                    rightAlignCols.includes(i) ? "text-right font-mono" : "text-left",
                  ].join(" ")}
                >
                  {typeof cell === "number" ? cell.toFixed(1) : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

function RankedBars({
  items,
  undecided,
  color,
}: {
  items: PrimaryRow[];
  undecided: number;
  color: "red" | "blue";
}) {
  const max = Math.max(...items.map((x) => x.pct), undecided);

  return (
    <div className="space-y-3">
      {items.map((it) => {
        const w = max ? (it.pct / max) * 100 : 0;
        return (
          <div key={it.name} className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-semibold text-white/85">{it.name}</span>
              <span className="font-mono text-sm font-black text-white/70">
                {it.pct.toFixed(1)}%
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full border border-white/10 bg-white/[0.03]">
              <div
                className={[
                  "h-full",
                  color === "red" ? "bg-red-600/80" : "bg-blue-600/80",
                ].join(" ")}
                style={{ width: `${clampPct(w)}%` }}
              />
            </div>
          </div>
        );
      })}

      <div className="pt-2 space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-semibold text-white/55">Undecided</span>
          <span className="font-mono text-sm font-black text-white/70">
            {undecided.toFixed(1)}%
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full border border-white/10 bg-white/[0.03]">
          <div className="h-full bg-white/25" style={{ width: `${clampPct((undecided / max) * 100)}%` }} />
        </div>
      </div>
    </div>
  );
}

/* ---------- page ---------- */

export default function PollReleasePage() {
  const generalDerived = useMemo(() => {
    return GENERAL.map((row) => {
      const raw = row.dem.pct - row.rep.pct;
      const dec = decidedMargin(row);
      return { ...row, rawMargin: raw, decidedOnlyMargin: dec };
    });
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center pt-12 pb-24 px-4 bg-transparent text-white">
      <div className="w-full max-w-6xl space-y-12">
        {/* Header */}
        <header className="space-y-5 text-center">
          <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full">
            <span className="uppercase tracking-[0.2em] text-[10px] font-black text-blue-400">
              {POLL.org} poll
            </span>
            <span className="text-white/20 text-xs font-black">•</span>
            <span className="uppercase tracking-[0.2em] text-[10px] font-black text-white/35">
              Released {POLL.releaseDate}
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-none italic">
            {POLL.title}
            <br />
            <span className="text-white/30 not-italic">{POLL.subtitle}</span>
          </h1>

          <p className="mx-auto max-w-3xl text-white/55 text-lg leading-relaxed">
            A statewide Florida survey of{" "}
            <span className="font-bold text-white/80">{POLL.sample.adults} adults</span>{" "}
            (including{" "}
            <span className="font-bold text-white/80">{POLL.sample.registeredVoters} registered voters</span>{" "}
            and a modeled universe of{" "}
            <span className="font-bold text-white/80">{POLL.sample.likelyVoters} likely voters</span>
            ) provides an early snapshot of the 2026 governor’s race, primaries, and the broader approval/policy climate.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 max-w-5xl mx-auto">
            <StatPill label="Adults (n)" value={POLL.sample.adults} />
            <StatPill label="Registered (n)" value={POLL.sample.registeredVoters} />
            <StatPill label="Likely (n)" value={POLL.sample.likelyVoters} />
            <StatPill label="MOE (Adults)" value={POLL.moe.adults} />
            <StatPill label="MOE (LV)" value={POLL.moe.lv} />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <a
              href={POLL.links.crosstabs}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-[11px] font-black uppercase tracking-[0.28em] text-white/80 hover:bg-white/[0.06] transition"
            >
              View Crosstabs
            </a>
            <a
              href={POLL.links.questionnaire}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-[11px] font-black uppercase tracking-[0.28em] text-white/80 hover:bg-white/[0.06] transition"
            >
              View Questionnaire
            </a>
          </div>
        </header>

        {/* Disclaimer */}
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.02] p-8">
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-200/90">
              DISCLAIMER
            </div>
            <p className="mt-2 text-white/70 leading-relaxed">
              We completely understand that a <span className="font-bold text-white/85">200 adult</span> sample is low.
              We will return to the field in about <span className="font-bold text-white/85">2 weeks</span> and poll{" "}
              <span className="font-bold text-white/85">200 more</span>, releasing the second set and the combined{" "}
              <span className="font-bold text-white/85">n=400</span>. This poll was conducted using the{" "}
              <span className="font-bold text-white/85">Pollfish IDE Panel</span>. MOE is {POLL.moe.adults} (Adults) to{" "}
              {POLL.moe.lv} (LV), depending on the screen.
            </p>
          </div>
        </section>

        {/* General election */}
        <section className="space-y-8">
          <SectionTitle
            kicker="Toplines"
            title="General Election Ballots"
            desc="Both tested matchups show Jolly leading, with a large undecided bloc keeping the race fluid."
          />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card
              title="General Election Test #1"
              note={`Raw margin (D−R): ${formatSignedMargin(generalDerived[0].rawMargin)} • Decided-only: ${formatSignedMargin(
                generalDerived[0].decidedOnlyMargin
              )}`}
            >
              <InlineBar
                leftLabel={GENERAL[0].dem.name}
                leftPct={GENERAL[0].dem.pct}
                rightLabel={GENERAL[0].rep.name}
                rightPct={GENERAL[0].rep.pct}
                undecidedPct={GENERAL[0].undecided}
              />

              <div className="mt-5">
                <CompactTable
                  columns={["Matchup", "Dem", "Dem %", "Rep", "Rep %", "3rd %", "Und %", "Margin (D−R)"]}
                  rows={[
                    [
                      GENERAL[0].matchup,
                      GENERAL[0].dem.name,
                      GENERAL[0].dem.pct,
                      GENERAL[0].rep.name,
                      GENERAL[0].rep.pct,
                      GENERAL[0].third ?? 0,
                      GENERAL[0].undecided,
                      generalDerived[0].rawMargin,
                    ],
                  ]}
                  rightAlignCols={[2, 4, 5, 6, 7]}
                />
              </div>
            </Card>

            <Card
              title="General Election Test #2"
              note={`Raw margin (D−R): ${formatSignedMargin(generalDerived[1].rawMargin)} • Decided-only: ${formatSignedMargin(
                generalDerived[1].decidedOnlyMargin
              )}`}
            >
              <InlineBar
                leftLabel={GENERAL[1].dem.name}
                leftPct={GENERAL[1].dem.pct}
                rightLabel={GENERAL[1].rep.name}
                rightPct={GENERAL[1].rep.pct}
                undecidedPct={GENERAL[1].undecided}
              />

              <div className="mt-5">
                <CompactTable
                  columns={["Matchup", "Dem", "Dem %", "Rep", "Rep %", "3rd %", "Und %", "Margin (D−R)"]}
                  rows={[
                    [
                      GENERAL[1].matchup,
                      GENERAL[1].dem.name,
                      GENERAL[1].dem.pct,
                      GENERAL[1].rep.name,
                      GENERAL[1].rep.pct,
                      GENERAL[1].third ?? 0,
                      GENERAL[1].undecided,
                      generalDerived[1].rawMargin,
                    ],
                  ]}
                  rightAlignCols={[2, 4, 5, 6, 7]}
                />
              </div>
            </Card>
          </div>
        </section>

        {/* Primaries */}
        <section className="space-y-8">
          <SectionTitle
            kicker="Party primaries"
            title="High Undecided, Early Sorting"
            desc="Donalds is the early GOP leader, but neither party is close to consolidation."
          />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card title="Republican Primary" note={`Undecided: ${UNDECIDED.gop.toFixed(1)}%`}>
              <RankedBars items={GOP_PRIMARY} undecided={UNDECIDED.gop} color="red" />

              <div className="mt-6">
                <CompactTable
                  columns={["Candidate", "%"]}
                  rows={[
                    ...GOP_PRIMARY.map((x) => [x.name, x.pct]),
                    ["Undecided", UNDECIDED.gop],
                  ]}
                  rightAlignCols={[1]}
                />
              </div>
            </Card>

            <Card title="Democratic Primary" note={`Undecided: ${UNDECIDED.dem.toFixed(1)}%`}>
              <RankedBars items={DEM_PRIMARY} undecided={UNDECIDED.dem} color="blue" />

              <div className="mt-6">
                <CompactTable
                  columns={["Candidate", "%"]}
                  rows={[
                    ...DEM_PRIMARY.map((x) => [x.name, x.pct]),
                    ["Undecided", UNDECIDED.dem],
                  ]}
                  rightAlignCols={[1]}
                />
              </div>
            </Card>
          </div>
        </section>

        {/* Commentators & candidates approvals */}
        <section className="space-y-8">
          <SectionTitle
            kicker="Approval"
            title="Commentators & Candidate Ratings"
            desc="Net shows whether approval exceeds disapproval."
          />

          <Card title="Approval Toplines" note="Net = Approve − Disapprove">
            <CompactTable
              columns={["Subject", "Approve", "Disapprove", "Neutral", "Net"]}
              rows={COMMENTATOR_APPROVALS.map((r) => [r.name, r.approve, r.disapprove, r.neutral, netApprove(r)])}
              rightAlignCols={[1, 2, 3, 4]}
            />
          </Card>
        </section>

        {/* Trump / DeSantis issue approvals */}
        <section className="space-y-8">
          <SectionTitle
            kicker="Executive environment"
            title="Trump & DeSantis Approval By Issue"
            desc="Tables are horizontally scrollable on mobile, and fixed-width to prevent overflow."
          />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card title="Trump Approval By Issue" note="Net = Approve − Disapprove">
              <CompactTable
                columns={["Issue", "Approve", "Disapprove", "Neutral", "Net"]}
                rows={TRUMP_APPROVAL_BY_ISSUE.map((r) => [r.name, r.approve, r.disapprove, r.neutral, netApprove(r)])}
                rightAlignCols={[1, 2, 3, 4]}
              />
            </Card>

            <Card title="DeSantis Approval By Issue" note="Net = Approve − Disapprove">
              <CompactTable
                columns={["Issue", "Approve", "Disapprove", "Neutral", "Net"]}
                rows={DESANTIS_APPROVAL_BY_ISSUE.map((r) => [r.name, r.approve, r.disapprove, r.neutral, netApprove(r)])}
                rightAlignCols={[1, 2, 3, 4]}
              />
            </Card>
          </div>
        </section>

        {/* Policy approval */}
        <section className="space-y-8">
          <SectionTitle
            kicker="Issue terrain"
            title="Policy Approval"
            desc="Mobile-friendly table: scrolls horizontally, doesn’t smash the layout."
          />

          <Card title="Policy Approval (Toplines)" note="Net = Approve − Disapprove">
            <CompactTable
              columns={["Policy", "Approve", "Disapprove", "Neutral", "Net"]}
              rows={POLICY_APPROVAL.map((r) => [r.policy, r.approve, r.disapprove, r.neutral, r.approve - r.disapprove])}
              rightAlignCols={[1, 2, 3, 4]}
            />
          </Card>
        </section>

        {/* Israel PAC question */}
        <section className="space-y-8">
          <SectionTitle
            kicker="Attitudes"
            title="Israel-Supporting PAC Donation Effect"
            desc="Nearly half say it makes no difference; the remainder is split."
          />

          <Card title="PAC Donations (Israel-supporting) • Vote Impact">
            <CompactTable
              columns={["Response", "%"]}
              rows={ISRAEL_PAC.map((r) => [r.label, r.pct])}
              rightAlignCols={[1]}
            />

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/35">
                Quick read
              </div>
              <p className="mt-2 text-white/70 leading-relaxed">
                Net impact is essentially neutral:{" "}
                <span className="font-bold text-white/80">25.3%</span> more likely vs{" "}
                <span className="font-bold text-white/80">25.5%</span> less likely, while{" "}
                <span className="font-bold text-white/80">49.1%</span> say no difference.
              </p>
            </div>
          </Card>
        </section>

        {/* Footer */}
        <footer className="text-center pt-10 border-t border-white/5">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">
            Powered by The Public Sentiment Institute & Pollfish.
          </p>
        </footer>
      </div>
    </main>
  );
}