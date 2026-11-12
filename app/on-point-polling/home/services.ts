// Every On Point Polling service in one place. The polling hub, the services index and each service page read this
// list, so names, scope and deliverables never drift between pages. Copy is written for buyers who search: say what
// it is, what arrives, how fast and for whom.
export type Group = "research" | "analytics" | "data";
export type Service = {
  slug: string; group: Group; name: string; kicker: string; short: string; intro: string;
  deliver: string[]; scope: { k: string; v: string }[]; forWho: string; how: string[];
  faq: { q: string; a: string }[]; keywords: string[]; media?: Media;
};
export type Media = { src: string; poster: string; w: number; h: number; label: string; alt: string };

export const CONTACT = "onpointpoliticscontact@gmail.com";
export const mailto = (subject: string) => `mailto:${CONTACT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent("Organization:\nService:\nRace or topic:\nGeography:\nSample size or budget:\nTimeline:\n")}`;
const M = "/on-point-polling/media";
export const MEDIA = {
  desk: { src: `${M}/county-desk-assistant`, poster: `${M}/county-desk-assistant.jpg`, w: 1280, h: 888, label: "County Desk with the scenario assistant", alt: "On Point County Desk running 10,000 simulated elections for Pennsylvania while the scenario assistant answers what if questions about turnout and swing" },
  states: { src: `${M}/county-desk-states`, poster: `${M}/county-desk-states.jpg`, w: 1280, h: 888, label: "Any state, county by county", alt: "On Point County Desk switching between Arizona, Georgia, Michigan, Wisconsin, North Carolina, Texas and Nebraska county maps" },
  weight: { src: `${M}/weighting-dashboard`, poster: `${M}/weighting-dashboard.jpg`, w: 1280, h: 888, label: "Weighting Dashboard", alt: "On Point Weighting Dashboard raking a sample to voter file targets, scoring likely voters and leaning undecided voters" },
} satisfies Record<string, Media>;

export const GROUPS: { id: Group; name: string; blurb: string }[] = [
  { id: "research", name: "Survey research", blurb: "Polls built on the voter file and weighted with the method behind our 2026 record." },
  { id: "analytics", name: "Modeling and dashboards", blurb: "County simulations, likely voter models and private dashboards your team can work in." },
  { id: "data", name: "Data and fieldwork", blurb: "Voter file samples, quotas and text to web fieldwork for teams that run their own research." },
];

export const SERVICES: Service[] = [
  {
    slug: "one-time-poll", group: "research", name: "One time poll", kicker: "Benchmark and horse race surveys",
    short: "A statewide, district or national survey on your race and your questions, with leaned likely voter results and full crosstabs.",
    intro: "A single survey designed around the decision in front of you: where the race stands, which issues move voters and how each candidate is seen. Every poll is weighted to the voter file and reported among registered and likely voters, with undecided voters leaned.",
    deliver: ["Leaned likely voter and registered voter toplines", "Full crosstabs by age, gender, race, education, region and party", "A written memo with the read and the risks", "The weighted data file and a walkthrough call"],
    scope: [{ k: "Turnaround", v: "48 to 72 hours in field" }, { k: "Typical sample", v: "500 to 1,500 interviews" }, { k: "Geography", v: "National, statewide, district, county, city" }, { k: "Modes", v: "Text to web on the voter file, online panel" }],
    forWho: "Campaigns, party committees, PACs, ballot measure campaigns, newsrooms and public affairs teams.",
    how: ["Scope call and same day quote", "Questionnaire written with you", "Fieldwork on the voter file", "Weighting, memo and delivery"],
    faq: [
      { q: "How long does a one time poll take?", a: "Most polls field in 48 to 72 hours from an approved questionnaire, with toplines and crosstabs delivered shortly after fieldwork closes." },
      { q: "What sample size do I need?", a: "Most statewide polls use 500 to 1,000 interviews and national polls 1,000 to 1,500. We size the sample to the subgroups you need to read with confidence." },
      { q: "Are results released publicly?", a: "Only if you choose. Private work stays private, and any public release discloses the sponsor." },
    ],
    keywords: ["one time poll", "benchmark poll", "horse race poll", "statewide poll", "district poll", "campaign poll"],
  },
  {
    slug: "tracking-polls", group: "research", name: "Monthly and quarterly tracking", kicker: "Tracking programs",
    short: "The same core questionnaire on a schedule you set, weighted to locked targets so the movement you see is real.",
    intro: "A tracking program measures the same questions wave after wave so you can see a race or an issue move. Weighting targets and the likely voter anchor are set before the first wave, so changes come from voters, not from the method.",
    deliver: ["A dashboard with trend lines across every wave", "Leaned toplines and crosstabs each wave", "Room for new questions each wave", "Priority fielding when news breaks"],
    scope: [{ k: "Cadence", v: "Monthly or quarterly" }, { k: "Waves", v: "12 or 4 a year" }, { k: "Typical sample", v: "600 to 1,200 per wave" }, { k: "Commitment", v: "A season or a full cycle" }],
    forWho: "Committees, advocacy groups, companies and media partners who need a steady read through a cycle.",
    how: ["Core questionnaire and locked targets", "Wave schedule set with you", "Each wave weighted the same way", "Trend report and call after each wave"],
    faq: [
      { q: "What is a tracking poll?", a: "A tracking poll asks the same questions at regular intervals, weighted the same way each time, so you can measure change rather than noise." },
      { q: "Can we add questions between waves?", a: "Yes. The core stays fixed for trend lines, and each wave has room for new questions on what is happening that month." },
    ],
    keywords: ["tracking poll", "monthly tracking poll", "quarterly polling", "brand tracking survey", "issue tracking survey"],
  },
  {
    slug: "message-testing", group: "research", name: "Message and ballot testing", kicker: "Experiments",
    short: "Randomized ballot and message experiments that show which arguments move which voters, and which ones backfire.",
    intro: "Message tests split the sample at random and show each half a different argument, then measure the change in support. You see what persuades, who it persuades and what it costs you elsewhere, before the money is spent.",
    deliver: ["Effect of each message on the ballot", "Results by persuadable group", "Backfire and intensity checks", "A ranked list of messages with a memo"],
    scope: [{ k: "Design", v: "Randomized split samples" }, { k: "Messages", v: "Up to 8 per test" }, { k: "Typical sample", v: "1,000 to 2,000 interviews" }, { k: "Turnaround", v: "About a week" }],
    forWho: "Campaigns, ballot measure committees, advocacy groups and corporate affairs teams.",
    how: ["Agree the messages and the outcome", "Randomize and field", "Estimate effects by group", "Rank and recommend"],
    faq: [
      { q: "What is an informed ballot test?", a: "Voters answer the ballot, read an argument, then answer again. The change shows how much that argument moves them, compared with a group that read nothing." },
    ],
    keywords: ["message testing", "ballot test", "informed ballot", "persuasion research", "message testing survey"],
  },
  {
    slug: "county-desk", group: "analytics", name: "County Desk with a scenario assistant", kicker: "AI county simulations",
    short: "Your poll inside a county by county model of any state, simulated 10,000 times, with an assistant that answers what if questions in plain English.",
    intro: "The County Desk turns a poll into a forecast for every county in the state. Each run draws a statewide error, a regional error and a county error, so you see the full range of outcomes. Type a question such as what if turnout in the largest county drops eight percent, and the desk reruns the race and tells you what changed.",
    deliver: ["Win chance, the range of outcomes and expected votes", "Every county mapped with its chance to flip", "A scenario assistant for turnout, swing and polling error", "The counties that decide the race, ranked"],
    scope: [{ k: "Coverage", v: "All 50 states and every county" }, { k: "Simulations", v: "10,000 per run" }, { k: "Scenarios", v: "County, region, metro, rural or voter group" }, { k: "Access", v: "Private to your team" }],
    forWho: "Campaign leadership, data directors, committees and investors who need to plan against more than one outcome.",
    how: ["Your poll sets the statewide input", "Counties start from their last result", "The desk simulates every county", "Ask the assistant and compare scenarios"],
    faq: [
      { q: "What can I ask the scenario assistant?", a: "Turnout changes and swings for a county, a region, metro or rural areas or a group of voters such as young voters or independents, plus polling error, the counties that decide the race and what it takes to flip the state." },
      { q: "Is my data shared?", a: "No. Dashboards are delivered privately, and voter files load from your computer without being sent anywhere." },
    ],
    keywords: ["county level election forecast", "election simulation", "AI election model", "what if election scenarios", "county by county forecast"],
    media: MEDIA.desk,
  },
  {
    slug: "weighting-dashboard", group: "analytics", name: "Weighting Dashboard", kicker: "DSMeridian weighting",
    short: "Weight a poll in the open: rake to voter file targets, score likely voters and lean undecideds, with every diagnostic on screen.",
    intro: "The Weighting Dashboard runs our published method on your sample. It rakes to registered voter targets from the voter file, scores each respondent's likelihood to vote from engagement and vote history, and leans undecided voters on how they answer the survey. The design effect, the effective sample and the turnout anchor are always visible.",
    deliver: ["Raking to voter file targets with trimming", "A likely voter curve with an exposed turnout anchor", "Undecided voters leaned on survey answers only", "Leaned toplines, crosstabs and a weights file"],
    scope: [{ k: "Inputs", v: "Your poll file and voter file targets" }, { k: "Stages", v: "Electorate, likely voters, allocation" }, { k: "Diagnostics", v: "Design effect, effective n, weight range" }, { k: "Output", v: "Weights CSV and crosstabs" }],
    forWho: "Pollsters, data teams and researchers who field their own surveys and want a transparent weighting audit.",
    how: ["Load the poll and map columns", "Set targets from the voter file", "Score likely voters and lean undecideds", "Export weights and crosstabs"],
    faq: [
      { q: "Does the dashboard weight by recalled 2024 vote?", a: "No. Recalled vote is a diagnostic only and is never set as a likely voter target." },
      { q: "How are undecided voters allocated?", a: "On how they answer the survey, such as approval questions. Not on vote history alone, not on demographics directly and not on past vote." },
    ],
    keywords: ["poll weighting", "survey weighting software", "raking weights", "likely voter model", "weighting dashboard"],
    media: MEDIA.weight,
  },
  {
    slug: "likely-voter-modeling", group: "analytics", name: "Likely voter modeling and MRP", kicker: "Modeling",
    short: "The Meridian likely voter model on your sample or your universe, and MRP estimates for counties and districts.",
    intro: "Our likely voter model combines survey engagement with validated vote history and turns the score into a probability of voting. MRP carries a statewide sample down to counties and districts so you can read places the sample alone cannot.",
    deliver: ["A likely voter score for every respondent or record", "Turnout projections with the anchor stated", "County and district estimates with MRP", "A method note your team can audit"],
    scope: [{ k: "Inputs", v: "Survey responses and vote history" }, { k: "Geography", v: "State, county, district" }, { k: "Turnout", v: "Bounded by the voter file and early vote" }, { k: "Turnaround", v: "Days" }],
    forWho: "Campaigns and committees planning turnout and targeting, and researchers who need small area estimates.",
    how: ["Score engagement and history", "Set the turnout anchor before results", "Fit the model and MRP", "Report with the assumptions exposed"],
    faq: [{ q: "What is MRP?", a: "Multilevel regression and poststratification models opinion from a sample, then weights it to the real population of each county or district to estimate places the sample cannot read directly." }],
    keywords: ["likely voter model", "MRP polling", "turnout modeling", "small area estimation", "voter propensity model"],
  },
  {
    slug: "election-night-desk", group: "analytics", name: "Election night desk", kicker: "Results and calls",
    short: "A live county results desk built on your polling, with expected vote and race calls for your audience or your war room.",
    intro: "On election night the desk compares each county's count with what the model expected, estimates the vote still out and shows when a race can be called. We called every state live on election night in 2026 with VT Analytics for an audience of millions.",
    deliver: ["Live county maps and expected vote", "Remaining vote estimates by county", "Call thresholds and a call log", "Branded graphics for broadcast or stream"],
    scope: [{ k: "Coverage", v: "Any statewide or national race" }, { k: "Inputs", v: "Your polling and the county model" }, { k: "Delivery", v: "Live desk and graphics" }, { k: "Team", v: "Analyst support on the night" }],
    forWho: "Campaign war rooms, media outlets and streamers covering election night.",
    how: ["Model each county before the night", "Connect the live count", "Estimate the vote still out", "Call races with stated thresholds"],
    faq: [{ q: "Can the desk run on our own stream?", a: "Yes. The desk and its graphics can be branded and run on your broadcast or stream." }],
    keywords: ["election night desk", "election results dashboard", "race calls", "expected vote model"],
  },
  {
    slug: "voter-file-fieldwork", group: "data", name: "Voter file sampling and fieldwork", kicker: "With L2 voter data",
    short: "Samples drawn from the L2 voter file, registered voter benchmarks, quotas and text to web fieldwork matched back to each record.",
    intro: "Every On Point poll starts from the voter file. We draw the sample from L2 voter data, build registered voter benchmarks from the file itself, set quotas so hard to reach groups are in the sample and field by text to web, with online panel only to fill gaps.",
    deliver: ["Registered voter benchmarks from the file", "A stratified draw with quotas", "Text to web fieldwork and panel fill", "Responses matched back to the voter record"],
    scope: [{ k: "Data", v: "L2 voter file" }, { k: "Fieldwork", v: "Text to web, online panel" }, { k: "Survey platform", v: "Alchemer and Qualtrics" }, { k: "Compliance", v: "Registered texting program" }],
    forWho: "Campaigns and organizations that want voter file grade samples, with or without our analysis.",
    how: ["Pick the universe", "Build benchmarks and quotas", "Draw and field", "Match back and deliver"],
    faq: [{ q: "Why poll from the voter file?", a: "Because the sample can be checked against the real registered population, and responses can be matched back to validated vote history for the likely voter model." }],
    keywords: ["voter file polling", "L2 voter data", "text to web survey", "SMS polling", "registration based sampling"],
  },
];

export const svcHref = (s: Service) => `/on-point-polling/services/${s.slug}`;

export const PARTNERS: { name: string; role: string }[] = [
  { name: "L2 Data", role: "Voter file data" },
  { name: "Tigre Strategics", role: "Strategy partner" },
  { name: "Alchemer", role: "Survey platform" },
  { name: "On Point Weighting Dashboard", role: "Weighting platform" },
];
