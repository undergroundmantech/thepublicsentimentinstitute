// app/polling/page.tsx
import Link from "next/link";

type PollPage = {
  title: string;
  description: string;
  href: string;
  badge?: string;
  tag?: string;
  status?: "live" | "building" | "planned";
};

const PAGES: PollPage[] = [
  {
    title: "Florida Governor • 2026 • GOP Primary",
    description:
      "Daily weighted polling average using recency + √n + LV/RV/A adjustments. Includes trend chart + current leaderboard.",
    href: "/polling/floridagovernorgop2026",
    badge: "Daily average",
    tag: "Florida",
    status: "live",
  },
  {
    title: "Donald Trump • Job Approval",
    description:
      "Tracking the President's job approval in real time",
    href: "/polling/donaldtrumpapproval",
    badge: "Approval",
    tag: "National",
    status: "live",
  },
  {
    title: "2028 President - Democrat Primary",
    description:
      "View how the 2028 Democrat candidates are shaping up in one of the most contested primaries of all time",
    href: "/polling/president/h2h",
    badge: "Multi-candidate",
    tag: "National",
    status: "building",
  },
  {
    title: "Issue Tracker • National",
    description:
      "Repeatable issue questions over time with clean disclosure and consistent wording.",
    href: "/polling/issues/national",
    badge: "Tracker",
    tag: "National",
    status: "planned",
  },
];

function StatusPill({ status }: { status?: PollPage["status"] }) {
  if (!status) return null;
  const map: Record<NonNullable<PollPage["status"]>, string> = {
    live: "Live",
    building: "Building",
    planned: "Planned",
  };

  const cls =
    status === "live"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
      : status === "building"
      ? "border-white/15 bg-white/5 text-white/70"
      : "border-white/10 bg-white/5 text-white/55";

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide",
        cls,
      ].join(" ")}
    >
      {map[status]}
    </span>
  );
}

function Card({ p }: { p: PollPage }) {
  const isDisabled = p.status !== "live";

  return (
    <div className="psi-card p-6 psi-animate-in">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {p.badge ? <span className="psi-chip">{p.badge}</span> : null}
            {p.tag ? (
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/65">
                {p.tag}
              </span>
            ) : null}
          </div>

          <h2 className="mt-3 text-lg font-semibold tracking-tight text-white/90">
            {p.title}
          </h2>

          <p className="mt-2 text-sm text-white/60">{p.description}</p>
        </div>

        <StatusPill status={p.status} />
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        {isDisabled ? (
          <span className="psi-mono text-xs text-white/45">
            Route not wired yet
          </span>
        ) : (
          <span className="psi-mono text-xs text-white/45">
            Public display • no editing
          </span>
        )}

        {isDisabled ? (
          <span className="psi-btn psi-btn-ghost opacity-60">Open →</span>
        ) : (
          <Link href={p.href} className="psi-btn psi-btn-primary">
            Open →
          </Link>
        )}
      </div>
    </div>
  );
}

export default function PollingHomePage() {
  return (
    <div className="space-y-10">
      {/* HERO */}
      <header className="space-y-4 psi-animate-in">

        <h2 className="text-5xl font-semibold tracking-tight text-white/90">
          <span className="psi-gradient-text">Polling</span> Dashboard
        </h2>

        <p className="max-w-3xl text-white/60">
          Public-facing pages built on the same measurement standard: documented question
          wording, field dates, sample notes, and transparent weighting decisions.
        </p>

      </header>

      {/* GRID */}
      <section className="grid gap-4 lg:grid-cols-2">
        {PAGES.map((p) => (
          <Card key={p.href} p={p} />
        ))}
      </section>

      {/* FOOTNOTE */}
    </div>
  );
}
