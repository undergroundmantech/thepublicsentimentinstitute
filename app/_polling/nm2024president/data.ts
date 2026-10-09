// Poll data for this tracker, kept out of the client page so server code can import it.
import type { Poll } from "@/app/_polling/lib/buildDailyModel";

export const RAW_POLLS: Poll[] = [
  { pollster: "Victory Insights", endDate: "2024-11-03", sampleSize: 600, sampleType: "LV", results: { Harris: 49.6, Trump: 44.7 } },
  { pollster: "KOB-TV/SurveyUSA", endDate: "2024-10-31", sampleSize: 632, sampleType: "LV", results: { Harris: 50, Trump: 44 } },
  { pollster: "Rasmussen Reports", endDate: "2024-10-26", sampleSize: 749, sampleType: "LV", results: { Harris: 49, Trump: 44 } },
  
  // --- Mid-October ---
  { pollster: "Albuquerque Journal", endDate: "2024-10-18", sampleSize: 1024, sampleType: "LV", results: { Harris: 50, Trump: 41 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-14", sampleSize: 382, sampleType: "LV", results: { Harris: 49, Trump: 45 } },
  
  // --- September ---
  { pollster: "Rasmussen Reports", endDate: "2024-09-22", sampleSize: 708, sampleType: "LV", results: { Harris: 50, Trump: 44 } },
  { pollster: "KOB-TV/SurveyUSA", endDate: "2024-09-18", sampleSize: 619, sampleType: "LV", results: { Harris: 50, Trump: 42 } },
  { pollster: "Albuquerque Journal", endDate: "2024-09-13", sampleSize: 532, sampleType: "LV", results: { Harris: 49, Trump: 39 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-09-09", sampleSize: 521, sampleType: "LV", results: { Harris: 49, Trump: 44 } },
  
  // --- August ---
  { pollster: "The Hill/Emerson College", endDate: "2024-08-22", sampleSize: 965, sampleType: "RV", results: { Harris: 52, Trump: 42 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-08-15", sampleSize: 592, sampleType: "LV", results: { Harris: 47, Trump: 41 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-08-03", sampleSize: 493, sampleType: "LV", results: { Harris: 44, Trump: 37 } }
];
