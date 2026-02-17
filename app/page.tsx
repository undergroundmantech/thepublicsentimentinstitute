import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-12 px-4 sm:px-6 lg:px-0">
      {/* HERO */}
      <section className="grid gap-8 lg:grid-cols-2 lg:items-center">
        <div className="psi-animate-in max-w-prose lg:max-w-none">

          <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Building the{" "}
            <span className="psi-gradient-text">Public Sentiment National Database</span>.
          </h2>

          <p className="mt-4 text-base sm:text-lg">
            A living, continuously updated national dataset capturing what Americans believe —
            by issue, region, demographic group, and time.
          </p>

          <p className="mt-4 text-sm sm:text-base">
            Instead of snapshots, we’re building repeatable measurement: consistent wording,
            respondent tracking, and clean trendlines designed for public reporting
            and professional analysis.
          </p>

  
        </div>

        <div className="psi-card p-5 sm:p-6 psi-animate-in w-full max-w-xl lg:max-w-none mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-white/90">What we’re building</div>
            </div>
          </div>

          <div className="my-4 psi-divider" />

          <ul className="space-y-3 text-white/80">
            <li className="flex gap-3">
              <span className="mt-2 h-2 w-2 rounded-full flex-none" style={{ background: "var(--psi-magenta)" }} />
              <span className="min-w-0">
                <b className="text-white/90">National issue tracker</b> — consistent questions repeated over time
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-2 h-2 w-2 rounded-full flex-none" style={{ background: "var(--psi-purple)" }} />
              <span className="min-w-0">
                <b className="text-white/90">Panel-aware results</b> — optional respondent IDs for recruitment/source matching
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-2 h-2 w-2 rounded-full flex-none" style={{ background: "var(--psi-red)" }} />
              <span className="min-w-0">
                <b className="text-white/90">Cross-tab engine</b> — slice sentiment by demos, geography, turnout indicators
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-2 h-2 w-2 rounded-full flex-none" style={{ background: "var(--psi-blue)" }} />
              <span className="min-w-0">
                <b className="text-white/90">Public summaries</b> — clean toplines with documented methods + disclosure
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="psi-card p-5 sm:p-7">
        <h2 className="text-lg sm:text-xl font-semibold">How you can help</h2>
        <div className="my-4 psi-divider" />
        <p className="mt-2 text-sm sm:text-base">
          Taking the active survey helps expand the national baseline and improve trend accuracy.
          If you want to partner on recurring fielding or custom analysis, reach out.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row flex-wrap gap-3">
          <Link
            href="https://wss.pollfish.com/link/522d0e01-b70f-4955-8514-b42a7f10d4b6"
            className="psi-btn psi-btn-primary w-full sm:w-auto text-center"
          >
            Take the survey
          </Link>
          <Link href="/contact" className="psi-btn psi-btn-ghost w-full sm:w-auto text-center">
            Partner / request a poll
          </Link>
        </div>
      </section>
    </div>
  );
}
