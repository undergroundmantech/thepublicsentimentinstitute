// OnPoint Politics redirect map: every tpsielections.com URL 301s to its onpointpolitics.com route.
// Domain level: point tpsielections.com at the same deployment and add a host redirect at the
// edge (Vercel: Domains, redirect tpsielections.com to onpointpolitics.com, 308).
// The retired experiments, /v2 and /polling/old/*, are answered 410 Gone by middleware.ts.

type Redirect = { source: string; destination: string; permanent: boolean };
const p = (source: string, destination: string, permanent = true): Redirect => ({ source, destination, permanent });

export const redirects: Redirect[] = [
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
  p("/results/tonight", "/results/live"),
  p("/results/onpoint", "/results"),
  p("/results/onpoint/:path*", "/results/:path*"),

  // tpsi
  p("/tpsipoll", "/tpsi/polls"),
  p("/latestpoll", "/tpsi/polls"),
  p("/goldstandard", "/tpsi/methodology"),
  p("/situationroom", "/tpsi/situation-room"),
  p("/SMSOptIn", "/tpsi/sms"),
  p("/TermsAndConditions", "/terms"),
];
