// Who On Point Polling works for, one page each, so a candidate, a committee or a PAC searching for a pollster lands
// on a page written for them: the decisions they face, the research that answers each one, how a cycle runs and the
// practical rules of their world. Services are referenced by slug from services.ts.
export type Audience = {
  slug: string; name: string; label: string; title: string; short: string; intro: string;
  decisions: { q: string; svc: string }[];
  cycle: { t: string; s: string }[];
  services: string[];
  notes: { t: string; s: string }[];
  faq: { q: string; a: string }[];
  keywords: string[];
};

export const audHref = (a: Audience) => `/on-point-polling/for/${a.slug}`;

export const AUDIENCES: Audience[] = [
  {
    slug: "candidates", name: "Candidates and campaigns", label: "Candidates",
    title: "Polling for candidates and campaigns",
    short: "Benchmark, tracking and message polls for candidates running for Congress, statewide office, the legislature and local office, from the decision to run through election night.",
    intro: "Whether you are deciding to run for city council or managing a Senate race, the questions are the same: can we win, what do we say and to whom. We poll your actual electorate from the voter file, weight it the way that put us within a point of the 2026 national result, and deliver numbers your team can plan a budget on.",
    decisions: [
      { q: "Should I run, and can I win?", svc: "candidate-viability" },
      { q: "Where does the race stand right now?", svc: "one-time-poll" },
      { q: "Which message moves the voters we need?", svc: "message-testing" },
      { q: "Is our paid media working?", svc: "tracking-polls" },
      { q: "Which voters should field and mail reach?", svc: "modeled-voter-universes" },
      { q: "What are our real chances, county by county?", svc: "county-desk" },
    ],
    cycle: [
      { t: "Before the launch", s: "A viability study on the primary and general electorates, with name recognition against the likely field." },
      { t: "The benchmark", s: "A full survey that sets the baseline: ballot, images, issues and the persuadable universe." },
      { t: "Message and targeting", s: "Randomized message tests, then the poll scored onto the voter file for field, mail and digital." },
      { t: "Tracking to election day", s: "Monthly, then weekly waves on locked targets, with the County Desk for scenarios and an election night desk." },
    ],
    services: ["candidate-viability", "one-time-poll", "message-testing", "tracking-polls", "modeled-voter-universes", "county-desk", "election-night-desk", "post-election-autopsy"],
    notes: [
      { t: "Any office, any size", s: "The voter file lets us poll a city council ward or a state legislative district as well as a statewide race. We size the sample to the electorate." },
      { t: "Primary and general electorates", s: "Primary voters are a different electorate. We draw and weight each one separately so a primary poll reads the voters who will actually vote in it." },
      { t: "Reporting the cost", s: "A poll paid for by your campaign is a campaign expenditure. Results given to you by someone else can be an in kind contribution; see the PAC page and ask your counsel." },
    ],
    faq: [
      { q: "How much does a campaign poll cost?", a: "It depends on the geography, the sample size and the length of the questionnaire. Smaller districts and shorter surveys cost less. Send the race and the timeline and you will have a written quote the same day." },
      { q: "Do you work with Republicans and Democrats?", a: "Yes. On Point Polling is nonpartisan and works with candidates of both parties and independents, with the same method for every client. Client work is confidential." },
      { q: "Can you poll a local race?", a: "Yes. Mayoral, county, school board and legislative races are polled from the voter file for that jurisdiction." },
      { q: "How fast can we have numbers?", a: "Most polls field in 48 to 72 hours from an approved questionnaire." },
    ],
    keywords: ["campaign pollster", "pollster for candidates", "political pollster for hire", "campaign polling firm", "congressional campaign poll", "state legislative race poll", "local election poll", "mayoral race pollster"],
  },
  {
    slug: "party-committees", name: "Party committees", label: "Parties",
    title: "Polling for party committees and caucuses",
    short: "Statewide and multi district polling, legislative MRP, targeting models and post election reviews for state and county parties and legislative caucus committees.",
    intro: "Parties and caucus committees decide where a whole slate's money goes. That needs more than one poll: a read on the statewide environment, estimates for every targeted district, recruiting research and an honest review after the election. We build programs that answer all of it from one consistent method.",
    decisions: [
      { q: "Which seats are really in play?", svc: "likely-voter-modeling" },
      { q: "What is the environment statewide?", svc: "tracking-polls" },
      { q: "Is this recruit viable?", svc: "candidate-viability" },
      { q: "Which voters should the coordinated campaign target?", svc: "modeled-voter-universes" },
      { q: "What happened across the slate?", svc: "post-election-autopsy" },
      { q: "How do we follow every race on election night?", svc: "election-night-desk" },
    ],
    cycle: [
      { t: "Off year", s: "Post election review, recruiting viability studies and a statewide environment benchmark." },
      { t: "Targeting", s: "MRP estimates for every legislative or congressional district from one statewide sample, and the target list." },
      { t: "The campaign", s: "Quarterly, then monthly statewide tracking, district polls in the closest seats and modeled universes for the coordinated program." },
      { t: "Election night and after", s: "A results desk across the slate, then an autopsy that starts the next cycle." },
    ],
    services: ["tracking-polls", "likely-voter-modeling", "candidate-viability", "modeled-voter-universes", "one-time-poll", "election-night-desk", "post-election-autopsy", "voter-data-and-text-programs"],
    notes: [
      { t: "One method across the slate", s: "Every district is weighted to the same voter file targets and the same likely voter model, so seat to seat comparisons are fair." },
      { t: "District reads from one sample", s: "MRP carries a statewide poll down to districts too small or too numerous to poll one by one." },
      { t: "Sharing results with candidates", s: "Results a committee gives to a candidate can count as a contribution under FEC rules for federal races and state law for state races. We date every field period and delivery for your compliance staff." },
    ],
    faq: [
      { q: "Do you work with county parties as well as state parties?", a: "Yes. County and local party committees commission district and countywide polls, autopsies and voter data." },
      { q: "Can one poll cover many legislative districts?", a: "Yes. A statewide sample with MRP estimates every district, and we add oversamples in the seats that matter most." },
      { q: "Is the work nonpartisan?", a: "The firm is nonpartisan and works with both parties. Each committee's work is confidential to that committee." },
    ],
    keywords: ["party committee polling", "state party pollster", "county party poll", "legislative caucus polling", "coordinated campaign polling", "legislative district MRP"],
  },
  {
    slug: "pacs", name: "PACs and super PACs", label: "PACs",
    title: "Polling for PACs, super PACs and independent expenditure groups",
    short: "Race selection, message testing, targeting models and tracking for PACs, super PACs and independent expenditure campaigns, delivered confidentially.",
    intro: "A PAC spends where it can change an outcome. That means knowing which races are close, which messages move the voters in them and which voters to reach, often across many states at once. We poll from the voter file, test messages with randomized experiments and score the results onto every voter, so your independent expenditures go where they matter.",
    decisions: [
      { q: "Which races should we spend in?", svc: "one-time-poll" },
      { q: "Which ad or contrast works best?", svc: "message-testing" },
      { q: "Who exactly should see it?", svc: "modeled-voter-universes" },
      { q: "Is the spending moving the race?", svc: "tracking-polls" },
      { q: "What are the odds in each state?", svc: "county-desk" },
      { q: "Do we need national numbers for donors?", svc: "omnibus-questions" },
    ],
    cycle: [
      { t: "Race selection", s: "Screening polls across candidate races to find where the margin is close enough for money to matter." },
      { t: "Message and creative", s: "Randomized message and ad tests before the buy, with results among the persuadable voters in each race." },
      { t: "Targeting", s: "The poll scored onto the voter file so mail, digital and doors reach the right universe." },
      { t: "Measure and adjust", s: "Tracking waves through the flight, with the County Desk to reallocate between states." },
    ],
    services: ["one-time-poll", "message-testing", "modeled-voter-universes", "tracking-polls", "county-desk", "omnibus-questions", "issue-ballot-measure-polling", "voter-data-and-text-programs"],
    notes: [
      { t: "Confidential by default", s: "Client work is never shared with another client, including candidates and parties in the same race. Independent expenditure groups must not coordinate with candidates, and confidentiality between clients helps keep that line clear." },
      { t: "Sharing a poll with a candidate", s: "Under the FEC's poll allocation rule, 11 CFR 106.4, results given to a candidate can be an in kind contribution, and their value falls the longer after the poll they are shared. We date field periods and deliveries so your counsel can value and report them. This is not legal advice." },
      { t: "Many races at once", s: "Screening programs poll several states or districts in one field period with the same method, so races compare on equal terms." },
    ],
    faq: [
      { q: "Can a super PAC hire On Point Polling?", a: "Yes. We work with PACs, super PACs and independent expenditure groups. Their research is confidential and not shared with candidates, parties or other clients." },
      { q: "Can you test our ads before they run?", a: "Yes. Scripts and finished video are shown at random inside the survey, and the effect on the ballot is measured among persuadable voters." },
      { q: "Do you poll in many states at once?", a: "Yes. A screening program fields every target race in the same window with the same weighting, so you can rank them for spending." },
      { q: "How do we report poll costs to the FEC?", a: "Poll costs are reported as expenditures like any other vendor payment. If results are shared with a candidate, the allocation rule in 11 CFR 106.4 applies. Ask your counsel; we provide dated invoices and field dates." },
    ],
    keywords: ["PAC polling", "super PAC pollster", "independent expenditure polling", "political action committee poll", "IE research", "PAC message testing"],
  },
  {
    slug: "ballot-measures", name: "Ballot measure committees", label: "Ballot measures",
    title: "Polling for ballot measure and initiative campaigns",
    short: "Ballot language tests, informed vote polling, message experiments and tracking for initiative, referendum and bond campaigns, for or against.",
    intro: "Ballot measures are won and lost on wording and on the arguments voters hear last. We test the exact title and summary voters will read, measure how support holds up after the strongest arguments on each side and track the measure through the campaign.",
    decisions: [
      { q: "Can this measure pass?", svc: "issue-ballot-measure-polling" },
      { q: "Which ballot title should we file?", svc: "issue-ballot-measure-polling" },
      { q: "Which argument holds our coalition together?", svc: "message-testing" },
      { q: "Is support holding up?", svc: "tracking-polls" },
      { q: "Who are the persuadable voters?", svc: "modeled-voter-universes" },
      { q: "Why did it pass or fail?", svc: "post-election-autopsy" },
    ],
    cycle: [
      { t: "Before filing", s: "A feasibility poll on the issue and the draft language, before money goes to signatures." },
      { t: "Language and arguments", s: "Wording tests between titles and summaries, and the informed vote after arguments for and against." },
      { t: "The campaign", s: "Message experiments, persuasion universes and tracking through the election." },
      { t: "After", s: "An autopsy for the next measure or the legislative fight that follows." },
    ],
    services: ["issue-ballot-measure-polling", "message-testing", "tracking-polls", "modeled-voter-universes", "omnibus-questions", "post-election-autopsy"],
    notes: [
      { t: "The right electorate", s: "Measures appear in primaries, specials and general elections, each with a different electorate. We weight to the voters of the election the measure is on." },
      { t: "Yes or no campaigns", s: "We work for either side. Each client's work is confidential." },
    ],
    faq: [
      { q: "When should a ballot measure campaign poll?", a: "Before filing, to decide whether to spend on qualification, then on the final language, then through the campaign." },
      { q: "Can you poll a local bond or tax measure?", a: "Yes. City, county and school district measures are polled from the voter file for that jurisdiction." },
    ],
    keywords: ["ballot measure polling", "ballot initiative poll", "referendum poll", "bond measure poll", "ballot language testing", "initiative campaign pollster"],
  },
  {
    slug: "advocacy-groups", name: "Advocacy groups and nonprofits", label: "Advocacy",
    title: "Polling for advocacy groups, unions and nonprofits",
    short: "Issue polling, message research, member surveys and public releases for advocacy organizations, unions, associations and nonprofits.",
    intro: "Advocacy groups need numbers that persuade: lawmakers who want to know where their own voters stand, reporters who need a credible source and members who want to see the case. We design issue polls that hold up to scrutiny and message research that shows which frame wins.",
    decisions: [
      { q: "Where does the public stand on our issue?", svc: "issue-ballot-measure-polling" },
      { q: "Which frame wins over the middle?", svc: "message-testing" },
      { q: "What do voters in a lawmaker's district think?", svc: "likely-voter-modeling" },
      { q: "Can we get national numbers on a budget?", svc: "omnibus-questions" },
      { q: "Is opinion moving over the session?", svc: "tracking-polls" },
    ],
    cycle: [
      { t: "Baseline", s: "An issue poll that sets where voters stand and which arguments move them." },
      { t: "Persuasion", s: "Message experiments to pick the frame for paid and earned media." },
      { t: "Pressure", s: "District estimates for the lawmakers who matter, and a public release with full disclosure." },
      { t: "Track", s: "Quarterly or omnibus waves to show movement over a session or a cycle." },
    ],
    services: ["issue-ballot-measure-polling", "message-testing", "omnibus-questions", "tracking-polls", "likely-voter-modeling", "corporate-consumer-research"],
    notes: [
      { t: "Releases that hold up", s: "Public releases publish the sponsor, field dates, sample, mode and margin of error, and the full question wording." },
      { t: "Lobby day numbers", s: "MRP and district oversamples let you show each lawmaker the opinion of their own constituents." },
    ],
    faq: [
      { q: "Will a poll we sponsor be credible to reporters?", a: "Credibility comes from disclosure and balanced wording. We publish the full method with every release and write questions that a skeptical reporter can read in full." },
      { q: "Do you survey members or donors?", a: "Yes. Member and supporter surveys are fielded from your own lists, weighted to your membership." },
    ],
    keywords: ["advocacy polling", "nonprofit polling", "union polling", "issue poll", "public opinion research nonprofit", "advocacy message research"],
  },
  {
    slug: "media", name: "Newsrooms and media", label: "Media",
    title: "Commissioned polls for newsrooms, publishers and creators",
    short: "Exclusive national, state and district polls for newspapers, digital publishers, TV, podcasts and creators, with full disclosure and an analyst for interviews.",
    intro: "A good poll gives your audience something no one else has. We field commissioned polls for outlets that want exclusive numbers on the races and questions their readers follow, with a published method, graphics and an analyst ready for segments.",
    decisions: [
      { q: "We want an exclusive poll on a race", svc: "media-partner-polls" },
      { q: "We need one national number for a story", svc: "omnibus-questions" },
      { q: "We are covering election night", svc: "election-night-desk" },
      { q: "We want a forecast for our audience", svc: "county-desk" },
    ],
    cycle: [
      { t: "Plan", s: "Agree topics and release dates around the calendar: debates, primaries and the final weeks." },
      { t: "Field", s: "Questionnaire built with your editors, fielded in days." },
      { t: "Release", s: "Exclusive first release with charts, crosstabs and a methodology statement." },
      { t: "Accountability", s: "After the election, every poll is scored against the result in public." },
    ],
    services: ["media-partner-polls", "omnibus-questions", "election-night-desk", "county-desk", "tracking-polls"],
    notes: [
      { t: "A record you can cite", s: "Our final 2026 national poll was second closest of 42 to the count, and every final poll is scored in our public accuracy report." },
      { t: "Analyst on air", s: "An On Point analyst is available for interviews, podcasts and election night segments." },
    ],
    faq: [
      { q: "Can we commission a single state poll?", a: "Yes. Single state and district polls are commissioned with an exclusive first release to your outlet." },
      { q: "What disclosure do you publish?", a: "Sponsor, field dates, mode, population, sample size, margin of error, weighting and full question wording." },
    ],
    keywords: ["media poll partner", "commission a poll for news", "newspaper poll", "podcast poll", "exclusive poll", "election night analytics media"],
  },
  {
    slug: "companies", name: "Companies and public affairs", label: "Companies",
    title: "Opinion research for companies, associations and public affairs teams",
    short: "Reputation, policy, concept and consumer research for companies, trade associations and public affairs firms, built on election grade sampling.",
    intro: "Companies and associations face voters too: in policy fights, in local approvals and in the court of public opinion. We bring election grade sampling and weighting to reputation, policy and consumer research, so decisions rest on what the public actually thinks.",
    decisions: [
      { q: "How is our company seen?", svc: "corporate-consumer-research" },
      { q: "Will this rebrand or launch land?", svc: "corporate-consumer-research" },
      { q: "Where do voters stand on our policy fight?", svc: "issue-ballot-measure-polling" },
      { q: "Which message wins the argument?", svc: "message-testing" },
      { q: "We need one national number fast", svc: "omnibus-questions" },
    ],
    cycle: [
      { t: "Diagnose", s: "A reputation or policy benchmark among voters, adults or customers." },
      { t: "Test", s: "Concept, name and message experiments before launch or before a public campaign." },
      { t: "Engage", s: "District level numbers for government relations and public releases with full disclosure." },
      { t: "Track", s: "Quarterly tracking or omnibus questions to watch reputation and policy support move." },
    ],
    services: ["corporate-consumer-research", "message-testing", "issue-ballot-measure-polling", "omnibus-questions", "tracking-polls"],
    notes: [
      { t: "Avoid an expensive misread", s: "A launch or a rebrand built on a misread of the customer base is costly. Representative samples and honest weighting are the cheapest insurance." },
      { t: "Voters and customers", s: "We can sample registered voters for policy work or adults and customers for brand work, and report both." },
    ],
    faq: [
      { q: "Do you work with companies outside politics?", a: "Yes. Reputation, consumer and policy research use the same methods as our election polling." },
      { q: "Can results stay private?", a: "Yes. Private work stays private; only work you choose to release is published, with the sponsor named." },
    ],
    keywords: ["public affairs research", "corporate polling", "reputation survey", "consumer research firm", "trade association polling", "policy opinion research"],
  },
  {
    slug: "consultants", name: "Consultants, agencies and pollsters", label: "Consultants",
    title: "White label polling for consultants, agencies and pollsters",
    short: "Fieldwork, weighting and tabulation under your brand for political consultants, agencies and polling firms that need capacity or voter file sampling.",
    intro: "Consultants and agencies sell research to their clients; we can be the team behind it. You keep the client relationship and the brand. We draw voter file samples, field, weight and deliver crosstabs in your format, quietly and on time.",
    decisions: [
      { q: "We need a poll fielded under our name", svc: "white-label-fieldwork" },
      { q: "We need voter file samples for our own survey", svc: "voter-file-fieldwork" },
      { q: "We want an audit of our own weighting", svc: "weighting-dashboard" },
      { q: "We need scores for our client's program", svc: "modeled-voter-universes" },
    ],
    cycle: [
      { t: "Brief", s: "Send the questionnaire, the universe and the deadline." },
      { t: "Field", s: "We program, sample from the voter file and field in 48 to 72 hours." },
      { t: "Weight", s: "Raking, likely voter screen and allocation to your specification or ours." },
      { t: "Deliver", s: "Data, crosstabs and a method note in your format, under your brand." },
    ],
    services: ["white-label-fieldwork", "voter-file-fieldwork", "weighting-dashboard", "modeled-voter-universes", "voter-data-and-text-programs"],
    notes: [
      { t: "Your client stays yours", s: "We never contact your client and do not disclose that we fielded the work." },
      { t: "October capacity", s: "Book a season of fielding so capacity is held for you in the busiest weeks." },
    ],
    faq: [
      { q: "Do you subcontract fieldwork for other pollsters?", a: "Yes. Polling firms use us for voter file sampling, text to web fieldwork and weighting under their own name." },
      { q: "Can you weight to our specification?", a: "Yes. Send your targets and screen, or use our DSMeridian method and we will document it for your report." },
    ],
    keywords: ["white label polling", "polling for consultants", "polling subcontractor", "survey fieldwork partner", "agency polling partner"],
  },
];
