// Poll data for this tracker, kept out of the client page so server code can import it.
import type { Poll } from "@/app/_polling/lib/buildDailyModel";

export const RAW_POLLS: Poll[] = [
  // ── AtlasIntel ────────────────────────────────────────────────────────────
  { pollster: "AtlasIntel", endDate: "2024-11-04", sampleSize: 707,  sampleType: "LV", results: { Harris: 47, Trump: 50 } },
  { pollster: "AtlasIntel", endDate: "2024-11-02", sampleSize: 782,  sampleType: "LV", results: { Harris: 46, Trump: 52 } },
  { pollster: "AtlasIntel", endDate: "2024-10-30", sampleSize: 845,  sampleType: "LV", results: { Harris: 47, Trump: 51 } },
  { pollster: "AtlasIntel", endDate: "2024-10-29", sampleSize: 1083, sampleType: "LV", results: { Harris: 48, Trump: 49 } },
  { pollster: "AtlasIntel", endDate: "2024-10-17", sampleSize: 1171, sampleType: "LV", results: { Harris: 48, Trump: 48 } },
  { pollster: "AtlasIntel", endDate: "2024-09-25", sampleSize: 858,  sampleType: "LV", results: { Harris: 51, Trump: 48 } },

  // ── NY Times / Siena ──────────────────────────────────────────────────────
  { pollster: "NY Times/Siena", endDate: "2024-11-02", sampleSize: 1010, sampleType: "LV", results: { Harris: 49, Trump: 46 } },
  { pollster: "NY Times/Siena", endDate: "2024-08-15", sampleSize: 677,  sampleType: "LV", results: { Harris: 48, Trump: 47 } },
  { pollster: "NY Times/Siena", endDate: "2024-11-03", sampleSize: 611,  sampleType: "LV", results: { Harris: 42, Trump: 50 } },

  // ── The Hill / Emerson ────────────────────────────────────────────────────
  { pollster: "The Hill/Emerson", endDate: "2024-11-02", sampleSize: 840,  sampleType: "LV", results: { Harris: 48, Trump: 48 } },
  { pollster: "The Hill/Emerson", endDate: "2024-10-08", sampleSize: 900,  sampleType: "LV", results: { Harris: 48, Trump: 47 } },
  { pollster: "The Hill/Emerson", endDate: "2024-09-18", sampleSize: 895,  sampleType: "LV", results: { Harris: 48, Trump: 48 } },
  { pollster: "The Hill/Emerson", endDate: "2024-08-28", sampleSize: 1168, sampleType: "LV", results: { Harris: 49, Trump: 48 } },

  // ── Noble Predictive Insights ─────────────────────────────────────────────
  { pollster: "Noble Predictive Insights", endDate: "2024-10-31", sampleSize: 593, sampleType: "LV", results: { Harris: 49, Trump: 48 } },
  { pollster: "Noble Predictive Insights", endDate: "2024-09-16", sampleSize: 692, sampleType: "LV", results: { Harris: 47, Trump: 47 } },

  // ── Susquehanna ───────────────────────────────────────────────────────────
  { pollster: "Susquehanna", endDate: "2024-10-31", sampleSize: 400, sampleType: "LV", results: { Harris: 44, Trump: 50 } },

  // ── Emerson College ───────────────────────────────────────────────────────
  { pollster: "Emerson College", endDate: "2024-10-31", sampleSize: 700, sampleType: "LV", results: { Harris: 48, Trump: 47 } },

  // ── Rasmussen Reports ─────────────────────────────────────────────────────
  { pollster: "Rasmussen Reports", endDate: "2024-10-28", sampleSize: 767,  sampleType: "LV", results: { Harris: 47, Trump: 49 } },
  { pollster: "Rasmussen Reports", endDate: "2024-10-14", sampleSize: 748,  sampleType: "LV", results: { Harris: 47, Trump: 49 } },
  { pollster: "Rasmussen Reports", endDate: "2024-09-22", sampleSize: 738,  sampleType: "LV", results: { Harris: 49, Trump: 48 } },
  { pollster: "Rasmussen Reports", endDate: "2024-08-19", sampleSize: 980,  sampleType: "LV", results: { Harris: 46, Trump: 48 } },

  // ── Data for Progress (D) ─────────────────────────────────────────────────
  { pollster: "Data for Progress", endDate: "2024-10-30", sampleSize: 721, sampleType: "LV", results: { Harris: 49, Trump: 47 } },

  // ── Trafalgar Group (R) ───────────────────────────────────────────────────
  { pollster: "Trafalgar Group", endDate: "2024-10-28", sampleSize: 1082, sampleType: "LV", results: { Harris: 48, Trump: 48 } },
  { pollster: "Trafalgar Group", endDate: "2024-10-13", sampleSize: 1088, sampleType: "LV", results: { Harris: 46, Trump: 45 } },
  { pollster: "Trafalgar Group", endDate: "2024-09-13", sampleSize: 1079, sampleType: "LV", results: { Harris: 45, Trump: 44 } },
  { pollster: "Trafalgar Group", endDate: "2024-08-08", sampleSize: 1000, sampleType: "LV", results: { Harris: 45, Trump: 48 } },

  // ── CNN/SSRS ──────────────────────────────────────────────────────────────
  { pollster: "CNN/SSRS", endDate: "2024-10-26", sampleSize: 683, sampleType: "LV", results: { Harris: 47, Trump: 48 } },
  { pollster: "CNN/SSRS", endDate: "2024-08-29", sampleSize: 626, sampleType: "LV", results: { Harris: 48, Trump: 47 } },

  // ── InsiderAdvantage ──────────────────────────────────────────────────────
  { pollster: "InsiderAdvantage", endDate: "2024-10-21", sampleSize: 800, sampleType: "LV", results: { Harris: 48, Trump: 48 } },
  { pollster: "InsiderAdvantage", endDate: "2024-09-30", sampleSize: 800, sampleType: "LV", results: { Harris: 48, Trump: 49 } },
  { pollster: "InsiderAdvantage", endDate: "2024-08-31", sampleSize: 800, sampleType: "LV", results: { Harris: 47, Trump: 48 } },

  // ── Bloomberg / Morning Consult ───────────────────────────────────────────
  { pollster: "Bloomberg/Morning Consult", endDate: "2024-10-20", sampleSize: 420,  sampleType: "LV", results: { Harris: 48, Trump: 48 } },
  { pollster: "Bloomberg/Morning Consult", endDate: "2024-09-25", sampleSize: 516,  sampleType: "LV", results: { Harris: 50, Trump: 44 } },
  { pollster: "Bloomberg/Morning Consult", endDate: "2024-08-26", sampleSize: 416,  sampleType: "LV", results: { Harris: 48, Trump: 46 } },
  { pollster: "Bloomberg/Morning Consult", endDate: "2024-07-28", sampleSize: 450,  sampleType: "RV", results: { Harris: 47, Trump: 45 } },

  // ── Fabrizio Ward / Impact Research ──────────────────────────────────────
  { pollster: "Fabrizio/Anzalone", endDate: "2024-10-15", sampleSize: 600, sampleType: "LV", results: { Harris: 46, Trump: 49 } },

  // ── Redfield & Wilton Strategies ─────────────────────────────────────────
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-31", sampleSize: 690,  sampleType: "LV", results: { Harris: 47, Trump: 48 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-27", sampleSize: 531,  sampleType: "LV", results: { Harris: 47, Trump: 47 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-22", sampleSize: 540,  sampleType: "LV", results: { Harris: 46, Trump: 47 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-18", sampleSize: 529,  sampleType: "LV", results: { Harris: 46, Trump: 47 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-14", sampleSize: 838,  sampleType: "LV", results: { Harris: 47, Trump: 47 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-02", sampleSize: 514,  sampleType: "LV", results: { Harris: 48, Trump: 47 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-09-19", sampleSize: 652,  sampleType: "LV", results: { Harris: 45, Trump: 45 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-09-09", sampleSize: 698,  sampleType: "LV", results: { Harris: 45, Trump: 46 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-08-28", sampleSize: 490,  sampleType: "LV", results: { Harris: 47, Trump: 47 } },

  // ── OnMessage Inc. (R) ────────────────────────────────────────────────────
  { pollster: "OnMessage Inc.", endDate: "2024-10-22", sampleSize: 600, sampleType: "LV", results: { Harris: 47, Trump: 50 } },

  // ── Wall Street Journal ───────────────────────────────────────────────────
  { pollster: "Wall Street Journal", endDate: "2024-10-08", sampleSize: 600, sampleType: "RV", results: { Harris: 43, Trump: 49 } },

  // ── GSG / NSOR ────────────────────────────────────────────────────────────
  { pollster: "GSG/NSOR", endDate: "2024-09-29", sampleSize: 407, sampleType: "LV", results: { Harris: 48, Trump: 47 } },

  // ── AmGreatness / TIPP ────────────────────────────────────────────────────
  { pollster: "AmGreatness/TIPP", endDate: "2024-09-25", sampleSize: 736, sampleType: "LV", results: { Harris: 50, Trump: 49 } },

  // ── Cook Political Report ─────────────────────────────────────────────────
  { pollster: "Cook Political Report", endDate: "2024-09-25", sampleSize: 409, sampleType: "LV", results: { Harris: 48, Trump: 47 } },
  { pollster: "Cook Political Report", endDate: "2024-08-02", sampleSize: 403, sampleType: "LV", results: { Harris: 45, Trump: 48 } },

  // ── Remington Research (R) ────────────────────────────────────────────────
  { pollster: "Remington Research", endDate: "2024-09-20", sampleSize: 800, sampleType: "LV", results: { Harris: 48, Trump: 49 } },

  // ── YouGov ────────────────────────────────────────────────────────────────
  { pollster: "YouGov", endDate: "2024-10-31", sampleSize: 773, sampleType: "LV", results: { Harris: 48, Trump: 47 } },

  // ── HarrisX ───────────────────────────────────────────────────────────────
  { pollster: "HarrisX", endDate: "2024-11-05", sampleSize: 1125, sampleType: "LV", results: { Harris: 48, Trump: 47 } },

  // ── FOX News ──────────────────────────────────────────────────────────────
  { pollster: "FOX News", endDate: "2024-08-26", sampleSize: 1026, sampleType: "RV", results: { Harris: 48, Trump: 50 } },

  // ── InsiderAdvantage (July) ───────────────────────────────────────────────
  { pollster: "InsiderAdvantage", endDate: "2024-07-16", sampleSize: 800, sampleType: "LV", results: { Harris: 40, Trump: 50 } },
];
