// Poll data for this tracker, kept out of the client page so server code can import it.
import type { Poll } from "@/app/_polling/lib/buildDailyModel";

export const RAW_POLLS: Poll[] = [
  // ── AtlasIntel ────────────────────────────────────────────────────────────
  { pollster: "AtlasIntel", endDate: "2024-11-04", sampleSize: 1112, sampleType: "LV", results: { Harris: 48, Trump: 48 } },
  { pollster: "AtlasIntel", endDate: "2024-11-02", sampleSize: 1174, sampleType: "LV", results: { Harris: 47, Trump: 49 } },
  { pollster: "AtlasIntel", endDate: "2024-10-31", sampleSize: 1212, sampleType: "LV", results: { Harris: 47, Trump: 49 } },
  { pollster: "AtlasIntel", endDate: "2024-10-29", sampleSize: 1429, sampleType: "LV", results: { Harris: 47, Trump: 50 } },
  { pollster: "AtlasIntel", endDate: "2024-10-17", sampleSize: 1411, sampleType: "LV", results: { Harris: 48, Trump: 50 } },
  { pollster: "AtlasIntel", endDate: "2024-09-25", sampleSize: 1200, sampleType: "LV", results: { Harris: 49, Trump: 49 } },

  // ── NY Times / Siena ──────────────────────────────────────────────────────
  { pollster: "NY Times/Siena", endDate: "2024-11-02", sampleSize: 1004, sampleType: "LV", results: { Harris: 46, Trump: 46 } },
  { pollster: "NY Times/Siena", endDate: "2024-09-21", sampleSize: 682,  sampleType: "LV", results: { Harris: 44, Trump: 47 } },
  { pollster: "NY Times/Siena", endDate: "2024-08-14", sampleSize: 661,  sampleType: "LV", results: { Harris: 47, Trump: 44 } },

  // ── East Carolina University ──────────────────────────────────────────────
  { pollster: "East Carolina University", endDate: "2024-10-31", sampleSize: 902, sampleType: "LV", results: { Harris: 49, Trump: 50 } },
  { pollster: "East Carolina University", endDate: "2024-10-14", sampleSize: 701, sampleType: "LV", results: { Harris: 46, Trump: 49 } },

  // ── Data for Progress (D) ─────────────────────────────────────────────────
  { pollster: "Data for Progress", endDate: "2024-10-30", sampleSize: 972, sampleType: "LV", results: { Harris: 49, Trump: 48 } },

  // ── CNN/SSRS ──────────────────────────────────────────────────────────────
  { pollster: "CNN/SSRS", endDate: "2024-10-28", sampleSize: 732, sampleType: "LV", results: { Harris: 48, Trump: 47 } },
  { pollster: "CNN/SSRS", endDate: "2024-08-29", sampleSize: 617, sampleType: "LV", results: { Harris: 48, Trump: 47 } },

  // ── Bloomberg / Morning Consult ───────────────────────────────────────────
  { pollster: "Bloomberg/Morning Consult", endDate: "2024-10-20", sampleSize: 855,  sampleType: "LV", results: { Harris: 48, Trump: 47 } },
  { pollster: "Bloomberg/Morning Consult", endDate: "2024-09-25", sampleSize: 913,  sampleType: "LV", results: { Harris: 48, Trump: 48 } },
  { pollster: "Bloomberg/Morning Consult", endDate: "2024-08-26", sampleSize: 737,  sampleType: "LV", results: { Harris: 48, Trump: 46 } },
  { pollster: "Bloomberg/Morning Consult", endDate: "2024-07-28", sampleSize: 799,  sampleType: "RV", results: { Harris: 45, Trump: 45 } },

  // ── Quinnipiac ────────────────────────────────────────────────────────────
  { pollster: "Quinnipiac", endDate: "2024-10-14", sampleSize: 1328, sampleType: "LV", results: { Harris: 45, Trump: 52 } },
  { pollster: "Quinnipiac", endDate: "2024-09-29", sampleSize: 942,  sampleType: "LV", results: { Harris: 44, Trump: 50 } },
  { pollster: "Quinnipiac", endDate: "2024-09-08", sampleSize: 969,  sampleType: "LV", results: { Harris: 45, Trump: 49 } },

  // ── Atlanta Journal-Constitution ──────────────────────────────────────────
  { pollster: "Atlanta Journal-Constitution", endDate: "2024-10-16", sampleSize: 1000, sampleType: "LV", results: { Harris: 43, Trump: 47 } },
  { pollster: "Atlanta Journal-Constitution", endDate: "2024-09-15", sampleSize: 1000, sampleType: "LV", results: { Harris: 44, Trump: 47 } },

  // ── Wall Street Journal ───────────────────────────────────────────────────
  { pollster: "Wall Street Journal", endDate: "2024-10-08", sampleSize: 600, sampleType: "RV", results: { Harris: 46, Trump: 45 } },

  // ── GSG / NSOR ────────────────────────────────────────────────────────────
  { pollster: "GSG/NSOR", endDate: "2024-09-29", sampleSize: 400, sampleType: "LV", results: { Harris: 46, Trump: 47 } },

  // ── Cook Political Report ─────────────────────────────────────────────────
  { pollster: "Cook Political Report", endDate: "2024-09-25", sampleSize: 411, sampleType: "LV", results: { Harris: 47, Trump: 48 } },
  { pollster: "Cook Political Report", endDate: "2024-08-02", sampleSize: 405, sampleType: "LV", results: { Harris: 46, Trump: 46 } },

  // ── FOX News ──────────────────────────────────────────────────────────────
  { pollster: "FOX News", endDate: "2024-09-24", sampleSize: 707,  sampleType: "LV", results: { Harris: 50, Trump: 48 } },
  { pollster: "FOX News", endDate: "2024-08-26", sampleSize: 1014, sampleType: "RV", results: { Harris: 48, Trump: 46 } },

  // ── Redfield & Wilton Strategies ─────────────────────────────────────────
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-31", sampleSize: 1779, sampleType: "LV", results: { Harris: 47, Trump: 48 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-27", sampleSize: 1112, sampleType: "LV", results: { Harris: 47, Trump: 48 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-22", sampleSize: 1168, sampleType: "LV", results: { Harris: 47, Trump: 48 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-18", sampleSize: 1019, sampleType: "LV", results: { Harris: 47, Trump: 48 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-14", sampleSize: 637,  sampleType: "LV", results: { Harris: 47, Trump: 47 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-09", sampleSize: 608,  sampleType: "LV", results: { Harris: 47, Trump: 48 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-02", sampleSize: 3783, sampleType: "LV", results: { Harris: 47, Trump: 47 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-09-19", sampleSize: 1043, sampleType: "LV", results: { Harris: 46, Trump: 48 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-09-09", sampleSize: 562,  sampleType: "LV", results: { Harris: 47, Trump: 49 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-08-28", sampleSize: 699,  sampleType: "LV", results: { Harris: 42, Trump: 44 } },

  // ── YouGov ────────────────────────────────────────────────────────────────
  { pollster: "YouGov", endDate: "2024-10-31", sampleSize: 939, sampleType: "LV", results: { Harris: 47, Trump: 48 } },

  // ── University of Georgia SPIA ────────────────────────────────────────────
  { pollster: "U. Georgia SPIA", endDate: "2024-10-16", sampleSize: 1000, sampleType: "LV", results: { Harris: 43, Trump: 47 } },
  { pollster: "U. Georgia SPIA", endDate: "2024-09-15", sampleSize: 1000, sampleType: "LV", results: { Harris: 44, Trump: 47 } },

  // ── HarrisX ───────────────────────────────────────────────────────────────
  { pollster: "HarrisX", endDate: "2024-11-05", sampleSize: 1659, sampleType: "LV", results: { Harris: 47, Trump: 48 } },

  // ── TIPP Insights ─────────────────────────────────────────────────────────
  { pollster: "TIPP", endDate: "2024-09-18", sampleSize: 835, sampleType: "LV", results: { Harris: 48, Trump: 48 } },

  // ── The Citadel ───────────────────────────────────────────────────────────
  { pollster: "The Citadel", endDate: "2024-10-25", sampleSize: 1126, sampleType: "LV", results: { Harris: 47, Trump: 49 } },

  // ── Fabrizio / Anzalone ───────────────────────────────────────────────────
  { pollster: "Fabrizio/Anzalone", endDate: "2024-07-31", sampleSize: 600, sampleType: "LV", results: { Harris: 46, Trump: 44 } },

  // ── The Hill / Emerson ────────────────────────────────────────────────────
  { pollster: "The Hill/Emerson", endDate: "2024-07-23", sampleSize: 800, sampleType: "RV", results: { Harris: 46, Trump: 43 } },

  // ── Landmark Communications ───────────────────────────────────────────────
  { pollster: "Landmark Communications", endDate: "2024-07-22", sampleSize: 400, sampleType: "LV", results: { Harris: 46, Trump: 44 } },
];
