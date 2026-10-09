// Poll data for this tracker, kept out of the client page so server code can import it.
import type { Poll } from "@/app/_polling/lib/buildDailyModel";

export const RAW_POLLS: Poll[] = [
  // March 2026
  { pollster: "Quantus Insights**",          endDate: "2026-03-05", sampleSize: 450, sampleType: "LV", results: { Costello: 0,  Mills: 38, Platner: 43, Wood: 0 } },

  // February / March 2026
  { pollster: "Pan Atlantic Research",        endDate: "2026-03-02", sampleSize: 367, sampleType: "LV", results: { Costello: 4,  Mills: 39, Platner: 46, Wood: 0 } },

  // February 2026
  { pollster: "University of New Hampshire",  endDate: "2026-02-16", sampleSize: 462, sampleType: "LV", results: { Costello: 1,  Mills: 26, Platner: 64, Wood: 0 } },

  // December 2025
  { pollster: "Workbench Strategy**",         endDate: "2025-12-16", sampleSize: 500, sampleType: "LV", results: { Costello: 0,  Mills: 40, Platner: 55, Wood: 0 } },

  // November / December 2025
  { pollster: "Pan Atlantic Research",        endDate: "2025-12-07", sampleSize: 318, sampleType: "LV", results: { Costello: 1,  Mills: 47, Platner: 37, Wood: 0 } },

  // November 2025
  { pollster: "Z to A Research**",            endDate: "2025-11-18", sampleSize: 845, sampleType: "LV", results: { Costello: 0,  Mills: 38, Platner: 58, Wood: 0 } },

  // October 2025
  { pollster: "Maine People's Resource Center", endDate: "2025-10-29", sampleSize: 783, sampleType: "LV", results: { Costello: 0,  Mills: 39, Platner: 41, Wood: 5 } },
  { pollster: "SoCal Strategies",             endDate: "2025-10-25", sampleSize: 500, sampleType: "LV", results: { Costello: 1,  Mills: 41, Platner: 36, Wood: 2 } },
  { pollster: "NRSC**",                       endDate: "2025-10-23", sampleSize: 647, sampleType: "LV", results: { Costello: 0,  Mills: 25, Platner: 46, Wood: 3 } },
  { pollster: "University of New Hampshire",  endDate: "2025-10-21", sampleSize: 510, sampleType: "LV", results: { Costello: 1,  Mills: 24, Platner: 58, Wood: 1 } },
];
