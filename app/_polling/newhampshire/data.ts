// Poll data for this tracker, kept out of the client page so server code can import it.
import type { Poll } from "@/app/_polling/lib/buildDailyModel";

export const RAW_POLLS: Poll[] = [
{ pollster: "Dartmouth College", endDate: "2024-11-03", sampleSize: 587, sampleType: "LV", results: { Harris: 62, Trump: 34 } },

{ pollster: "University of New Hampshire", endDate: "2024-11-02", sampleSize: 2814, sampleType: "LV", results: { Harris: 51, Trump: 46 } },
{ pollster: "Saint Anselm College", endDate: "2024-10-29", sampleSize: 2791, sampleType: "LV", results: { Harris: 51, Trump: 46 } },

{ pollster: "Rasmussen Reports", endDate: "2024-10-28", sampleSize: 901, sampleType: "LV", results: { Harris: 48, Trump: 47 } },

{ pollster: "Praecones Analytica/NHJournal", endDate: "2024-10-26", sampleSize: 622, sampleType: "RV", results: { Harris: 50, Trump: 50 } },

{ pollster: "Emerson College", endDate: "2024-10-23", sampleSize: 915, sampleType: "LV", results: { Harris: 50, Trump: 47 } },

{ pollster: "UMass Lowell", endDate: "2024-10-23", sampleSize: 600, sampleType: "LV", results: { Harris: 50, Trump: 43 } },

{ pollster: "UMass Lowell", endDate: "2024-10-10", sampleSize: 600, sampleType: "LV", results: { Harris: 50, Trump: 41 } },

{ pollster: "Dartmouth College", endDate: "2024-10-18", sampleSize: 2211, sampleType: "RV", results: { Harris: 59, Trump: 38 } },

{ pollster: "CES/YouGov", endDate: "2024-10-25", sampleSize: 375, sampleType: "LV", results: { Harris: 52, Trump: 45 } },

{ pollster: "Saint Anselm College", endDate: "2024-10-02", sampleSize: 2104, sampleType: "LV", results: { Harris: 51, Trump: 44 } },

{ pollster: "University of New Hampshire", endDate: "2024-09-16", sampleSize: 1695, sampleType: "LV", results: { Harris: 54, Trump: 43 } },

{ pollster: "Saint Anselm College", endDate: "2024-09-12", sampleSize: 2241, sampleType: "LV", results: { Harris: 51, Trump: 43 } },

{ pollster: "University of New Hampshire", endDate: "2024-08-19", sampleSize: 2048, sampleType: "LV", results: { Harris: 52, Trump: 47 } },

{ pollster: "Emerson College", endDate: "2024-07-28", sampleSize: 1000, sampleType: "RV", results: { Harris: 50, Trump: 46 } },

{ pollster: "Saint Anselm College", endDate: "2024-07-25", sampleSize: 2083, sampleType: "RV", results: { Harris: 50, Trump: 44 } },

{ pollster: "University of New Hampshire", endDate: "2024-07-25", sampleSize: 2875, sampleType: "LV", results: { Harris: 53, Trump: 46 } }
];
