// Poll data for this tracker, kept out of the client page so server code can import it.
import type { Poll } from "@/app/_polling/lib/buildDailyModel";

export const RAW_POLLS: Poll[] = [
  // ── AtlasIntel ────────────────────────────────────────────────────────────
  { pollster: "AtlasIntel", endDate: "2024-11-04", sampleSize: 875,  sampleType: "LV", results: { Harris: 46, Trump: 51 } },
  { pollster: "AtlasIntel", endDate: "2024-11-02", sampleSize: 967,  sampleType: "LV", results: { Harris: 45, Trump: 52 } },
  { pollster: "AtlasIntel", endDate: "2024-10-31", sampleSize: 1005, sampleType: "LV", results: { Harris: 46, Trump: 51 } },
  { pollster: "AtlasIntel", endDate: "2024-10-29", sampleSize: 1458, sampleType: "LV", results: { Harris: 46, Trump: 51 } },
  { pollster: "AtlasIntel", endDate: "2024-10-17", sampleSize: 1440, sampleType: "LV", results: { Harris: 49, Trump: 49 } },
  { pollster: "AtlasIntel", endDate: "2024-09-25", sampleSize: 946,  sampleType: "LV", results: { Harris: 49, Trump: 50 } },

  // ── NY Times / Siena ──────────────────────────────────────────────────────
  { pollster: "NY Times/Siena", endDate: "2024-11-02", sampleSize: 1025, sampleType: "LV", results: { Harris: 44, Trump: 48 } },
  { pollster: "NY Times/Siena", endDate: "2024-10-10", sampleSize: 808,  sampleType: "LV", results: { Harris: 45, Trump: 50 } },
  { pollster: "NY Times/Siena", endDate: "2024-09-21", sampleSize: 713,  sampleType: "LV", results: { Harris: 43, Trump: 48 } },
  { pollster: "NY Times/Siena", endDate: "2024-08-15", sampleSize: 677,  sampleType: "LV", results: { Harris: 47, Trump: 43 } },

  // ── Noble Predictive Insights ─────────────────────────────────────────────
  { pollster: "Noble Predictive Insights", endDate: "2024-10-30", sampleSize: 775, sampleType: "LV", results: { Harris: 47, Trump: 48 } },

  // ── Data for Progress (D) ─────────────────────────────────────────────────
  { pollster: "Data for Progress", endDate: "2024-10-30", sampleSize: 1079, sampleType: "LV", results: { Harris: 47, Trump: 48 } },

  // ── Data Orbital ──────────────────────────────────────────────────────────
  { pollster: "Data Orbital", endDate: "2024-10-28", sampleSize: 550, sampleType: "LV", results: { Harris: 42, Trump: 50 } },

  // ── Mitchell Research & Communications ───────────────────────────────────
  { pollster: "Mitchell Research", endDate: "2024-10-28", sampleSize: 610, sampleType: "LV", results: { Harris: 48, Trump: 50 } },

  // ── J.L. Partners ─────────────────────────────────────────────────────────
  { pollster: "J.L. Partners", endDate: "2024-10-26", sampleSize: 500, sampleType: "LV", results: { Harris: 48, Trump: 49 } },

  // ── CNN/SSRS ──────────────────────────────────────────────────────────────
  { pollster: "CNN/SSRS", endDate: "2024-10-26", sampleSize: 781, sampleType: "LV", results: { Harris: 48, Trump: 47 } },
  { pollster: "CNN/SSRS", endDate: "2024-08-29", sampleSize: 682, sampleType: "LV", results: { Harris: 44, Trump: 49 } },

  // ── Bloomberg / Morning Consult ───────────────────────────────────────────
  { pollster: "Bloomberg/Morning Consult", endDate: "2024-10-20", sampleSize: 861,  sampleType: "LV", results: { Harris: 48, Trump: 48 } },
  { pollster: "Bloomberg/Morning Consult", endDate: "2024-09-25", sampleSize: 926,  sampleType: "LV", results: { Harris: 49, Trump: 46 } },
  { pollster: "Bloomberg/Morning Consult", endDate: "2024-08-26", sampleSize: 776,  sampleType: "LV", results: { Harris: 49, Trump: 47 } },
  { pollster: "Bloomberg/Morning Consult", endDate: "2024-07-28", sampleSize: 804,  sampleType: "RV", results: { Harris: 48, Trump: 44 } },

  // ── Redfield & Wilton Strategies ─────────────────────────────────────────
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-31", sampleSize: 652,  sampleType: "LV", results: { Harris: 47, Trump: 48 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-27", sampleSize: 901,  sampleType: "LV", results: { Harris: 47, Trump: 49 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-22", sampleSize: 710,  sampleType: "LV", results: { Harris: 46, Trump: 48 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-18", sampleSize: 691,  sampleType: "LV", results: { Harris: 46, Trump: 49 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-14", sampleSize: 1141, sampleType: "LV", results: { Harris: 46, Trump: 48 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-02", sampleSize: 555,  sampleType: "LV", results: { Harris: 47, Trump: 48 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-09-19", sampleSize: 789,  sampleType: "LV", results: { Harris: 47, Trump: 47 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-09-09", sampleSize: 765,  sampleType: "LV", results: { Harris: 46, Trump: 47 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-08-28", sampleSize: 530,  sampleType: "LV", results: { Harris: 45, Trump: 46 } },

  // ── YouGov ────────────────────────────────────────────────────────────────
  { pollster: "YouGov", endDate: "2024-10-31", sampleSize: 856, sampleType: "LV", results: { Harris: 48, Trump: 48 } },

  // ── Wall Street Journal ───────────────────────────────────────────────────
  { pollster: "Wall Street Journal", endDate: "2024-10-08", sampleSize: 600, sampleType: "RV", results: { Harris: 47, Trump: 45 } },

  // ── Fabrizio Ward / Impact Research ──────────────────────────────────────
  { pollster: "Fabrizio/Anzalone", endDate: "2024-10-01", sampleSize: 600, sampleType: "LV", results: { Harris: 47, Trump: 49 } },

  // ── GSG / NSOR ────────────────────────────────────────────────────────────
  { pollster: "GSG/NSOR", endDate: "2024-09-29", sampleSize: 400, sampleType: "LV", results: { Harris: 47, Trump: 47 } },

  // ── Cook Political Report ─────────────────────────────────────────────────
  { pollster: "Cook Political Report", endDate: "2024-09-25", sampleSize: 409, sampleType: "LV", results: { Harris: 50, Trump: 47 } },

  // ── FOX News ──────────────────────────────────────────────────────────────
  { pollster: "FOX News", endDate: "2024-09-24", sampleSize: 764,  sampleType: "LV", results: { Harris: 47, Trump: 50 } },
  { pollster: "FOX News", endDate: "2024-08-26", sampleSize: 1014, sampleType: "RV", results: { Harris: 48, Trump: 47 } },

  // ── USA Today / Suffolk ───────────────────────────────────────────────────
  { pollster: "USA Today/Suffolk", endDate: "2024-09-24", sampleSize: 500, sampleType: "LV", results: { Harris: 42, Trump: 48 } },

  // ── TIPP Insights ─────────────────────────────────────────────────────────
  { pollster: "TIPP", endDate: "2024-09-05", sampleSize: 949, sampleType: "LV", results: { Harris: 48, Trump: 48 } },

  // ── HarrisX ───────────────────────────────────────────────────────────────
  { pollster: "HarrisX", endDate: "2024-11-05", sampleSize: 1468, sampleType: "LV", results: { Harris: 46, Trump: 49 } },

  // ── Rasmussen Reports ─────────────────────────────────────────────────────
  { pollster: "Rasmussen Reports", endDate: "2024-08-17", sampleSize: 1187, sampleType: "LV", results: { Harris: 44, Trump: 45 } },

  // ── The Hill / Emerson ────────────────────────────────────────────────────
  { pollster: "The Hill/Emerson", endDate: "2024-07-23", sampleSize: 800, sampleType: "RV", results: { Harris: 40, Trump: 48 } },
];
