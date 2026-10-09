// Poll data for this tracker, kept out of the client page so server code can import it.
import type { Poll } from "@/app/_polling/lib/buildDailyModel";

export const RAW_POLLS: Poll[] = [
  { pollster: "YouGov", endDate: "2026-03-02", sampleSize: 2400, sampleType: "LV", results: { Talarico: 53, Crockett: 40 , Hassan:0 } },
  { pollster: "Emerson", endDate: "2026-02-27", sampleSize: 850, sampleType: "LV", results: { Talarico: 52, Crockett: 47, Hassan: 1 } },
  { pollster: "Public Policy Polling", endDate: "2026-02-25", sampleSize: 599, sampleType: "LV", results: { Crockett: 42, Talarico: 48, Hassan: 0 } },
  { pollster: "Chism/Blueprint", endDate: "2026-02-24", sampleSize: 472, sampleType: "LV", results: { Talarico: 52, Crockett: 40, Hassan: 0 } },
  { pollster: "Impact Research", endDate: "2026-02-12", sampleSize: 800, sampleType: "LV", results: { Crockett: 43, Talarico: 47, Hassan: 0 } },
  { pollster: "University of Texas / Texas Politics Project", endDate: "2026-02-16", sampleSize: 369, sampleType: "RV", results: { Crockett: 56, Talarico: 44, Hassan: 0 } },
  { pollster: "University of Houston", endDate: "2026-01-31", sampleSize: 550, sampleType: "LV", results: { Crockett: 47, Talarico: 39, Hassan: 2 } },
  { pollster: "TPOR", endDate: "2026-01-21", sampleSize: 1290, sampleType: "LV", results: { Crockett: 38, Talarico: 37, Hassan: 0 } },
  { pollster: "HIT Strategies", endDate: "2026-01-15", sampleSize: 1005, sampleType: "LV", results: { Crockett: 46, Talarico: 33, Hassan: 0 } },
  { pollster: "Emerson", endDate: "2026-01-12", sampleSize: 413, sampleType: "LV", results: { Crockett: 38, Talarico: 47, Hassan: 1 } },
  { pollster: "TSU", endDate: "2025-12-11", sampleSize: 1600, sampleType: "LV", results: { Crockett: 51, Talarico: 43, Hassan: 0 } },
  { pollster: "U. of Houston/TSU", endDate: "2025-10-01", sampleSize: 478, sampleType: "RV", results: { Crockett: 52, Talarico: 34, Hassan: 0 } },
  { pollster: "TPOR", endDate: "2025-08-29", sampleSize: 267, sampleType: "RV", results: { Crockett: 26, Talarico: 27, Hassan: 0 } }
];
