"""Builds public/earlyvote-history.json: what early voting looked like in 2022 and 2024, so the 2026 tracker can say
whether a state is ahead of or behind its past pace.

Two kinds of baseline:
  1. Every state: total ballots counted in 2022 and 2024 (US Elections Project turnout files) and the ballots cast by
     mail and early in person (EAC EAVS state data briefs). turnout_baseline.json holds both, with sources.
  2. States with reported counts during early voting: cumulative ballots cast before Election Day (mail or absentee
     returned plus early in person) on dated days, from state election offices and news reports of their data, plus the
     registered party split of those ballots where the state registers by party. HIST below, every count sourced.

Days out are days before Election Day: Nov 8 2022, Nov 5 2024, Nov 3 2026. Election Day is always a Tuesday, so the
same days out falls on the same weekday every year. A count marked "r" was rounded by its source.

Run from the repo root:  python3 scripts/earlyvote/build_history.py
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
BASE = json.load(open(os.path.join(HERE, "turnout_baseline.json")))

# cps: [days out, ballots cast before Election Day so far, "r" if rounded]
# party: [days out, D share, R share] of those ballots by registration; final = the latest split found
HIST = {
 "GA": {
  "2022": {"evStart": 22, "cps": [[22, 143077], [21, 291740], [16, 837597], [15, 986587], [10, 1533594], [8, 1810345], [5, 2261094], [4, 2504956]],
           "src": ["https://sos.ga.gov/news/georgia-voters-continue-sunday-turnout-doubling-2018-record", "https://sos.ga.gov/news/georgia-voters-set-all-time-midterm-early-turnout-record"]},
  "2024": {"evStart": 21, "cps": [[20, 459250], [15, 1592995], [12, 2267342], [8, 2916979], [7, 3204666], [5, 3653333], [3, 4004588]],
           "src": ["https://sos.ga.gov/news/georgia-voters-continue-turning-out-force-day-7-early-voting", "https://sos.ga.gov/news/georgia-voters-break-4-million-votes-during-early-voting-period"]}},
 "NC": {
  "2022": {"evStart": 19, "cps": [[23, 36197], [16, 380769], [13, 796057], [9, 1160747], [5, 1747957], [2, 2152369], [1, 2167503]],
           "party": [[16, .4105, .2919], [1, .3819, .3123]],
           "src": ["https://s3.amazonaws.com/dl.ncsbe.gov/Press/2022%20General/NC%20Absentee%20Stats%20for%202022%20General/2022-10-24%20Daily%20Absentee%20Stats%20Report%20-%202022%20General.pdf", "https://ncsbe.gov/results-data/voter-turnout/2022-general-election-turnout"]},
  "2024": {"evStart": 19, "cps": [[20, 67582], [16, 1031210], [13, 2008166], [9, 2820665], [5, 3861634], [2, 4453339], [1, 4481455]],
           "party": [[16, .3534, .3316], [1, .3239, .3322]],
           "src": ["https://s3.amazonaws.com/dl.ncsbe.gov/Press/2024%20General/NC%20Absentee%20Stats%20for%202024%20General/2024-10-21%20Daily%20Absentee%20Stats%20Report%20-%202024%20General.pdf", "https://ncsbe.gov/results-data/voter-turnout/2024-general-election-turnout"]}},
 "FL": {
  "2022": {"evStart": 15, "cps": [[21, 837948], [17, 1161170], [12, 2172931], [9, 2774204], [5, 3887262], [2, 4788018], [0, 5059413]],
           "party": [[17, .4217, .3825], [0, .3697, .4287]],
           "src": ["https://floridaphoenix.com/2022/10/19/florida-leads-the-nation-in-votes-cast-so-far-in-2022-midterm-election/", "https://files.floridados.gov/media/706191/2022-ge-rptstatuscountsarchive-ev-vbm.pdf"]},
  "2024": {"evStart": 15, "cps": [[22, 526219], [21, 603731], [15, 1683676], [9, 4598924], [7, 5697987], [0, 8392165]],
           "party": [[15, .3945, .4038], [0, .3304, .4289]],
           "src": ["https://www.news4jax.com/news/florida/2024/10/23/florida-gop-grabs-early-voting-edge-turnout-remains-fairly-even-in-duval-county/", "https://files.floridados.gov/media/708588/2024-general-election-43888.pdf"]}},
 "VA": {
  "2022": {"evStart": 46, "cps": [[15, 410000, "r"], [0, 992227]],
           "src": ["https://virginiamercury.com/2022/10/25/more-than-9-million-voters-already-have-cast-their-ballots-in-november-elections/", "https://www.elections.virginia.gov/resultsreports/registrationturnout-statistics/"]},
  "2024": {"evStart": 46, "cps": [[18, 993738], [3, 2289483], [0, 2344581]],
           "src": ["https://epec.substack.com/p/va-early-vote-wk-4-tallies-spikes", "https://epec.substack.com/p/va-early-voting-record-provisional"]}},
 "PA": {
  "2022": {"cps": [[21, 237000, "r"], [15, 556750], [14, 640000, "r"], [12, 733370], [0, 1150000, "r"]],
           "party": [[15, .731, .192], [12, .729, .195]],
           "src": ["https://www.wivb.com/pennsylvania-senate-race/500k-votes-already-cast-in-pennsylvania-midterm-election/amp", "https://penncapital-star.com/?p=45912"]},
  "2024": {"cps": [[20, 631725], [15, 919000, "r"], [14, 1051655], [11, 1252719], [7, 1473825], [6, 1550128], [1, 1790319]],
           "party": [[15, .63, .276], [6, .569, .324]],
           "src": ["https://www.sungazette.com/news/top-news/2024/10/over-1-million-ballots-already-cast-in-pennsylvania/", "https://www.abc27.com/pennsylvania-politics/over-80-of-pennsylvania-mail-ballots-returned-as-of-election-day-eve/amp"]}},
 "MI": {
  "2022": {"evStart": 40, "cps": [[28, 155142], [21, 432960], [15, 771967], [8, 1100000, "r"], [0, 1800000, "r"]],
           "src": ["https://www.michigan.gov/sos/resources/news/2022/10/25/two-weeks-before-election-day-1-point-8-million-absentee-ballots", "https://www.uppermichiganssource.com/2022/11/09/secretary-state-announces-2022-midterm-surpasses-2018-highest-midterm-voter-turnout-michigans-history"]},
  "2024": {"cps": [[21, 672585], [15, 1020000, "r"], [14, 1152141], [7, 1992475], [1, 3196038]],
           "src": ["https://michiganadvance.com/briefs/benson-launches-dashboard-with-data-on-michigan-early-and-absentee-voting/", "https://www.wxyz.com/news/national-politics/america-votes/early-voting-in-michigan-ends-with-more-than-1-2-million-people-casting-their-ballots"]}},
 "WI": {
  "2022": {"cps": [[21, 160000, "r"], [14, 258761], [12, 353929], [6, 593819], [1, 719429]],
           "src": ["https://urbanmilwaukee.com/2022/10/26/early-in-person-voting-begins-in-state/", "https://wpr.org/nearly-90k-absentee-ballots-still-circulating-ahead-tuesday-election"]},
  "2024": {"cps": [[26, 199206], [20, 267524], [18, 305344], [13, 475460], [11, 715395], [8, 858000, "r"], [1, 1510773]],
           "src": ["https://justthenews.com/nation/states/center-square/wisconsin-has-78-ballot-drop-boxes-use-compared-500-2020", "https://www.denvergazette.com/2024/11/04/wisconsin-sees-record-949k-in-person-ballots-for-tuesdays-election/"]}},
 "OH": {
  "2022": {"evStart": 27, "cps": [[7, 817644], [1, 1392767]],
           "src": ["https://www.ohiosos.gov/office/media-center/categories/press-releases/2022-11-01", "https://www.ohiosos.gov/office/media-center/categories/press-releases/2022-11-07"]},
  "2024": {"evStart": 28, "cps": [[18, 668199], [13, 989000, "r"], [11, 1270308], [8, 1640000, "r"], [6, 1825000, "r"], [1, 2532260]],
           "src": ["https://highlandcountypress.com/news/more-660k-ohioans-have-voted-election-so-far", "https://ohiocapitaljournal.com/2024/11/05/nearly-a-third-of-registered-ohio-voters-cast-their-ballots-early-in-the-2024-election/"]}},
 "IA": {
  "2022": {"evStart": 20, "cps": [[14, 70878], [12, 136616], [8, 199358], [5, 272469], [1, 341237], [0, 368071]],
           "party": [[12, .551, .318], [0, .506, .331]],
           "src": ["https://www.bleedingheartland.com/2022/10/20/iowa-absentee-ballot-numbers-in-the-2022-general-election/"]},
  "2024": {"evStart": 20, "cps": [[19, 28103], [15, 112318], [13, 214884], [8, 401760], [5, 517525], [3, 603985], [1, 634836], [0, 675464]],
           "party": [[15, .430, .396], [0, .379, .395]],
           "src": ["https://www.bleedingheartland.com/2024/10/18/iowa-absentee-ballot-numbers-in-the-2024-general-election/"]}},
 "AZ": {
  "2022": {"evStart": 27, "cps": [[14, 365000, "r"], [8, 875000, "r"], [1, 1544753]],
           "src": ["https://news.yahoo.com/arizona-voting-updates-republics-analysis-174548254.html"]},
  "2024": {"evStart": 27, "cps": [[8, 1400000, "r"], [1, 2300000, "r"]],
           "party": [[8, .347, .420], [1, .32, .41]],
           "src": ["https://www.kold.com/2024/10/29/republicans-lead-early-vote-numbers-arizona-even-though-democrats-turnout-is-higher/", "https://www.axios.com/local/phoenix/2024/11/05/arizona-republicans-take-big-early-voting-lead-into-election-day"]}},
 "NV": {
  "2022": {"evStart": 17, "cps": [[10, 300000, "r"], [9, 331000, "r"], [7, 382000, "r"], [6, 430000, "r"], [4, 530000, "r"], [3, 620500, "r"], [2, 660000, "r"], [0, 672000, "r"]],
           "party": [[0, .389, .373]],
           "src": ["https://thenevadaindependent.com/es/article/the-early-voting-blog-2022"]},
  "2024": {"evStart": 17, "cps": [[15, 245356], [13, 320293], [12, 397795], [11, 479436], [9, 635000, "r"], [5, 876000, "r"], [3, 1060000, "r"], [1, 1068977]],
           "party": [[15, .363, .395], [1, .338, .378]],
           "src": ["https://news3lv.com/news/local/over-1m-ballots-cast-in-nevada-heading-into-election-day-gop-with-4-lead-republicans-2024-voter-turnout-democrats-trump-harris", "https://thenevadaindependent.com/article/the-early-voting-blog-2024"]}},
 "CO": {
  "2022": {"evStart": 15, "cps": [[15, 171991], [13, 360593], [9, 537735], [7, 862637], [5, 1099847], [2, 1339399], [0, 1726063]],
           "party": [[15, .3312, .2979], [0, .3147, .2893]],
           "src": ["https://coloradosos.gov/pubs/newsRoom/pressReleases/2022/20221025GeneralElectionReturnReporting15daysout.pdf", "https://coloradosos.gov/pubs/newsRoom/pressReleases/2022/PR20221108BallotReturns2.html"]},
  "2024": {"evStart": 15, "cps": [[14, 636597], [13, 772468], [9, 1059861], [6, 1592308], [5, 1731171], [2, 2092035], [0, 2507472]],
           "party": [[14, .3156, .2802], [0, .2843, .2681]],
           "src": ["https://coloradosos.gov/pubs/newsRoom/pressReleases/2024/2024GeneralElectionReturnReporting13daysout.pdf", "https://coloradosos.gov/pubs/newsRoom/pressReleases/2024/2024GeneralElectionReturnReportingElectionDay9AM.pdf"]}},
 "TX": {
  "2022": {"evStart": 15, "cps": [[9, 3000000, "r"], [4, 5510000, "r"]],
           "src": ["https://www.kxan.com/news/your-local-election-hq/a-week-into-early-voting-which-counties-in-texas-are-seeing-the-highest-turnout/amp/", "https://www.texastribune.org/2022/10/28/texas-2022-election-turnout-tracker/"]},
  "2024": {"evStart": 15, "cps": [[13, 2800000, "r"], [9, 4800000, "r"], [4, 9000000, "r"]],
           "src": ["https://www.texastribune.org/2024/10/25/texas-2024-election-early-vote-turnout/", "https://www.texastribune.org/2024/11/04/texas-early-voting-turnout-rate-down/"]}},
 "CA": {
  "2022": {"evStart": 28, "cps": [[12, 1800000, "r"], [1, 5230699]],
           "src": ["https://elections.cdn.sos.ca.gov/statewide-elections/2022-general/media-releases/10-27-22-over1million-vbm-returned.pdf", "https://elections.cdn.sos.ca.gov/statewide-elections/2022-general/vbm-statistics.pdf"]},
  "2024": {"evStart": 28, "cps": [[18, 1500000, "r"], [15, 1987421], [1, 8000000, "r"]],
           "party": [[1, .48, .30]],
           "src": ["https://elections.cdn.sos.ca.gov/statewide-elections/2024-general/vbm-statistics.pdf", "https://calmatters.org/newsletter/california-election-results-what-to-watch/"]}},
 "ME": {
  "2022": {"evStart": 30, "cps": [[20, 50000, "r"], [12, 117000, "r"], [8, 144578], [4, 205251], [0, 237000, "r"]],
           "src": ["https://www.wgme.com/news/local/more-than-75000-mainers-have-voted-already-early-voting-secretary-state-maine-election-president-2024", "https://www.maine.gov/sos/news/secretary-bellows-visit-polling-places-election-day"]},
  "2024": {"evStart": 29, "cps": [[20, 75000, "r"], [14, 165000, "r"], [8, 243000, "r"], [1, 361924]],
           "src": ["https://www.mainepublic.org/politics/2024-10-22/1-in-4-maine-voters-have-requested-absentee-ballots", "https://www.centralmaine.com/2024/11/04/more-than-one-third-of-maine-voters-cast-ballots-before-election-day/"]}},
 "MN": {
  "2022": {"evStart": 46, "cps": [[26, 99252], [20, 152000, "r"], [7, 376000, "r"], [1, 586000, "r"]],
           "src": ["https://radiomankato.com/absentee-ballot-acceptance-pace-ahead-of-last-mid-term-election-in-mn/", "https://minnesotareformer.com/?p=19045"]},
  "2024": {"evStart": 46, "cps": [[40, 32788], [33, 107421], [26, 220006], [19, 337633], [12, 565909], [5, 919581], [4, 989807], [1, 1174224], [0, 1271636]],
           "src": ["https://sos.mn.gov/about-the-office/news-room/337-633-ballots-accepted-in-first-four-weeks-for-november-5-election/", "https://www.sos.mn.gov/about-the-office/news-room/1-271-636-absentee-and-mail-ballots-accepted-for-november-5-election/"]}},
 "NJ": {
  "2022": {"evStart": 10, "cps": [[20, 270719], [18, 303008], [15, 320936], [8, 493414], [7, 529611], [6, 568734], [4, 642305], [3, 684072], [2, 725595]],
           "src": ["https://newjerseyglobe.com/campaigns/returned-n-j-mail-in-ballots-now-over-300000/", "https://nj.gov/www.nj.gov/state/press-2022-1107.shtml"]},
  "2024": {"evStart": 10, "cps": [[32, 165000, "r"], [26, 291651], [21, 350000, "r"], [15, 470657], [14, 500810], [10, 589353], [9, 858031], [4, 1607140], [2, 1936020]],
           "party": [[15, .622, .206], [2, .446, .287]],
           "src": ["https://newjerseyglobe.com/voters/vote-by-mail-update-470k-have-voted-in-new-jersey/", "https://newjerseyglobe.com/voters/with-early-voting-done-new-jerseyans-have-cast-1-9-million-ballots/"]}},
 "NE": {
  "2022": {"cps": [[7, 153035], [1, 209120], [0, 264478]],
           "party": [[1, .377, .476]],
           "src": ["https://civicnebraska.org/20221107-new-record-early-vote-nebraska-midterms/"]},
  "2024": {"evStart": 29, "cps": [[7, 249235], [1, 332455]],
           "src": ["https://sos.nebraska.gov/sites/default/files/doc/news-releases/Secretary%20of%20State%20predicts%20turnout%20for%20General%20Election.pdf"]}},
 "SC": {
  "2022": {"evStart": 15, "cps": [[6, 431000, "r"], [5, 489500, "r"], [3, 612000, "r"]],
           "src": ["https://scvotes.gov/south-carolinians-vote-early-in-record-numbers/", "https://www.southcarolinapublicradio.org/sc-news/2022-11-07/nearly-1-in-5-in-sc-have-already-voted-in-2022-midterms"]},
  "2024": {"evStart": 15, "cps": [[3, 1572000, "r"]],
           "src": ["https://scvotes.gov/south-carolinians-set-new-records-with-historic-pre-election-day-turnout/"]}},
 "MD": {
  "2022": {"evStart": 12, "cps": [[8, 475290], [6, 614000, "r"]],
           "party": [[0, .649, .212]],
           "src": ["https://www.wusa9.com/article/news/politics/one-week-until-election-day-heres-how-many-people-have-voted-in-the-dmv-mail-in-ballots-early-voting/65-a35ff344-16a3-4fea-874e-0d07dfad67b4", "https://elections.maryland.gov/press_room/2022_stats/GG22/Official by Party and County.pdf"]},
  "2024": {"evStart": 12, "cps": [[9, 918453], [5, 1563022]],
           "party": [[0, .579, .246]],
           "src": ["https://marylandmatters.org/2024/11/01/nearly-1-million-voters-cast-ballots-over-eight-days-of-early-voting/", "https://elections.maryland.gov/press_room/2024_stats/PG24/Official by Party and County.pdf"]}},
}

# state turnout where a state's own certified count is better than a rounded placeholder in the turnout file
TURNOUT_FIX = {("PA", "2024"): 7034206, ("TX", "2024"): 11388674}


def year(st, yr):
    b = BASE["states"].get(st) if st != "US" else BASE["US"]
    tk, mk = ("t22", "mode22_n") if yr == "2022" else ("t24", "mode24_n")
    turnout = TURNOUT_FIX.get((st, yr)) or (b or {}).get(tk)
    m = (b or {}).get(mk) or {}
    eavs = (m.get("mail") or 0) + (m.get("early") or 0) if m else None
    h = HIST.get(st, {}).get(yr, {})
    cps = sorted([[c[0], c[1]] + (["r"] if len(c) > 2 else []) for c in h.get("cps", [])], key=lambda c: -c[0])
    # the early vote total: the last count before polls opened where one was reported, else the EAVS mail plus early
    # in person count, which also takes in mail that arrived on Election Day
    if cps:
        early, basis = cps[-1][1], "reported"
    elif eavs:
        early, basis = eavs, "eavs"
    else:
        early, basis = None, None
    out = {"turnout": turnout, "early": early, "earlyBasis": basis}
    if m.get("mail") is not None: out["mail"] = m["mail"]
    if m.get("early") is not None: out["inperson"] = m["early"]
    if cps: out["cps"] = cps
    if h.get("evStart") is not None: out["evStart"] = h["evStart"]
    if h.get("party"): out["party"] = h["party"]
    if h.get("src"): out["src"] = h["src"]
    return out


states = {}
for st in sorted(BASE["states"]):
    states[st] = {"2022": year(st, "2022"), "2024": year(st, "2024")}
out = {
    "meta": {
        "built": "2026-10-18",
        "electionDay": {"2022": "2022-11-08", "2024": "2024-11-05", "2026": "2026-11-03"},
        "sources": {
            "turnout": ["https://election.lab.ufl.edu/data-downloads/turnoutdata/Turnout_2022G_v1.1.csv", "https://election.lab.ufl.edu/data-downloads/turnoutdata/Turnout_2024G_v0.4.csv"],
            "modes": "U.S. Election Assistance Commission, Election Administration and Voting Survey state data briefs, 2022 and 2024",
            "counts": "State election offices and news reports of their data; each state lists its own",
        },
        "note": "cps are [days out, ballots cast before Election Day so far] with an r for a count its source rounded; party is [days out, Democratic share, Republican share] of those ballots by registration",
    },
    "us": {"2022": year("US", "2022"), "2024": year("US", "2024")},
    "states": states,
}
p = os.path.join(ROOT, "public", "earlyvote-history.json")
json.dump(out, open(p, "w"), separators=(",", ":"))
print("wrote", p, os.path.getsize(p), "bytes;", sum(1 for s in states.values() if s["2022"].get("cps") or s["2024"].get("cps")), "states with counts")
