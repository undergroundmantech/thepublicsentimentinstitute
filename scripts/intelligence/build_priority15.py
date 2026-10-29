#!/usr/bin/env python3
"""Builds the priority-15 research package, source register, state dataset and build manifest.

Reproducible from committed inputs plus the local source cache. Inputs:
  scripts/intelligence/research/sources.json            source manifest (URLs, publishers, tiers)
  scripts/intelligence/research/sequence_findings.json  curated findings, each with a verbatim evidence anchor
  .cache/intelligence-sources/{fetch-log.jsonl,text/}   made by research/fetch_sources.py (not committed)
  data/intelligence/seed/priority15-seed-normalized.json made by research/normalize_seed.py
  data/intelligence/historical/medsl-method-aggregates-2026-10-26.json made by research/medsl_reconcile.py
Every curated value was read from the source named beside it. The build checks each verbatim anchor against the cached
text of its source and STOPS with a message when a source was not retrieved, was marked unusable, or no longer contains
its anchor. Nothing is filled in from memory, and a value with no usable source is not supplied.

Run from anywhere:   python3 scripts/intelligence/build_priority15.py            # writes the outputs
                     python3 scripts/intelligence/build_priority15.py --check    # rebuilds and compares with the committed files
Outputs are a pure function of the inputs: no wall-clock time is used (timestamps come from the fetch log).
"""
import csv, hashlib, json, os, re, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
os.chdir(ROOT)
sys.path.insert(0, os.path.join(HERE, "research"))
from fetch_sources import norm, FETCH_VERSION  # noqa: E402

BUILD_VERSION = "build_priority15/2"
PACKAGE_SCHEMA = "priority15-package/2"
BUILD_MANIFEST_SCHEMA = "priority15-build-manifest/1"
CHECK = "--check" in sys.argv

MANIFEST = "scripts/intelligence/research/sources.json"
FINDINGS = "scripts/intelligence/research/sequence_findings.json"
LOG = ".cache/intelligence-sources/fetch-log.jsonl"
TEXT = ".cache/intelligence-sources/text"
SEED = "data/intelligence/seed/priority15-seed-normalized.json"
AGG = "data/intelligence/historical/medsl-method-aggregates-2026-10-26.json"
VOTERREG = "data/voter-registration/states_summary.csv"
OUT_PKG = "data/intelligence/research/priority15-reporting-2026-10-26.json"
OUT_REG = "data/intelligence/sources/register-2026-10-26.json"
OUT_STATES = "data/intelligence/states/priority15-2026-10-26.json"
OUT_BUILD = "data/intelligence/build/priority15-build-manifest-2026-10-26.json"


def fail(msg):
    sys.exit("BUILD STOPPED: " + msg)


def sha(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


for need_path, how in ((LOG, "python3 scripts/intelligence/research/fetch_sources.py"), (SEED, "python3 scripts/intelligence/research/normalize_seed.py"),
                       (AGG, "python3 scripts/intelligence/research/medsl_reconcile.py")):
    if not os.path.exists(need_path):
        fail(f"{need_path} is missing. Create it with: {how}")

manifest = json.load(open(MANIFEST))
sources = {s["id"]: s for s in manifest["sources"]}
log = {}
for line in open(LOG):
    d = json.loads(line)
    log[d["id"]] = d
USED = collections.Counter()
_text = {}


def usable(sid):
    """None when the source is usable, else the reason it is not."""
    s, lg = sources.get(sid), log.get(sid)
    if s is None:
        return "not in sources.json"
    if s.get("unusable"):
        return "marked unusable: " + s["unusable"]
    if lg is None:
        return "no fetch-log entry; run fetch_sources.py"
    if lg.get("error") or lg.get("http") != 200:
        return "retrieval failed: " + str(lg.get("error") or f"HTTP {lg.get('http')}")
    if lg.get("anchorsMissing"):
        return "anchors missing from retrieved text: " + "; ".join(lg["anchorsMissing"])
    if not os.path.exists(f"{TEXT}/{sid}.txt"):
        return "extracted text is not in the cache; run fetch_sources.py"
    return None


for sid, s in sources.items():
    if s.get("required") and usable(sid):
        fail(f"required source {sid} ({s['url']}) is not usable: {usable(sid)}")


def verify_anchor(sid, anchor):
    why = usable(sid)
    if why:
        fail(f"source {sid} cannot support a finding: {why}")
    if sid not in _text:
        _text[sid] = norm(open(f"{TEXT}/{sid}.txt", errors="replace").read())
    if norm(anchor) not in _text[sid]:
        fail(f"the evidence anchor {anchor!r} is not in the retrieved text of {sid} ({sources[sid]['url']}). "
             f"The page changed or was retrieved incompletely; re-run fetch_sources.py and re-verify the finding before building.")


def src_meta(sid):
    why = usable(sid)
    if why:
        fail(f"source {sid} is used by a record but is not usable: {why}")
    USED[sid] += 1
    s = sources[sid]
    return s["url"], s["publisher"], s["title"], s.get("pageDate"), s["tier"], log[sid]


RACES = {
    "AK": ["sen-AK"], "AZ": ["house-AZ-08", "house-AZ-02"], "CO": ["house-CO-04", "house-CO-05", "house-CO-03"],
    "FL": ["house-FL-04", "house-FL-22", "house-FL-09", "house-FL-26"], "GA": ["gov-GA"], "IA": ["sen-IA", "house-IA-02"],
    "KS": ["sen-KS", "gov-KS", "house-KS-02"], "ME": ["sen-ME", "house-ME-02"], "NE": ["sen-NE", "gov-NE", "house-NE-01"],
    "NY": ["house-NY-01", "house-NY-11", "house-NY-02", "house-NY-17"], "OH": ["sen-OH", "house-OH-15", "house-OH-09", "house-OH-08"],
    "PA": ["house-PA-10", "house-PA-08"], "SC": ["sen-SC", "house-SC-01"], "TX": ["sen-TX", "gov-TX", "house-TX-35", "house-TX-24"],
    "WI": ["gov-WI", "house-WI-01"],
}
STATES = list(RACES)


# ---- poll close: statute or official-calendar text read on the retrieval date ----------------------------------------------
# state -> (src id, local text, cite, closes_at_utc | None, time zone text, confidence, limitations, anchors, closes_local, time_zone_rule)
# A poll-closing time is when voting ends. It is not a results release time and nothing here derives one from it.
POLL = {
    "AK": ("AK_CH15", "polls close at eight o'clock in the evening", "AS 15.15.080", "2026-11-04T05:00:00Z", "Alaska Standard Time (UTC-9)", "HIGH", ["The statute allows an exception in (b); the Aleutian zone is not separately researched"], ["shall close the polls for voting at eight o'clock in the evening"], None, None),
    "AZ": ("AZ_16_565", "polls closed at 7:00 p.m.", "A.R.S. 16-565(A)", "2026-11-04T02:00:00Z", "Mountain Standard Time (UTC-7), Arizona does not observe daylight time", "HIGH", [], ["shall be closed at 7:00 p.m."], None, None),
    "CO": ("CO_1_7_101", "polling locations remain open until 7 p.m. and stay open for electors in line at 7 p.m.", "C.R.S. 1-7-101", "2026-11-04T02:00:00Z", "Mountain Standard Time (UTC-7)", "MEDIUM", ["Read from a public mirror of the statute, not the legislature's own page"], ["open continuously from 7 a.m. until 7 p.m. on election day"], None, None),
    "FL": ("FL_100_011", "polls kept open until 7:00 p.m., regulated by the customary time in standard use in the county seat", "Fla. Stat. 100.011", "2026-11-04T01:00:00Z", "7 p.m. local: 00:00Z in Eastern counties, 01:00Z in the Central-time panhandle counties; the later instant is recorded", "MEDIUM", ["The statute does not list which counties are in Central time; that assignment is general knowledge, not from the source", "Eastern counties close one hour earlier (00:00Z)"], ["kept open until 7:00 p.m."], None, None),
    "GA": ("GA_GOV_GENERAL_2026", "Polls are open from 7 a.m. to 7 p.m.; anyone in line before 7 p.m. may vote", "Georgia 2026 General Election page (georgia.gov)", "2026-11-04T00:00:00Z", "Eastern Standard Time (UTC-5); daylight time ended 2026-11-01", "HIGH", ["Official state page; the statute (O.C.G.A. 21-2-403) was not retrievable"], ["Polls are open from 7 a.m. to 7 p.m."], None, None),
    "IA": ("IA_49_73", "polling places shall be closed at 8:00 p.m. for all elections", "Iowa Code 49.73", "2026-11-04T02:00:00Z", "Central Standard Time (UTC-6)", "HIGH", [], ["the polling places shall be closed at 8:00 p.m. for all elections"], None, None),
    "KS": ("KS_25_106", "polls close at 7:00 p.m. in central-time counties and 6:00 p.m. in mountain-time counties, unless the county election officer sets and announces different hours", "K.S.A. 25-106", "2026-11-04T01:00:00Z", "7 p.m. CST (UTC-6) and 6 p.m. MST (UTC-7) are the same instant", "HIGH", ["A county election officer may set different publicly announced hours"], ["close at 7:00 p.m., unless different hours are set and publicly announced", "close at 6:00 p.m."], None, None),
    "ME": ("ME_626", "polls must be closed at 8 p.m. on election day, except in municipalities under 100 population that may close after all registered voters have voted", "21-A M.R.S. 626", "2026-11-04T01:00:00Z", "Eastern Standard Time (UTC-5)", "HIGH", ["Municipalities under 100 population may close earlier"], ["the polls must be closed at 8 p.m. on election day"], None, None),
    "NE": ("NE_32_908", "polls close at 8 p.m. in Central-time areas and 7 p.m. in Mountain-time areas", "Neb. Rev. Stat. 32-908(1)", "2026-11-04T02:00:00Z", "8 p.m. CST (UTC-6) and 7 p.m. MST (UTC-7) are the same instant", "HIGH", ["Voters in line at closing may vote"], ["close at 8 p.m. of the same day", "close at 7 p.m. of the same day"], None, None),
    "NY": ("NY_8_100", "polls open six o'clock in the morning until nine o'clock in the evening for a general election", "N.Y. Election Law 8-100(2)", "2026-11-04T02:00:00Z", "Eastern Standard Time (UTC-5)", "MEDIUM", ["Read from a public mirror of the statute, not the state's own page"], ["the general election from six o'clock in the morning until nine o'clock in the evening"], None, None),
    "OH": ("OH_3501_32", "polls closed by proclamation at seven-thirty p.m.", "R.C. 3501.32(A)", "2026-11-04T00:30:00Z", "Eastern Standard Time (UTC-5)", "HIGH", ["An island polling place may close early if every registered voter has voted"], ["closed by proclamation at seven-thirty p.m."], None, None),
    "PA": ("PA_UPCOMING_ELECTIONS", "Polls are open on election day from 7 A.M. - 8 P.M.", "Pennsylvania Department of State, upcoming elections page", "2026-11-04T01:00:00Z", "Eastern Standard Time (UTC-5)", "HIGH", ["Official state calendar page; the statute page was not retrievable with its text"], ["Polls are open on election day from 7 A.M. - 8 P.M."], None, None),
    "SC": ("SC_7_13_60", "polls opened at seven o'clock a.m. and closed at seven o'clock p.m.", "S.C. Code 7-13-60", "2026-11-04T00:00:00Z", "Eastern Standard Time (UTC-5)", "HIGH", [], ["closed at seven o'clock p.m."], None, None),
    "TX": ("TX_SOS_ADVISORY_2026_21", "7:00 a.m. - 7:00 p.m. Polls open. (Sec. 41.031)", "Texas Secretary of State Election Advisory 2026-21 (Nov. 3 election law calendar); Tex. Elec. Code 41.031", None, "7:00 p.m. local time in each county. Texas spans Central and Mountain time, so there is no single statewide instant", "HIGH", ["Closing is a local clock time; the instant differs by county time zone and is deliberately not recorded as one UTC value", "No county time-zone table was sourced, so none is supplied"], ["7:00 a.m. - 7:00 p.m. Polls open. (Sec. 41.031)"], "19:00", "PER_COUNTY_LOCAL"),
    "WI": ("WI_6_78", "polls at every election open from 7 a.m. until 8 p.m.", "Wis. Stat. 6.78(1m)", "2026-11-04T02:00:00Z", "Central Standard Time (UTC-6)", "HIGH", [], ["the polls at every election shall be open from 7 a.m. until 8 p.m."], None, None),
}
assert set(POLL) == set(STATES)

# ---- NCSL tables: processing and scanning, results unit, receipt, UOCAVA, provisional --------------------------------
PROC = {  # (processing, scanning)
    "AK": ("No less than seven days before Election Day (review of absentee voter certificates)", "Counting may not begin before 8:00 p.m. local time on Election Day"),
    "AZ": ("Upon receipt", "Immediately after processing"),
    "CO": ("Upon receipt", "Fifteen days before Election Day; counties with more than 10,000 active voters must begin no later than four days before"),
    "FL": ("Upon receipt", "After public testing of automatic tabulating equipment"),
    "GA": ("Upon receipt; further processing from 8 a.m. on the third Monday before Election Day", "Third Monday before Election Day"),
    "IA": ("The day before Election Day if directed by the commissioner", "On Election Day at a time set so the absentee count can finish by 10 p.m.; the commissioner may convene the day before"),
    "KS": ("Prior to Election Day; exact timing not specified", "May scan prior to Election Day"),
    "ME": ("Seven days before Election Day if notice of processing times is posted 30 days ahead", "Seven days before Election Day"),
    "NE": ("From the second Friday before Election Day", "Twenty-four hours before polls open"),
    "NY": ("Within four days of receipt", "From the day before the first day of early voting"),
    "OH": ("Before Election Day; timing not specified", "Before Election Day; timing not specified"),
    "PA": ("7 a.m. on Election Day", "7 a.m. on Election Day"),
    "SC": ("7 a.m. two days before Election Day", "7 a.m. on Election Day"),
    "TX": ("No more than 20 days before Election Day", "At polls opening on Election Day; jurisdictions of 100,000 or more may start the fourth day before"),
    "WI": ("After the polls open on Election Day", "After the polls open on Election Day"),
}
CITE16 = {"AK": "Alaska Stat. 15.20.201", "AZ": "A.R.S. 16-550, 16-551", "CO": "C.R.S. 1-7.5-107.5", "FL": "Fla. Stat. 101.68, 101.5612", "GA": "O.C.G.A. 21-2-386", "IA": "Iowa Code 53.23", "KS": "K.S.A. 25-1134", "ME": "21-A M.R.S. 759, 760-B", "NE": "Neb. Rev. Stat. 32-1027", "NY": "N.Y. Election Law 9-209", "OH": "R.C. 3509.06", "PA": "25 P.S. 3146.8", "SC": "S.C. Code 7-15-420", "TX": "Tex. Elec. Code 87.0241, 87.027, 87.041, 87.042", "WI": "Wis. Stat. 6.88, 7.52"}
UNIT = {  # NCSL17
    "AK": ("By election district", "Alaska Stat. 15.20.201"), "AZ": ("By precinct or election district. The Secretary of State describes 'Precincts Reporting' as a count of voting locations reporting, not ballots", "A.R.S. 16-622"),
    "CO": ("By precinct", "C.R.S. 1-7-601"), "FL": ("By precinct", "Fla. Stat. 101.68, 98.0981"), "GA": ("By precinct", "O.C.G.A. 21-2-386"),
    "IA": ("A special absentee ballot and special voters precinct is set up in each county; in general elections absentee results are also reported by the voter's resident precinct", "Iowa Code 53.20, 53.23"),
    "KS": ("By precinct", "K.S.A. 25-1134, 25-3206"), "ME": ("By precinct, with military and overseas results counted centrally and reported separately", "21 M.R.S. 759, 760-A"), "NE": ("By precinct", "Neb. Rev. Stat. 32-1036"),
    "NY": ("By election district", "N.Y. Election Law 9-209"), "OH": ("By precinct", "R.C. 3509.06"), "PA": ("By election district", "25 P.S. 3146.8"),
    "SC": ("An absentee voting precinct for counting all absentee ballots is established in each county", "S.C. Code 7-15-420"),
    "TX": ("By precinct; the report includes the number of early in-person and absentee voters in each precinct", "Tex. Elec. Code 67.017"), "WI": ("By ward", "Wis. Stat. 6.88, 7.52"),
}
SEPARATION = {  # only where NCSL17 states it for the state
    "IA": "Absentee results are reported in a separate special precinct per county, and also by voter's resident precinct in general elections",
    "ME": "Military and overseas results are counted centrally and reported separately",
    "SC": "Each county has an absentee voting precinct, so absentee results form their own reporting unit",
    "TX": "The precinct report states the number of early in-person and absentee voters; the candidate split by method is not stated",
}
LATE = {  # NCSL11 domestic
    "AK": "Counted if postmarked on or before Election Day and received within 10 days (AS 15.20.081)", "AZ": "Must be received by 7 p.m. Election Day (A.R.S. 16-548)",
    "CO": "Must be received by 7 p.m. Election Day", "FL": "Must be received by 7 p.m. Election Day (Fla. Stat. 101.67)", "GA": "Must be received by close of polls (O.C.G.A. 21-2-386(F))",
    "IA": "Must be received before close of polls (Iowa Code 53.17(2))", "KS": "Statute (SB 4, 2025) sets close of polls but a July 2026 preliminary injunction restores receipt by the third day after if postmarked by Election Day (K.S.A. 25-1132)",
    "ME": "Must be received by close of polls (21-A M.R.S. 755)", "NE": "Must be received by close of polls (Neb. Rev. Stat. 32-950)", "NY": "Counted if postmarked by Election Day and received within 7 days (N.Y. Election Law 8-412)",
    "OH": "Must be received by close of polls (R.C. 3509.05)", "PA": "Must be received by 8 p.m. Election Day (25 P.S. 3146.8)", "SC": "Must be received by close of polls (S.C. Code 7-15-420)",
    "TX": "Counted if postmarked by Election Day and received by 5 p.m. the day after (Tex. Elec. Code 86.007)", "WI": "Must be received by 8 p.m. Election Day (Wis. Stat. 6.87(6))",
}
UOCAVA = {  # NCSL11
    "AK": "Received by close of business on the 15th day after the general election if mailed by Election Day", "AZ": "Received by 7 p.m. Election Day", "CO": "Received by close of business on the 8th day after Election Day",
    "FL": "Uniformed-service voters in the U.S.: received by 7 p.m. Election Day; overseas voters: received within 10 days", "GA": "Received within 3 days if postmarked by Election Day",
    "IA": "Received by noon the Monday after, if postmarked by the day before Election Day", "KS": "Received by close of polls", "ME": "Received before close of polls", "NE": "Received by close of polls",
    "NY": "General election: received within 13 days", "OH": "Received by the 4th day after Election Day; no postmark required", "PA": "Received by 5 p.m. on the 7th day after if sent by 11:59 p.m. the day before Election Day",
    "SC": "Received by close of business the business day before the county canvass, held the Friday after the election", "TX": "Overseas non-military: received by the 5th day after if postmarked by 7 p.m. Election Day; military using the FPCA: received by the 6th day after",
    "WI": "Received by 8 p.m. Election Day",
}
PROV = {  # NCSL provisional-ballots page
    "AK": ("Fifteen days", "Alaska Stat. 15.20.205"), "AZ": ("Ten business days after the general federal election", "2023 Elections Procedures Manual"),
    "CO": ("Fourteen days after a general election", "C.R.S. 1-8.5-105(5)"), "FL": ("Provisional ballot count must be completed by noon on the fourth day after a general election", "information from a state election official, per NCSL"),
    "GA": ("Three days to prove identity or for the registrar to verify registration", "O.C.G.A. 21-2-419(c)(1)"), "IA": ("Thursday after Election Day", None),
    "KS": ("Counted at the intermediate canvass by the county board of canvassers on the Monday or second Thursday after the election", "K.S.A. 25-3104"), "ME": ("A reasonable time after the election", "21-A M.R.S. 673"),
    "NE": ("Verification completed within seven days after the election", "Neb. Rev. Stat. 32-1002"), "NY": ("No more than 14 days after a general election", "N.Y. Election Law 9-209"),
    "OH": ("Until the eleventh day after the election, or earlier if a hearing is held", "R.C. 3505.183"), "PA": ("Seven days", None),
    "SC": ("Before the board of canvassers meets, on the Friday following a general election", "S.C. Code 7-13-830, 7-17-10, 7-17-510"), "TX": ("Seven to thirteen days", "Tex. Elec. Code 65.051"),
    "WI": ("4 p.m. the Friday after the election", "Wis. Stat. 7.52"),
}
CANVASS = {
    "SC": ("County board of canvassers meets on the Friday following a general election", "S.C. Code 7-13-830, 7-17-10, 7-17-510", "NCSL_PROV"),
    "KS": ("Intermediate canvass by the county board of canvassers on the Monday or second Thursday following the election", "K.S.A. 25-3104", "NCSL_PROV"),
}


records = []
def add(rec):
    records.append(rec)

def base(rid, rtype, state, sid, conf, evidence="VERIFIED", limitations=None, notes=None, race=None, hist_year=None, value_kind="OBSERVATION"):
    url, pub, title, pdate, tier, lg = src_meta(sid)
    r = {"recordId": rid, "recordType": rtype, "raceId": race, "state": state, "jurisdictionId": "STATE", "jurisdictionLevel": "STATE",
         "evidenceClass": evidence, "valueKind": value_kind, "sourceUrl": url, "sourceName": f"{pub}: {title}", "sourceTier": tier,
         "retrievedAt": lg["retrieved_at"], "confidence": conf, "limitations": limitations or [], "notes": notes}
    if pdate: r["publishedAt"] = pdate
    if hist_year: r["historicalYear"] = hist_year
    return r

for st in STATES:
    # poll close: a poll-closing time, not a results release time
    sid, text, cite, utc, tz, conf, lim, anchors, local, rule = POLL[st]
    for a in anchors:
        verify_anchor(sid, a)
    r = base(f"p2-pollclose-{st}", "POLL_CLOSE", st, sid, conf, limitations=lim,
             notes=f"{cite}: {text}. {tz}. This is when voting ends, not when results are released. Evidence anchor: " + "; ".join(f'"{a}"' for a in anchors))
    r["closesAtUtc"] = utc
    r["closesLocal"] = local
    r["timeZoneRule"] = rule
    add(r)
    # legal processing and scanning (NCSL16, except Alaska scanning which the statute states directly)
    proc, scan = PROC[st]
    cite = CITE16[st]
    r = base(f"p2-time-proc-{st}", "RELEASE_TIMING", st, "NCSL16", "MEDIUM", limitations=["Secondary summary of the statute; not a release time"], notes="Legal processing time only. It says nothing about when results are published.")
    r.update({"timingKind": "LEGAL_PROCESSING_TIME", "localText": proc, "statuteCite": cite}); add(r)
    if st == "AK":
        r = base(f"p2-time-scan-{st}", "RELEASE_TIMING", st, "AK_15_20_201", "HIGH", limitations=["Statute text of the district absentee counting provision; not a release time"], notes="Legal scanning/counting time only. It says nothing about when results are published.")
        r.update({"timingKind": "LEGAL_SCANNING_TIME", "localText": "Counting of absentee ballots begins at 8:00 p.m. local time on Election Day; an election supervisor may not count absentee ballots before then", "timeZone": "Alaska local time", "statuteCite": "AS 15.20.201(b); AS 15.15.350(b)"}); add(r)
    else:
        r = base(f"p2-time-scan-{st}", "RELEASE_TIMING", st, "NCSL16", "MEDIUM", limitations=["Secondary summary of the statute; not a release time"], notes="Legal scanning time only. It says nothing about when results are published.")
        r.update({"timingKind": "LEGAL_SCANNING_TIME", "localText": scan, "statuteCite": cite}); add(r)
    # Arizona documents a first-release statement
    if st == "AZ":
        r = base("p2-time-expected-AZ", "RELEASE_TIMING", st, "AZSOS", "MEDIUM", limitations=["States a lower bound and 'sporadic' updates, not an exact time or a county schedule"], notes="Arizona Secretary of State, election-night description.")
        r.update({"timingKind": "OFFICIAL_EXPECTED_RELEASE_TIME", "localText": "The first batch of election results will be available after 8:00 p.m. on election night; after that results are updated sporadically as counties receive data from polling locations"}); add(r)
    # reporting practice
    unit, ucite = UNIT[st]
    r = base(f"p2-unit-{st}", "REPORTING_PRACTICE", st, "NCSL17", "MEDIUM", limitations=["Secondary summary; page dated 2024-10-15"])
    r.update({"practiceKind": "REPORTING_UNIT", "summary": unit, "statuteCite": ucite}); add(r)
    if st in SEPARATION:
        r = base(f"p2-sep-{st}", "REPORTING_PRACTICE", st, "NCSL17", "MEDIUM", limitations=["Secondary summary; says how results are organized, not when each part is released"])
        r.update({"practiceKind": "METHOD_SEPARATION", "summary": SEPARATION[st], "statuteCite": ucite}); add(r)
    r = base(f"p2-late-{st}", "REPORTING_PRACTICE", st, "NCSL11", "MEDIUM", limitations=["Secondary summary; the cited statute governs"])
    r.update({"practiceKind": "LATE_BALLOT_RULE", "summary": LATE[st]}); add(r)
    r = base(f"p2-uocava-{st}", "REPORTING_PRACTICE", st, "NCSL11", "MEDIUM", limitations=["Secondary summary; the cited statute governs"])
    r.update({"practiceKind": "UOCAVA_RULE", "summary": UOCAVA[st]}); add(r)
    ptext, pcite = PROV[st]
    r = base(f"p2-prov-{st}", "REPORTING_PRACTICE", st, "NCSL_PROV", "MEDIUM", limitations=["Secondary summary; page dated 2025-04-16"])
    r.update({"practiceKind": "PROVISIONAL_RULE", "summary": ptext, "statuteCite": pcite}); add(r)
    if st in CANVASS:
        ctext, ccite, csid = CANVASS[st]
        r = base(f"p2-canvass-{st}", "REPORTING_PRACTICE", st, csid, "MEDIUM", limitations=["Secondary summary; the county canvass date is not the state certification date"])
        r.update({"practiceKind": "CANVASS_CERTIFICATION", "summary": ctext, "statuteCite": ccite}); add(r)
# Alaska ranked-choice (statute text read directly)
r = base("p2-rcv-AK", "REPORTING_PRACTICE", "AK", "AK_CH15", "HIGH", limitations=["Tabulation order and timing of rounds are not stated in what was retrieved"])
r.update({"practiceKind": "RANKED_CHOICE", "summary": "General elections are conducted by ranked-choice voting: each ballot is first tabulated for its highest-ranked continuing candidate, and tabulation proceeds in rounds unless a candidate has more than half of active ballots", "statuteCite": "AS 15.15.350(c)-(d)"}); add(r)


# ---- sequence findings (curated, anchored) ---------------------------------------------------------------------------------
FIND = json.load(open(FINDINGS))
for f in FIND["findings"]:
    verify_anchor(f["sourceId"], f["anchor"])
    r = base(f"p2b-seq-{f['id']}", "REPORTING_PRACTICE", f["state"], f["sourceId"], f["confidence"], limitations=f["limitations"],
             notes=f"Evidence anchor: \"{f['anchor']}\"")
    r.update({"practiceKind": "SEQUENCE_FINDING", "summary": f["summary"], "statuteCite": f["cite"], "ballotCategory": f["category"], "sequenceFact": f["fact"]})
    add(r)
for f in FIND["practices"]:
    verify_anchor(f["sourceId"], f["anchor"])
    r = base(f"p2b-prac-{f['id']}", "REPORTING_PRACTICE", f["state"], f["sourceId"], f["confidence"], limitations=f["limitations"],
             notes=f"Evidence anchor: \"{f['anchor']}\"")
    r.update({"practiceKind": f["kind"], "summary": f["summary"], "statuteCite": f["cite"]})
    add(r)
for f in FIND["timings"]:
    verify_anchor(f["sourceId"], f["anchor"])
    r = base(f"p2b-time-{f['id']}", "RELEASE_TIMING", f["state"], f["sourceId"], f["confidence"], limitations=f["limitations"],
             notes=f"Evidence anchor: \"{f['anchor']}\"")
    r.update({"timingKind": f["kind"], "localText": f["localText"], "statuteCite": f["cite"]})
    add(r)


# ---- candidate votes by method (MEDSL aggregates and their reconciliation) -----------------------------------------------
agg = json.load(open(AGG))
if agg.get("schemaVersion") != "medsl-method-aggregates/2":
    fail(f"{AGG} has schema {agg.get('schemaVersion')!r}; expected medsl-method-aggregates/2. Re-run medsl_reconcile.py")
NO_METHOD = {"TOTAL", "", "UNSPECIFIED", "UNKNOWN"}
TARGET_HOUSE = {"AZ": [8, 2], "IA": [2], "SC": [1]}
OFFICES = {"senate": "sen", "governor": "gov", "house": "house"}
LABEL_MIN_FOR_RECORDS = 0.5  # below this the label is not a method breakdown of the contest; no per-method records are made
cbm_contests, cbm_skipped = [], []
for c in agg["contests"]:
    st, rec = c["state"], c["reconciliation"]
    if c["special"]:
        continue
    if c["office"] == "house" and (st not in TARGET_HOUSE or int(c["district"]) not in TARGET_HOUSE[st]):
        continue
    labeled = {m: v for m, v in c["modes"].items() if m not in NO_METHOD}
    comp, cs, ver = rec["methodLabelCompleteness"], rec["certified"], rec["verdict"]
    tag = f"{c['year']} {st} {c['office']}" + (f" CD-{c['district']}" if c["office"] == "house" else "")
    if not labeled or comp is None or comp < LABEL_MIN_FOR_RECORDS:
        cbm_skipped.append(tag)
        continue
    other_reasons = [x for x in ver["reasons"] if not x.startswith("no certified total")]
    coverage = "RECONCILED" if ver["status"] == "DATASET_RECONCILED" else ("NO_TOTAL" if not other_reasons and cs["status"] != "COMPARED" else "AMBIGUOUS")
    cbm_contests.append(tag)
    furl = agg["files"][f"{c['year']}-{st.lower()}"]["url"]
    dist = None if c["office"] != "house" else str(int(c["district"]))
    for mode, v in sorted(labeled.items()):
        slug = re.sub(r"[^a-z0-9]+", "-", mode.lower()).strip("-")
        rid = f"p2-cbm-{st}-{c['year']}-{OFFICES[c['office']]}{'-' + dist if dist else ''}-{slug}"
        lim = [f"MEDSL compilation of official precinct returns. Method labels cover {comp:.1%} of the contest's votes ({rec['methodLabeledVotes']:,} of {rec['contestVotesDeduplicated']:,})."]
        if cs["status"] == "COMPARED":
            lim.append(f"Contest votes differ from the FEC certified total of {cs['total']:,} by {cs['differencePct']}% ({cs['unmatchedVotes']:+,} unmatched votes)")
        else:
            lim.append("No official certified total was retrieved for this contest, so completeness against the official result is not checked")
        lim.extend(other_reasons)
        lim.extend(ver["semanticCaveats"])
        lim.append("Not validated for adjustment: a method adjustment stays disabled until a backtest over timestamped returns exists")
        r = {"recordId": rid, "recordType": "CANDIDATE_BY_METHOD", "raceId": None, "state": st, "jurisdictionId": "STATE", "jurisdictionLevel": "STATE",
             "method": "ELECTION_DAY" if mode.replace("_", " ") == "ELECTION DAY" else ("PROVISIONAL" if mode == "PROVISIONAL" else None),
             "evidenceClass": "HISTORICAL", "valueKind": "OBSERVATION", "historicalYear": c["year"], "sourceUrl": furl, "sourceName": f"MIT Election Data and Science Lab, {c['year']} official precinct returns",
             "sourceTier": "RESEARCH_COMPILATION", "retrievedAt": agg["builtAt"], "confidence": "MEDIUM" if (coverage == "RECONCILED" and st != "SC") else "LOW", "limitations": lim,
             "notes": "Aggregated from precinct rows; side A is party_simplified DEMOCRAT, side B REPUBLICAN, other is everything else.",
             "measureKind": "A", "contestYear": c["year"], "office": c["office"], "contestDistrict": dist, "modeLabel": mode,
             "votesA": v.get("D", 0), "votesB": v.get("R", 0), "votesOther": v.get("OTHER", 0), "coverage": coverage}
        add(r)

# ---- outputs ---------------------------------------------------------------------------------------------------------------
NOW = max(log[sid]["retrieved_at"] for sid in USED)
OUTS = {}


def emit(path, obj):
    OUTS[path] = (json.dumps(obj, indent=1, sort_keys=False) + "\n").encode()


pkg = {"meta": {"packageId": "priority15-reporting-2026-10-26", "producer": "OnPoint engineering, from the 2026-10-25 research seed and sources retrieved 2026-10-26", "createdAt": NOW, "synthetic": False, "baselineSnapshot": "2026-10-25"}, "records": records}
emit(OUT_PKG, pkg)

register = {"kind": "SOURCE_REGISTER", "generatedAt": NOW, "retrievedOn": NOW[:10],
            "note": "sha256 is of the bytes retrieved. usedByRecords counts the research records that cite the source (0 means retrieved but not used). A source under notRetrieved was attempted or inspected and contributed nothing.",
            "sources": [], "notRetrieved": [],
            "dataFiles": [{"id": k, **v} for k, v in sorted(agg["files"].items())], "certifiedSources": agg["certifiedSources"]}
for sid, s in sources.items():
    why, lg = usable(sid), log.get(sid)
    if why:
        register["notRetrieved"].append({"id": sid, "url": s["url"], "publisher": s["publisher"], "outcome": why, "attemptedOn": lg["retrieved_at"][:10] if lg else None})
    else:
        register["sources"].append({"id": sid, "url": s["url"], "retrievedUrl": lg["final_url"], "publisher": s["publisher"], "title": s["title"], "pageDate": s.get("pageDate"), "tier": s["tier"],
                                    "http": lg["http"], "retrievedAt": lg["retrieved_at"], "sha256": lg["sha256"], "bytes": lg["bytes"], "usedByRecords": USED[sid]})
emit(OUT_REG, register)

# ---- state dataset ----------------------------------------------------------------------------------------------------------
seed = json.load(open(SEED))
seedby = {s["state"]: s for s in seed["states"]}
reg = {}
for row in csv.DictReader(open(VOTERREG)):
    reg[row["abbr"]] = row
byst = collections.defaultdict(list)
for r in records:
    byst[r["state"]].append(r)
states = []
for st in STATES:
    rs = byst[st]
    kinds = collections.Counter(r["timingKind"] for r in rs if r["recordType"] == "RELEASE_TIMING")
    cb = [r for r in rs if r["recordType"] == "CANDIDATE_BY_METHOD"]
    s = seedby[st]
    pc = POLL[st]
    states.append({
        "state": st, "raceIds": RACES[st], "raceCount": len(RACES[st]),
        "pollClose": "VERIFIED_PER_COUNTY_LOCAL" if pc[9] == "PER_COUNTY_LOCAL" else "VERIFIED",
        "pollCloseSource": pc[0],
        "timings": {k: kinds.get(k, 0) for k in ("LEGAL_PROCESSING_TIME", "LEGAL_SCANNING_TIME", "OFFICIAL_EXPECTED_RELEASE_TIME", "HISTORICAL_OBSERVED_RELEASE_TIME", "ACTUAL_2026_RELEASE_TIME")},
        "practiceKinds": sorted({r["practiceKind"] for r in rs if r["recordType"] == "REPORTING_PRACTICE"}),
        "sequenceCategories": sorted({r["ballotCategory"] for r in rs if r["recordType"] == "REPORTING_PRACTICE" and r.get("ballotCategory")}),
        "candidateByMethodRecords": len(cb),
        "candidateByMethodContests": sorted({f"{r['contestYear']} {r['office']}" + (f" CD-{r['contestDistrict']}" if r["contestDistrict"] else "") for r in cb}),
        "partyRegistration": {"class": "C", "registersByParty": reg[st]["registers_by_party"] == "True", "asOf": reg[st]["as_of_date"], "sourceUrl": reg[st]["source_url"], "useAsVoteShare": False,
                              "note": "Class C evidence. Registration is not vote share and is never used as one."},
        "seed": {"legalScanningCategory": s["legal_scanning_category"], "legalScanningStatus": s["legal_scanning_status"],
                 "unvalidatedWatchpoints": s["operational_watchpoints"], "watchpointsStatus": s["operational_watchpoints_evidence"],
                 "nextVerification": s["next_verification"], "seedPartisanDataStatus": s["partisan_data_status"]},
    })
emit(OUT_STATES, {"kind": "PRIORITY_15_STATE_DATASET", "generatedAt": NOW, "baselineSnapshot": "2026-10-25", "raceCount": sum(len(v) for v in RACES.values()), "states": states})

# ---- build manifest: what went in, what came out, what to expect ---------------------------------------------------------------
by_type = collections.Counter(r["recordType"] for r in records)
manifest_out = {
    "schemaVersion": BUILD_MANIFEST_SCHEMA, "buildVersion": BUILD_VERSION, "generatedAt": NOW,
    "parsers": {"build": BUILD_VERSION, "fetch": "fetch_sources/" + FETCH_VERSION, "medsl": agg["parserVersion"], "seed": seed["transformVersion"], "packageSchema": PACKAGE_SCHEMA, "medslSchema": agg["schemaVersion"]},
    "transformation": [
        "fetch_sources.py retrieves each URL in sources.json into a local cache, extracts text, and logs status, sha256 and retrieval time",
        "normalize_seed.py reduces the analyst-supplied seed ZIP to the fields the build uses, with the ZIP checksum",
        "medsl_reconcile.py aggregates MEDSL precinct returns by the source's mode label and reconciles each contest against the FEC certified total",
        "build_priority15.py checks every evidence anchor against the cached source text, then writes the research package, source register and state dataset",
        "npm run intelligence:validate and npm run test:intelligence validate the package against the importer's rules",
    ],
    "inputs": {
        "sourcesManifest": {"path": MANIFEST, "sha256": sha(MANIFEST)},
        "sequenceFindings": {"path": FINDINGS, "sha256": sha(FINDINGS)},
        "seed": {"path": SEED, "sha256": sha(SEED), "archiveSha256": seed["sourceArchive"]["sha256"], "archiveName": seed["sourceArchive"]["name"]},
        "medslAggregates": {"path": AGG, "sha256": sha(AGG), "files": len(agg["files"])},
        "voterRegistration": {"path": VOTERREG, "sha256": sha(VOTERREG)},
        "sources": [{"id": sid, "url": sources[sid]["url"], "sha256": log[sid]["sha256"], "bytes": log[sid]["bytes"], "retrievedAt": log[sid]["retrieved_at"], "usedByRecords": n} for sid, n in sorted(USED.items())],
    },
    "retrievalFailures": [{"id": n["id"], "url": n["url"], "outcome": n["outcome"]} for n in register["notRetrieved"]],
    "expected": {"records": len(records), "byRecordType": dict(sorted(by_type.items())), "races": sum(len(v) for v in RACES.values()), "states": len(STATES),
                 "pollCloseRecords": by_type["POLL_CLOSE"], "sequenceFindings": sum(1 for r in records if r.get("practiceKind") == "SEQUENCE_FINDING"),
                 "candidateByMethodContests": cbm_contests, "contestsWithoutMethodRows": cbm_skipped},
    "outputs": [],
}
for path, data in sorted(OUTS.items()):
    manifest_out["outputs"].append({"path": path, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)})
emit(OUT_BUILD, manifest_out)

if CHECK:
    bad = []
    for path, data in OUTS.items():
        if not os.path.exists(path) or open(path, "rb").read() != data:
            bad.append(path)
    if bad:
        fail("rebuilt outputs differ from the committed files: " + ", ".join(bad))
    print(f"CHECK OK: {len(OUTS)} outputs identical to the committed files")
else:
    for path, data in OUTS.items():
        os.makedirs(os.path.dirname(path), exist_ok=True)
        open(path, "wb").write(data)
    print(len(records), "records;", sum(1 for r in records if r["recordType"] == "CANDIDATE_BY_METHOD"), "candidate-by-method;", sum(len(v) for v in RACES.values()), "races;",
          sum(1 for r in records if r.get("practiceKind") == "SEQUENCE_FINDING"), "sequence findings;", len(register["notRetrieved"]), "sources not usable")
