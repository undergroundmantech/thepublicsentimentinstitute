import Link from "next/link";
import StatCard from "./components/StatCard";

export default function HomePage() {
  return (
    <div className="space-y-12">
      {/* HERO */}
      <section className="grid gap-8 lg:grid-cols-2 lg:items-center">
        <div className="psi-animate-in">

          <h2 className="mt-5 text-4xl font-semibold tracking-tight sm:text-6xl">
            Building the{" "}
            <span className="psi-gradient-text">Public Sentiment National Database</span>.
          </h2>

          <p className="mt-4 text-lg">
            A living, continuously updated national dataset capturing what Americans believe —
            by issue, region, demographic group, and time.
          </p>

          <p className="mt-4">
            Instead of snapshots, we’re building repeatable measurement: consistent wording,
            respondent tracking, and clean trendlines designed for public reporting
            and professional analysis.
          </p>

  
        </div>

        <div className="psi-card p-6 psi-animate-in">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-white/90">What we’re building</div>
            </div>
          </div>

          <div className="my-4 psi-divider" />

          <ul className="space-y-3 text-white/80">
            <li className="flex gap-3">
              <span className="mt-2 h-2 w-2 rounded-full" style={{ background: "var(--psi-magenta)" }} />
              <span>
                <b className="text-white/90">National issue tracker</b> — consistent questions repeated over time
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-2 h-2 w-2 rounded-full" style={{ background: "var(--psi-purple)" }} />
              <span>
                <b className="text-white/90">Panel-aware results</b> — optional respondent IDs for recruitment/source matching
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-2 h-2 w-2 rounded-full" style={{ background: "var(--psi-red)" }} />
              <span>
                <b className="text-white/90">Cross-tab engine</b> — slice sentiment by demos, geography, turnout indicators
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-2 h-2 w-2 rounded-full" style={{ background: "var(--psi-blue)" }} />
              <span>
                <b className="text-white/90">Public summaries</b> — clean toplines with documented methods + disclosure
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="psi-card p-7">
        <h2 className="text-xl font-semibold">How you can help</h2>
        <div className="my-4 psi-divider" />
        <p className="mt-2">
          Taking the active survey helps expand the national baseline and improve trend accuracy.
          If you want to partner on recurring fielding or custom analysis, reach out.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="https://wss.pollfish.com/link/522d0e01-b70f-4955-8514-b42a7f10d4b6" className="psi-btn psi-btn-primary">
            Take the survey
          </Link>
          <Link href="/contact" className="psi-btn psi-btn-ghost">
            Partner / request a poll
          </Link>
        </div>
      </section>
    </div>
  );
}
