// The site's one menu: the masthead, the phone menu and the footer all read it.
// Five tabs. The four that matter most each open a short panel; More gathers the rest of the site, one column per
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
  { key: "opp", label: "On Point Polling", href: "/on-point-polling",
    feature: { href: "/on-point-polling#contact", eyebrow: "Nonpartisan · both parties", title: "Field a poll with the most accurate pollster of 2026", note: "Democrats, Republicans and independents, committees, newsrooms and companies.", cta: "Get a quote" },
    cols: [
      { h: "Work with us", links: [
        { href: "/on-point-polling#contact", label: "Get a quote", note: "Fielded in 48 to 72 hours" },
        { href: "/on-point-polling#services", label: "What we field", note: "Horse races, issue surveys, MRP" },
        { href: "/on-point-polling#who", label: "Who we work with", note: "Both parties, one method" },
      ] },
      { h: "Our polling", links: [
        { href: "/on-point-polling/polls", label: "Poll releases", note: "Toplines and crosstabs" },
        { href: "/on-point-polling/methodology", label: "Methodology" },
        { href: "/on-point-polling/weighting-room", label: "The Weighting Room", note: "Subscriber community" },
        { href: "/portal/login", label: "Client portal" },
      ] },
    ] },
  { key: "accuracy", label: "Accuracy", href: "/accuracy", chip: "#1",
    feature: { href: "/accuracy", eyebrow: "The #1 forecast of 2026", title: "The 2026 accuracy report", note: "Every race we forecast and every poll we fielded, scored against the count.", cta: "Read the report" },
    cols: [
      { h: "The record", links: [
        { href: "/most-accurate-pollster", label: "Most accurate pollster", note: "D +13.1 against a D +13.0 result" },
        { href: "/accuracy#field", label: "The #1 forecast", note: "Against every major forecast" },
        { href: "/accuracy#our-polls", label: "Our polls, scored", note: "Race by race, misses included" },
      ] },
      { h: "The proof", links: [
        { href: "/forecast/2026", label: "The forecast as published", note: "Frozen November 3, fingerprinted" },
        { href: "/accuracy#method", label: "How it is graded" },
        { href: "/accuracy/2026.json", label: "Download the scores" },
      ] },
    ] },
  { key: "forecast", label: "Forecasts", href: "/forecast",
    feature: { href: "/forecast/2028", eyebrow: "Now forecasting", title: "The 2028 presidential race", note: "The Electoral College and both primaries, county by county.", cta: "Open 2028" },
    cols: [
      { h: "2028", links: [
        { href: "/forecast/2028", label: "2028 forecast", note: "Map, primaries and simulator" },
        { href: "/polls/2028", label: "2028 primary polls" },
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
        { href: "/polls/senate", label: "Senate" },
        { href: "/polls/governor", label: "Governors" },
      ] },
      { h: "Ours", links: [
        { href: "/on-point-polling/polls", label: "On Point Polling releases" },
        { href: "/most-accurate-pollster", label: "Most accurate pollster" },
      ] },
    ] },
  { key: "more", label: "More", href: "/news", more: true,
    cols: [
      { h: "News", href: "/news", links: [
        { href: "/news", label: "Front page" },
        { href: "/accountability", label: "Accountability Index" },
        { href: "/news/sources", label: "Outlets and ratings" },
      ] },
      { h: "Results", href: "/results/2026", links: [
        { href: "/results/2026", label: "2026 results" },
        { href: "/results/archive", label: "Results archive" },
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
      { h: "Play", href: "/play", links: [
        { href: "/play", label: "Campaign 2026", note: "Run a Senate or governor campaign" },
      ] },
    ] },
];
