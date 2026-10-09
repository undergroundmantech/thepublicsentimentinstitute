// Poll data for this tracker, kept out of the client page so server code can import it.
import type { Poll } from "@/app/_polling/lib/buildDailyModel";

export const GOLD_STANDARD_NAMES = [
  "Big Data Poll", "Rasmussen Reports", "AtlasIntel", "SoCalStrategies",
  "Emerson", "Trafalgar", "InsiderAdvantage", "Patriot Polling",
];

export const RAW_POLLS: Poll[] = [
  { pollster: "The Public Sentiment Institute",          endDate: "2026-02-28", sampleSize: 316, sampleType: "RV", results: { Vance: 43, Newsom: 38 } },
  { pollster: "The Public Sentiment Institute",          endDate: "2026-02-28", sampleSize: 250, sampleType: "LV", results: { Vance: 41, Newsom: 46 } },
  { pollster: "Big Data Poll",          endDate: "2026-02-18", sampleSize: 1805, sampleType: "LV", results: { Vance: 46.8, Newsom: 53.2 } },
  { pollster: "YouGov / Yahoo",         endDate: "2026-02-12", sampleSize: 511,  sampleType: "LV", results: { Vance: 43.0, Newsom: 49.0 } },
  { pollster: "Zogby",                  endDate: "2026-01-07", sampleSize: 891,  sampleType: "LV", results: { Vance: 44.6, Newsom: 41.0 } },
  { pollster: "The Argument/Verasight", endDate: "2025-11-17", sampleSize: 1508, sampleType: "RV", results: { Vance: 46.4, Newsom: 53.6 } },
  { pollster: "Morning Consult",        endDate: "2025-11-16", sampleSize: 2201, sampleType: "RV", results: { Vance: 42.0, Newsom: 41.0 } },
  { pollster: "Overton Insights",       endDate: "2025-10-29", sampleSize: 1200, sampleType: "RV", results: { Vance: 43.0, Newsom: 46.0 } },
  { pollster: "Echelon Insights",       endDate: "2025-10-20", sampleSize: 1010, sampleType: "LV", results: { Vance: 46.0, Newsom: 47.0 } },
  { pollster: "YouGov / UMass Lowell",  endDate: "2025-10-20", sampleSize: 1000, sampleType: "A",  results: { Vance: 32.0, Newsom: 36.0 } },
  { pollster: "Emerson",                endDate: "2025-10-14", sampleSize: 1000, sampleType: "RV", results: { Vance: 45.5, Newsom: 44.9 } },
  { pollster: "YouGov / Yahoo",         endDate: "2025-09-02", sampleSize: 1690, sampleType: "A",  results: { Vance: 41.0, Newsom: 49.0 } },
  { pollster: "Leger360",               endDate: "2025-08-31", sampleSize: 849,  sampleType: "A",  results: { Vance: 46.0, Newsom: 47.0 } },
  { pollster: "Emerson",                endDate: "2025-08-26", sampleSize: 1000, sampleType: "LV", results: { Vance: 44.4, Newsom: 43.5 } },
  { pollster: "SoCal Strategies",       endDate: "2025-08-18", sampleSize: 700,  sampleType: "A",  results: { Vance: 37.0, Newsom: 39.0 } },
  { pollster: "Emerson",                endDate: "2025-07-22", sampleSize: 1400, sampleType: "RV", results: { Vance: 45.3, Newsom: 42.1 } },
  { pollster: "SoCal Strategies",       endDate: "2024-12-23", sampleSize: 656,  sampleType: "A",  results: { Vance: 37.0, Newsom: 34.0 } },
];
