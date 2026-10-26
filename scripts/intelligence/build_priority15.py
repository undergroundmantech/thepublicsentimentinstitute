#!/usr/bin/env python3
"""Builds the Phase 2 priority-15 research package, source register, state dataset and MEDSL aggregate file.

Inputs (not committed): the fetch log and extracted text in /tmp/research and the MEDSL aggregate in /tmp/medsl/agg.json
(made by the same session; see docs/ELECTION_NIGHT_INTELLIGENCE_PHASE2.md). Every curated value below was read from the
source named beside it on the retrieval date; nothing is filled in from memory. Where a source could not be retrieved
the value is recorded as UNKNOWN, not supplied.

Run from the repository root:  python3 scripts/intelligence/build_priority15.py
"""
import csv, json, os, re, datetime, collections

ROOT = os.getcwd()
LOG = "/tmp/research/log.jsonl"
AGG = "/tmp/medsl/agg.json"
OUT_PKG = "data/intelligence/research/priority15-reporting-2026-10-26.json"
OUT_REG = "data/intelligence/sources/register-2026-10-26.json"
OUT_STATES = "data/intelligence/states/priority15-2026-10-26.json"
OUT_HIST = "data/intelligence/historical/medsl-method-aggregates-2026-10-26.json"

NOW = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

RACES = {
    "AK": ["sen-AK"], "AZ": ["house-AZ-08", "house-AZ-02"], "CO": ["house-CO-04", "house-CO-05", "house-CO-03"],
    "FL": ["house-FL-04", "house-FL-22", "house-FL-09", "house-FL-26"], "GA": ["gov-GA"], "IA": ["sen-IA", "house-IA-02"],
    "KS": ["sen-KS", "gov-KS", "house-KS-02"], "ME": ["sen-ME", "house-ME-02"], "NE": ["sen-NE", "gov-NE", "house-NE-01"],
    "NY": ["house-NY-01", "house-NY-11", "house-NY-02", "house-NY-17"], "OH": ["sen-OH", "house-OH-15", "house-OH-09", "house-OH-08"],
    "PA": ["house-PA-10", "house-PA-08"], "SC": ["sen-SC", "house-SC-01"], "TX": ["sen-TX", "gov-TX", "house-TX-35", "house-TX-24"],
    "WI": ["gov-WI", "house-WI-01"],
}
STATES = list(RACES)

# ---- sources ----------------------------------------------------------------------------------------------------------
# id -> (url, publisher, title, page date, tier, fetch-log id)
NCSL = "https://www.ncsl.org/elections-and-campaigns/"
SRC = {
    "NCSL16": (NCSL + "table-16-when-absentee-mail-ballot-processing-and-counting-can-begin", "NCSL", "Table 16: When Absentee/Mail Ballot Processing and Counting Can Begin", "2026-09-15", "SECONDARY_SUMMARY", "NCSL16"),
    "NCSL17": (NCSL + "table-17-how-election-results-are-reported", "NCSL", "Table 17: How Election Results Are Reported", "2024-10-15", "SECONDARY_SUMMARY", "NCSL17"),
    "NCSL11": (NCSL + "table-11-receipt-and-postmark-deadlines-for-absentee-mail-ballots", "NCSL", "Table 11: Receipt and Postmark Deadlines for Absentee/Mail Ballots", "2026-09-25", "SECONDARY_SUMMARY", "NCSL11"),
    "NCSL_PROV": (NCSL + "provisional-ballots", "NCSL", "Provisional Ballots (time allotted to verify)", "2025-04-16", "SECONDARY_SUMMARY", "NCSL_PROV"),
    "AZSOS": ("https://azsos.gov/elections/election-information", "Arizona Secretary of State", "Election information (election night results)", None, "PRIMARY_OFFICIAL", "AZSOS"),
    "EAC": ("https://www.eac.gov/why-do-election-results-change-after-election-night", "U.S. Election Assistance Commission", "Why do election results change after election night?", "2025-12-23", "PRIMARY_OFFICIAL", "EAC"),
    "EAC_CANVASS": ("https://www.eac.gov/election-officials/election-results-canvass-and-certification", "U.S. Election Assistance Commission", "Election Results, Canvass, and Certification", None, "PRIMARY_OFFICIAL", "EAC_CANVASS"),
    "AK_CH15": ("https://www.akleg.gov/basis/statutes.asp?media=print&secStart=15.15.010&secEnd=15.15.470", "Alaska Legislature", "AS 15.15.010-15.15.470 (voting and counting)", None, "PRIMARY_OFFICIAL", "AK_STAT_CH15_15"),
    "AK_15_20_201": ("https://www.akleg.gov/basis/statutes.asp?media=print&secStart=15.20.201&secEnd=15.20.201", "Alaska Legislature", "AS 15.20.201 district absentee ballot counting review", None, "PRIMARY_OFFICIAL", "AK_STAT_15_20_201"),
    "AZ_16_565": ("https://www.azleg.gov/ars/16/00565.htm", "Arizona Legislature", "A.R.S. 16-565 hours polls opened and closed", None, "PRIMARY_OFFICIAL", "AZ_STAT_16_565"),
    "CO_1_7_101": ("https://colorado.public.law/statutes/crs_1-7-101", "Public.Law (mirror of C.R.S.)", "C.R.S. 1-7-101 hours for voting", None, "SECONDARY_SUMMARY", "CO_CRS_1_7_101"),
    "FL_100_011": ("http://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0100-0199/0100/Sections/0100.011.html", "Florida Legislature", "Fla. Stat. 100.011 hours of voting", None, "PRIMARY_OFFICIAL", "FL_STAT_100_011"),
    "IA_49_73": ("https://www.legis.iowa.gov/docs/code/49.73.pdf", "Iowa Legislature", "Iowa Code 49.73 time of opening and closing polls", None, "PRIMARY_OFFICIAL", "IA_CODE_49_73"),
    "KS_25_106": ("https://www.ksrevisor.gov/statutes/chapters/ch25/025_001_0006.html", "Kansas Revisor of Statutes", "K.S.A. 25-106 hours of voting", None, "PRIMARY_OFFICIAL", "KS_STAT_25_106"),
    "ME_626": ("https://legislature.maine.gov/statutes/21-A/title21-Asec626.html", "Maine Legislature", "21-A M.R.S. 626 polling times", None, "PRIMARY_OFFICIAL", "ME_STAT_626"),
    "NE_32_908": ("https://nebraskalegislature.gov/laws/statutes.php?statute=32-908", "Nebraska Legislature", "Neb. Rev. Stat. 32-908 polls when opened and closed", None, "PRIMARY_OFFICIAL", "NE_STAT_32_908"),
    "NY_8_100": ("https://newyork.public.law/laws/n.y._election_law_section_8-100", "Public.Law (mirror of N.Y. Election Law)", "N.Y. Election Law 8-100 hours of voting", None, "SECONDARY_SUMMARY", "NY_ELEC_8_100"),
    "OH_3501_32": ("https://codes.ohio.gov/ohio-revised-code/section-3501.32", "Ohio Laws and Administrative Rules", "R.C. 3501.32 opening and closing polls", None, "PRIMARY_OFFICIAL", "OH_RC_3501_32"),
    "SC_7_13_60": ("https://www.scstatehouse.gov/code/t07c013.php", "South Carolina Legislature", "S.C. Code 7-13-60 hours polls open", None, "PRIMARY_OFFICIAL", "SC_CODE_7_13_60"),
    "WI_6_78": ("https://docs.legis.wisconsin.gov/statutes/statutes/6/iii/78", "Wisconsin Legislature", "Wis. Stat. 6.78 polling hours", None, "PRIMARY_OFFICIAL", "WI_STAT_6_78"),
}
NOT_RETRIEVED = [
    ("AK_DOE", "https://www.elections.alaska.gov/", "Alaska Division of Elections", "no response (timeout) on every attempt"),
    ("GA_SOS", "https://sos.ga.gov/page/election-day-voting", "Georgia Secretary of State", "HTTP 403"),
    ("GA_CODE_21_2_403", "https://georgia.public.law/statutes/ga._code_21-2-403", "Public.Law mirror of O.C.G.A. 21-2-403", "no response"),
    ("PA_VOTE", "https://www.pa.gov/agencies/vote/voting-in-pennsylvania/voting-in-person", "Pennsylvania Department of State", "HTTP 404"),
    ("PA_25PS_3045", "https://www.palegis.us/statutes/unconsolidated/law-information/view-statute?txtType=HTM&SessYr=1937&ActNum=0320.&SessInd=0&chapter=12&section=1", "Pennsylvania General Assembly", "page returned without the statute text"),
    ("TX_41_031", "https://texas.public.law/statutes/tex._elec._code_section_41.031", "Public.Law mirror of Tex. Elec. Code", "page returned an index, not the polling-hours section"),
    ("TX_VOTETX", "https://www.votetexas.gov/voting/when.html", "Texas Secretary of State", "page moved"),
    ("NY_BOE", "https://elections.ny.gov/voting-hours", "New York State Board of Elections", "HTTP 403"),
    ("WI_WEC", "https://elections.wi.gov/elections/election-results", "Wisconsin Elections Commission", "HTTP 403"),
    ("CO_LEG", "https://content.leg.colorado.gov/sites/default/files/images/olls/crs2025-title-01.pdf", "Colorado Legislature", "HTTP 404"),
    ("ME_SOS", "https://www.maine.gov/sos/elections-voting/voting-information", "Maine Secretary of State", "HTTP 404"),
]

log = {}
for line in open(LOG):
    d = json.loads(line)
    log[d["id"]] = d

# ---- poll close: statute text read on the retrieval date -------------------------------------------------------------
# state -> (src id, local text, cite, closes_at_utc | None, time zone text, confidence, limitations)
POLL = {
    "AK": ("AK_CH15", "polls close at eight o'clock in the evening", "AS 15.15.080", "2026-11-04T05:00:00Z", "Alaska Standard Time (UTC-9)", "HIGH", ["The statute allows an exception in (b); the Aleutian zone is not separately researched"]),
    "AZ": ("AZ_16_565", "polls closed at 7:00 p.m.", "A.R.S. 16-565(A)", "2026-11-04T02:00:00Z", "Mountain Standard Time (UTC-7), Arizona does not observe daylight time", "HIGH", []),
    "CO": ("CO_1_7_101", "polling locations remain open until 7 p.m. and stay open for electors in line at 7 p.m.", "C.R.S. 1-7-101", "2026-11-04T02:00:00Z", "Mountain Standard Time (UTC-7)", "MEDIUM", ["Read from a public mirror of the statute, not the legislature's own page"]),
    "FL": ("FL_100_011", "polls kept open until 7:00 p.m., regulated by the customary time in standard use in the county seat", "Fla. Stat. 100.011", "2026-11-04T01:00:00Z", "7 p.m. local: 00:00Z in Eastern counties, 01:00Z in the Central-time panhandle counties; the later instant is recorded", "MEDIUM", ["The statute does not list which counties are in Central time; that assignment is general knowledge, not from the source", "Eastern counties close one hour earlier (00:00Z)"]),
    "IA": ("IA_49_73", "polling places shall be closed at 8:00 p.m. for all elections", "Iowa Code 49.73", "2026-11-04T02:00:00Z", "Central Standard Time (UTC-6)", "HIGH", []),
    "KS": ("KS_25_106", "polls close at 7:00 p.m. in central-time counties and 6:00 p.m. in mountain-time counties, unless the county election officer sets and announces different hours", "K.S.A. 25-106", "2026-11-04T01:00:00Z", "7 p.m. CST (UTC-6) and 6 p.m. MST (UTC-7) are the same instant", "HIGH", ["A county election officer may set different publicly announced hours"]),
    "ME": ("ME_626", "polls must be closed at 8 p.m. on election day, except in municipalities under 100 population that may close after all registered voters have voted", "21-A M.R.S. 626", "2026-11-04T01:00:00Z", "Eastern Standard Time (UTC-5)", "HIGH", ["Municipalities under 100 population may close earlier"]),
    "NE": ("NE_32_908", "polls close at 8 p.m. in Central-time areas and 7 p.m. in Mountain-time areas", "Neb. Rev. Stat. 32-908(1)", "2026-11-04T02:00:00Z", "8 p.m. CST (UTC-6) and 7 p.m. MST (UTC-7) are the same instant", "HIGH", ["Voters in line at closing may vote"]),
    "NY": ("NY_8_100", "polls open six o'clock in the morning until nine o'clock in the evening for a general election", "N.Y. Election Law 8-100(2)", "2026-11-04T02:00:00Z", "Eastern Standard Time (UTC-5)", "MEDIUM", ["Read from a public mirror of the statute, not the state's own page"]),
    "OH": ("OH_3501_32", "polls closed by proclamation at seven-thirty p.m.", "R.C. 3501.32(A)", "2026-11-04T00:30:00Z", "Eastern Standard Time (UTC-5)", "HIGH", ["An island polling place may close early if every registered voter has voted"]),
    "SC": ("SC_7_13_60", "polls opened at seven o'clock a.m. and closed at seven o'clock p.m.", "S.C. Code 7-13-60", "2026-11-04T00:00:00Z", "Eastern Standard Time (UTC-5)", "HIGH", []),
    "WI": ("WI_6_78", "polls at every election open from 7 a.m. until 8 p.m.", "Wis. Stat. 6.78(1)", "2026-11-04T02:00:00Z", "Central Standard Time (UTC-6)", "HIGH", []),
}
POLL_UNKNOWN = {"GA": "the Georgia statute and Secretary of State pages could not be retrieved", "PA": "the Pennsylvania pages could not be retrieved with their statute text", "TX": "the Texas statute page could not be retrieved with the polling-hours section"}

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

def src_meta(sid):
    url, pub, title, pdate, tier, logid = SRC[sid]
    return url, pub, title, pdate, tier, log[logid]

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
    # poll close
    if st in POLL:
        sid, text, cite, utc, tz, conf, lim = POLL[st]
        r = base(f"p2-pollclose-{st}", "POLL_CLOSE", st, sid, conf, limitations=lim, notes=f"{cite}: {text}. {tz}.")
        r["closesAtUtc"] = utc
        add(r)
    else:
        r = base(f"p2-pollclose-{st}", "POLL_CLOSE", st, "NCSL16", "NONE", evidence="UNKNOWN", notes=f"UNKNOWN: {POLL_UNKNOWN[st]} on 2026-10-26.")
        r["sourceUrl"] = None; r["sourceName"] = None; r["sourceTier"] = None; r["retrievedAt"] = None; r.pop("publishedAt", None)
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

# ---- candidate votes by method (MEDSL aggregates) ---------------------------------------------------------------------
agg = json.load(open(AGG))
MEDSL_URL = {"2022": "https://github.com/MEDSL/2022-elections-official", "2024": "https://github.com/MEDSL/2024-elections-official"}
TARGET_HOUSE = {"AZ": [8, 2], "IA": [2], "SC": [1]}
OFFICES = {"senate": "sen", "governor": "gov", "house": "house"}
hist_out = {"kind": "MEDSL_METHOD_AGGREGATES", "retrievedAt": agg["retrievedAt"], "classification": "A for contests with method rows (RESEARCH_COMPILATION of official returns); E where only TOTAL rows exist",
            "files": agg["files"], "contests": []}
cbm_skipped = []
for c in agg["contests"]:
    st = c["state"]
    modes = c["modes"]
    nontot = {k: v for k, v in modes.items() if k != "TOTAL"}
    tot = modes.get("TOTAL")
    entry = {"year": c["year"], "state": st, "office": c["office"], "district": c["district"], "modes": modes}
    if c["office"] == "house" and st not in TARGET_HOUSE:
        continue
    if c["office"] == "house" and (not str(c["district"]).isdigit() or int(c["district"]) not in TARGET_HOUSE[st]):
        continue
    if not nontot:
        entry["classification"] = "E"; entry["reason"] = "only TOTAL rows; no method breakdown"
        hist_out["contests"].append(entry); continue
    if st == "NY":
        entry["classification"] = "E"; entry["reason"] = "mode labels are not standardized; one label ('UNSPECIFIED') carries the great majority of votes and others overlap"
        hist_out["contests"].append(entry); cbm_skipped.append((c["year"], st, c["office"], "NY labels unusable")); continue
    msum = sum(sum(v.values()) for v in nontot.values())
    tsum = sum(tot.values()) if tot else None
    if tsum is None: coverage = "NO_TOTAL"
    elif abs(msum - tsum) <= 0.001 * tsum: coverage = "RECONCILED"
    else: coverage = "AMBIGUOUS"
    entry["classification"] = "A"; entry["coverage"] = coverage; entry["methodVotes"] = msum; entry["totalRowVotes"] = tsum
    hist_out["contests"].append(entry)
    fkey = f"{c['year']}-{st.lower()}"
    furl = agg["files"][fkey]["url"]
    for mode, v in sorted(nontot.items()):
        slug = re.sub(r"[^a-z0-9]+", "-", mode.lower()).strip("-")
        dist = None if c["office"] != "house" else str(int(c["district"]))
        rid = f"p2-cbm-{st}-{c['year']}-{OFFICES[c['office']]}{'-' + dist if dist else ''}-{slug}"
        lim = [f"MEDSL compilation of official precinct returns; coverage {coverage}: method rows sum to {msum:,}" + (f" against TOTAL rows of {tsum:,}" if tsum is not None else " with no TOTAL row to check against")]
        if coverage == "AMBIGUOUS": lim.append("TOTAL rows may cover jurisdictions that report no method split; the share of the contest with a method breakdown is not established")
        if st == "SC": lim.append("SC labels FAILSAFE, PROVISIONAL and FAILSAFE PROVISIONAL may overlap")
        if st == "AZ": lim.append("Arizona 'EARLY VOTING' covers early ballots returned by mail and in person; it is not an in-person measure")
        if st in ("IA", "GA"): lim.append("'ABSENTEE'/'ADVANCED' labels may include early in-person voting; the label is kept as the source gives it")
        r = {"recordId": rid, "recordType": "CANDIDATE_BY_METHOD", "raceId": None, "state": st, "jurisdictionId": "STATE", "jurisdictionLevel": "STATE",
             "method": "ELECTION_DAY" if mode.replace("_", " ") == "ELECTION DAY" else ("PROVISIONAL" if mode == "PROVISIONAL" else None),
             "evidenceClass": "HISTORICAL", "valueKind": "OBSERVATION", "historicalYear": c["year"], "sourceUrl": furl, "sourceName": f"MIT Election Data and Science Lab, {c['year']} official precinct returns",
             "sourceTier": "RESEARCH_COMPILATION", "retrievedAt": agg["retrievedAt"], "confidence": "LOW" if (coverage == "AMBIGUOUS" or st == "SC") else "MEDIUM", "limitations": lim,
             "notes": "Aggregated from precinct rows; side A is party_simplified DEMOCRAT, side B REPUBLICAN, other is everything else.",
             "measureKind": "A", "contestYear": c["year"], "office": c["office"], "contestDistrict": dist, "modeLabel": mode,
             "votesA": v.get("D", 0), "votesB": v.get("R", 0), "votesOther": v.get("OTHER", 0), "coverage": coverage}
        add(r)

# ---- write -------------------------------------------------------------------------------------------------------------
os.makedirs(os.path.dirname(OUT_PKG), exist_ok=True)
for p in (OUT_REG, OUT_STATES, OUT_HIST): os.makedirs(os.path.dirname(p), exist_ok=True)
pkg = {"meta": {"packageId": "priority15-reporting-2026-10-26", "producer": "OnPoint engineering, from the 2026-10-25 research seed and sources retrieved 2026-10-26", "createdAt": NOW, "synthetic": False, "baselineSnapshot": "2026-10-25"}, "records": records}
json.dump(pkg, open(OUT_PKG, "w"), indent=1)
json.dump(hist_out, open(OUT_HIST, "w"), indent=1)

register = {"kind": "SOURCE_REGISTER", "generatedAt": NOW, "retrievedOn": "2026-10-26",
            "note": "sha256 is of the bytes retrieved. A source listed under notRetrieved was attempted and contributed nothing.",
            "sources": [], "notRetrieved": [{"id": i, "url": u, "publisher": p, "outcome": o, "attemptedOn": "2026-10-26"} for i, u, p, o in NOT_RETRIEVED],
            "dataFiles": [{"id": k, **v} for k, v in sorted(agg["files"].items())]}
for sid, (url, pub, title, pdate, tier, logid) in SRC.items():
    lg = log[logid]
    register["sources"].append({"id": sid, "url": url, "retrievedUrl": lg["final_url"], "publisher": pub, "title": title, "pageDate": pdate, "tier": tier, "http": lg["http"], "retrievedAt": lg["retrieved_at"], "sha256": lg["sha256"], "bytes": lg["bytes"]})
json.dump(register, open(OUT_REG, "w"), indent=1)

# ---- state dataset ------------------------------------------------------------------------------------------------------
seed = json.load(open("/tmp/seed/priority_15_state_research_seed.json"))
seedby = {s["state"]: s for s in seed["states"]}
reg = {}
for row in csv.DictReader(open("data/voter-registration/states_summary.csv")):
    reg[row["abbr"]] = row
byst = collections.defaultdict(list)
for r in records: byst[r["state"]].append(r)
states = []
for st in STATES:
    rs = byst[st]
    kinds = collections.Counter(r["timingKind"] for r in rs if r["recordType"] == "RELEASE_TIMING")
    cb = [r for r in rs if r["recordType"] == "CANDIDATE_BY_METHOD"]
    s = seedby[st]
    states.append({
        "state": st, "raceIds": RACES[st], "raceCount": len(RACES[st]),
        "pollClose": "VERIFIED" if st in POLL else "UNKNOWN",
        "timings": {k: kinds.get(k, 0) for k in ("LEGAL_PROCESSING_TIME", "LEGAL_SCANNING_TIME", "OFFICIAL_EXPECTED_RELEASE_TIME", "HISTORICAL_OBSERVED_RELEASE_TIME", "ACTUAL_2026_RELEASE_TIME")},
        "practiceKinds": sorted({r["practiceKind"] for r in rs if r["recordType"] == "REPORTING_PRACTICE"}),
        "candidateByMethodRecords": len(cb),
        "candidateByMethodContests": sorted({f"{r['contestYear']} {r['office']}" + (f" CD-{r['contestDistrict']}" if r["contestDistrict"] else "") for r in cb}),
        "partyRegistration": {"class": "C", "registersByParty": reg[st]["registers_by_party"] == "True", "asOf": reg[st]["as_of_date"], "sourceUrl": reg[st]["source_url"], "useAsVoteShare": False,
                              "note": "Class C evidence. Registration is not vote share and is never used as one."},
        "seed": {"legalScanningCategory": s["legal_scanning_category"], "legalScanningStatus": s["legal_scanning_status"],
                 "unvalidatedWatchpoints": s["operational_watchpoints"], "watchpointsStatus": s["operational_watchpoints_evidence"],
                 "nextVerification": s["next_verification"], "seedPartisanDataStatus": s["partisan_data_status"]},
    })
json.dump({"kind": "PRIORITY_15_STATE_DATASET", "generatedAt": NOW, "baselineSnapshot": "2026-10-25", "raceCount": sum(len(v) for v in RACES.values()), "states": states}, open(OUT_STATES, "w"), indent=1)
print(len(records), "records;", sum(1 for r in records if r["recordType"] == "CANDIDATE_BY_METHOD"), "candidate-by-method;", sum(len(v) for v in RACES.values()), "races")
