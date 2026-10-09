// Poll data for this tracker, kept out of the client page so server code can import it.
import type { Poll } from "@/app/_polling/lib/buildDailyModel";

export const RAW_POLLS: Poll[] = [
  { pollster: "AtlasIntel", endDate: "2024-11-04", sampleSize: 2065, sampleType: "LV", results: { Harris: 49, Trump: 47 } },
  { pollster: "Research Co.", endDate: "2024-11-03", sampleSize: 450, sampleType: "LV", results: { Harris: 51, Trump: 44 } },
  { pollster: "ActiVote", endDate: "2024-11-01", sampleSize: 400, sampleType: "LV", results: { Harris: 52, Trump: 48 } },
  { pollster: "SurveyUSA", endDate: "2024-10-28", sampleSize: 728, sampleType: "LV", results: { Harris: 51, Trump: 43 } },
  { pollster: "Rasmussen Reports (R)", endDate: "2024-10-26", sampleSize: 959, sampleType: "LV", results: { Harris: 50, Trump: 47 } },
  { pollster: "CES/YouGov", endDate: "2024-10-25", sampleSize: 1275, sampleType: "LV", results: { Harris: 53, Trump: 43 } },
  { pollster: "Embold Research/MinnPost", endDate: "2024-10-22", sampleSize: 1734, sampleType: "LV", results: { Harris: 48, Trump: 45 } },
  { pollster: "ActiVote", endDate: "2024-10-09", sampleSize: 400, sampleType: "LV", results: { Harris: 53, Trump: 47 } },
  { pollster: "SurveyUSA", endDate: "2024-09-26", sampleSize: 646, sampleType: "LV", results: { Harris: 50, Trump: 44 } },
  { pollster: "Rasmussen Reports (R)", endDate: "2024-09-22", sampleSize: 993, sampleType: "LV", results: { Harris: 49, Trump: 46 } },
  { pollster: "Mason-Dixon", endDate: "2024-09-18", sampleSize: 800, sampleType: "LV", results: { Harris: 48, Trump: 43 } },
  { pollster: "Morning Consult", endDate: "2024-09-18", sampleSize: 517, sampleType: "LV", results: { Harris: 50, Trump: 43 } },
  { pollster: "Embold Research/MinnPost", endDate: "2024-09-08", sampleSize: 1616, sampleType: "LV", results: { Harris: 49, Trump: 45 } },
  { pollster: "Morning Consult", endDate: "2024-09-08", sampleSize: 501, sampleType: "LV", results: { Harris: 51, Trump: 44 } },
  { pollster: "SurveyUSA", endDate: "2024-08-29", sampleSize: 635, sampleType: "LV", results: { Harris: 48, Trump: 43 } },
  { pollster: "SurveyUSA", endDate: "2024-07-25", sampleSize: 656, sampleType: "LV", results: { Harris: 50, Trump: 40 } },
  { pollster: "Fox News", endDate: "2024-07-24", sampleSize: 1071, sampleType: "RV", results: { Harris: 52, Trump: 46 } },
];
