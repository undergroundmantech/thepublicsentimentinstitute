// Texas Senate general election polls, shared by the polling hub and the averages.
import type { Poll } from "@/app/_polling/lib/buildDailyModel";

export const TX_CORNYN_POLLS: Poll[] = [
  { pollster: "Impact Research (D)",                  endDate: "2026-03-17", sampleSize: 900,  sampleType: "LV", results: { Republican: 41, Democrat: 43 } },
  { pollster: "Public Policy Polling (D)",            endDate: "2026-03-05", sampleSize: 576,  sampleType: "RV", results: { Republican: 43, Democrat: 44 } },
  { pollster: "University of Houston/YouGov",         endDate: "2026-01-31", sampleSize: 1502, sampleType: "LV", results: { Republican: 44, Democrat: 43 } },
  { pollster: "Emerson College",                      endDate: "2026-01-12", sampleSize: 1165, sampleType: "RV", results: { Republican: 47, Democrat: 44 } },
  { pollster: "Ragnar Research Partners (R)",         endDate: "2025-11-17", sampleSize: 1000, sampleType: "LV", results: { Republican: 46, Democrat: 40 } },
  { pollster: "Univ. of Houston/Texas Southern Univ.",endDate: "2025-10-01", sampleSize: 1650, sampleType: "RV", results: { Republican: 48, Democrat: 45 } },
  { pollster: "UT Tyler",                             endDate: "2025-09-24", sampleSize: 1032, sampleType: "RV", results: { Republican: 41, Democrat: 35 } },
];

export const TX_PAXTON_POLLS: Poll[] = [
  { pollster: "Impact Research (D)",                  endDate: "2026-03-17", sampleSize: 900,  sampleType: "LV", results: { Republican: 43, Democrat: 44 } },
  { pollster: "Public Policy Polling (D)",            endDate: "2026-03-05", sampleSize: 576,  sampleType: "RV", results: { Republican: 45, Democrat: 47 } },
  { pollster: "University of Houston/YouGov",         endDate: "2026-01-31", sampleSize: 1502, sampleType: "LV", results: { Republican: 46, Democrat: 44 } },
  { pollster: "Emerson College",                      endDate: "2026-01-12", sampleSize: 1165, sampleType: "RV", results: { Republican: 46, Democrat: 46 } },
  { pollster: "Ragnar Research Partners (R)",         endDate: "2025-11-17", sampleSize: 1000, sampleType: "LV", results: { Republican: 44, Democrat: 44 } },
  { pollster: "Univ. of Houston/Texas Southern Univ.",endDate: "2025-10-01", sampleSize: 1650, sampleType: "RV", results: { Republican: 49, Democrat: 46 } },
  { pollster: "UT Tyler",                             endDate: "2025-09-24", sampleSize: 1032, sampleType: "RV", results: { Republican: 38, Democrat: 37 } },
];
