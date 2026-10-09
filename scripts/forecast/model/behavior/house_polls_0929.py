"""District poll entries, Sept 29 2026, by the Sept 19 sweep rule.
The previous table entry enters as one nonpartisan 500 sample reading dated Aug 15, standing for the older record."""
import json, math, datetime as dt
AS_OF = dt.date(2026, 9, 29)
# state, district, pollster, sponsor D/R/'' , end, n, d, r, undecided
P = [
 ("AZG",2,"GBAO","D","2026-08-24",500,44,46,10),("AZG",2,"Peak Insights","R","2026-08-20",400,42,53,5),
 ("KY",6,"Lake Research Partners","D","2026-08-23",400,45,44,11),
 ("ME",2,"Impact Research","D","2026-09-12",500,49,49,2),
 ("NVG",2,"Strategies 360","D","2026-08-26",400,42,45,6),("NVG",2,"GBAO","D","2026-09-03",500,38,37,11),
 ("NH",1,"UNH Granite State Poll","","2026-09-21",711,46,42,11),
 ("NH",2,"Saint Anselm College","","2026-08-18",701,50,35,16),("NH",2,"UNH Granite State Poll","","2026-09-21",702,56,35,6),
 ("NJ",7,"StimSight Research","","2026-09-12",498,47,42,10),
 ("NM",2,"SurveyUSA for KOB 4","","2026-09-02",554,46,43,11),
 ("NYG",21,"J.L. Partners","","2026-08-17",500,40,50,10),("NYG",21,"Impact Research","D","2026-09-02",500,44,47,None),
 ("NYG",21,"Public Policy Polling","D","2026-09-10",557,43,48,None),
 ("NC",1,"GBAO","D","2026-09-11",500,50,43,7),("NC",7,"Public Policy Polling","D","2026-08-20",517,39,45,13),
 ("NC",9,"Lake Research Partners","D","2026-09-03",400,42,46,12),("NC",11,"Public Policy Polling","D","2026-09-11",531,47,44,9),
 ("OH",1,"Quantus Insights","","2026-08-24",509,47,43,9),
 ("PAG",1,"GQR","D","2026-08-23",400,48,49,3),("PAG",1,"Public Opinion Strategies","R","2026-09-14",400,42,51,None),
 ("PAG",7,"Franklin & Marshall","","2026-09-20",357,45,40,16),("PAG",10,"Franklin & Marshall","","2026-09-20",390,47,44,9),
 ("SC",1,"Public Policy Polling","D","2026-09-10",536,40,41,19),
 ("TN",5,"Impact Research","D","2026-08-24",500,40,48,12),("TN",9,"Hart Research Associates","D","2026-09-03",400,44,48,8),
 ("TX",15,"Texas Southern University","","2026-08-22",700,50,45,5),("TX",28,"Texas Southern University","","2026-08-22",600,45,34,15),
 ("TX",34,"Texas Southern University","","2026-08-22",700,45,42,8),("TX",35,"Normington Petts","D","2026-08-31",500,44,45,None),
 ("UT",2,"Crosby campaign","D","2026-09-10",762,30.7,32.4,25),("UT",2,"Crosby campaign","D","2026-09-23",650,34.9,32,23),
 ("VA",1,"DCCC Analytics","D","2026-09-17",519,46,47,7),
 ("AK",1,"Fabrizio Ward and Impact Research for AARP, final round","","2026-09-11",800,43,57,None),
 ("AL",2,"Tulchin Research","D","2026-08-31",400,47,47,None),
 ("CO",8,"McLaughlin and Associates","R","2026-09-17",400,46,48,6),
]
import re, sys
src = open(sys.argv[1]).read()
blk = src[src.index("POLLS = {"):src.index("UNCONTESTED = {")]
old = {}
for st, body in re.findall(r'"([A-Z]+)": \{(.*?)\}(?=,|\})', blk, re.S):
    for d, dv, rv in re.findall(r'(\d+): dict\(d=([\d.]+), r=([\d.]+)\)', body):
        old[(st, int(d))] = (float(dv), float(rv))
def w(end, n, sp):
    days = (AS_OF - dt.date.fromisoformat(end)).days
    return 0.5 ** (days / 45) * math.sqrt(max(n, 400)) * (0.7 if sp else 1.0)
out, log = {}, []
for key in sorted({(p[0], p[1]) for p in P}):
    rows = [p for p in P if (p[0], p[1]) == key and (p[8] is None or p[8] < 20)]
    dropped = [p for p in P if (p[0], p[1]) == key and p not in rows]
    items = []
    for st, dn, pol, sp, end, n, d, r, u in rows:
        if sp == "D": d, r = d - 1.5, r + 1.5
        if sp == "R": d, r = d + 1.5, r - 1.5
        items.append((pol, w(end, n, sp), d, r))
    if key in old:
        items.append(("previous table entry", w("2026-08-15", 500, ""), *old[key]))
    if not items:
        log.append((key, "all polls dropped", [p[2] for p in dropped])); continue
    W = sum(x[1] for x in items)
    d = round(sum(x[1] * x[2] for x in items) / W, 1); r = round(sum(x[1] * x[3] for x in items) / W, 1)
    out[key] = (d, r)
    log.append((key, old.get(key), (d, r), [(x[0], round(x[1], 1)) for x in items], [p[2] for p in dropped]))
json.dump({f"{k[0]}-{k[1]}": v for k, v in out.items()}, open("/tmp/hpolls/new_entries.json", "w"), indent=1)
for l in log: print(l)
