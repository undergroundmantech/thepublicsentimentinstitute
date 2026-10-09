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

export const POLLSTERS: Pollster[] = [
  {
    name: "Big Data Poll",
    abbr: "BDP",
    website: "https://bigdatapoll.com",
    why: [
      "Pioneer in online data collection since 2016; developed methodology to eliminate response bias.",
      "Consistent performance and recognizable house style across multiple electoral cycles.",
      "Demonstrated strong understanding of the Trump coalition and modern polling dynamics.",
    ],
    standards: [
      "Publishes field dates + sample size",
      "States target population (A/RV/LV) and mode",
      "Provides toplines in consistent format",
    ],
    multiplier: 2,
    note: "Gold Standard upweight in OnPoint averages.",
    transparency: { fieldDates: true, sampleType: true, sampleSize: true, methodology: true, sponsorDisclosure: false },
  },
  {
    name: "Rasmussen Reports",
    abbr: "RAS",
    website: "https://www.rasmussenreports.com",
    why: [
      "High-frequency daily tracking ideal for time-series modeling and trend detection.",
      "Asks questions many firms avoid, creating additional signal for sentiment measurement.",
      "Leadership emphasizes issue salience and continuous public feedback loops.",
    ],
    standards: [
      "Publishes field dates + sample size",
      "States target population and mode",
      "Provides toplines in consistent format",
    ],
    multiplier: 2,
    note: "Gold Standard upweight; OnPoint may cap impact depending on documentation/mode considerations.",
    transparency: { fieldDates: true, sampleType: true, sampleSize: true, methodology: true, sponsorDisclosure: false },
  },
  {
    name: "AtlasIntel",
    abbr: "ATL",
    website: "https://atlasintel.org",
    why: [
      "Strong performance in recent cycles across both national and swing-state environments.",
      "Publishes politician approvals and trendable releases suitable for aggregation.",
      "Often provides high-signal readings when documentation is present.",
    ],
    standards: [
      "Publishes field dates + sample size",
      "States target population and mode",
      "Provides toplines in consistent format",
    ],
    multiplier: 2,
    note: "Full Gold Standard upweight when documentation is present.",
    transparency: { fieldDates: true, sampleType: true, sampleSize: true, methodology: true, sponsorDisclosure: false },
  },
  {
    name: "SoCalStrategies",
    abbr: "SCS",
    website: "https://socalpoll.com",
    why: [
      "Demonstrated accuracy in the Wisconsin Supreme Court race (April 2025).",
      "Competitive performance vs. industry in NJ/VA gubernatorial contexts (2025) per TPSI review.",
      "Newer pollster with strong early performance across select environments.",
    ],
    standards: [
      "Publishes field dates + sample size",
      "States target population and mode",
      "Provides toplines in consistent format",
    ],
    multiplier: 2,
    note: "Conditional Gold Standard upweight: requires the minimum disclosure items to apply.",
    transparency: { fieldDates: true, sampleType: true, sampleSize: true, methodology: true, sponsorDisclosure: false },
  },
  {
    name: "Emerson College Polling",
    abbr: "EMR",
    website: "https://emersoncollegepolling.com",
    why: [
      "Longstanding, widely-cited pollster with consistent reporting format across years.",
      "Broad national and state coverage suitable for multi-environment aggregation.",
      "Historically competitive accuracy vs. industry averages across multiple cycles.",
    ],
    standards: [
      "Publishes field dates + sample size",
      "States target population and mode",
      "Provides toplines in consistent format",
    ],
    multiplier: 2,
    note: "Gold Standard upweight; OnPoint may adjust depending on project mode/field method details.",
    transparency: { fieldDates: true, sampleType: true, sampleSize: true, methodology: true, sponsorDisclosure: false },
  },
  {
    name: "Trafalgar Group",
    abbr: "TFG",
    website: "https://www.thetrafalgargroup.org",
    why: [
      "Historically competitive performance in select cycles per TPSI review.",
      "Recognizable approach and consistent structure across election environments.",
      "Adds methodological diversity to aggregates when disclosures are present.",
    ],
    standards: [
      "Publishes field dates + sample size",
      "States target population and mode",
      "Provides toplines in consistent format",
    ],
    multiplier: 2,
    note: "Conditional upweight; OnPoint may cap impact if documentation is thin.",
    transparency: { fieldDates: true, sampleType: true, sampleSize: true, methodology: true, sponsorDisclosure: false },
  },
  {
    name: "InsiderAdvantage",
    abbr: "IA",
    website: "https://insideradvantage.com",
    why: [
      "Often produces timely reads with clear toplines for rapid trend updates.",
      "Useful short-window signal contributor for daily tracking cycles.",
      "Included for upweighting when disclosure meets minimum standards.",
    ],
    standards: [
      "Publishes field dates + sample size",
      "States target population and mode",
      "Provides toplines in consistent format",
    ],
    multiplier: 2,
    note: "Conditional upweight: requires minimum disclosure items to be present.",
    transparency: { fieldDates: true, sampleType: true, sampleSize: true, methodology: true, sponsorDisclosure: false },
  },
  {
    name: "Patriot Polling",
    abbr: "PAT",
    website: "https://patriotpolling.com",
    why: [
      "Performed well in TPSI review of 2024 national and state-level releases.",
      "Produces structured releases that are easy to audit and aggregate.",
      "Timely field windows with consistent topline reporting format.",
    ],
    standards: [
      "Publishes field dates + sample size",
      "States target population and mode",
      "Provides toplines in consistent format",
    ],
    multiplier: 2,
    note: "Conditional upweight: requires minimum disclosure items to be present.",
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
                    <a href={p.website} target="_blank" rel="noopener noreferrer" className="btn sm" style={{ justifySelf: "start" }}>
                      {new URL(p.website).hostname.replace(/^www\./, "")}
                    </a>
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
