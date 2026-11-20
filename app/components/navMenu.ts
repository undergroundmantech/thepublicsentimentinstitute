// The site's one menu: the masthead, the phone menu and the footer all read it.
// Six tabs. The five that matter most each open a short panel; More gathers the rest of the site, one column per
// section, with the section's own page as the column heading.
export type NavLink = { href: string; label: string; note?: string; badge?: string };
export type NavCol = { h: string; href?: string; links: NavLink[] };
export type NavGroup = {
  key: string; label: string; href: string;
  /** a small chip beside the tab label */
  chip?: string;
  /** More has no page of its own: the label only opens the panel */
  more?: boolean;
  cols: NavCol[];
  feature?: { href: string; eyebrow: string; title: string; note: string; cta: string };
};

export const MENU: NavGroup[] = [
  // 2028 leads the menu now the midterms are counted: the forecast, then the game built on it
  { key: "f28", label: "2028 Forecast", href: "/2028", chip: "New",
    feature: { href: "/2028", eyebrow: "The 2028 presidential model", title: "Who wins the White House", note: "The Electoral College, both primaries and every matchup, county by county, on 20,000 simulations.", cta: "Open the forecast" },
    cols: [
      { h: "The forecast", links: [
        { href: "/2028", label: "Overview", note: "The map and the path to 270" },
        { href: "/2028/primaries", label: "Primaries", note: "Every state, every candidate" },
        { href: "/2028/general", label: "General election", note: "Every matchup" },
        { href: "/2028/ticket", label: "Pick a ticket", note: "Build your own matchup" },
      ] },
      { h: "The field", links: [
        { href: "/2028-presidential-candidates", label: "Who is running in 2028", note: "Every name, by party" },
        { href: "/polls/2028", label: "2028 primary polls" },
        { href: "/analysis/2028-first-look", label: "2028: where it starts" },
      ] },
    ] },
  { key: "play", label: "Campaign 2028", href: "/play", chip: "Game",
    feature: { href: "/play", eyebrow: "Free game · runs on the forecast", title: "Run for president", note: "Pick from 54 candidates, win the primaries, choose a running mate and fight county by county to 270.", cta: "Play now" },
    cols: [
      { h: "Play", links: [
        { href: "/play", label: "New campaign", note: "Primaries to the general" },
        { href: "/play", label: "Daily challenge", note: "Same race for everyone today" },
      ] },
      { h: "Built on the model", links: [
        { href: "/2028", label: "The 2028 forecast", note: "The numbers the game runs on" },
        { href: "/2028-presidential-candidates", label: "The candidates" },
      ] },
    ] },
  { key: "results", label: "2026 Results", href: "/results/monitor",
    feature: { href: "/results/monitor", eyebrow: "Election night", title: "The Situation Monitor", note: "The map, the count and every On Point call on one screen, with the election-night replay.", cta: "Open the monitor" },
    cols: [
      { h: "The night", links: [
        { href: "/results/2026", label: "2026 results", note: "Senate, House, governors and measures" },
        { href: "/results/monitor", label: "Situation Monitor", note: "One screen for the whole night" },
        { href: "/results/2026/calls", label: "Calls desk", note: "Every call and every race in one table" },
        { href: "/results/2026#rh", label: "Every race", note: "One sortable list" },
      ] },
      { h: "The record", links: [
        { href: "/results/archive", label: "Results archive" },
        { href: "/accuracy", label: "How the forecast did" },
      ] },
    ] },
  { key: "forecast", label: "Forecasts", href: "/forecast",
    feature: { href: "/2027", eyebrow: "New · the 2027 governors", title: "Kentucky, Mississippi and Louisiana", note: "The early model for next November: primaries, every matchup and every county.", cta: "Open 2027" },
    cols: [
      { h: "2028", links: [
        { href: "/forecast/2028", label: "2028 forecast", note: "Map, primaries and simulator" },
        { href: "/polls/2028", label: "2028 primary polls" },
        { href: "/2028-presidential-candidates", label: "Who is running in 2028" },
      ] },
      { h: "2027 governors", links: [
        { href: "/2027", label: "All three races", note: "The early model" },
        { href: "/2027/kentucky", label: "Kentucky" },
        { href: "/2027/mississippi", label: "Mississippi" },
        { href: "/2027/louisiana", label: "Louisiana" },
      ] },
      { h: "2026 final", links: [
        { href: "/forecast", label: "The final 2026 forecast", note: "Senate, House and governors" },
        { href: "/forecast/2026", label: "As published", note: "Every file, fingerprinted" },
        { href: "/accuracy", label: "How it did" },
      ] },
      { h: "Tools", links: [
        { href: "/what-if", label: "What If", note: "Pick winners, watch the map follow" },
        { href: "/swingometer", label: "Swingometer" },
        { href: "/forecast/methodology", label: "Methodology" },
      ] },
    ] },
  { key: "polls", label: "Polls", href: "/polls",
    cols: [
      { h: "National", links: [
        { href: "/polls/approval", label: "Trump approval" },
        { href: "/polls/generic-ballot", label: "Generic ballot" },
        { href: "/polls/right-track", label: "Right track, wrong track" },
      ] },
      { h: "Races", links: [
        { href: "/polls/2028", label: "2028 primaries" },
        { href: "/majority-tracker", label: "Senate leader race", badge: "Live" },
        { href: "/polls/senate", label: "Senate" },
        { href: "/polls/governor", label: "Governors" },
      ] },
      { h: "Ours", links: [
        { href: "/on-point-polling/polls", label: "On Point Polling releases" },
        { href: "/most-accurate-pollster", label: "Pollster ranking" },
      ] },
    ] },
  { key: "opp", label: "On Point Polling", href: "/on-point-polling",
    feature: { href: "/on-point-polling#contact", eyebrow: "Nonpartisan · both parties", title: "Field a poll with the firm that landed within a point in 2026", note: "Democrats, Republicans and independents, committees, newsrooms and companies.", cta: "Get a quote" },
    cols: [
      { h: "Work with us", links: [
        { href: "/on-point-polling#contact", label: "Get a quote", note: "Fielded in 48 to 72 hours" },
        { href: "/on-point-polling#services", label: "What we field", note: "Horse races, issue surveys, MRP" },
        { href: "/on-point-polling#who", label: "Who we work with", note: "Both parties, one method" },
      ] },
      { h: "Our record", links: [
        { href: "/accuracy", label: "The 2026 accuracy report", note: "Every race against the count" },
        { href: "/most-accurate-pollster", label: "Pollster ranking", note: "D +13.1 against a D +14.0 count, second of 42" },
      ] },
      { h: "Our polling", links: [
        { href: "/on-point-polling/polls", label: "Poll releases", note: "Toplines and crosstabs" },
        { href: "/on-point-polling/methodology", label: "Methodology" },
        { href: "/on-point-polling/weighting-room", label: "The Weighting Room", note: "Subscriber community" },
        { href: "/portal/login", label: "Client portal" },
      ] },
    ] },
  { key: "more", label: "More", href: "/news", more: true,
    cols: [
      { h: "Analysis", href: "/analysis", links: [
        { href: "/analysis", label: "All analysis" },
        { href: "/analysis/2028-first-look", label: "2028: where it starts" },
        { href: "/analysis/2026-forecast-review", label: "2026: right and wrong" },
        { href: "/about", label: "About us" },
      ] },
      { h: "News", href: "/news", links: [
        { href: "/news", label: "Front page" },
        { href: "/accountability", label: "Accountability Index" },
        { href: "/news/sources", label: "Outlets and ratings" },
      ] },
      { h: "Maps", href: "/maps", links: [
        { href: "/maps/electoral", label: "Electoral map" },
        { href: "/maps/ballot-measures", label: "Ballot measures" },
        { href: "/maps/party-registration", label: "Party registration" },
      ] },
      { h: "Watchdog", href: "/watchdog", links: [
        { href: "/watchdog/war-room", label: "War Room" },
        { href: "/watchdog/money", label: "Money flow" },
        { href: "/watchdog/people", label: "People files" },
      ] },
      { h: "Accuracy", href: "/accuracy", links: [
        { href: "/accuracy", label: "The 2026 accuracy report" },
        { href: "/most-accurate-pollster", label: "Pollster ranking" },
        { href: "/forecast/2026", label: "The forecast as published" },
      ] },
      { h: "Majority Tracker", href: "/majority-tracker", links: [
        { href: "/majority-tracker", label: "Senate leader race", note: "Schumer vs Van Hollen", badge: "Live" },
      ] },
    ] },
];
