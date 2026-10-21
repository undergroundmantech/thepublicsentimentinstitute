// On Point Politics redirect map: every tpsielections.com URL 301s to its onpointpolitics.us route.
// Domain level: onpointpolitics.us is the one address search engines index. Any other host that reaches
// this deployment, onpointpolitics.com, www and tpsielections.com, is sent there path for path below,
// so links to an old address keep their ranking instead of splitting it across two sites.
// The retired experiments, /v2 and /polling/old/*, are answered 410 Gone by middleware.ts.

type Redirect = { source: string; destination: string; permanent: boolean; has?: { type: "host"; value: string }[] };
const MAIN = "https://onpointpolitics.us";
const OTHER_HOSTS = ["www.onpointpolitics.us", "onpointpolitics.com", "www.onpointpolitics.com", "tpsielections.com", "www.tpsielections.com"];
const p = (source: string, destination: string, permanent = true): Redirect => ({ source, destination, permanent });

export const redirects: Redirect[] = [
  // every other domain to the main one, first so it wins before any path rule
  ...OTHER_HOSTS.map((value): Redirect => ({ source: "/:path*", has: [{ type: "host", value }], destination: `${MAIN}/:path*`, permanent: true })),
  // short addresses people type or search for the early vote tracker
  p("/early-vote", "/maps/early-vote"),
  p("/early-voting", "/maps/early-vote"),
  p("/early-vote-tracker", "/maps/early-vote"),
  p("/early-vote/:state", "/maps/early-vote/:state"),
  // short address for the swingometer
  p("/swingometer", "/forecast/swingometer", false),
  // polls
  p("/polling/donaldtrumpapproval", "/polls/approval"),
  p("/polling/jdvanceapproval", "/polls/approval/vance"),
  // the unified averages page kept its ?race= deep links, which the new page still reads
  p("/polling/genericballot", "/polls/generic-ballot"),
  p("/polling/rightorwrongtrack", "/polls/right-track"),
  p("/polling/senatepolling", "/polls/senate"),
  p("/polling/governorpolling", "/polls/governor"),
  p("/polling/2028polling", "/polls/2028"),
  p("/polling/2025pollingview", "/polls"),
  p("/polling/floridarepublicanprimary", "/polls/fl/governor-gop-primary"),
  p("/polling/texasdemocratprimary", "/polls/tx/senate-dem-primary"),
  p("/polling/texasrepublicanprimary", "/polls/tx/senate-gop-primary"),
  p("/polling/mainedemocratprimary", "/polls/me/senate-dem-primary"),
  // the old New Hampshire page is 2024 presidential polling, so it joins the 2024 archive
  p("/polling/newhampshire", "/polls/archive/2024/nh"),
  p("/polling/2024president", "/polls/archive/2024"),
  p("/polling/:st(az|fl|ga|mi|mn|nc|nj|nm|nv|pa|tx|va|wi)2024president", "/polls/archive/2024/:st"),
  p("/polling", "/polls"),

  // forecast and maps
  p("/forecastratings", "/forecast"),
  p("/electoralmap", "/maps/electoral"),
  p("/partymap", "/maps/party-registration"),
  p("/earlyvote", "/maps/early-vote"),
  p("/earlyvote/:path*", "/maps/early-vote/:path*"),
  // voter registration totals are their own map, kept beside party registration
  p("/voterregistration", "/maps/voter-registration"),

  // results
  p("/results/onpoint", "/results"),
  p("/results/onpoint/:path*", "/results/:path*"),

  // tpsi
  p("/tpsipoll", "/on-point-polling/polls"),
  p("/latestpoll", "/on-point-polling/polls"),
  p("/goldstandard", "/on-point-polling/methodology"),
  p("/situationroom", "/on-point-polling/situation-room"),
  p("/SMSOptIn", "/on-point-polling/sms"),
  // the polling section moved from /tpsi to /on-point-polling on Oct 19 2026; every old link, including the SMS opt in
  // page and the poll pages linked from Substack, lands on its new address
  p("/tpsi", "/on-point-polling"),
  p("/tpsi/:path*", "/on-point-polling/:path*"),
  p("/TermsAndConditions", "/terms"),
];
