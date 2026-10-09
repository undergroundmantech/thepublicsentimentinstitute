// Poll data for this tracker, kept out of the client page so server code can import it.
import type { Poll } from "@/app/_polling/lib/buildDailyModel";

export const RAW_POLLS: Poll[] = [
  // ── AtlasIntel ────────────────────────────────────────────────────────────
  { pollster: "AtlasIntel", endDate: "2024-11-04", sampleSize: 1219, sampleType: "LV", results: { Harris: 48, Trump: 50 } },
  { pollster: "AtlasIntel", endDate: "2024-11-02", sampleSize: 1310, sampleType: "LV", results: { Harris: 47, Trump: 50 } },
  { pollster: "AtlasIntel", endDate: "2024-10-31", sampleSize: 1373, sampleType: "LV", results: { Harris: 47, Trump: 51 } },
  { pollster: "AtlasIntel", endDate: "2024-10-29", sampleSize: 1665, sampleType: "LV", results: { Harris: 49, Trump: 48 } },
  { pollster: "AtlasIntel", endDate: "2024-10-17", sampleSize: 1674, sampleType: "LV", results: { Harris: 50, Trump: 49 } },
  { pollster: "AtlasIntel", endDate: "2024-09-25", sampleSize: 1173, sampleType: "LV", results: { Harris: 51, Trump: 47 } },

  // ── Big Data Poll ─────────────────────────────────────────────────────────
  { pollster: "Big Data Poll", endDate: "2024-10-31", sampleSize: 1157, sampleType: "LV", results: { Harris: 47, Trump: 51 } },

  // ── NY Times / Siena ──────────────────────────────────────────────────────
  { pollster: "NY Times/Siena", endDate: "2024-11-02", sampleSize: 1010, sampleType: "LV", results: { Harris: 48, Trump: 45 } },
  { pollster: "NY Times/Siena", endDate: "2024-09-21", sampleSize: 682,  sampleType: "LV", results: { Harris: 45, Trump: 47 } },
  { pollster: "NY Times/Siena", endDate: "2024-08-14", sampleSize: 655,  sampleType: "LV", results: { Harris: 46, Trump: 44 } },

  // ── East Carolina University ──────────────────────────────────────────────
  { pollster: "East Carolina University", endDate: "2024-10-29", sampleSize: 1250, sampleType: "LV", results: { Harris: 48, Trump: 50 } },
  { pollster: "East Carolina University", endDate: "2024-09-26", sampleSize: 1005, sampleType: "LV", results: { Harris: 47, Trump: 49 } },
  { pollster: "East Carolina University", endDate: "2024-08-28", sampleSize: 920,  sampleType: "LV", results: { Harris: 47, Trump: 48 } },

  // ── FOX News ──────────────────────────────────────────────────────────────
  { pollster: "FOX News", endDate: "2024-10-28", sampleSize: 872,  sampleType: "LV", results: { Harris: 47, Trump: 49 } },
  { pollster: "FOX News", endDate: "2024-09-24", sampleSize: 787,  sampleType: "LV", results: { Harris: 47, Trump: 49 } },
  { pollster: "FOX News", endDate: "2024-08-26", sampleSize: 999,  sampleType: "RV", results: { Harris: 47, Trump: 48 } },

  // ── CNN/SSRS ──────────────────────────────────────────────────────────────
  { pollster: "CNN/SSRS", endDate: "2024-10-28", sampleSize: 750, sampleType: "LV", results: { Harris: 48, Trump: 47 } },
  { pollster: "CNN/SSRS", endDate: "2024-09-25", sampleSize: 931, sampleType: "LV", results: { Harris: 48, Trump: 48 } },

  // ── UMass Lowell ──────────────────────────────────────────────────────────
  { pollster: "UMass Lowell", endDate: "2024-10-23", sampleSize: 650, sampleType: "LV", results: { Harris: 45, Trump: 47 } },

  // ── Bloomberg / Morning Consult ───────────────────────────────────────────
  { pollster: "Bloomberg/Morning Consult", endDate: "2024-10-20", sampleSize: 702,  sampleType: "LV", results: { Harris: 46, Trump: 49 } },
  { pollster: "Bloomberg/Morning Consult", endDate: "2024-09-25", sampleSize: 828,  sampleType: "LV", results: { Harris: 49, Trump: 47 } },
  { pollster: "Bloomberg/Morning Consult", endDate: "2024-08-26", sampleSize: 645,  sampleType: "LV", results: { Harris: 48, Trump: 48 } },
  { pollster: "Bloomberg/Morning Consult", endDate: "2024-07-28", sampleSize: 706,  sampleType: "RV", results: { Harris: 44, Trump: 45 } },

  // ── Carolina Journal / Cygnal (R) ─────────────────────────────────────────
  { pollster: "Cygnal", endDate: "2024-10-14", sampleSize: 600, sampleType: "LV", results: { Harris: 47, Trump: 47 } },
  { pollster: "Cygnal", endDate: "2024-09-16", sampleSize: 600, sampleType: "LV", results: { Harris: 45, Trump: 46 } },
  { pollster: "Cygnal", endDate: "2024-08-05", sampleSize: 600, sampleType: "LV", results: { Harris: 44, Trump: 47 } },

  // ── Quinnipiac ────────────────────────────────────────────────────────────
  { pollster: "Quinnipiac", endDate: "2024-10-14", sampleSize: 1031, sampleType: "LV", results: { Harris: 49, Trump: 47 } },
  { pollster: "Quinnipiac", endDate: "2024-09-29", sampleSize: 953,  sampleType: "LV", results: { Harris: 47, Trump: 49 } },
  { pollster: "Quinnipiac", endDate: "2024-09-08", sampleSize: 940,  sampleType: "LV", results: { Harris: 49, Trump: 46 } },

  // ── Wall Street Journal ───────────────────────────────────────────────────
  { pollster: "Wall Street Journal", endDate: "2024-10-08", sampleSize: 600, sampleType: "RV", results: { Harris: 45, Trump: 46 } },

  // ── GSG / NSOR ────────────────────────────────────────────────────────────
  { pollster: "GSG/NSOR", endDate: "2024-09-29", sampleSize: 401, sampleType: "LV", results: { Harris: 47, Trump: 47 } },

  // ── Cook Political Report ─────────────────────────────────────────────────
  { pollster: "Cook Political Report", endDate: "2024-09-25", sampleSize: 411, sampleType: "LV", results: { Harris: 49, Trump: 46 } },
  { pollster: "Cook Political Report", endDate: "2024-08-02", sampleSize: 403, sampleType: "LV", results: { Harris: 46, Trump: 44 } },

  // ── Fabrizio Ward / Impact Research ──────────────────────────────────────
  { pollster: "Fabrizio/Anzalone", endDate: "2024-09-17", sampleSize: 600, sampleType: "LV", results: { Harris: 46, Trump: 48 } },

  // ── AmGreatness / TIPP ────────────────────────────────────────────────────
  { pollster: "AmGreatness/TIPP", endDate: "2024-09-13", sampleSize: 973, sampleType: "LV", results: { Harris: 45, Trump: 48 } },

  // ── Meredith College ──────────────────────────────────────────────────────
  { pollster: "Meredith College", endDate: "2024-09-20", sampleSize: 802, sampleType: "LV", results: { Harris: 48, Trump: 48 } },

  // ── Redfield & Wilton Strategies ─────────────────────────────────────────
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-31", sampleSize: 1123, sampleType: "LV", results: { Harris: 47, Trump: 48 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-27", sampleSize: 770,  sampleType: "LV", results: { Harris: 46, Trump: 48 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-22", sampleSize: 679,  sampleType: "LV", results: { Harris: 47, Trump: 48 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-18", sampleSize: 843,  sampleType: "LV", results: { Harris: 45, Trump: 48 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-14", sampleSize: 620,  sampleType: "LV", results: { Harris: 46, Trump: 48 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-02", sampleSize: 753,  sampleType: "LV", results: { Harris: 45, Trump: 47 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-09-19", sampleSize: 868,  sampleType: "LV", results: { Harris: 47, Trump: 48 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-09-09", sampleSize: 495,  sampleType: "LV", results: { Harris: 45, Trump: 44 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-08-28", sampleSize: 1071, sampleType: "LV", results: { Harris: 44, Trump: 45 } },

  // ── YouGov ────────────────────────────────────────────────────────────────
  { pollster: "YouGov", endDate: "2024-10-31", sampleSize: 949, sampleType: "LV", results: { Harris: 48, Trump: 49 } },

  // ── HarrisX ───────────────────────────────────────────────────────────────
  { pollster: "HarrisX", endDate: "2024-11-05", sampleSize: 1600, sampleType: "LV", results: { Harris: 48, Trump: 49 } },

  // ── PPP (D) ───────────────────────────────────────────────────────────────
  { pollster: "PPP", endDate: "2024-07-20", sampleSize: 573, sampleType: "RV", results: { Harris: 44, Trump: 48 } },
];
