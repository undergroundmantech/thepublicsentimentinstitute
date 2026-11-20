// Every On Point Polling service in one place. The polling hub, the services index and each service page read this
// list, so names, scope and deliverables never drift between pages. Copy is written for buyers who search: say what
// it is, what arrives, how fast and for whom.
export type Group = "research" | "strategy" | "analytics" | "data" | "media";
export type Service = {
  slug: string; group: Group; name: string; kicker: string; short: string; intro: string;
  deliver: string[]; scope: { k: string; v: string }[]; forWho: string; how: string[];
  faq: { q: string; a: string }[]; keywords: string[]; media?: Media;
  /** the moments a buyer reaches for this service */
  when: string[];
  /** how the work is done, in a paragraph a research director can check */
  method: string;
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
  { id: "research", name: "Polling", blurb: "Benchmark, tracking, issue and omnibus surveys built on the voter file and weighted with the method behind our 2026 record." },
  { id: "strategy", name: "Campaign strategy research", blurb: "Research for the decisions that shape a campaign: whether to run, what to say, whom to reach and what went wrong." },
  { id: "analytics", name: "Modeling and dashboards", blurb: "County simulations, likely voter models, MRP and private dashboards your team can work in." },
  { id: "data", name: "Data and fieldwork", blurb: "Voter file samples, text to web fieldwork and white label collection for teams that run their own research." },
  { id: "media", name: "Media and public affairs", blurb: "Commissioned polls for newsrooms and opinion research for companies, associations and public affairs teams." },
];

export const SERVICES: Service[] = [
  {
    slug: "one-time-poll", group: "research", name: "Benchmark and horse race polls", kicker: "One time survey",
    short: "A statewide, district, county, city or national survey on your race and your questions, with leaned likely voter results and full crosstabs.",
    intro: "A single survey designed around the decision in front of you: where the race stands, which issues move voters and how each candidate is seen. Every poll is weighted to the voter file and reported among registered and likely voters, with undecided voters leaned so the topline reads like the ballot.",
    when: ["Before you launch, to set a baseline the rest of the campaign is measured against", "Before a budget decision, a donor meeting or an endorsement push", "After a debate, a scandal or a big ad buy, to see what changed", "When public polling on your race is thin, old or partisan"],
    method: "We draw the sample from the L2 voter file for your geography, set quotas on age, gender, race, education and region, and field by text to web with online panel only to fill groups that are hard to reach. Results are raked to registered voter targets from the same file, scored with our likely voter model and leaned on how undecided voters answer the rest of the survey. You see both the leaned and the as asked numbers.",
    deliver: ["Leaned likely voter and registered voter toplines", "Full crosstabs by age, gender, race, education, region and party", "Favorability, job approval and issue batteries", "A written memo with the read, the risks and the path", "The weighted data file and a walkthrough call"],
    scope: [{ k: "Turnaround", v: "48 to 72 hours in field" }, { k: "Typical sample", v: "400 to 1,500 interviews" }, { k: "Geography", v: "National, statewide, district, county, city" }, { k: "Modes", v: "Text to web on the voter file, online panel" }],
    forWho: "Candidates, party committees, PACs, ballot measure campaigns, newsrooms and public affairs teams.",
    how: ["Scope call and same day quote", "Questionnaire written with you", "Fieldwork on the voter file", "Weighting, memo and delivery"],
    faq: [
      { q: "How long does a benchmark poll take?", a: "Most polls field in 48 to 72 hours from an approved questionnaire, with toplines and crosstabs delivered shortly after fieldwork closes. A full benchmark with a memo usually runs about a week from the first call." },
      { q: "What sample size do I need?", a: "Most statewide polls use 500 to 1,000 interviews, congressional districts 400 to 600 and national polls 1,000 to 1,500. We size the sample to the subgroups you need to read with confidence and tell you the margin of error before you approve." },
      { q: "Can you poll a state legislative, county or city race?", a: "Yes. Because the sample comes from the voter file, we can poll any district or jurisdiction with enough registered voters, including legislative districts, county commissions, mayoral races and school boards." },
      { q: "Are results released publicly?", a: "Only if you choose. Private work stays private, and any public release discloses the sponsor." },
    ],
    keywords: ["benchmark poll", "horse race poll", "campaign poll", "hire a pollster", "statewide poll", "congressional district poll", "state legislative poll", "city council poll", "mayoral race poll"],
  },
  {
    slug: "tracking-polls", group: "research", name: "Tracking programs", kicker: "Weekly, monthly or quarterly waves",
    short: "The same core questionnaire on a schedule you set, weighted to locked targets so the movement you see is real.",
    intro: "A tracking program measures the same questions wave after wave so you can see a race or an issue move. Weighting targets and the likely voter anchor are set before the first wave, so changes come from voters, not from the method.",
    when: ["Through a primary or a general election, from benchmark to the final weeks", "When paid media is running and you need to see whether it is working", "For a committee or a group that briefs donors or members every month", "For an issue campaign that runs across a legislative session"],
    method: "The core questionnaire, the weighting targets and the likely voter anchor are locked before wave one and only change with a documented reason. Each wave carries rotating questions on what is happening that month. In the closing weeks waves can move to weekly with a rolling sample.",
    deliver: ["A private dashboard with trend lines across every wave", "Leaned toplines and crosstabs each wave", "Room for new questions each wave", "Priority fielding when news breaks", "A short trend memo after every wave"],
    scope: [{ k: "Cadence", v: "Weekly, monthly or quarterly" }, { k: "Typical sample", v: "500 to 1,200 per wave" }, { k: "Commitment", v: "A season or a full cycle" }, { k: "Geography", v: "National, statewide or district" }],
    forWho: "Campaigns, party committees, PACs, advocacy groups, companies and media partners who need a steady read through a cycle.",
    how: ["Core questionnaire and locked targets", "Wave schedule set with you", "Each wave weighted the same way", "Trend report and call after each wave"],
    faq: [
      { q: "What is a tracking poll?", a: "A tracking poll asks the same questions at regular intervals, weighted the same way each time, so you can measure change rather than noise." },
      { q: "Can we add questions between waves?", a: "Yes. The core stays fixed for trend lines, and each wave has room for new questions on what is happening that month." },
      { q: "Is a tracking program cheaper per wave than separate polls?", a: "Yes. Programs are quoted for the whole schedule, so each wave costs less than a one time poll of the same size." },
    ],
    keywords: ["tracking poll", "campaign tracking poll", "monthly tracking poll", "weekly tracking poll", "quarterly polling", "issue tracking survey"],
  },
  {
    slug: "issue-ballot-measure-polling", group: "research", name: "Issue and ballot measure polling", kicker: "Policy, initiatives and referendums",
    short: "Where voters stand on an issue or a measure, tested with the exact ballot language they will read and the arguments they will hear.",
    intro: "Issue and ballot measure polls measure support at the level voters actually decide: the exact title and summary on the ballot, then again after the strongest arguments for and against. You learn whether a measure can pass, how much support is soft and which wording or argument changes the result.",
    when: ["Before filing or qualifying an initiative, to decide whether to spend on signatures", "When choosing between ballot titles or summaries", "Before a legislative fight, to show members where their own voters stand", "During the campaign, to track a measure against the opposition's message"],
    method: "Voters read the measure as it will appear, answer, then hear balanced arguments from each side and answer again. Wording tests split the sample at random so each version is read by a comparable group. Results are reported among likely voters for the election the measure is on, because measure electorates differ from the electorate in a presidential year.",
    deliver: ["Support on the exact ballot language", "Informed vote after arguments for and against", "Wording tests between titles or summaries", "Results by party, region and persuadable groups", "A memo on whether it passes and what moves it"],
    scope: [{ k: "Typical sample", v: "600 to 1,200 interviews" }, { k: "Wording tests", v: "Up to 4 versions per poll" }, { k: "Geography", v: "Statewide, county or city" }, { k: "Turnaround", v: "About a week" }],
    forWho: "Ballot measure committees, advocacy groups, unions, associations, companies and legislators.",
    how: ["Agree the language and the arguments", "Randomize wordings and field", "Read the initial and informed vote", "Recommend wording and message"],
    faq: [
      { q: "Should a ballot measure poll use the exact ballot language?", a: "Yes. Voters respond to the words on the ballot, and small changes in a title can move support by several points. We test the language as written and any alternatives you are considering." },
      { q: "What is an informed vote?", a: "The vote after respondents hear the main arguments on each side. The gap between the initial and informed vote shows how much support is soft and which side the campaign favors." },
    ],
    keywords: ["ballot measure poll", "ballot initiative polling", "referendum poll", "issue polling", "policy polling", "ballot language test"],
  },
  {
    slug: "omnibus-questions", group: "research", name: "Omnibus questions on the national poll", kicker: "Buy a question",
    short: "Place your own questions on On Point's national registered voter poll and get results, crosstabs and the weighted data for a fraction of a full survey.",
    intro: "Our national poll fields on a regular schedule among registered voters across the country. Omnibus clients add their own questions to it and share the cost of fieldwork, so a single question or a short battery gets national, weighted results without commissioning a full survey.",
    when: ["You need one or two national numbers for a report, a pitch or a release", "You want a quick read on a message or a name before a bigger study", "You are a newsroom, group or company testing whether a topic has public interest", "You need a national comparison point for a state poll"],
    method: "Your questions run inside the national instrument with the same sample, the same weighting and the same likely voter screen as our published polls. Questions are placed to avoid order effects from our own battery. Results are private unless you choose to release them, and any release names you as the sponsor.",
    deliver: ["Results for your questions among registered and likely voters", "Crosstabs by age, gender, race, education, region and party", "Our ballot, approval and right track measures as covariates", "The weighted data for your questions"],
    scope: [{ k: "Sample", v: "National registered voters" }, { k: "Questions", v: "One question or a short battery" }, { k: "Schedule", v: "Each national wave" }, { k: "Turnaround", v: "Results days after field" }],
    forWho: "Advocacy groups, companies, associations, newsrooms, PACs and researchers who need national numbers on a budget.",
    how: ["Send the questions", "We review wording and placement", "Fielded with the next national wave", "Results, crosstabs and data delivered"],
    faq: [
      { q: "What is an omnibus poll?", a: "A shared survey where several clients each add questions to one national sample. Each client pays for its own questions and sees only its own results." },
      { q: "Will other clients see my questions?", a: "No. Each client's questions and results are private to that client." },
    ],
    keywords: ["omnibus poll", "omnibus survey", "national poll question", "buy a poll question", "shared national survey"],
  },
  {
    slug: "candidate-viability", group: "strategy", name: "Should I Run viability study", kicker: "Candidate viability",
    short: "Before you announce: name recognition, image, the field, the electorate and a path to win, tested on the voters who will decide the race.",
    intro: "A viability study answers the question every candidate asks first. We measure your name recognition and image against likely opponents, test your biography and positions with the voters who will decide the nomination and the general, and model the electorate so you can see whether a path to win exists before you raise a dollar.",
    when: ["Before deciding to run for a seat", "Before a donor or party meeting where you need numbers", "When choosing between two offices or two cycles", "When an incumbent retires and the field is forming"],
    method: "We poll the primary electorate and the general electorate for the seat from the voter file, test name recognition and favorability for you and each likely opponent, run informed ballots with short biographies, and estimate the turnout you will face. The read is honest: if the path is not there, the memo says so.",
    deliver: ["Name recognition and favorability against the likely field", "Primary and general election ballots, initial and informed", "The strongest and weakest parts of your profile", "A turnout estimate for the primary and the general", "A viability memo with a go, wait or no read"],
    scope: [{ k: "Electorates", v: "Primary and general" }, { k: "Typical sample", v: "400 to 800 interviews" }, { k: "Geography", v: "Any district or statewide" }, { k: "Turnaround", v: "About a week" }],
    forWho: "Prospective candidates for Congress, statewide office, the legislature and local office, and the parties and groups recruiting them.",
    how: ["Confidential scope call", "Field the primary and general electorates", "Model turnout and the paths", "Viability memo and a walkthrough"],
    faq: [
      { q: "Is a viability poll confidential?", a: "Yes. Viability work is private to the client, and we do not disclose that a study was done." },
      { q: "Can a viability poll be paid for before I am a candidate?", a: "Testing the waters is covered by FEC rules for federal offices and by state law for state and local offices. Ask your counsel how to pay for it; we provide dated invoices and field dates for the record." },
    ],
    keywords: ["should I run poll", "candidate viability poll", "exploratory poll", "testing the waters poll", "poll before running for office", "name recognition poll"],
  },
  {
    slug: "message-testing", group: "strategy", name: "Message and ad testing", kicker: "Randomized experiments",
    short: "Randomized ballot, message and ad experiments that show which arguments move which voters, and which ones backfire.",
    intro: "Message tests split the sample at random and show each group a different argument, contrast or ad script, then measure the change in support. You see what persuades, who it persuades and what it costs you elsewhere, before the money is spent.",
    when: ["Before a paid media buy, to choose the message and the audience", "When an attack lands and you need to know whether to answer it", "Before a mail or digital program, to pick the strongest contrast", "When the board, the donors or the consultants disagree on the message"],
    method: "Each respondent is randomly assigned to a control group or to one message or script, and the effect is the difference in support between groups. Because assignment is random, the effect is causal, not a correlation. We report the effect overall and among the persuadable groups you care about, with the uncertainty stated.",
    deliver: ["The effect of each message on the ballot", "Results among persuadable and base voters", "Backfire and intensity checks", "A ranked list of messages with a memo", "Script and ad copy notes for your creative team"],
    scope: [{ k: "Design", v: "Randomized split samples" }, { k: "Messages", v: "Up to 8 per test" }, { k: "Typical sample", v: "1,000 to 2,000 interviews" }, { k: "Turnaround", v: "About a week" }],
    forWho: "Candidates, PACs and super PACs, party committees, ballot measure committees, advocacy groups and corporate affairs teams.",
    how: ["Agree the messages and the outcome", "Randomize and field", "Estimate effects by group", "Rank and recommend"],
    faq: [
      { q: "What is an informed ballot test?", a: "Voters answer the ballot, read an argument, then answer again. The change shows how much that argument moves them, compared with a group that read nothing." },
      { q: "Can you test video ads?", a: "Yes. Scripts and finished video can be shown inside the survey, with each respondent seeing one version at random." },
    ],
    keywords: ["message testing", "ad testing", "message testing poll", "persuasion research", "informed ballot", "political ad testing", "randomized message test"],
  },
  {
    slug: "post-election-autopsy", group: "strategy", name: "Post election autopsy", kicker: "What happened and why",
    short: "A survey of the voters who just decided the race, matched to the voter file, that shows who turned out, who switched and why.",
    intro: "After an election the count tells you who won. An autopsy tells you why. We survey voters right after the election, match responses back to the voter file to confirm who voted, and compare the result with the electorate you expected, county by county, so the next campaign starts from evidence instead of blame.",
    when: ["After a loss, before the next cycle's decisions are made", "After a win that was closer or wider than expected", "For a party or a committee reviewing a whole slate", "Before a donor or board review of a program"],
    method: "Respondents are drawn from the voter file and matched back to it, so the analysis separates voters from nonvoters with the official record once vote history updates. We compare the actual electorate with the pre election model, measure vote switching against the last comparable election and ask the reasons in voters' own words.",
    deliver: ["Who voted, who stayed home and who switched", "Reasons in voters' own words, coded and quoted", "County and regional turnout against the model", "Message and media recall", "An autopsy report and a briefing"],
    scope: [{ k: "Timing", v: "Days to weeks after the election" }, { k: "Typical sample", v: "800 to 1,500 interviews" }, { k: "Validation", v: "Matched to voter file history" }, { k: "Geography", v: "Statewide, district or a slate" }],
    forWho: "Candidates, party committees, caucus committees, PACs and allied groups planning the next cycle.",
    how: ["Agree the questions the review must answer", "Field among voters and nonvoters", "Match to the voter file", "Report and brief"],
    faq: [
      { q: "How soon after the election should an autopsy field?", a: "Within days, while voters remember why they chose. The voter file match is added when official vote history is posted." },
    ],
    keywords: ["post election poll", "post election autopsy", "election autopsy survey", "why we lost poll", "post election analysis", "voter validation study"],
  },
  {
    slug: "modeled-voter-universes", group: "strategy", name: "Modeled voter universes", kicker: "Targeting from your poll",
    short: "Your poll scored onto every record on the voter file: a support and turnout score for each voter, and universes for mail, doors and digital.",
    intro: "A poll tells you how a group of voters feels. A model tells you which individual voters are in that group. We match your survey back to the voter file, fit support and turnout models on the matched records and score every voter in your district, so your field, mail and digital programs reach the people who can actually be moved.",
    when: ["Before a persuasion or turnout program is built", "When you need to size the persuadable universe for a budget", "When a party or committee needs targets for many races at once", "When your list vendor's scores do not match what your poll is seeing"],
    method: "Survey responses are matched to voter records, then support and turnout are modeled from voter file fields such as vote history, age, geography and registration, with the poll as the training data. Scores are validated on held out respondents and calibrated so the totals match the poll. You receive scores for every record and the universes built from them.",
    deliver: ["Support and turnout scores for every voter", "Persuasion and mobilization universes with counts", "County and precinct summaries", "A model validation report", "Files ready for your list or digital vendor"],
    scope: [{ k: "Input", v: "Your poll matched to the voter file" }, { k: "Output", v: "Scores for every record" }, { k: "Geography", v: "Any district or statewide" }, { k: "Turnaround", v: "About a week after the poll" }],
    forWho: "Campaigns, party committees, PACs and super PACs, and advocacy groups running field, mail or digital programs.",
    how: ["Poll on the voter file", "Match and model", "Validate on held out voters", "Deliver scores and universes"],
    faq: [
      { q: "How is this different from a vendor score?", a: "The model is trained on your own poll in your own race, so it reflects how voters in this contest actually feel instead of a national score built for another purpose." },
    ],
    keywords: ["voter targeting model", "support score", "turnout score", "persuasion universe", "voter file modeling", "microtargeting"],
  },
  {
    slug: "county-desk", group: "analytics", name: "County Desk with a scenario assistant", kicker: "AI county simulations",
    short: "Your poll inside a county by county model of any state, simulated 10,000 times, with an assistant that answers what if questions in plain English.",
    intro: "The County Desk turns a poll into a forecast for every county in the state. Each run draws a statewide error, a regional error and a county error, so you see the full range of outcomes. Type a question such as what if turnout in the largest county drops eight percent, and the desk reruns the race and tells you what changed.",
    when: ["When leadership needs a win probability, not just a topline", "When deciding where to spend field and media money", "When planning against more than one turnout scenario", "When briefing donors or a board on the path to win"],
    method: "Your poll sets the statewide input. Each county starts from its last comparable result and moves with the poll, a regional error and its own error, drawn 10,000 times so the outcome range is honest. Turnout scenarios move votes county by county, and every scenario reports the change in win chance and margin.",
    deliver: ["Win chance, the range of outcomes and expected votes", "Every county mapped with its chance to flip", "A scenario assistant for turnout, swing and polling error", "The counties that decide the race, ranked"],
    scope: [{ k: "Coverage", v: "All 50 states and every county" }, { k: "Simulations", v: "10,000 per run" }, { k: "Scenarios", v: "County, region, metro, rural or voter group" }, { k: "Access", v: "Private to your team" }],
    forWho: "Campaign leadership, data directors, committees, PACs and investors who need to plan against more than one outcome.",
    how: ["Your poll sets the statewide input", "Counties start from their last result", "The desk simulates every county", "Ask the assistant and compare scenarios"],
    faq: [
      { q: "What can I ask the scenario assistant?", a: "Turnout changes and swings for a county, a region, metro or rural areas or a group of voters such as young voters or independents, plus polling error, the counties that decide the race and what it takes to flip the state." },
      { q: "Is my data shared?", a: "No. Dashboards are delivered privately, and voter files load from your computer without being sent anywhere." },
    ],
    keywords: ["county level election forecast", "election simulation", "AI election model", "what if election scenarios", "county by county forecast", "win probability model"],
    media: MEDIA.desk,
  },
  {
    slug: "weighting-dashboard", group: "analytics", name: "Weighting Dashboard", kicker: "DSMeridian weighting",
    short: "Weight a poll in the open: rake to voter file targets, score likely voters and lean undecideds, with every diagnostic on screen.",
    intro: "The Weighting Dashboard runs our published method on your sample. It rakes to registered voter targets from the voter file, scores each respondent's likelihood to vote from engagement and vote history, and leans undecided voters on how they answer the survey. The design effect, the effective sample and the turnout anchor are always visible.",
    when: ["When your team fields its own surveys and wants an audit trail", "When a client or a newsroom asks how a poll was weighted", "When comparing likely voter assumptions before a release", "When training staff on weighting"],
    method: "Raking runs in the order age and gender, race and education, then region, with trimming to keep the design effect in check. The likely voter stage combines an engagement score with validated history and an exposed turnout anchor. Undecided voters are leaned only on survey answers, never on demographics alone or recalled vote.",
    deliver: ["Raking to voter file targets with trimming", "A likely voter curve with an exposed turnout anchor", "Undecided voters leaned on survey answers only", "Leaned toplines, crosstabs and a weights file"],
    scope: [{ k: "Inputs", v: "Your poll file and voter file targets" }, { k: "Stages", v: "Electorate, likely voters, allocation" }, { k: "Diagnostics", v: "Design effect, effective n, weight range" }, { k: "Output", v: "Weights CSV and crosstabs" }],
    forWho: "Pollsters, consultants, data teams and researchers who field their own surveys and want a transparent weighting audit.",
    how: ["Load the poll and map columns", "Set targets from the voter file", "Score likely voters and lean undecideds", "Export weights and crosstabs"],
    faq: [
      { q: "Does the dashboard weight by recalled 2024 vote?", a: "No. Recalled vote is a diagnostic only and is never set as a likely voter target." },
      { q: "How are undecided voters allocated?", a: "On how they answer the survey, such as approval questions. Not on vote history alone, not on demographics directly and not on past vote." },
    ],
    keywords: ["poll weighting", "survey weighting software", "raking weights", "likely voter model", "weighting dashboard"],
    media: MEDIA.weight,
  },
  {
    slug: "likely-voter-modeling", group: "analytics", name: "Likely voter modeling and MRP", kicker: "Turnout and small areas",
    short: "The Meridian likely voter model on your sample or your universe, and MRP estimates for counties, legislative districts and cities.",
    intro: "Our likely voter model combines survey engagement with validated vote history and turns the score into a probability of voting. MRP carries a statewide sample down to counties and districts so you can read places the sample alone cannot.",
    when: ["When the electorate for an off year, special or primary election is uncertain", "When you need district level reads from one statewide poll", "When a party or caucus is sizing many legislative seats at once", "When early vote is in and turnout assumptions need a check"],
    method: "Engagement comes from intention, ballot method and close contacts; history comes from validated participation on the voter file. The two combine into a probability of voting, anchored to a turnout figure stated before results. MRP fits opinion on individual and place level predictors, then poststratifies to the real registered population of each county or district.",
    deliver: ["A likely voter score for every respondent or record", "Turnout projections with the anchor stated", "County and district estimates with MRP", "A method note your team can audit"],
    scope: [{ k: "Inputs", v: "Survey responses and vote history" }, { k: "Geography", v: "State, county, district, city" }, { k: "Turnout", v: "Bounded by the voter file and early vote" }, { k: "Turnaround", v: "Days" }],
    forWho: "Campaigns, party and caucus committees planning turnout and targeting, and researchers who need small area estimates.",
    how: ["Score engagement and history", "Set the turnout anchor before results", "Fit the model and MRP", "Report with the assumptions exposed"],
    faq: [{ q: "What is MRP?", a: "Multilevel regression and poststratification models opinion from a sample, then weights it to the real population of each county or district to estimate places the sample cannot read directly." }],
    keywords: ["likely voter model", "MRP polling", "turnout modeling", "small area estimation", "voter propensity model", "legislative district estimates"],
  },
  {
    slug: "election-night-desk", group: "analytics", name: "Election night desk", kicker: "Results and calls",
    short: "A live county results desk built on your polling, with expected vote and race calls for your audience or your war room.",
    intro: "On election night the desk compares each county's count with what the model expected, estimates the vote still out and shows when a race can be called. We called every state live on election night in 2026 with VT Analytics for an audience of millions.",
    when: ["For a campaign war room that needs to know which counties are still out", "For a newsroom, a podcast or a stream covering the night", "For a party tracking a whole slate", "For a special or primary election night"],
    method: "Before the night, every county gets an expected vote and margin from the model. As returns arrive, the desk compares each county with its expectation, estimates the vote remaining and recomputes the race. A race is called only when the remaining vote cannot close the gap under the stated threshold.",
    deliver: ["Live county maps and expected vote", "Remaining vote estimates by county", "Call thresholds and a call log", "Branded graphics for broadcast or stream", "Analyst support through the night"],
    scope: [{ k: "Coverage", v: "Any statewide or national race" }, { k: "Inputs", v: "Your polling and the county model" }, { k: "Delivery", v: "Live desk and graphics" }, { k: "Team", v: "Analyst support on the night" }],
    forWho: "Campaign war rooms, party committees, media outlets, podcasts and streamers covering election night.",
    how: ["Model each county before the night", "Connect the live count", "Estimate the vote still out", "Call races with stated thresholds"],
    faq: [{ q: "Can the desk run on our own stream?", a: "Yes. The desk and its graphics can be branded and run on your broadcast or stream." }],
    keywords: ["election night desk", "election results dashboard", "race calls", "expected vote model", "election night analytics"],
  },
  {
    slug: "voter-file-fieldwork", group: "data", name: "Voter file sampling and fieldwork", kicker: "With L2 voter data",
    short: "Samples drawn from the L2 voter file, registered voter benchmarks, quotas and text to web fieldwork matched back to each record.",
    intro: "Every On Point poll starts from the voter file. We draw the sample from L2 voter data, build registered voter benchmarks from the file itself, set quotas so hard to reach groups are in the sample and field by text to web, with online panel only to fill gaps.",
    when: ["When you want voter file grade samples for your own questionnaire", "When you need responses matched to vote history", "When you poll a district too small for online panels", "When you need registered voter benchmarks for weighting"],
    method: "We pull the universe from L2 with phone and demographic fields appended, build benchmarks from the full file, draw a stratified sample and send text invitations to a web survey through a registered texting program. Online panel fills cells that fall short. Every complete is matched back to its voter record.",
    deliver: ["Registered voter benchmarks from the file", "A stratified draw with quotas", "Text to web fieldwork and panel fill", "Responses matched back to the voter record", "Field reports with completion by cell"],
    scope: [{ k: "Data", v: "L2 voter file" }, { k: "Fieldwork", v: "Text to web, online panel" }, { k: "Survey platforms", v: "Alchemer and Qualtrics" }, { k: "Compliance", v: "Registered texting program" }],
    forWho: "Campaigns, consultants and organizations that want voter file grade samples, with or without our analysis.",
    how: ["Pick the universe", "Build benchmarks and quotas", "Draw and field", "Match back and deliver"],
    faq: [{ q: "Why poll from the voter file?", a: "Because the sample can be checked against the real registered population, and responses can be matched back to validated vote history for the likely voter model." }],
    keywords: ["voter file polling", "L2 voter data", "text to web survey", "SMS polling", "registration based sampling"],
  },
  {
    slug: "white-label-fieldwork", group: "data", name: "White label fieldwork for consultants and pollsters", kicker: "Partner fielding",
    short: "We field, weight and tabulate under your name: voter file samples, text to web collection and crosstabs delivered to your firm.",
    intro: "Consultants, agencies and smaller polling firms use us as their back office. You own the client and the questionnaire. We draw the sample, run the fieldwork, weight it and deliver clean data and crosstabs under your brand, on your timeline, with no contact with your client.",
    when: ["When your firm sells research but does not run its own fieldwork", "When you need capacity in a busy October", "When a client needs a district or state you do not usually poll", "When you want voter file sampling without building it"],
    method: "The same voter file sampling, text to web collection and DSMeridian weighting we use on our own polls, delivered unbranded. Your firm approves the questionnaire and the targets; we deliver data, crosstabs and a method note in your format.",
    deliver: ["Programmed survey from your questionnaire", "Voter file sample and fieldwork", "Weighted data and crosstabs in your format", "A method note for your report", "Confidential, no contact with your client"],
    scope: [{ k: "Branding", v: "Yours" }, { k: "Turnaround", v: "48 to 72 hours in field" }, { k: "Output", v: "Data, crosstabs, method note" }, { k: "Volume", v: "One project or a season" }],
    forWho: "Political consultants, digital and media agencies, general consultants and polling firms.",
    how: ["Send the questionnaire and targets", "We program and field", "Weight and tabulate", "Deliver under your brand"],
    faq: [
      { q: "Will you contact my client?", a: "No. White label work is delivered only to your firm, and we do not disclose that we fielded it." },
      { q: "Can you match our house style for crosstabs?", a: "Yes. Send a sample of your format and we will deliver in it." },
    ],
    keywords: ["white label polling", "polling subcontractor", "survey fieldwork vendor", "outsourced polling", "polling for consultants"],
  },
  {
    slug: "voter-data-and-text-programs", group: "data", name: "Voter data and text programs", kicker: "Lists and SMS",
    short: "Voter file datasets for your universe and text programs over the file, for surveys, persuasion and turnout.",
    intro: "Beyond polling, we supply voter file datasets with demographic and phone fields appended for the universe you need, and run text programs over the file for surveys, persuasion and get out the vote, through a registered and compliant texting program.",
    when: ["When you need a clean list for a district or a target group", "When you want to text a universe from your own model", "When you need a quick survey of your own supporters or members", "When a turnout program needs a text channel"],
    method: "Records come from L2 with the fields you need. Text programs send only to lawful universes with opt out handling built in, through a registered program, and report delivery, responses and opt outs.",
    deliver: ["Voter file datasets for your universe", "Phone and demographic fields appended", "Text program setup and sending", "Delivery, response and opt out reports"],
    scope: [{ k: "Data", v: "L2 voter file" }, { k: "Channel", v: "SMS and MMS" }, { k: "Uses", v: "Survey, persuasion, turnout" }, { k: "Compliance", v: "Registered program, opt out handling" }],
    forWho: "Campaigns, party committees, PACs and advocacy groups running their own voter contact.",
    how: ["Define the universe", "Pull and append the file", "Set up the program", "Send and report"],
    faq: [{ q: "Are text programs compliant?", a: "Programs run through a registered texting program with opt out handling. You remain responsible for the content and the legal basis for contacting your universe." }],
    keywords: ["voter file data", "voter list", "political texting", "SMS program", "peer to peer texting", "GOTV texting"],
  },
  {
    slug: "media-partner-polls", group: "media", name: "Media partner polls", kicker: "Commissioned and syndicated polls",
    short: "A poll your newsroom commissions and releases first: questionnaire built with your editors, full disclosure and the crosstabs to back the story.",
    intro: "Newsrooms, publishers, podcasts and creators commission On Point polls on the races and questions their audience follows. You get an exclusive first release, a methodology statement that holds up to scrutiny and an analyst for interviews. Syndication and sponsorship options let a poll carry your brand across a season.",
    when: ["Before a debate, a primary or election day", "For a series that needs fresh national or state numbers", "When your audience asks a question no public poll answers", "For an election night or results show"],
    method: "Questionnaires are written with your editors and follow standard disclosure: sponsor, field dates, mode, sample size, population and margin of error published with every release. We show the leaned and the as asked numbers, and every poll is later scored against the result in our public accuracy report.",
    deliver: ["Exclusive first release", "Toplines, crosstabs and a methodology statement", "Charts and graphics for publication", "An analyst for interviews and segments", "Scored against the result after the election"],
    scope: [{ k: "Geography", v: "National, statewide or district" }, { k: "Release", v: "Exclusive first release to you" }, { k: "Cadence", v: "One poll or a season" }, { k: "Disclosure", v: "Full method published" }],
    forWho: "Newspapers, digital publishers, TV and radio, podcasts, newsletters and creators.",
    how: ["Agree the topics and the release date", "Questionnaire built with your editors", "Field, weight and verify", "Release with graphics and an analyst"],
    faq: [
      { q: "Is the sponsor disclosed?", a: "Yes. Every public release names the sponsor, the field dates, the sample and the method." },
      { q: "Can we release the poll as our own?", a: "Yes, as a poll conducted by On Point Polling for your outlet, the standard credit for a commissioned poll." },
    ],
    keywords: ["media poll", "commission a poll", "newspaper poll", "poll for news outlet", "sponsored poll", "poll syndication"],
  },
  {
    slug: "corporate-consumer-research", group: "media", name: "Corporate, consumer and public affairs research", kicker: "Beyond elections",
    short: "Reputation, policy and consumer research for companies, associations and public affairs teams, with the same sampling and weighting as our election work.",
    intro: "The method that called the 2026 midterms works on any population. Companies use it to read their reputation, test a rebrand or a product before launch, and understand how voters and customers see a policy fight. Associations use it to show lawmakers where their members and the public stand.",
    when: ["Before a rebrand, a launch or a price change", "When a policy fight puts your company or industry in the news", "When an association needs numbers for a lobby day", "When a board needs an outside read on reputation"],
    method: "Samples are drawn to the population you need: registered voters, all adults, customers or members. Results are weighted to known benchmarks for that population and reported with the same disclosure as our public polls. Message and concept tests use randomized designs.",
    deliver: ["Reputation and favorability measures", "Concept, name and message tests", "Policy support among voters and key groups", "Crosstabs, a report and a briefing"],
    scope: [{ k: "Population", v: "Voters, adults, customers or members" }, { k: "Typical sample", v: "800 to 2,000 interviews" }, { k: "Geography", v: "National or state" }, { k: "Turnaround", v: "One to two weeks" }],
    forWho: "Companies, trade associations, public affairs and communications firms, foundations and nonprofits.",
    how: ["Define the population and the decision", "Design and field", "Weight to the population", "Report and brief"],
    faq: [{ q: "Do you do research outside politics?", a: "Yes. Reputation, consumer and policy research use the same sampling and weighting discipline as our election polling." }],
    keywords: ["public affairs polling", "corporate reputation survey", "consumer research", "policy research", "association polling", "market research survey"],
  },
];

export const svcHref = (s: Service) => `/on-point-polling/services/${s.slug}`;

export const PARTNERS: { name: string; role: string }[] = [
  { name: "L2 Data", role: "Voter file data" },
  { name: "Tigre Strategics", role: "Strategy partner" },
  { name: "Alchemer", role: "Survey platform" },
  { name: "On Point Weighting Dashboard", role: "Weighting platform" },
];

/** the proposal form, opened with the service and the kind of client already picked */
export const quoteHref = (o: { service?: string; for?: string } = {}) => {
  const q = new URLSearchParams(); if (o.service) q.set("service", o.service); if (o.for) q.set("for", o.for);
  const s = q.toString(); return `/contact${s ? `?${s}` : ""}#brief`;
};
export const bySlug = (slug: string) => SERVICES.find((s) => s.slug === slug);

/** the ways a client buys: one study, a program, a full cycle or fieldwork alone */
export const ENGAGE: { name: string; s: string; inc: string[]; fit: string }[] = [
  { name: "Single study", s: "One poll, one test or one model, scoped and quoted on its own.", inc: ["Questionnaire design", "Voter file fieldwork", "Leaned toplines and crosstabs", "Memo and walkthrough call"], fit: "A benchmark, a viability read or a single message test" },
  { name: "Tracking program", s: "A set schedule of waves on a locked method, quoted for the whole program.", inc: ["Locked weighting targets", "Waves on your schedule", "Trend dashboard", "Priority fielding when news breaks"], fit: "A primary, a general election or a legislative session" },
  { name: "Cycle research program", s: "Everything a campaign or committee needs from benchmark to autopsy, with an analyst assigned.", inc: ["Benchmark, tests and tracking", "Modeled universes and the County Desk", "Election night desk", "Standing analyst access"], fit: "Statewide campaigns, committees, PACs and parties" },
  { name: "Fieldwork and data", s: "Samples, fieldwork, weighting or voter data on their own, for teams that do their own analysis.", inc: ["Voter file samples", "Text to web collection", "Weighting and tabulation", "White label delivery"], fit: "Consultants, agencies and pollsters" },
];
