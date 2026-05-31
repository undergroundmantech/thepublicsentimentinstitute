import { Poll } from "@/app/polling/lib/buildDailyModel";

// KY-04 Republican Primary (Gallrein vs Massie).
// Relocated out of app/page.tsx when the homepage became the editorial
// landing page; aggregates.ts and the polling pages import it from here.
export const KY04_POLLS: Poll[] = [
  // Big Data Poll Apr 3–7 (forced choice, no undecided)
  { pollster: "Big Data Poll (R)",        endDate: "2026-04-07", sampleSize: 433, sampleType: "LV", results: { Gallrein: 48, Massie: 52 } },
  // Quantus Insights Apr 6–7
  { pollster: "Quantus Insights (R)",     endDate: "2026-04-07", sampleSize: 438, sampleType: "LV", results: { Gallrein: 38, Massie: 47 } },
  // Big Data Poll May 12–14 (forced choice)
  { pollster: "Big Data Poll (R)",        endDate: "2026-05-14", sampleSize: 518, sampleType: "LV", results: { Gallrein: 49, Massie: 51 } },
  // Neighborhood Research & Media May 12–15 (39/39 tie, undecideds excluded from two-way)
  { pollster: "Neighborhood R&M (R)",     endDate: "2026-05-15", sampleSize: 291, sampleType: "LV", results: { Gallrein: 50, Massie: 50 } },
  // Quantus Insights May 11–12 (standard ballot with undecideds — 48/43/8%)
  { pollster: "Quantus Insights (R)",     endDate: "2026-05-12", sampleSize: 908, sampleType: "LV", results: { Gallrein: 53, Massie: 45 } },
  // SoCal Strategies May 15–16
  { pollster: "SoCal Strategies (R)",     endDate: "2026-05-16", sampleSize: 450, sampleType: "LV", results: { Gallrein: 54, Massie: 46 } },
];
