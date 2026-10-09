// Poll data for this tracker, kept out of the client page so server code can import it.
import type { Poll } from "@/app/_polling/lib/buildDailyModel";

export const RAW_POLLS: Poll[] = [
  // February 2026
  { pollster: "The American Promise", endDate: "2026-02-26", sampleSize: 800, sampleType: "LV", results: { Collins: 4, Donalds: 44, Fishback: 5, Renner: 2 } },
  { pollster: "The Public Sentiment Institute", endDate: "2026-02-20", sampleSize: 0, sampleType: "LV", results: { Collins: 12, Donalds: 30, Fishback: 8, Renner: 2 } },
  { pollster: "The Public Sentiment Institute", endDate: "2026-02-20", sampleSize: 0, sampleType: "RV", results: { Collins: 7, Donalds: 29, Fishback: 5, Renner: 1 } },
  { pollster: "University of North Florida", endDate: "2026-02-20", sampleSize: 657, sampleType: "LV", results: { Collins: 4, Donalds: 31, Fishback: 6, Renner: 1 } },
  { pollster: "Targoz Market Research**", endDate: "2026-02-16", sampleSize: 401, sampleType: "RV", results: { Collins: 15, Donalds: 33, Fishback: 3, Renner: 9 } },

  // January 2026
  { pollster: "Patriot Polling**", endDate: "2026-01-29", sampleSize: 827, sampleType: "LV", results: { Collins: 0, Donalds: 37, Fishback: 23, Renner: 0 } },
  { pollster: "Mason-Dixon Polling & Strategy", endDate: "2026-01-13", sampleSize: 400, sampleType: "RV", results: { Collins: 7, Donalds: 37, Fishback: 3, Renner: 4 } },
  { pollster: "Fabrizio, Lee & Associates**", endDate: "2026-01-06", sampleSize: 600, sampleType: "LV", results: { Collins: 6, Donalds: 45, Fishback: 4, Renner: 3 } },

  // December 2025
  { pollster: "Public Opinion Strategies**", endDate: "2025-12-11", sampleSize: 700, sampleType: "RV", results: { Collins: 13, Donalds: 40, Fishback: 0, Renner: 0 } },
  { pollster: "The Tyson Group**", endDate: "2025-12-09", sampleSize: 800, sampleType: "LV", results: { Collins: 9, Donalds: 38, Fishback: 2, Renner: 1 } },

  // November 2025
  { pollster: "The American Promise", endDate: "2025-11-19", sampleSize: 800, sampleType: "LV", results: { Collins: 1, Donalds: 43, Fishback: 0, Renner: 2 } },
  { pollster: "Victory Insights**", endDate: "2025-11-13", sampleSize: 600, sampleType: "LV", results: { Collins: 1, Donalds: 45, Fishback: 1, Renner: 3 } },

  // October 2025
  { pollster: "St. Pete Polls", endDate: "2025-10-15", sampleSize: 1034, sampleType: "LV", results: { Collins: 4, Donalds: 39, Fishback: 0, Renner: 3 } },

  // September 2025
  { pollster: "Targoz Market Research**", endDate: "2025-09-18", sampleSize: 506, sampleType: "RV", results: { Collins: 0, Donalds: 29, Fishback: 0, Renner: 9 } },
  { pollster: "The American Promise", endDate: "2025-09-05", sampleSize: 800, sampleType: "LV", results: { Collins: 2, Donalds: 40, Fishback: 0, Renner: 2 } },
];
