// Poll data for this tracker, kept out of the client page so server code can import it.
import type { Poll } from "@/app/_polling/lib/buildDailyModel";

export const RAW_POLLS: Poll[] = [
  // ── AtlasIntel ────────────────────────────────────────────────────────────
  { pollster: "AtlasIntel", endDate: "2024-11-04", sampleSize: 869,  sampleType: "LV", results: { Harris: 48, Trump: 49 } },
  { pollster: "AtlasIntel", endDate: "2024-11-02", sampleSize: 728,  sampleType: "LV", results: { Harris: 48, Trump: 49 } },
  { pollster: "AtlasIntel", endDate: "2024-10-31", sampleSize: 673,  sampleType: "LV", results: { Harris: 48, Trump: 49 } },
  { pollster: "AtlasIntel", endDate: "2024-10-29", sampleSize: 1470, sampleType: "LV", results: { Harris: 48, Trump: 49 } },
  { pollster: "AtlasIntel", endDate: "2024-10-17", sampleSize: 932,  sampleType: "LV", results: { Harris: 48, Trump: 49 } },

  // ── NY Times / Siena ──────────────────────────────────────────────────────
  { pollster: "NY Times/Siena", endDate: "2024-11-02", sampleSize: 1305, sampleType: "LV", results: { Harris: 48, Trump: 45 } },
  { pollster: "NY Times/Siena", endDate: "2024-09-26", sampleSize: 680,  sampleType: "LV", results: { Harris: 48, Trump: 46 } },
  { pollster: "NY Times/Siena", endDate: "2024-08-08", sampleSize: 661,  sampleType: "LV", results: { Harris: 49, Trump: 43 } },

  // ── Echelon Insights ──────────────────────────────────────────────────────
  { pollster: "Echelon Insights", endDate: "2024-10-30", sampleSize: 600, sampleType: "LV", results: { Harris: 48, Trump: 48 } },

  // ── CNN/SSRS ──────────────────────────────────────────────────────────────
  { pollster: "CNN/SSRS", endDate: "2024-11-02", sampleSize: 736,  sampleType: "LV", results: { Harris: 45, Trump: 51 } },
  { pollster: "CNN/SSRS", endDate: "2024-08-29", sampleSize: 976,  sampleType: "LV", results: { Harris: 50, Trump: 44 } },

  // ── USA Today / Suffolk ───────────────────────────────────────────────────
  { pollster: "USA Today/Suffolk", endDate: "2024-10-23", sampleSize: 500, sampleType: "LV", results: { Harris: 48, Trump: 47 } },

  // ── Marquette Law School ──────────────────────────────────────────────────
  { pollster: "Marquette Law School", endDate: "2024-10-24", sampleSize: 753, sampleType: "LV", results: { Harris: 46, Trump: 45 } },
  { pollster: "Marquette Law School", endDate: "2024-09-26", sampleSize: 798, sampleType: "LV", results: { Harris: 46, Trump: 43 } },
  { pollster: "Marquette Law School", endDate: "2024-09-05", sampleSize: 738, sampleType: "LV", results: { Harris: 48, Trump: 43 } },
  { pollster: "Marquette Law School", endDate: "2024-08-01", sampleSize: 801, sampleType: "LV", results: { Harris: 46, Trump: 45 } },

  // ── Quinnipiac ────────────────────────────────────────────────────────────
  { pollster: "Quinnipiac", endDate: "2024-10-21", sampleSize: 1136, sampleType: "LV", results: { Harris: 48, Trump: 48 } },
  { pollster: "Quinnipiac", endDate: "2024-10-07", sampleSize: 1073, sampleType: "LV", results: { Harris: 46, Trump: 48 } },
  { pollster: "Quinnipiac", endDate: "2024-09-16", sampleSize: 1075, sampleType: "LV", results: { Harris: 48, Trump: 47 } },

  // ── Bloomberg / Morning Consult ───────────────────────────────────────────
  { pollster: "Bloomberg/Morning Consult", endDate: "2024-10-20", sampleSize: 624,  sampleType: "LV", results: { Harris: 47, Trump: 47 } },
  { pollster: "Bloomberg/Morning Consult", endDate: "2024-09-25", sampleSize: 785,  sampleType: "LV", results: { Harris: 50, Trump: 47 } },
  { pollster: "Bloomberg/Morning Consult", endDate: "2024-08-26", sampleSize: 648,  sampleType: "LV", results: { Harris: 52, Trump: 44 } },
  { pollster: "Bloomberg/Morning Consult", endDate: "2024-07-28", sampleSize: 700,  sampleType: "RV", results: { Harris: 45, Trump: 44 } },

  // ── Wall Street Journal ───────────────────────────────────────────────────
  { pollster: "Wall Street Journal", endDate: "2024-10-08", sampleSize: 600, sampleType: "RV", results: { Harris: 45, Trump: 46 } },

  // ── GSG / NSOR ────────────────────────────────────────────────────────────
  { pollster: "GSG/NSOR", endDate: "2024-09-29", sampleSize: 408, sampleType: "LV", results: { Harris: 45, Trump: 46 } },

  // ── Cook Political Report ─────────────────────────────────────────────────
  { pollster: "Cook Political Report", endDate: "2024-09-25", sampleSize: 411, sampleType: "LV", results: { Harris: 46, Trump: 48 } },

  // ── Fabrizio / Anzalone ───────────────────────────────────────────────────
  { pollster: "Fabrizio/Anzalone", endDate: "2024-09-14", sampleSize: 600, sampleType: "LV", results: { Harris: 45, Trump: 48 } },

  // ── Rasmussen Reports ─────────────────────────────────────────────────────
  { pollster: "Rasmussen Reports", endDate: "2024-08-19", sampleSize: 1099, sampleType: "LV", results: { Harris: 46, Trump: 46 } },

  // ── AmGreatness / TIPP ────────────────────────────────────────────────────
  { pollster: "AmGreatness/TIPP", endDate: "2024-08-14", sampleSize: 976, sampleType: "RV", results: { Harris: 45, Trump: 46 } },

  // ── FOX News ──────────────────────────────────────────────────────────────
  { pollster: "FOX News", endDate: "2024-07-24", sampleSize: 1046, sampleType: "RV", results: { Harris: 46, Trump: 46 } },

  // ── The Hill / Emerson ────────────────────────────────────────────────────
  { pollster: "The Hill/Emerson", endDate: "2024-07-23", sampleSize: 845, sampleType: "RV", results: { Harris: 45, Trump: 45 } },

  // ── Redfield & Wilton Strategies ─────────────────────────────────────────
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-31", sampleSize: 932, sampleType: "LV", results: { Harris: 48, Trump: 47 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-27", sampleSize: 746, sampleType: "LV", results: { Harris: 49, Trump: 47 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-22", sampleSize: 557, sampleType: "LV", results: { Harris: 49, Trump: 47 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-18", sampleSize: 622, sampleType: "LV", results: { Harris: 47, Trump: 46 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-14", sampleSize: 641, sampleType: "LV", results: { Harris: 48, Trump: 47 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-02", sampleSize: 533, sampleType: "LV", results: { Harris: 47, Trump: 46 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-09-19", sampleSize: 600, sampleType: "LV", results: { Harris: 47, Trump: 47 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-09-09", sampleSize: 626, sampleType: "LV", results: { Harris: 49, Trump: 46 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-08-28", sampleSize: 672, sampleType: "LV", results: { Harris: 48, Trump: 44 } },

  // ── YouGov ────────────────────────────────────────────────────────────────
  { pollster: "YouGov", endDate: "2024-10-31", sampleSize: 876, sampleType: "LV", results: { Harris: 49, Trump: 45 } },

  // ── OnMessage Inc. (R) ────────────────────────────────────────────────────
  { pollster: "OnMessage Inc.", endDate: "2024-10-22", sampleSize: 600, sampleType: "LV", results: { Harris: 47, Trump: 48 } },

  // ── HarrisX ───────────────────────────────────────────────────────────────
  { pollster: "HarrisX", endDate: "2024-11-05", sampleSize: 1549, sampleType: "LV", results: { Harris: 47, Trump: 47 } },

  // ── Remington Research (R) ────────────────────────────────────────────────
  { pollster: "Remington Research", endDate: "2024-09-20", sampleSize: 800, sampleType: "LV", results: { Harris: 48, Trump: 48 } },
];
