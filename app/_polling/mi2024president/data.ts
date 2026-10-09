// Poll data for this tracker, kept out of the client page so server code can import it.
import type { Poll } from "@/app/_polling/lib/buildDailyModel";

export const RAW_POLLS: Poll[] = [
  { pollster: "Big Data Poll", endDate: "2024-10-14", sampleSize: 904, sampleType: "LV", results: { Harris: 49.5, Trump: 50.5 } },
  // ── AtlasIntel ────────────────────────────────────────────────────────────
  { pollster: "AtlasIntel", endDate: "2024-11-04", sampleSize: 1113, sampleType: "LV", results: { Harris: 48, Trump: 50 } },
  { pollster: "AtlasIntel", endDate: "2024-11-02", sampleSize: 1198, sampleType: "LV", results: { Harris: 48, Trump: 49 } },
  { pollster: "AtlasIntel", endDate: "2024-10-31", sampleSize: 1136, sampleType: "LV", results: { Harris: 48, Trump: 49 } },
  { pollster: "AtlasIntel", endDate: "2024-10-29", sampleSize: 938,  sampleType: "LV", results: { Harris: 48, Trump: 49 } },
  { pollster: "AtlasIntel", endDate: "2024-10-17", sampleSize: 1529, sampleType: "LV", results: { Harris: 47, Trump: 50 } },
  { pollster: "AtlasIntel", endDate: "2024-09-25", sampleSize: 918,  sampleType: "LV", results: { Harris: 47, Trump: 50 } },

  // ── NY Times / Siena ──────────────────────────────────────────────────────
  { pollster: "NY Times/Siena", endDate: "2024-11-02", sampleSize: 998, sampleType: "LV", results: { Harris: 45, Trump: 45 } },
  { pollster: "NY Times/Siena", endDate: "2024-09-26", sampleSize: 688, sampleType: "LV", results: { Harris: 46, Trump: 46 } },
  { pollster: "NY Times/Siena", endDate: "2024-08-08", sampleSize: 619, sampleType: "LV", results: { Harris: 48, Trump: 43 } },

  // ── MNS / Mitchell Research ───────────────────────────────────────────────
  { pollster: "Mitchell Research", endDate: "2024-11-02", sampleSize: 585, sampleType: "LV", results: { Harris: 48, Trump: 49 } },
  { pollster: "Mitchell Research", endDate: "2024-10-14", sampleSize: 589, sampleType: "LV", results: { Harris: 47, Trump: 47 } },

  // ── FOX News ──────────────────────────────────────────────────────────────
  { pollster: "FOX News", endDate: "2024-10-28", sampleSize: 988,  sampleType: "LV", results: { Harris: 46, Trump: 48 } },
  { pollster: "FOX News", endDate: "2024-07-24", sampleSize: 1012, sampleType: "RV", results: { Harris: 43, Trump: 45 } },

  // ── Detroit Free Press ────────────────────────────────────────────────────
  { pollster: "Detroit Free Press", endDate: "2024-10-27", sampleSize: 600, sampleType: "LV", results: { Harris: 45, Trump: 48 } },

  // ── CNN/SSRS ──────────────────────────────────────────────────────────────
  { pollster: "CNN/SSRS", endDate: "2024-10-28", sampleSize: 726, sampleType: "LV", results: { Harris: 48, Trump: 43 } },

  // ── Echelon Insights ──────────────────────────────────────────────────────
  { pollster: "Echelon Insights", endDate: "2024-10-30", sampleSize: 600, sampleType: "LV", results: { Harris: 47, Trump: 47 } },

  // ── Detroit News / WDIV-TV ────────────────────────────────────────────────
  { pollster: "Detroit News/WDIV-TV", endDate: "2024-10-24", sampleSize: 600, sampleType: "LV", results: { Harris: 47, Trump: 44 } },
  { pollster: "Detroit News/WDIV-TV", endDate: "2024-10-04", sampleSize: 600, sampleType: "LV", results: { Harris: 47, Trump: 44 } },
  { pollster: "Detroit News/WDIV-TV", endDate: "2024-08-29", sampleSize: 600, sampleType: "LV", results: { Harris: 44, Trump: 45 } },
  { pollster: "Detroit News/WDIV-TV", endDate: "2024-07-24", sampleSize: 600, sampleType: "LV", results: { Harris: 42, Trump: 41 } },

  // ── UMass Lowell ──────────────────────────────────────────────────────────
  { pollster: "UMass Lowell", endDate: "2024-10-24", sampleSize: 600, sampleType: "LV", results: { Harris: 49, Trump: 45 } },
  { pollster: "UMass Lowell", endDate: "2024-09-19", sampleSize: 650, sampleType: "LV", results: { Harris: 48, Trump: 43 } },

  // ── Quinnipiac ────────────────────────────────────────────────────────────
  { pollster: "Quinnipiac", endDate: "2024-10-21", sampleSize: 1136, sampleType: "LV", results: { Harris: 49, Trump: 46 } },
  { pollster: "Quinnipiac", endDate: "2024-10-07", sampleSize: 1007, sampleType: "LV", results: { Harris: 47, Trump: 50 } },
  { pollster: "Quinnipiac", endDate: "2024-09-16", sampleSize: 905,  sampleType: "LV", results: { Harris: 50, Trump: 45 } },

  // ── Bloomberg / Morning Consult ───────────────────────────────────────────
  { pollster: "Bloomberg/Morning Consult", endDate: "2024-10-20", sampleSize: 705,  sampleType: "LV", results: { Harris: 49, Trump: 46 } },
  { pollster: "Bloomberg/Morning Consult", endDate: "2024-09-25", sampleSize: 800,  sampleType: "LV", results: { Harris: 50, Trump: 46 } },
  { pollster: "Bloomberg/Morning Consult", endDate: "2024-08-26", sampleSize: 651,  sampleType: "LV", results: { Harris: 49, Trump: 47 } },
  { pollster: "Bloomberg/Morning Consult", endDate: "2024-07-28", sampleSize: 706,  sampleType: "RV", results: { Harris: 51, Trump: 39 } },

  // ── MRG ───────────────────────────────────────────────────────────────────
  { pollster: "MRG", endDate: "2024-10-11", sampleSize: 600, sampleType: "LV", results: { Harris: 45, Trump: 44 } },

  // ── Fabrizio / Anzalone ───────────────────────────────────────────────────
  { pollster: "Fabrizio/Anzalone", endDate: "2024-10-08", sampleSize: 600, sampleType: "LV", results: { Harris: 46, Trump: 46 } },
  { pollster: "Fabrizio/Anzalone", endDate: "2024-08-11", sampleSize: 600, sampleType: "LV", results: { Harris: 45, Trump: 43 } },

  // ── Wall Street Journal ───────────────────────────────────────────────────
  { pollster: "Wall Street Journal", endDate: "2024-10-08", sampleSize: 600, sampleType: "RV", results: { Harris: 47, Trump: 45 } },

  // ── MIRS / MI News Source ─────────────────────────────────────────────────
  { pollster: "MIRS/MI News Source", endDate: "2024-09-30", sampleSize: 709, sampleType: "LV", results: { Harris: 47, Trump: 47 } },
  { pollster: "MIRS/MI News Source", endDate: "2024-09-11", sampleSize: 580, sampleType: "LV", results: { Harris: 47, Trump: 46 } },

  // ── GSG / NSOR ────────────────────────────────────────────────────────────
  { pollster: "GSG/NSOR", endDate: "2024-09-29", sampleSize: 404, sampleType: "LV", results: { Harris: 48, Trump: 46 } },

  // ── Cook Political Report ─────────────────────────────────────────────────
  { pollster: "Cook Political Report", endDate: "2024-09-25", sampleSize: 416, sampleType: "LV", results: { Harris: 49, Trump: 46 } },
  { pollster: "Cook Political Report", endDate: "2024-08-02", sampleSize: 406, sampleType: "LV", results: { Harris: 46, Trump: 44 } },

  // ── USA Today / Suffolk ───────────────────────────────────────────────────
  { pollster: "USA Today/Suffolk", endDate: "2024-09-19", sampleSize: 500, sampleType: "LV", results: { Harris: 48, Trump: 45 } },

  // ── Remington Research (R) ────────────────────────────────────────────────
  { pollster: "Remington Research", endDate: "2024-09-20", sampleSize: 800, sampleType: "LV", results: { Harris: 49, Trump: 47 } },

  // ── Redfield & Wilton Strategies ─────────────────────────────────────────
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-31", sampleSize: 1731, sampleType: "LV", results: { Harris: 47, Trump: 47 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-27", sampleSize: 728,  sampleType: "LV", results: { Harris: 49, Trump: 48 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-22", sampleSize: 1115, sampleType: "LV", results: { Harris: 47, Trump: 47 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-18", sampleSize: 1008, sampleType: "LV", results: { Harris: 47, Trump: 47 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-14", sampleSize: 682,  sampleType: "LV", results: { Harris: 47, Trump: 47 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-02", sampleSize: 839,  sampleType: "LV", results: { Harris: 48, Trump: 46 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-09-19", sampleSize: 993,  sampleType: "LV", results: { Harris: 46, Trump: 45 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-09-09", sampleSize: 556,  sampleType: "LV", results: { Harris: 48, Trump: 45 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-08-28", sampleSize: 1071, sampleType: "LV", results: { Harris: 47, Trump: 44 } },

  // ── YouGov ────────────────────────────────────────────────────────────────
  { pollster: "YouGov", endDate: "2024-10-31", sampleSize: 942, sampleType: "LV", results: { Harris: 48, Trump: 45 } },

  // ── CNN/SSRS (Aug) ────────────────────────────────────────────────────────
  { pollster: "CNN/SSRS", endDate: "2024-08-29", sampleSize: 708, sampleType: "LV", results: { Harris: 48, Trump: 43 } },

  // ── EPIC-MRA ──────────────────────────────────────────────────────────────
  { pollster: "EPIC/MRA", endDate: "2024-08-26", sampleSize: 600, sampleType: "LV", results: { Harris: 46, Trump: 45 } },

  // ── AmGreatness / TIPP ────────────────────────────────────────────────────
  { pollster: "AmGreatness/TIPP", endDate: "2024-08-22", sampleSize: 741, sampleType: "LV", results: { Harris: 46, Trump: 45 } },

  // ── Rasmussen Reports ─────────────────────────────────────────────────────
  { pollster: "Rasmussen Reports", endDate: "2024-08-17", sampleSize: 1093, sampleType: "LV", results: { Harris: 47, Trump: 44 } },

  // ── The Hill / Emerson ────────────────────────────────────────────────────
  { pollster: "The Hill/Emerson", endDate: "2024-07-23", sampleSize: 800, sampleType: "RV", results: { Harris: 44, Trump: 44 } },
];
