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
    title: "Donald Trump • Job Approval",
    description: "Tracking the President's job approval in real time",
    href: "/polling/donaldtrumpapproval",
    badge: "Approval",
    tag: "National",
    status: "live",
  },
  {
    title: "2026 National Generic Ballot",
    description:
      "View how the 2028 Democrat candidates are shaping up in one of the most contested primaries of all time",
    href: "/polling/genericballot",
    badge: "Daily average",
    tag: "National",
    status: "live",
  },
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
    title: "2026 Senate - State Polling",
    description:
      "View a map of all Senate races for the November 2026 election and their polling data",
    href: "/polling/2026senatepollingview",
    badge: "Tracker",
    tag: "National",
    status: "live",
  },
  {
    title: "2026 Senate - Governor Polling",
    description:
      "View a map of all Governor races for the November 2026 election and their polling data",
    href: "/polling/2026governorpollingview",
    badge: "Tracker",
    tag: "National",
    status: "live",
  },
  {
    title: "2025 Elections - Retrospective Polling Averages",
    description:
      "A view of the New Jersey & Virginia Election polling, with unique modeling from The Public Sentiment Institute",
    href: "/polling/2025pollingview",
    badge: "Tracker",
    tag: "National",
    status: "live",
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
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide flex-none",
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
    <div className="psi-card p-5 sm:p-6 psi-animate-in w-full min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {p.badge ? <span className="psi-chip">{p.badge}</span> : null}
            {p.tag ? (
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/65">
                {p.tag}
              </span>
            ) : null}
          </div>

          <h2 className="mt-3 text-base sm:text-lg font-semibold tracking-tight text-white/90">
            {p.title}
          </h2>

          <p className="mt-2 text-sm text-white/60 break-words">
            {p.description}
          </p>
        </div>

        <StatusPill status={p.status} />
      </div>

      <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {isDisabled ? (
          <span className="psi-mono text-xs text-white/45">
            Not wired yet
          </span>
        ) : (
          <span className="psi-mono text-xs text-white/45">
            Click Open to view polling average
          </span>
        )}

        {isDisabled ? (
          <span className="psi-btn psi-btn-ghost opacity-60 w-full sm:w-auto text-center">
            Open →
          </span>
        ) : (
          <Link
            href={p.href}
            className="psi-btn psi-btn-primary w-full sm:w-auto text-center"
          >
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

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-white/90">
          <span className="psi-gradient-text">Polling</span> Dashboard
        </h2>

        <p className="max-w-3xl text-sm sm:text-base text-white/60">
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
