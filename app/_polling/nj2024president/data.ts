// Poll data for this tracker, kept out of the client page so server code can import it.
import type { Poll } from "@/app/_polling/lib/buildDailyModel";

export const RAW_POLLS: Poll[] = [
 // --- Final Pre-Election Polls ---
  { pollster: "Research Co.", endDate: "2024-11-03", sampleSize: 450, sampleType: "LV", results: { Harris: 57, Trump: 40 } },
  { pollster: "ActiVote", endDate: "2024-10-28", sampleSize: 400, sampleType: "LV", results: { Harris: 57, Trump: 43 } },
  { pollster: "Cygnal (R)", endDate: "2024-10-24", sampleSize: 600, sampleType: "LV", results: { Harris: 52, Trump: 40 } },
  
  // --- Mid-October ---
  { pollster: "Rutgers-Eagleton", endDate: "2024-10-22", sampleSize: 929, sampleType: "RV", results: { Harris: 55, Trump: 35 } },
  { pollster: "Rutgers-Eagleton", endDate: "2024-10-22", sampleSize: 478, sampleType: "RV", results: { Harris: 51, Trump: 37 } },
  
  // --- September ---
  { pollster: "ActiVote", endDate: "2024-10-02", sampleSize: 400, sampleType: "LV", results: { Harris: 56, Trump: 44 } }
];
