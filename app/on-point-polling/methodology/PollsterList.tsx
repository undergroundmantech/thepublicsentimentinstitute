"use client";

import { useState } from "react";

export type Pollster = {
  name: string;
  abbr: string;
  website: string;
  why: string[];
  standards: string[];
  multiplier: number;
  note: string;
  transparency: {
    fieldDates: boolean;
    sampleType: boolean;
    sampleSize: boolean;
    methodology: boolean;
    sponsorDisclosure: boolean;
  };
};

// Oct 22 2026, set by the publisher: the seven Gold Standard pollsters. Rasmussen Reports and
// ActiVote are no longer counted in any average; Trafalgar and InsiderAdvantage are labelled
// Republican leaning and their measured lean is taken off before they are averaged.
export const POLLSTERS: Pollster[] = [
  {
    name: "On Point Polling",
    abbr: "OPP",
    website: "https://onpointpolitics.us/on-point-polling",
    why: [
      "Dual panel surveys weighted with the DSMeridian likely voter model.",
      "Full toplines, crosstabs and methodology published with every release.",
    ],
    standards: [
      "Publishes field dates + sample size",
      "States target population and mode",
      "Provides toplines in consistent format",
    ],
    multiplier: 6,
    note: "Gold Standard: the top pollster grade, 6 times the baseline weight, in every On Point average.",
    transparency: { fieldDates: true, sampleType: true, sampleSize: true, methodology: true, sponsorDisclosure: true },
  },
  {
    name: "Big Data Poll",
    abbr: "BDP",
    website: "https://bigdatapoll.com",
    why: [
      "Online data collection since 2016 with a consistent house style across cycles.",
      "Frequent national and state releases that trend well over time.",
    ],
    standards: [
      "Publishes field dates + sample size",
      "States target population and mode",
      "Provides toplines in consistent format",
    ],
    multiplier: 6,
    note: "Gold Standard: the top pollster grade, 6 times the baseline weight, in every On Point average.",
    transparency: { fieldDates: true, sampleType: true, sampleSize: true, methodology: true, sponsorDisclosure: false },
  },
  {
    name: "The Honest Poll",
    abbr: "THP",
    website: "",
    why: [
      "Named to the Gold Standard tier by On Point Politics in October 2026.",
      "Releases carry field dates, sample sizes and toplines.",
    ],
    standards: [
      "Publishes field dates + sample size",
      "States target population and mode",
      "Provides toplines in consistent format",
    ],
    multiplier: 6,
    note: "Gold Standard: the top pollster grade, 6 times the baseline weight, in every On Point average.",
    transparency: { fieldDates: true, sampleType: true, sampleSize: true, methodology: true, sponsorDisclosure: false },
  },
  {
    name: "Emerson College Polling",
    abbr: "EMR",
    website: "https://emersoncollegepolling.com",
    why: [
      "Longstanding, widely cited pollster with a consistent reporting format across years.",
      "Broad national, state and district coverage, including the Hill and Nexstar partnerships.",
    ],
    standards: [
      "Publishes field dates + sample size",
      "States target population and mode",
      "Provides toplines in consistent format",
    ],
    multiplier: 6,
    note: "Gold Standard: the top pollster grade, 6 times the baseline weight, in every On Point average.",
    transparency: { fieldDates: true, sampleType: true, sampleSize: true, methodology: true, sponsorDisclosure: false },
  },
  {
    name: "Cygnal",
    abbr: "CYG",
    website: "https://www.cygn.al",
    why: [
      "Frequent national and state releases with full toplines.",
      "Counted under one name across its partner sponsored releases.",
    ],
    standards: [
      "Publishes field dates + sample size",
      "States target population and mode",
      "Provides toplines in consistent format",
    ],
    multiplier: 6,
    note: "Gold Standard: the top pollster grade, 6 times the baseline weight, in every On Point average.",
    transparency: { fieldDates: true, sampleType: true, sampleSize: true, methodology: true, sponsorDisclosure: false },
  },
  {
    name: "Quantus Insights",
    abbr: "QI",
    website: "https://quantusinsights.org",
    why: [
      "Frequent likely voter releases in the 2026 battlegrounds.",
      "Already the top weighted pollster in the averages before October 2026.",
    ],
    standards: [
      "Publishes field dates + sample size",
      "States target population and mode",
      "Provides toplines in consistent format",
    ],
    multiplier: 6,
    note: "Gold Standard: the top pollster grade, 6 times the baseline weight, in every On Point average.",
    transparency: { fieldDates: true, sampleType: true, sampleSize: true, methodology: true, sponsorDisclosure: false },
  },
  {
    name: "The New York Times/Siena",
    abbr: "NYT",
    website: "https://www.nytimes.com/section/upshot",
    why: [
      "Live caller and text to web polls of national and battleground samples.",
      "Detailed crosstabs and full methodology published with each release.",
    ],
    standards: [
      "Publishes field dates + sample size",
      "States target population and mode",
      "Provides toplines in consistent format",
    ],
    multiplier: 6,
    note: "Gold Standard: the top pollster grade, 6 times the baseline weight, in every On Point average.",
    transparency: { fieldDates: true, sampleType: true, sampleSize: true, methodology: true, sponsorDisclosure: false },
  },
  {
    name: "The Wall Street Journal",
    abbr: "WSJ",
    website: "https://www.wsj.com",
    why: [
      "National and battleground polls fielded by bipartisan pollster teams.",
      "Full toplines and methodology published with each release.",
    ],
    standards: [
      "Publishes field dates + sample size",
      "States target population and mode",
      "Provides toplines in consistent format",
    ],
    multiplier: 6,
    note: "Gold Standard: the top pollster grade, 6 times the baseline weight, in every On Point average.",
    transparency: { fieldDates: true, sampleType: true, sampleSize: true, methodology: true, sponsorDisclosure: false },
  },
];

export const DISC_LABELS: Record<keyof Pollster["transparency"], string> = {
  fieldDates: "Field dates",
  sampleSize: "Sample size",
  sampleType: "Sample type",
  methodology: "Methodology",
  sponsorDisclosure: "Sponsor",
};

export default function PollsterList() {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="card">
      <div className="card-h"><h3>Designated pollsters</h3><span className="eye" style={{ marginLeft: "auto" }}>Select a row to expand</span></div>
      <div>
        {POLLSTERS.map((p, idx) => {
          const isOpen = expanded === p.name;
          const discKeys = Object.keys(p.transparency) as Array<keyof typeof p.transparency>;
          const metCount = discKeys.filter((k) => p.transparency[k]).length;
          return (
            <div key={p.name} className={`gs-row${isOpen ? " open" : ""}`}>
              <button type="button" className="gs-head" aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? null : p.name)}>
                <span className="gs-idx mono">{String(idx + 1).padStart(2, "0")}</span>
                <span className="gs-abbr mono">{p.abbr}</span>
                <span className="gs-name">{p.name}</span>
                <span className="gs-dots" aria-label={`${metCount} of ${discKeys.length} disclosure items`}>
                  {discKeys.map((k) => <i key={k} className={p.transparency[k] ? "on" : ""} title={DISC_LABELS[k]} />)}
                </span>
                <span className="gs-disc mono">{metCount}/{discKeys.length}</span>
                <span className="gs-mult mono">x{p.multiplier.toFixed(2)}</span>
                <span className="gs-chev" aria-hidden="true">{isOpen ? "Hide" : "Show"}</span>
              </button>
              {isOpen && (
                <div className="gs-detail">
                  <div>
                    <div className="eye">Why it is included</div>
                    <ol className="gs-why">
                      {p.why.map((w, i) => <li key={i}><span className="mono">{String(i + 1).padStart(2, "0")}</span>{w}</li>)}
                    </ol>
                  </div>
                  <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
                    <div>
                      <div className="eye">Disclosure checklist</div>
                      <div className="gs-checks">
                        {discKeys.map((k) => (
                          <div key={k} className="kv"><span>{DISC_LABELS[k]}</span><span>{p.transparency[k] ? "Yes" : "No"}</span></div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="eye">Weighting note</div>
                      <p style={{ fontSize: 13.5, margin: "6px 0 0" }}>{p.note}</p>
                    </div>
                    {p.website ? <a href={p.website} target="_blank" rel="noopener noreferrer" className="btn sm" style={{ justifySelf: "start" }}>
                      {new URL(p.website).hostname.replace(/^www\./, "")}
                    </a> : null}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="gs-key">
        <span className="eye">Disclosure key</span>
        <span><i className="on" />Documented</span>
        <span><i />Not documented or not required</span>
        <span className="mono" style={{ marginLeft: "auto" }}>{Object.values(DISC_LABELS).join(" · ")}</span>
      </div>
    </div>
  );
}
