import Link from "next/link";

const keyMetrics = [
  { k: "REGISTERED VOTERS", v: "316", delta: "WEIGHTED N=282" },
  { k: "LIKELY VOTERS", v: "249", delta: "WEIGHTED N=249" },
  { k: "SURVEY PERIOD", v: "2026", delta: "NATIONAL" },
];

const headlineFindings = [
  {
    accent: "var(--blue2)",
    glow: "rgba(59,130,246,0.4)",
    tag: "MOTIVATION",
    title: "Voter Motivation (2026 Midterms)",
    sub: "Extremely motivated: 52% RV • 74% LV — high engagement expected among likely voters.",
    pct: 74,
  },
  {
    accent: "var(--purple-soft)",
    glow: "rgba(124,58,237,0.35)",
    tag: "GENERIC BALLOT",
    title: "2026 Generic Congressional Ballot",
    sub: "Dem +8 RV (41%–33%), Dem +9 LV (50%–41%) including leaners.",
    pct: 9,
  },
  {
    accent: "var(--red2)",
    glow: "rgba(230,57,70,0.35)",
    tag: "HYPOTHETICAL MATCHUP",
    title: "2028 Pres: Vance vs Newsom",
    sub: "Close race — Newsom +4 LV (47%–42%), undecideds still high.",
    pct: 4,
  },
  {
    accent: "var(--blue2)",
    glow: "rgba(59,130,246,0.3)",
    tag: "TRUMP APPROVAL",
    title: "President Trump Approval",
    sub: "Strong disapproval dominant at 49% RV / 48% LV overall.",
    pct: 49,
  },
];

const callouts = [
  {
    color: "var(--blue2)",
    bg: "rgba(37,99,235,0.06)",
    border: "rgba(59,130,246,0.20)",
    icon: "◈",
    label: "TAKE THE SURVEY",
    desc: "Contribute to the live national sentiment baseline.",
    href: "https://wss.pollfish.com/link/522d0e01-b70f-4955-8514-b42a7f10d4b6",
    cta: "PARTICIPATE →",
  },
  {
    color: "var(--purple-soft)",
    bg: "rgba(124,58,237,0.06)",
    border: "rgba(124,58,237,0.22)",
    icon: "◉",
    label: "PARTNER WITH US",
    desc: "Request custom cuts, crosstabs or recurring waves.",
    href: "/contact",
    cta: "REACH OUT →",
  },
  {
    color: "var(--red2)",
    bg: "rgba(230,57,70,0.06)",
    border: "rgba(230,57,70,0.20)",
    icon: "◫",
    label: "METHODOLOGY",
    desc: "Weighted toplines, transparent disclosure — full details available.",
    href: "/methodology",
    cta: "READ MORE →",
  },
];

const recentHeadlines = [
  { issue: "Economy Trust", dem: 37, rep: 33, n: "282 RV", date: "2026" },
  { issue: "Immigration Trust", dem: 29, rep: 45, n: "282 RV", date: "2026" },
  { issue: "Healthcare Trust", dem: 49, rep: 27, n: "282 RV", date: "2026" },
  { issue: "Crime Trust", dem: 35, rep: 36, n: "282 RV", date: "2026" },
];

export default function ResultsPage() {
  return (
    <>
      {/* ══════════════════════════════════ HERO / HEADER ══════════════════════════════════ */}
      <div className="grid md:grid-cols-2 gap-12 mb-16">
        {/* LEFT */}
        <div>
          <div className="text-sm uppercase tracking-wider text-gray-500 mb-2">
            SURVEY TOPLINES — NATIONAL POLL 2026
          </div>
          <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
            PUBLIC SENTIMENT INSTITUTE
            <br />
            <span className="text-blue-600">2026 National Poll</span>
          </h1>
          <p className="text-xl text-gray-700 max-w-2xl">
            Weighted results among Registered Voters (n=316) and Likely Voters (n=249). 
            Continuous disclosure-first polling on motivation, ballot, hypotheticals, approvals, issues, and policy.
          </p>

          <div className="grid grid-cols-3 gap-6 mt-10">
            {keyMetrics.map((m, i) => (
              <div key={i} className="text-center">
                <div className="text-4xl font-bold">{m.v}</div>
                <div className="text-sm uppercase text-gray-500">{m.k}</div>
                <div className="text-xs text-green-600 mt-1">{m.delta}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-6 mt-12">
            <Link
              href="https://wss.pollfish.com/link/522d0e01-b70f-4955-8514-b42a7f10d4b6"
              className="bg-blue-600 text-white px-8 py-4 rounded-lg font-medium hover:bg-blue-700 transition"
            >
              TAKE THE SURVEY →
            </Link>
            <Link
              href="/contact"
              className="border border-purple-600 text-purple-700 px-8 py-4 rounded-lg font-medium hover:bg-purple-50 transition"
            >
              PARTNER WITH US
            </Link>
          </div>
        </div>

        {/* RIGHT — HEADLINE FINDINGS */}
        <div className="bg-gray-50/70 p-8 rounded-2xl border border-gray-200">
          <div className="text-sm uppercase tracking-wider text-gray-600 mb-4">
            KEY HEADLINE FINDINGS · v1.0 · NATIONAL
          </div>
          <div className="space-y-10">
            {headlineFindings.map((f, i) => (
              <div key={i} className="relative">
                <div className="text-xs uppercase font-semibold mb-1" style={{ color: f.accent }}>
                  {f.tag}
                </div>
                <h3 className="text-xl font-bold mb-2">{f.title}</h3>
                <p className="text-gray-600 mb-3">{f.sub}</p>
                <div className="text-3xl font-bold" style={{ color: f.accent }}>
                  {f.pct}%
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 pt-6 border-t border-gray-200">
            <div className="text-sm text-gray-500">DATA STATUS</div>
            <div className="text-lg font-medium mt-1">WEIGHTED · PUBLIC · TRANSPARENT</div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════ CALLOUTS ══════════════════════════════════ */}
      <div className="mb-20">
        <h2 className="text-3xl font-bold text-center mb-10">GET INVOLVED</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {callouts.map((c, i) => (
            <div
              key={i}
              className="p-8 rounded-xl border"
              style={{
                background: c.bg,
                borderColor: c.border,
                color: c.color,
              }}
            >
              <div className="text-4xl mb-4">{c.icon}</div>
              <h3 className="text-xl font-bold mb-3">{c.label}</h3>
              <p className="text-gray-700 mb-6">{c.desc}</p>
              <Link
                href={c.href}
                className="font-medium hover:underline"
                style={{ color: c.color }}
              >
                {c.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════ SELECTED TOPLINES TABLE ══════════════════════════════════ */}
      <div className="mb-20">
        <h2 className="text-3xl font-bold mb-8 text-center">SELECTED TOPLINES</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-6 py-4 text-left font-semibold">Issue / Question</th>
                <th className="px-6 py-4 text-center font-semibold">Dem / Left</th>
                <th className="px-6 py-4 text-center font-semibold">Rep / Right</th>
                <th className="px-6 py-4 text-center font-semibold">Base</th>
                <th className="px-6 py-4 text-center font-semibold">Period</th>
              </tr>
            </thead>
            <tbody>
              {recentHeadlines.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="px-6 py-4 font-medium">{r.issue}</td>
                  <td className="px-6 py-4 text-center">{r.dem}%</td>
                  <td className="px-6 py-4 text-center">{r.rep}%</td>
                  <td className="px-6 py-4 text-center text-sm text-gray-600">{r.n}</td>
                  <td className="px-6 py-4 text-center text-sm text-gray-600">{r.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-center mt-8">
          <Link href="/full-results" className="text-blue-600 font-medium hover:underline">
            View Complete Cross-Tabs & All Questions →
          </Link>
        </div>
      </div>

      {/* ══════════════════════════════════ BAR CHARTS SECTION ══════════════════════════════════ */}
      <div className="mb-20">
        <h2 className="text-3xl font-bold text-center mb-12">Key Visualizations</h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
          {/* Chart 1: Trump Approval */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-xl font-bold mb-4 text-center">Trump Overall Approval (Q16)</h3>
            <img
              src="/charts/trump_approval_bar.png"
              alt="Bar chart of President Trump's approval ratings: Strongly approve, Somewhat approve, Somewhat disapprove, Strongly disapprove, Neutral — compared between Registered Voters and Likely Voters"
              className="w-full h-auto rounded-lg"
            />
            <p className="text-sm text-gray-600 mt-4 text-center">
              Strong disapproval leads at ~49% RV / 48% LV
            </p>
          </div>

          {/* Chart 2: Top Issues Ranking */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-xl font-bold mb-4 text-center">Most Important Issues (Q7) — RV</h3>
            <img
              src="/charts/top_issues_rv_bar.png"
              alt="Horizontal bar chart showing mean rank of top issues for Registered Voters (lower rank = higher priority). Economy ranks highest at 3.58."
              className="w-full h-auto rounded-lg"
            />
            <p className="text-sm text-gray-600 mt-4 text-center">
              Economy & Healthcare top the list; Guns ranks lowest priority
            </p>
          </div>

          {/* Chart 3: Party Trust on Issues */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-xl font-bold mb-4 text-center">Party Trust on Key Issues (Q18) — RV</h3>
            <img
              src="/charts/party_trust_bar.png"
              alt="Bar chart comparing Democrat vs Republican Party trust percentages on Economy, Immigration, Crime, Healthcare, and Education among Registered Voters"
              className="w-full h-auto rounded-lg"
            />
            <p className="text-sm text-gray-600 mt-4 text-center">
              Democrats trusted more on Healthcare/Education; Republicans lead on Immigration
            </p>
          </div>
        </div>

        <div className="text-center mt-10">
          <Link href="/methodology" className="text-blue-600 font-medium hover:underline">
            Full methodology and weighting details →
          </Link>
        </div>
      </div>
    </>
  );
}