// The analysis desk: long form pieces written by On Point Politics from its own polling, forecasts and results.
// Each article reads its numbers from the same data files the forecast and accuracy pages publish.
export type ArticleMeta = { slug: string; title: string; dek: string; published: string; modified: string; read: number; tag: string };

export const ARTICLES: ArticleMeta[] = [
  { slug: "who-votes-in-2028", tag: "2028", title: "Who votes in 2028: what vote history says about the next electorate",
    dek: "The On Point electorate model splits every county into 1,152 groups by age, race, education, gender, party and how often each group votes. Here is what that says about the 2028 turnout fight.",
    published: "2026-11-10", modified: "2026-11-10", read: 8 },
  { slug: "2028-first-look", tag: "2028", title: "The first On Point presidential forecast: where 2028 starts",
    dek: "Democrats begin the 2028 cycle as clear favorites in the On Point model, but the map that decides it is the same six states as 2024. A walk through the numbers and what could change them.",
    published: "2026-11-10", modified: "2026-11-10", read: 9 },
  { slug: "2026-forecast-review", tag: "2026", title: "What we got right and wrong in 2026",
    dek: "A plain account of the On Point forecast against the count: the chambers, the races we missed, where the errors clustered, and what we are changing because of them.",
    published: "2026-11-10", modified: "2026-11-10", read: 9 },
  { slug: "what-a-forecast-probability-means", tag: "Method", title: "What a 70 percent chance really means, checked against 479 races",
    dek: "Forecast probabilities are promises about how often favorites win. We grouped every 2026 race by the chance we gave the favorite and counted how often each group came through.",
    published: "2026-11-10", modified: "2026-11-10", read: 7 },
];
export const articleBySlug = (s: string) => ARTICLES.find((a) => a.slug === s)!;
export const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
