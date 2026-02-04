import Link from "next/link";

export default function MethodologyPage() {
  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          <span className="psi-gradient-text">Methodology</span>
        </h1>

        <p className="max-w-3xl">
          The Public Sentiment National Database is designed for repeat measurement over time.
          That means consistent wording, clear field notes, and trend-ready outputs.
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/polling"
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Take the active survey
          </Link>

          <Link
            href="/contact"
            className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold hover:bg-slate-50"
          >
            Partner / request a poll
          </Link>
        </div>

        <div className="psi-mono text-xs">
          Reporting standard: question text • field dates • mode • n-size • weighting notes (if used)
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="psi-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">1) Instrument design</h2>
          <div className="my-4 psi-divider" />
          <p>
            We prioritize clarity and neutrality. Core questions remain stable so results can be
            compared across waves.
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-sm text-slate-700">
            <li>Stable core question set for trendlines</li>
            <li>Rotating modules for timely topics</li>
            <li>Consistent scales (approve/disapprove, agree/disagree)</li>
            <li>Plain-language wording to reduce confusion</li>
          </ul>
        </div>

        <div className="psi-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">2) Fielding notes</h2>
          <div className="my-4 psi-divider" />
          <p>
            Each wave records how it was collected and when it was fielded to support transparency
            and proper interpretation.
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-sm text-slate-700">
            <li>Field window (start/end)</li>
            <li>Mode disclosure (panel, SMS, list, online)</li>
            <li>Basic quality controls and exclusions</li>
            <li>Wave labels for continuity</li>
          </ul>
        </div>

        <div className="psi-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">3) Respondent tracking</h2>
          <div className="my-4 psi-divider" />
          <p>
            When appropriate, we support respondent/source tracking (e.g., recruitment source or
            panel ID) to reduce repeat-bias and measure channel effects.
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-sm text-slate-700">
            <li>Optional respondent ID fields (privacy-respecting)</li>
            <li>Recruitment/source attribution</li>
            <li>Deduplication logic across waves</li>
            <li>Audit trail for exclusions</li>
          </ul>
        </div>

        <div className="psi-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">4) Weighting</h2>
          <div className="my-4 psi-divider" />
          <p>
            If weighting is used, we document benchmark targets and variables. The goal is
            representativeness and explainability.
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-sm text-slate-700">
            <li>Common targets: age, gender, race/ethnicity, education, region</li>
            <li>Weights documented by wave</li>
            <li>Weighted vs unweighted comparisons available</li>
            <li>Notes included for major adjustments</li>
          </ul>
        </div>
      </section>

      <section className="psi-card p-6">
        <div className="text-sm font-semibold">Deliverables</div>
        <div className="my-4 psi-divider" />
        <p className="text-sm text-slate-700">
          Typical outputs include toplines, crosstabs, a short memo summary, and a methodology
          disclosure section (field window, mode, n-size, and weighting notes).
        </p>
      </section>
    </div>
  );
}
