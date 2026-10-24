// The site's one menu: the masthead menus, the phone menu and the footer all read it.
export type NavLink = { href: string; label: string; note?: string; badge?: string };
export type NavCol = { h: string; links: NavLink[] };
export type NavGroup = { key: string; label: string; href: string; /** where clicking the label itself goes, when not href */ go?: string; live?: boolean; cols: NavCol[]; feature?: { href: string; eyebrow: string; title: string; note: string } };

export const MENU: NavGroup[] = [
  { key: "forecast", label: "Forecast", href: "/forecast",
    feature: { href: "/forecast", eyebrow: "2026 midterms", title: "The full forecast", note: "Every Senate, House and governor race, simulated 2,000 times." },
    cols: [
      { h: "Federal and governors", links: [
        { href: "/forecast?office=senate", label: "Senate", note: "35 races and control odds" },
        { href: "/forecast?office=house", label: "House", note: "All 435 districts" },
        { href: "/forecast?office=governor", label: "Governors", note: "36 races" },
      ] },
      { h: "Down the ballot", links: [
        { href: "/forecast/statewide", label: "Statewide offices", note: "Attorneys general, secretaries of state and more" },
        { href: "/forecast/legislatures", label: "State legislatures", note: "Every chamber, every district" },
        { href: "/forecast/measures", label: "Ballot measures", note: "145 statewide questions" },
        { href: "/forecast/other", label: "Courts, mayors and local", note: "Judicial, municipal and special races" },
      ] },
      { h: "Around the world", links: [
        { href: "/brasil", label: "Brasil 2026", note: "Runoff forecast, Flávio Bolsonaro x Lula", badge: "New" },
        { href: "/brasil/estados", label: "Brasil por município", note: "Every state and town" },
      ] },
      { h: "Scenarios and method", links: [
        { href: "/what-if", label: "What If", note: "Pick winners, watch every race follow" },
        { href: "/swingometer", label: "Swingometer", note: "Move any group of voters" },
        { href: "/forecast/methodology", label: "Methodology", note: "How the model works" },
        { href: "/forecast/changelog", label: "Changelog", note: "Every update, dated" },
      ] },
    ] },
  { key: "polls", label: "Polls", href: "/polls",
    feature: { href: "/polls", eyebrow: "Polling averages", title: "The whiteboard", note: "Every public poll, weighted, with the leans shown." },
    cols: [
      { h: "Races", links: [
        { href: "/polls/senate", label: "Senate averages" },
        { href: "/polls/governor", label: "Governor averages" },
        { href: "/polls/house", label: "House district polls" },
        { href: "/polls/2028", label: "2028 primaries" },
      ] },
      { h: "National", links: [
        { href: "/polls/generic-ballot", label: "Generic ballot" },
        { href: "/polls/approval", label: "Trump approval" },
        { href: "/polls/approval/timeline", label: "Approval timeline", badge: "New" },
        { href: "/polls/generic-ballot/timeline", label: "Generic ballot timeline", badge: "New" },
        { href: "/polls/approval/vance", label: "Vance approval" },
        { href: "/polls/right-track", label: "Right track, wrong track" },
      ] },
      { h: "Archive", links: [
        { href: "/polls/archive/2024", label: "2024 presidential polls" },
        { href: "/on-point-polling/polls", label: "On Point Polling releases" },
      ] },
    ] },
  { key: "results", label: "Results", href: "/results", go: "/results/monitor", live: true,
    feature: { href: "/brasil/monitor", eyebrow: "Brasil · 25 de outubro", title: "Sala de situação", note: "The Brazil runoff count live in every municipality, in Portuguese, with our projection." },
    cols: [
      { h: "Brasil, 2º turno", links: [
        { href: "/brasil/resultados", label: "Apuração ao vivo", note: "Flávio Bolsonaro x Lula, live from the TSE", badge: "Live" },
        { href: "/brasil/monitor", label: "Sala de situação", note: "Every municipality on one map" },
        { href: "/brasil", label: "Previsão do 2º turno", note: "The On Point Brazil forecast" },
      ] },
      { h: "November 3", links: [
        { href: "/results/monitor", label: "Situation monitor", note: "Full screen globe of every race", badge: "New" },
        { href: "/results/2026", label: "Every race", note: "Expected and reported vote, county by county" },
        { href: "/results", label: "Election night desk", note: "Countdown and coverage" },
      ] },
      { h: "Past nights", links: [
        { href: "/results/archive", label: "Results archive", note: "Every tracked night" },
        { href: "/results/archive/2026-08-25", label: "August 25 runoffs" },
        { href: "/results/archive/2026-08-18", label: "August 18 primaries" },
        { href: "/results/archive/2026-08-04", label: "August 4 primaries" },
      ] },
    ] },
  { key: "news", label: "News", href: "/news",
    feature: { href: "/news", eyebrow: "New", title: "The news, from every side", note: "Headlines from Left, Center and Right outlets, grouped by story, with neutral summaries." },
    cols: [
      { h: "Read", links: [
        { href: "/news", label: "Front page", note: "Top stories, summarized", badge: "New" },
        { href: "/news#wire", label: "The live wire", note: "Every outlet, grouped by story" },
      ] },
      { h: "Accountability", links: [
        { href: "/accountability", label: "Accountability Index", note: "Every member of Congress, scored for independence", badge: "New" },
        { href: "/accountability/methodology", label: "How the index works", note: "Sources, weights and gaps" },
      ] },
      { h: "Method", links: [
        { href: "/news/sources", label: "Outlets and ratings", note: "Every outlet and why we rate it" },
      ] },
    ] },
  { key: "early", label: "Early Vote", href: "/maps/early-vote", cols: [] },
  { key: "maps", label: "Maps", href: "/maps",
    cols: [
      { h: "Build and explore", links: [
        { href: "/maps/electoral", label: "Electoral map", note: "Make your own map" },
        { href: "/maps/ballot-measures", label: "Ballot measures map" },
        { href: "/watchdog/counties", label: "County data center", note: "Every county, every layer" },
      ] },
      { h: "Voters", links: [
        { href: "/maps/early-vote", label: "Early vote tracker" },
        { href: "/maps/party-registration", label: "Party registration" },
        { href: "/maps/voter-registration", label: "Voter registration" },
      ] },
    ] },
  { key: "watchdog", label: "Watchdog", href: "/watchdog",
    feature: { href: "/watchdog", eyebrow: "Investigations", title: "Follow the money", note: "Who pays for the midterms and where the money lands." },
    cols: [
      { h: "Money", links: [
        { href: "/watchdog/money", label: "Money flow" },
        { href: "/watchdog/paid", label: "Who gets paid" },
        { href: "/watchdog/connections", label: "Connections" },
        { href: "/accountability", label: "Accountability Index" },
      ] },
      { h: "People and places", links: [
        { href: "/watchdog/trail", label: "Campaign trail" },
        { href: "/watchdog/endorsements", label: "Endorsements" },
        { href: "/watchdog/media", label: "Media watch" },
        { href: "/watchdog/people", label: "People files" },
        { href: "/watchdog/counties", label: "County data center" },
      ] },
    ] },
  { key: "opp", label: "On Point Polling", href: "/on-point-polling",
    cols: [
      { h: "Our polling", links: [
        { href: "/on-point-polling/polls", label: "Poll releases" },
        { href: "/on-point-polling/methodology", label: "Methodology" },
        { href: "/results/monitor", label: "Situation monitor", note: "Election night on one globe" },
      ] },
      { h: "Work with us", links: [
        { href: "/on-point-polling/services", label: "Partner with us" },
        { href: "/on-point-polling/weighting-room", label: "The Weighting Room" },
        { href: "/portal/login", label: "Client portal" },
        { href: "/contact", label: "Contact" },
      ] },
    ] },
];
