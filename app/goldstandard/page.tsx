// app/methodology/gold-standard-pollsters/page.tsx
"use client";

import Link from "next/link";

type Pollster = {
  name: string;
  tier: "Gold Standard";
  website: string[];
  why: string[];
  standards: string[];
  weighting: {
    multiplier: number;
    note: string;
  };
  transparency: {
    fieldDates: boolean;
    sampleType: boolean;
    sampleSize: boolean;
    methodology: boolean;
    sponsorDisclosure: boolean;
  };
};

const POLLSTERS: Pollster[] = [
  {
    name: "Big Data Poll",
    tier: "Gold Standard",
    website: ["https://bigdatapoll.com"],
    why: [
      "Consistent performance and recognizable house style across cycles.",
      "Pioneer in online data collection in 2016; developed methodology to eliminate response bias in polling.",
      "Strong understanding of the Trump coalition & politics in the Trump era.",
    ],
    standards: [
      "Publishes field dates + sample size",
      "States target population (A/RV/LV) and mode when available",
      "Provides toplines in a consistent format",
    ],
    weighting: { multiplier: 2, note: "PSI upweight for Gold Standard pollsters." },
    transparency: {
      fieldDates: true,
      sampleType: true,
      sampleSize: true,
      methodology: true,
      sponsorDisclosure: false,
    },
  },
  {
    name: "Rasmussen Reports",
    tier: "Gold Standard",
    website: ["https://www.rasmussenreports.com/"],
    why: [
      "High-frequency tracking suitable for time-series modeling.",
      "Asks questions many firms avoid, creating additional signal for sentiment measurement.",
      "Leadership emphasizes issue salience and continuous feedback from the public.",
    ],
    standards: [
      "Publishes field dates + sample size",
      "States target population (A/RV/LV) and mode when available",
      "Provides toplines in a consistent format",
    ],
    weighting: {
      multiplier: 2,
      note: "Gold Standard upweight; PSI may cap impact depending on documentation/mode considerations.",
    },
    transparency: {
      fieldDates: true,
      sampleType: true,
      sampleSize: true,
      methodology: true,
      sponsorDisclosure: false,
    },
  },
  {
    name: "AtlasIntel",
    tier: "Gold Standard",
    website: ["https://atlasintel.org/"],
    why: [
      "Strong performance in recent cycles in both national and swing-state environments.",
      "Publishes politician approvals and trendable releases.",
      "Often provides high-signal readings suitable for aggregation when documentation is present.",
    ],
    standards: [
      "Publishes field dates + sample size",
      "States target population (A/RV/LV) and mode when available",
      "Provides toplines in a consistent format",
    ],
    weighting: { multiplier: 2, note: "Full Gold Standard upweight when documentation is present." },
    transparency: {
      fieldDates: true,
      sampleType: true,
      sampleSize: true,
      methodology: true,
      sponsorDisclosure: false,
    },
  },
  {
    name: "SoCalStrategies",
    tier: "Gold Standard",
    website: ["https://socalpoll.com/"],
    why: [
      "Newer pollster with strong early performance in select environments.",
      "Demonstrated accuracy in the Wisconsin Supreme Court race (April 2025).",
      "Competitive performance vs. industry in NJ/VA gubernatorial contexts (2025) per PSI review.",
    ],
    standards: [
      "Publishes field dates + sample size",
      "States target population (A/RV/LV) and mode when available",
      "Provides toplines in a consistent format",
    ],
    weighting: {
      multiplier: 2,
      note: "Conditional Gold Standard upweight: requires PSI minimum disclosure items to apply.",
    },
    transparency: {
      fieldDates: true,
      sampleType: true,
      sampleSize: true,
      methodology: true,
      sponsorDisclosure: false,
    },
  },
  {
    name: "Emerson",
    tier: "Gold Standard",
    website: ["https://emersoncollegepolling.com/"],
    why: [
      "Longstanding, widely-cited pollster with consistent reporting format.",
      "Broad coverage across national and state environments.",
      "Historically competitive accuracy vs. industry averages across cycles (PSI review).",
    ],
    standards: [
      "Publishes field dates + sample size",
      "States target population (A/RV/LV) and mode when available",
      "Provides toplines in a consistent format",
    ],
    weighting: {
      multiplier: 2,
      note: "Gold Standard upweight; PSI may adjust impact depending on project mode/field method details.",
    },
    transparency: {
      fieldDates: true,
      sampleType: true,
      sampleSize: true,
      methodology: true,
      sponsorDisclosure: false,
    },
  },
  {
    name: "Trafalgar",
    tier: "Gold Standard",
    website: ["https://www.thetrafalgargroup.org/"],
    why: [
      "Historically competitive performance in select cycles (PSI review).",
      "Recognizable approach and consistent structure across cycles.",
      "Adds methodological diversity to aggregates when disclosures are present.",
    ],
    standards: [
      "Publishes field dates + sample size",
      "States target population (A/RV/LV) and mode when available",
      "Provides toplines in a consistent format",
    ],
    weighting: { multiplier: 2, note: "Conditional upweight; PSI may cap impact if documentation is thin." },
    transparency: {
      fieldDates: true,
      sampleType: true,
      sampleSize: true,
      methodology: true,
      sponsorDisclosure: false,
    },
  },
  {
    name: "InsiderAdvantage",
    tier: "Gold Standard",
    website: ["https://insideradvantage.com/"],
    why: [
      "Often produces timely reads with clear toplines.",
      "Useful short-window signal contributor for trend updates.",
      "Included for PSI upweighting when disclosure meets minimum standards.",
    ],
    standards: [
      "Publishes field dates + sample size",
      "States target population (A/RV/LV) and mode when available",
      "Provides toplines in a consistent format",
    ],
    weighting: { multiplier: 2, note: "Conditional upweight: requires minimum disclosure items to be present." },
    transparency: {
      fieldDates: true,
      sampleType: true,
      sampleSize: true,
      methodology: true,
      sponsorDisclosure: false,
    },
  },
  {
    name: "Patriot Polling",
    tier: "Gold Standard",
    website: ["https://patriotpolling.com/about-us"],
    why: [
      "Timely releases with clear toplines.",
      "Performed well in PSI review of 2024 national/state releases.",
      "Produces structured releases that are easy to audit and aggregate.",
    ],
    standards: [
      "Publishes field dates + sample size",
      "States target population (A/RV/LV) and mode when available",
      "Provides toplines in a consistent format",
    ],
    weighting: { multiplier: 2, note: "Conditional upweight: requires minimum disclosure items to be present." },
    transparency: {
      fieldDates: true,
      sampleType: true,
      sampleSize: true,
      methodology: true,
      sponsorDisclosure: false,
    },
  },
];

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="psi-chip">{children}</span>;
}

function BoolDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2" title={ok ? "Meets standard" : "Not documented / not required"}>
      <span
        className={[
          "inline-flex h-2.5 w-2.5 rounded-full",
          ok ? "bg-[rgba(34,197,94,0.95)]" : "bg-[rgba(255,255,255,0.22)]",
        ].join(" ")}
        aria-label={ok ? "Yes" : "No"}
      />
      <span className="text-[11px] text-white/40">{label}</span>
    </div>
  );
}

function WebsiteLinks({ urls }: { urls: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {urls.map((url) => {
        const host = (() => {
          try {
            return new URL(url).hostname.replace(/^www\./, "");
          } catch {
            return url;
          }
        })();

        return (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="psi-chip hover:bg-white/10 transition"
            title={url}
          >
            {host}
          </a>
        );
      })}
    </div>
  );
}

export default function GoldStandardPollstersPage() {
  return (
    <div className="space-y-10 psi-animate-in">
      {/* HERO */}
      <section className="relative overflow-hidden psi-card p-7 md:p-10">
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute -left-24 -top-28 h-80 w-80 rounded-full bg-[rgba(255,215,0,0.10)] blur-3xl" />
          <div className="absolute -right-28 top-10 h-96 w-96 rounded-full bg-[rgba(74,27,179,0.18)] blur-3xl" />
        </div>

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap gap-2">
              <Chip>Methodology</Chip>
              <Chip>Weighting</Chip>
              <Chip>Disclosure</Chip>
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white/90 md:text-4xl">
              Gold Standard Pollsters
            </h1>

            <p className="mt-3 text-white/65">
              PSI designates a small set of pollsters as{" "}
              <span className="font-semibold text-white/85">Gold Standard</span> when they meet PSI
              criteria for consistency, transparency, and real-world accuracy in tracking public sentiment.
              <span className="font-semibold text-white/85"> Gold Standard polls are weighted up</span>{" "}
              in PSI polling averages.
            </p>

            <div className="mt-4 psi-mono text-xs text-white/50">
              Note: “Gold Standard” is a PSI internal designation and may evolve as disclosure and performance change.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="psi-chip psi-chip-gradient">PSI Criteria</span>
            <Link href="/methodology" className="psi-chip hover:bg-white/10 transition">
              Back to Methodology
            </Link>
          </div>
        </div>
      </section>

      {/* CRITERIA */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="psi-card p-6">
          <div className="text-sm font-semibold text-white/85">Accuracy</div>
          <div className="my-4 psi-divider" />
          <ul className="space-y-2 text-sm text-white/65">
            <li>• Demonstrates repeatable performance across environments</li>
            <li>• Produces stable, trackable readings suitable for time-series</li>
            <li>• Avoids extreme methodological drift without disclosure</li>
          </ul>
        </div>

        <div className="psi-card p-6">
          <div className="text-sm font-semibold text-white/85">Transparency</div>
          <div className="my-4 psi-divider" />
          <ul className="space-y-2 text-sm text-white/65">
            <li>• Field dates and sample size</li>
            <li>• Defined universe (A/RV/LV) and mode when available</li>
            <li>• Sponsor disclosure and/or full release notes when applicable</li>
          </ul>
        </div>

        <div className="psi-card p-6">
          <div className="text-sm font-semibold text-white/85">Standards Compliance</div>
          <div className="my-4 psi-divider" />
          <ul className="space-y-2 text-sm text-white/65">
            <li>• Clear toplines and consistent formatting</li>
            <li>• Prefer question wording consistency for trackers</li>
            <li>• Auditable releases (public-facing or verifiable)</li>
          </ul>
        </div>
      </section>

      {/* LIST */}
      <section className="psi-card p-6 md:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-white/85">PSI Gold Standard list</div>
            <div className="mt-1 text-sm text-white/55">
              These pollsters receive an upweight in PSI daily averages when required fields are present.
            </div>
          </div>
          <div className="psi-mono text-xs text-white/45">{POLLSTERS.length} pollsters</div>
        </div>

        <div className="my-5 psi-divider" />

        <div className="grid gap-4 lg:grid-cols-2">
          {POLLSTERS.map((p) => (
            <div key={p.name} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex flex-col gap-4">
                {/* header */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-base font-semibold text-white/90">{p.name}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="psi-chip psi-chip-gradient">{p.tier}</span>
                    </div>

                    <div className="mt-3">
                      <WebsiteLinks urls={p.website} />
                    </div>
                  </div>

                  {/* mini disclosure dots */}
                  <div className="min-w-[180px]">
                    <div className="psi-mono text-xs text-white/45 text-right">Disclosure</div>
                    <div className="mt-2 grid justify-end gap-1.5">
                      <BoolDot ok={p.transparency.fieldDates} label="Field dates" />
                      <BoolDot ok={p.transparency.sampleSize} label="Sample size" />
                      <BoolDot ok={p.transparency.sampleType} label="Sample type" />
                      <BoolDot ok={p.transparency.methodology} label="Methodology" />
                      <BoolDot ok={p.transparency.sponsorDisclosure} label="Sponsor" />
                    </div>
                  </div>
                </div>

                {/* why */}
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-white/55">
                    Why PSI includes it
                  </div>
                  <ul className="mt-2 space-y-1.5 text-sm text-white/65">
                    {p.why.map((w, i) => (
                      <li key={i}>• {w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="psi-card p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-lg font-semibold text-white/90">Want PSI to review a pollster?</div>
            <p className="mt-1 text-sm text-white/60">
              If you have a release with field dates, sample details, and documentation, send it over.
            </p>
          </div>
          <Link
            href="/contact"
            className="rounded-2xl border border-white/15 bg-white/[0.06] px-5 py-3 text-sm font-semibold text-white/85 hover:bg-white/[0.10] transition"
          >
            Contact PSI
          </Link>
        </div>
      </section>
    </div>
  );
}
