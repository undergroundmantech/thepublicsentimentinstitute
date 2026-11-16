#!/usr/bin/env python3
"""Past statewide results by county, 2018 to 2024, for the results pages: public/results/history/<ST>.json.

One file per state. Each lists the state's general elections for President (2020, 2024), U.S. Senate (2018, 2020,
2022, 2024) and Governor (2018, 2020, 2022, 2024) with the two leading candidates and, for every county, their votes
and the total. The pages work out shares, margins and the shift from one election to another from these counts.

SOURCE. The MIT Election Data and Science Lab's election returns (precinct-level returns for 2018, 2020, 2022 and
2024, and its 2024 county-level Senate file), added up to counties here. MEDSL publishes these on the Harvard
Dataverse under CC0 1.0 and asks to be cited; the pages carry the citation.

    usage:  python3 scripts/history/build_past_results.py <dir with the MEDSL files> [--out public/results/history]
            python3 scripts/history/build_past_results.py --states-only [--out public/results/history]

The second form only rewrites states.json (every state's statewide lines without the counties, which the national map
reads when it is set to a past election) from the state files already in the output folder. A full run writes it too.

The directory may hold, under any names: the 2018, 2020 precinct files by office (zip or csv; president, senate,
state), the 2022 and 2024 files by state (zip or csv), and 2024-senate-county.csv. Every .zip and .csv found is read;
only rows for the three offices in a general election are used. Nothing is downloaded.

A file with no county column at all (MEDSL's statewide files, such as 2024-president-state.csv) is never added to the
counts. It is used as a CHECK instead: the county sums built here are compared with its statewide totals, and every
contest is listed in the report with the difference. A contest more than 2% from a statewide file is marked.

HOW ROWS ARE ADDED UP (the pitfalls MEDSL's own notes warn about):
  * only stage GEN; write-in lines count toward the total and toward nobody's side;
  * vote "modes": a precinct that carries a TOTAL row is counted from its TOTAL rows only, and a precinct that does
    not is the sum of its mode rows, so nothing is counted twice;
  * fusion states: a candidate's votes on every party line are his; his party is the major party he has votes on;
  * the two sides of a contest are its two leading candidates statewide. Side A is the Democrat, or else whoever
    is not the Republican; side B is the Republican, or else the other. When both are of one party (a top-two general,
    a ranked-choice final) the contest is marked "same" and no partisan shift is drawn from it;
  * a state with a regular and a special Senate election in one year: the regular one is kept;
  * lines that are not candidates (TOTAL VOTES CAST, UNDERVOTES and the like) are left out;
  * where the directory holds a statewide file for a contest and the county sums are more than 3% off it for either
    major party, its COUNTIES ARE LEFT OUT and it is listed (the source's precinct file for it is incomplete or
    duplicated). The state keeps a statewide line for it, taken from the statewide file and marked "nocty";
  * a contest that lacks any of a state's counties is kept and marked partial (its statewide line is not shown);
  * votes published as "*" (suppressed for privacy in a few small places) count as zero, and are counted in the notes;
  * a candidate's total in a county is never taken below zero (a few files carry negative figures for minor lines);
  * rows with no county code (Alaska reports by election district) are kept as one statewide row for the state.
"""
import csv, io, json, os, re, sys, zipfile, collections

csv.field_size_limit(1 << 30)
OFFICE = {"US PRESIDENT": "P", "PRESIDENT": "P", "US SENATE": "S", "GOVERNOR": "G", "GOVERNOR AND LIEUTENANT GOVERNOR": "G", "GOVERNOR/LIEUTENANT GOVERNOR": "G",
          "GOVERNOR AND LT GOVERNOR": "G", "GOVERNOR & LIEUTENANT GOVERNOR": "G", "GOVERNOR & LT GOVERNOR": "G", "GOVERNOR / LIEUTENANT GOVERNOR": "G", "GOVERNOR AND LT. GOVERNOR": "G", "GOVERNOR/LT. GOVERNOR": "G", "GOVERNOR/LT GOVERNOR": "G"}
YEARS = {2018, 2020, 2022, 2024}
WANT = {("P", 2020), ("P", 2024), ("S", 2018), ("S", 2020), ("S", 2022), ("S", 2024), ("G", 2018), ("G", 2020), ("G", 2022), ("G", 2024)}
TRUE = {"TRUE", "True", "true", "1", "T"}
# lines that are not candidates: totals, turnout and uncounted ballots that some states publish among the candidates
NOT_A_CANDIDATE = re.compile(r"^(TOTAL|CONTEST TOTAL|CAST VOTES|VOTES CAST|BALLOTS? CAST|REGISTERED|REGISTRATION|TURNOUT|OVER ?VOTES?|UNDER ?VOTES?|BLANKS?( VOTES?)?$|BLANK BALLOTS?|SPOILED|VOID|REJECTED|NO VOTE|TIMES (OVER|UNDER|BLANK))")
NOT_REAL = re.compile(r"WRITE.?INS?\b|WRITEIN|SCATTER|^NONE OF|^UNCOMMITTED|^UNRESOLVED|^UNCERTIFIED|^UNASSIGNED|^ALL OTHERS?$|^OTHERS?$")
# The source's party label is missing or wrong for these candidates (checked against the states' certified results):
# New Mexico's 2022 file carries no party at all; Wyoming's 2022 file labels the Democratic nominee Libertarian.
PARTY_FIX = {("NM", 2022, "G", "MICHELLE LUJAN GRISHAM"): "DEMOCRAT", ("NM", 2022, "G", "MARK V RONCHETTI"): "REPUBLICAN", ("NM", 2022, "G", "KAREN EVETTE BEDONIE"): "LIBERTARIAN",
             ("WY", 2022, "G", "THERESA A LIVINGSTON"): "DEMOCRAT", ("WY", 2022, "G", "JARED J BALDES"): "LIBERTARIAN",
             ("VT", 2022, "G", "BRENDA SIEGEL"): "DEMOCRAT"}     # the Democratic nominee, listed on a fused Democratic/Progressive line
# a statewide file disagrees with the county sums by more than this on either major party: the contest is left out
MAX_OFF = 0.03

def rows_of(path):
    """Every CSV inside a file (a .csv, or each .csv in a .zip), as dict rows."""
    if path.lower().endswith(".zip"):
        z = zipfile.ZipFile(path)
        for n in z.namelist():
            if n.lower().endswith(".csv") and not os.path.basename(n).startswith("."):
                yield from csv.DictReader(io.TextIOWrapper(z.open(n), encoding="utf-8", errors="replace", newline=""))
    elif path.lower().endswith(".csv"):
        with open(path, encoding="utf-8", errors="replace", newline="") as f:
            yield from csv.DictReader(f)

def num(v):
    v = (v or "").strip()
    if v in ("", "*", "NA", "N/A"): return None
    try: return int(float(v))
    except ValueError: return None

def tidy(name):
    """MEDSL writes candidates in capitals: JOSEPH R BIDEN -> Joseph R. Biden."""
    s = re.sub(r"\s+", " ", (name or "").strip())
    if not s: return ""
    out = []
    for w in s.split(" "):
        lw = w.lower()
        if lw in ("jr", "sr", "jr.", "sr."): out.append(lw.rstrip(".").capitalize() + ".")
        elif lw in ("ii", "iii", "iv"): out.append(lw.upper())
        elif len(w) == 1 and w.isalpha(): out.append(w.upper() + ".")
        elif lw.startswith("mc") and len(w) > 2: out.append("Mc" + w[2:].capitalize())
        elif lw.startswith("o'") and len(w) > 2: out.append("O'" + w[2:].capitalize())
        else: out.append("-".join(p.capitalize() for p in w.split("-")))
    return " ".join(out)

# How a candidate is shown. Some states list the ticket (governor and running mate) or only a surname: the page shows
# the candidate at the head of the ticket, by full name. Keyed by state so a common surname is never guessed at.
TICKET_SPLIT = re.compile(r"\s*/\s*|\s+And\s+|\s*&\s*", re.I)
NAME_BY_STATE = {
    ("TX", "Abbott"): "Greg Abbott", ("TX", "Valdez"): "Lupe Valdez", ("TX", "Cornyn"): "John Cornyn", ("TX", "Hegar"): "MJ Hegar",
    ("TX", "Cruz"): "Ted Cruz", ("TX", "O'Rourke"): "Beto O'Rourke", ("MA", "Healey"): "Maura Healey", ("MA", "Diehl"): "Geoff Diehl",
    ("MA", "Baker"): "Charlie Baker", ("MA", "Gonzalez"): "Jay Gonzalez", ("HI", "Ige"): "David Ige", ("HI", "Tupola"): "Andria Tupola",
    ("UT", "Spencer J. Cox Deidre M. Henderson"): "Spencer J. Cox", ("UT", "Brian Smith King Rebekah Cummings"): "Brian King",
}
SURNAME_CASE = {"Desantis": "DeSantis", "Dewine": "DeWine", "Lepage": "LePage", "Dejear": "DeJear"}
def shown(st, raw):
    """The display name of a contest's leading candidate: tidy(), the head of a ticket, known surname-only rows, capitals."""
    n = TICKET_SPLIT.split(tidy(raw))[0].strip()
    if n.count(",") == 1:  # "Harris, Kamala D." in the statewide files
        last, first = [x.strip() for x in n.split(",")]
        if first and last and first.lower().rstrip(".") not in ("jr", "sr", "ii", "iii", "iv"): n = f"{first} {last}"
    n = re.sub(r'\s*"[^"]*"\s*', " ", n).strip()
    n = NAME_BY_STATE.get((st, n), n)
    return " ".join(SURNAME_CASE.get(w, w) for w in n.split(" "))

def write_states(out):
    """states.json: every state's statewide lines without the counties, for the national map's past-election setting."""
    states = {}
    for fn in sorted(os.listdir(out)):
        if not re.fullmatch(r"[A-Z]{2}\.json", fn): continue
        doc = json.load(open(os.path.join(out, fn)))
        states[doc["st"]] = [{k: v for k, v in c.items() if k != "c"} for c in doc["contests"]]
    src = "MIT Election Data and Science Lab (MEDSL) election returns, added up by On Point Politics"
    json.dump({"v": 1, "source": src, "states": states}, open(os.path.join(out, "states.json"), "w"), separators=(",", ":"))
    return len(states)

def main():
    out = "public/results/history"
    if "--out" in sys.argv: out = sys.argv[sys.argv.index("--out") + 1]
    if "--states-only" in sys.argv:
        # rewrite states.json from the state files already in the output folder
        print(f"states.json: {write_states(out)} states", file=sys.stderr); return
    args = [a for i, a in enumerate(sys.argv[1:], 1) if not a.startswith("--") and sys.argv[i - 1] != "--out"]
    if not args: sys.exit(__doc__)
    src = args[0]
    files = sorted(os.path.join(dp, f) for dp, _, fs in os.walk(src) for f in fs if f.lower().endswith((".zip", ".csv")))
    # (st, office, year, special) -> level -> (fips, precinct) -> (candidate, party) -> mode -> votes
    # level: "county" for a file that is already added up to counties, "precinct" otherwise. Where a contest is in
    # both, the county-level file is used and the precinct rows are left out, so nothing is counted twice.
    agg = collections.defaultdict(lambda: collections.defaultdict(lambda: collections.defaultdict(lambda: collections.defaultdict(lambda: collections.defaultdict(int)))))
    names = collections.defaultdict(dict); starred = collections.Counter(); used = collections.Counter()
    # statewide files, for checking only: (st, office, year, special) -> candidate -> party -> votes
    official = collections.defaultdict(lambda: collections.defaultdict(lambda: collections.Counter()))
    for fn in files:
        n = 0
        for r in rows_of(fn):
            statewide = "county_fips" not in r and "precinct" not in r
            o = OFFICE.get((r.get("office") or "").strip().upper())
            if not o: continue
            try: y = int(float(r.get("year") or 0))
            except ValueError: continue
            if (o, y) not in WANT: continue
            if (r.get("stage") or "GEN").strip().upper() != "GEN": continue
            st = (r.get("state_po") or "").strip().upper()
            if len(st) != 2: continue
            if statewide:
                if (r.get("mode") or "TOTAL").strip().upper() == "TOTAL" and num(r.get("votes")) is not None:
                    official[(st, o, y, (r.get("special") or "").strip() in TRUE)][(r.get("candidate") or "").strip().upper()][(r.get("party_simplified") or "").strip().upper()] += num(r.get("votes"))
                continue
            fips = re.sub(r"\D", "", (r.get("county_fips") or "").split(".")[0])
            # no county code: one statewide row for the state (Alaska reports by election district, not by borough)
            fips = fips.zfill(5) if fips and int(fips) > 0 else re.sub(r"\D", "", (r.get("state_fips") or "").split(".")[0]).zfill(2)[-2:] + "000"
            if len(fips) != 5 or fips == "00000": continue
            v = num(r.get("votes"))
            if v is None:
                if (r.get("votes") or "").strip() == "*": starred[(st, o, y)] += 1
                continue
            sp = (r.get("special") or "").strip() in TRUE
            wi = (r.get("writein") or "").strip() in TRUE
            cand = "WRITEIN" if wi and not (r.get("candidate") or "").strip() else (r.get("candidate") or "").strip().upper()
            if NOT_A_CANDIDATE.search(cand): continue
            if st == "DC" and o == "S": continue      # the District's "shadow senator" is not a Senate seat
            # the party: the simplified field, or the detailed one where the simplified says nothing (Nebraska's 2024 file marks every line NONPARTISAN)
            party = (r.get("party_simplified") or "").strip().upper(); det = (r.get("party_detailed") or "").strip().upper()
            party = ("DEMOCRAT" if party.startswith("DEM") else "REPUBLICAN" if party.startswith("REP") else "DEMOCRAT" if "DEMOCRAT" in det else "REPUBLICAN" if "REPUBLICAN" in det or det == "GOP" else party)
            party = PARTY_FIX.get((st, y, o, cand), party)
            mode = (r.get("mode") or "TOTAL").strip().upper() or "TOTAL"
            # a county-level file has no precinct: the county is its own
            level = "precinct" if "precinct" in r else "county"
            pk = (r.get("precinct") or "").strip() + "|" + (r.get("jurisdiction_name") or "").strip() if level == "precinct" else ""
            agg[(st, o, y, sp)][level][(fips, pk)][(cand, party)][mode] += v
            # (Kansas City, Missouri, is reported apart from its counties under a code of its own, 36000)
            if fips.endswith("000"): names[st].setdefault(fips, "Kansas City (reported apart from its counties)" if (st, fips) == ("MO", "36000") else "Statewide (no county breakdown in the source)")
            elif r.get("county_name"): names[st].setdefault(fips, r["county_name"].strip())
            n += 1
        if n: used[os.path.basename(fn)] = n
        print(f"read {os.path.basename(fn)}: {n} rows used", file=sys.stderr)

    states = collections.defaultdict(list); report = []; dropped = []
    for (st, o, y, sp), levels in sorted(agg.items()):
        precincts = levels["county"] if "county" in levels else levels["precinct"]
        # one figure per (county, candidate, party): TOTAL rows where a precinct has them, else the sum of its modes
        county = collections.defaultdict(lambda: collections.defaultdict(int))
        for (fips, _pk), cands in precincts.items():
            has_total = any("TOTAL" in modes for modes in cands.values())
            for (cand, party), modes in cands.items():
                county[fips][(cand, party)] += modes.get("TOTAL", 0) if has_total else sum(modes.values())
        # a few files carry negative figures for minor lines (New Mexico 2020): a candidate's county total is never below zero
        for cs in county.values():
            for k in cs:
                if cs[k] < 0: cs[k] = 0
        # candidates statewide, each with the party he has most votes on (a major party when he has any votes on one)
        cv = collections.defaultdict(lambda: collections.Counter())
        for fips, cs in county.items():
            for (cand, party), v in cs.items(): cv[cand][party] += v
        tot = {c: sum(p.values()) for c, p in cv.items()}
        def party_of(c):
            p = cv[c]; d, r = p.get("DEMOCRAT", 0), p.get("REPUBLICAN", 0)
            if d > 0 or r > 0: return "D" if d >= r else "R"
            top = p.most_common(1)[0][0] if p else ""
            return {"LIBERTARIAN": "L", "NONPARTISAN": "N", "INDEPENDENT": "I", "GREEN": "G"}.get(top, "I" if "INDEPEND" in top else "O")
        real = [c for c in tot if c and not NOT_REAL.search(c)]
        ranked = sorted(real, key=lambda c: -tot[c])
        if len(ranked) < 1 or sum(tot.values()) <= 0: continue
        c1 = ranked[0]; c2 = ranked[1] if len(ranked) > 1 else None
        p1, p2 = party_of(c1), party_of(c2) if c2 else None
        # side A: the Democrat, else whoever is not the Republican; side B: the Republican, else the other
        if p1 == "R" and p2 != "R": a, b = c2, c1
        elif p2 == "D" and p1 != "D": a, b = c2, c1
        else: a, b = c1, c2
        same = bool(c2) and p1 == p2
        ctot = sum(tot.values())
        rows = {}
        for fips, cs in sorted(county.items()):
            av = sum(v for (c, _), v in cs.items() if c == a) if a else 0
            bv = sum(v for (c, _), v in cs.items() if c == b) if b else 0
            tv = sum(cs.values())
            if tv > 0: rows[fips] = [av, bv, tv]
        # the check against a statewide file, where the directory holds one for this contest
        chk = None; off = official.get((st, o, y, sp))
        if off:
            od = sum(v for c, ps in off.items() for pp, v in ps.items() if pp == "DEMOCRAT"); orr = sum(v for c, ps in off.items() for pp, v in ps.items() if pp == "REPUBLICAN")
            md = sum(v for c in tot if party_of(c) == "D" for v in [tot[c]]); mr = sum(v for c in tot if party_of(c) == "R" for v in [tot[c]])
            # (fusion: a candidate's votes on minor lines are his here and "other" in a file split by line, so the check is on the two major lines' sum where they differ)
            ot = sum(v for ps in off.values() for v in ps.values())
            chk = [md - od, mr - orr, ctot - ot, round(100 * (ctot - ot) / ot, 2) if ot else None]
            # fusion states list a candidate's minor-line votes apart, so a small surplus over the major line alone is expected; a large gap either way is not
            bad_d = od > 0 and abs(md - od) / od > MAX_OFF and not (st in ("NY", "CT", "SC", "VT", "OR") and 0 <= (md - od) / od <= 0.12)
            bad_r = orr > 0 and abs(mr - orr) / orr > MAX_OFF and not (st in ("NY", "CT", "SC", "VT", "OR") and 0 <= (mr - orr) / orr <= 0.12)
            if bad_d or bad_r:
                dropped.append((st, y, o, f"county sums are off the statewide file by D {100 * (md - od) / od:+.1f}%, R {100 * (mr - orr) / orr:+.1f}%: counties left out, statewide line taken from the statewide file"))
                # the statewide file is MEDSL's own count of the state, so the state still gets its statewide line (for the
                # tables and the national map); it has no counties, and is marked so
                otot = {c: sum(ps.values()) for c, ps in off.items()}
                oreal = sorted((c for c in otot if c and not NOT_REAL.search(c)), key=lambda c: -otot[c])
                def oparty(c): return "D" if off[c].get("DEMOCRAT") else "R" if off[c].get("REPUBLICAN") else "O"
                oa = next((c for c in oreal[:2] if oparty(c) == "D"), None); ob = next((c for c in oreal[:2] if oparty(c) == "R"), None)
                if oa and ob:
                    states[st].append({"y": y, "o": o, "sp": sp, "a": [shown(st, oa), "D"], "b": [shown(st, ob), "R"], "tot": [otot[oa], otot[ob], ot], "same": False, "c": {}, "nocty": True, "_chk": None})
                continue
        states[st].append({"y": y, "o": o, "sp": sp, "a": [shown(st, a), party_of(a)] if a else None, "b": [shown(st, b), party_of(b)] if b else None,
                           "tot": [tot.get(a, 0) if a else 0, tot.get(b, 0) if b else 0, ctot], "same": same, "c": rows, "_chk": chk})
    os.makedirs(out, exist_ok=True)
    index = {}
    for st, cs in sorted(states.items()):
        # a regular and a special election for one office in one year: keep the regular one
        keep = []
        for c in sorted(cs, key=lambda c: (-c["y"], "PSG".index(c["o"]), c["sp"])):
            if any(k["y"] == c["y"] and k["o"] == c["o"] for k in keep): continue
            keep.append(c)
        fips_used = sorted({f for c in keep for f in c["c"]})
        # a contest that covers fewer counties than the state has (the source lacks precinct returns for the rest) is
        # marked partial: its statewide totals are not the result, and the pages say so
        full = max((len([f for f in c["c"] if not f.endswith("000")]) for c in keep), default=0)
        for c in keep:
            nreal = len([f for f in c["c"] if not f.endswith("000")])
            if full >= 5 and 0 < nreal < full: c["part"] = [nreal, full]
        checks = [c.pop("_chk", None) for c in keep]
        # (not partial after all where a statewide file agrees with the county sums: the "missing" counties are then a
        # matter of how the file groups them, as with two of Virginia's independent cities in 2024)
        for c, chk in zip(keep, checks):
            if c.get("part") and chk and chk[3] is not None and abs(chk[3]) <= 0.5 and abs(chk[0]) <= 0.005 * max(1, c["tot"][0]) and abs(chk[1]) <= 0.005 * max(1, c["tot"][1]): del c["part"]
        for c in cs: c.pop("_chk", None)
        doc = {"v": 1, "st": st, "source": "MIT Election Data and Science Lab (MEDSL) election returns, added up to counties by On Point Politics",
               "names": {f: (names[st].get(f, "") if f.endswith("000") else tidy(names[st].get(f, ""))) for f in fips_used}, "contests": keep}
        json.dump(doc, open(os.path.join(out, f"{st}.json"), "w"), separators=(",", ":"))
        index[st] = [[c["y"], c["o"], int(c["sp"]), len(c["c"])] for c in keep]
        for c, chk in zip(keep, checks):
            report.append((st, c["y"], c["o"], "special" if c["sp"] else "", c["a"], c["b"], c["tot"], len(c["c"]), ("same-party " if c["same"] else "") + (f"PARTIAL {c['part'][0]} of {c['part'][1]} counties" if c.get("part") else ""),
                           "" if chk is None else f"vs statewide file: D {chk[0]:+d}, R {chk[1]:+d}, total {chk[2]:+d} ({chk[3]:+.2f}%)" + ("  <-- CHECK" if chk[3] is not None and abs(chk[3]) > 2 else "")))
    json.dump({"v": 1, "states": index, "starred": {f"{k[0]}-{k[1]}-{k[2]}": v for k, v in starred.items()}}, open(os.path.join(out, "index.json"), "w"), separators=(",", ":"))
    write_states(out)
    for r in report: print(*r, sep="\t")
    for d in dropped: print("LEFT OUT", *d, sep="\t")
    print(f"\n{len(states)} states, {sum(len(v) for v in index.values())} contests; rows with suppressed votes: {sum(starred.values())}", file=sys.stderr)

if __name__ == "__main__":
    main()
