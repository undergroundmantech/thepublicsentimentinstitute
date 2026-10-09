# OnPoint Politics rebrand, pass 1, September 28 2026

## Shipped
- Brand: Sora, Manrope and JetBrains Mono; OnPoint tokens in app/globals.css; glass surfaces; dark only.
- Chrome: new header with the white lockup, six nav items, Search and The Weighting Room; ticker with days out and model margins; five column footer.
- Metadata: onpointpolitics.com, title template "%s | OnPoint Politics", new favicon, apple icon and social cards.
- Home page rebuilt to the mock with live data: hero KPIs, forecast map, seat histogram, closest races, county simulation, two polling averages, results desk, TPSI releases, CTA band.
- Route tree: /polls, /forecast/[state]/[race], /maps, /results/live, /tpsi. Every old URL 301s through next.redirects.ts. /v2 and /polling/old return 410.
- /api/polls/[avg] public JSON for every average.
- Poll data used by server pages moved out of client pages into plain data.ts modules; fixes the /polls and /polls/senate crash.
- Home seat histogram now reads chamber.hist as GOP seats and plots Democratic seats correctly.
- .github/skills/opp-ui replaces psi-ui.

## Pass 2
- Restyle the inner pages to the inner template: polling average pages, forecast desk, maps, results, TPSI pages, terms, contact, portal.
- Add /forecast/methodology and /forecast/changelog.
- Page metadata copy sweep, production build, redirect and contrast audit.
