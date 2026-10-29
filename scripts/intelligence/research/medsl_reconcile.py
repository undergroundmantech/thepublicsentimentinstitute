#!/usr/bin/env python3
"""MEDSL method aggregation and reconciliation against certified totals.

Downloads the MIT Election Data and Science Lab precinct-return zips named in medsl_files.json into
.cache/medsl/ (verifying sha256 against the manifest), aggregates candidate votes by the source's mode label for the
priority-15 contests, and compares each contest with a certified total where one was retrieved. Writes
data/intelligence/historical/medsl-method-aggregates-2026-10-26.json, which build_priority15.py reads. Nothing is
filled in from memory: a contest with no certified source retrieved is reported as such, not compared.

Run from the repository root:  python3 scripts/intelligence/research/medsl_reconcile.py [--refresh]
Exit status is non-zero when a required input cannot be retrieved or fails its checksum; the message says which.
"""
import argparse, collections, csv, datetime, hashlib, io, json, os, sys, urllib.request, zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xlsx_min import read_xlsx  # noqa: E402

PARSER_VERSION = "medsl_reconcile/3"
SCHEMA_VERSION = "medsl-method-aggregates/2"
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = ".cache/medsl"
CERT_CACHE = ".cache/certified"
OUT = "data/intelligence/historical/medsl-method-aggregates-2026-10-26.json"

STATES = ["AK", "AZ", "CO", "FL", "GA", "IA", "KS", "ME", "NE", "NY", "OH", "PA", "SC", "TX", "WI"]
YEARS = [2022, 2024]
TARGET_HOUSE = {"AZ": [8, 2], "IA": [2], "SC": [1]}
OFFICES = {"US SENATE": "senate", "GOVERNOR": "governor", "US HOUSE": "house"}
# Mode labels that carry no method information.
NO_METHOD = {"TOTAL", "", "UNSPECIFIED", "UNKNOWN"}
# Rows that are not votes for a candidate. They are excluded from candidate totals and reported beside them.
NON_CANDIDATE = {"UNDER VOTES", "OVER VOTES", "UNDERVOTES", "OVERVOTES", "BLANK VOTES", "BLANK", "NOT QUALIFIED", "REGISTERED VOTERS", "BALLOTS CAST", "TOTAL VOTES", "VOID"}
RECONCILE_TOLERANCE = 0.005  # 0.5% of the certified total
LABEL_COMPLETE_MIN = 0.99
ORDER = [("GA", 2022), ("AZ", 2022), ("AZ", 2024), ("IA", 2022), ("IA", 2024), ("AK", 2022), ("AK", 2024), ("SC", 2022), ("SC", 2024)]


class RetrievalError(Exception):
    pass


def sha256(b):
    return hashlib.sha256(b).hexdigest()


def download(url, path, expect=None, refresh=False):
    if os.path.exists(path) and not refresh:
        b = open(path, "rb").read()
    else:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (OnPoint research build)"})
            b = urllib.request.urlopen(req, timeout=180).read()
        except Exception as e:  # network, TLS, HTTP status
            raise RetrievalError(f"could not retrieve {url}: {type(e).__name__}: {e}") from e
        open(path, "wb").write(b)
    if expect and sha256(b) != expect:
        raise RetrievalError(f"checksum mismatch for {url}: expected {expect}, got {sha256(b)}. The published file changed; re-verify before using it.")
    return b


def certified_totals(cfg, refresh):
    """Returns {(year, office, state, district): {total, multiple, source}}. Federal offices only (FEC)."""
    out, files = {}, {}
    for year, c in cfg["certified"].items():
        path = f"{CERT_CACHE}/{c['file']}"
        b = download(c["url"], path, c.get("sha256"), refresh)
        files[year] = {"url": c["url"], "sha256": sha256(b), "bytes": len(b), "publisher": c["publisher"], "title": c["title"]}
        wb = read_xlsx(path)
        for kind, office in (("Senate Results by State", "senate"), ("House Results by State", "house")):
            name = next((n for n in wb if kind in n), None)
            if not name:
                raise RetrievalError(f"{path}: no sheet named like '{kind}'")
            rows = wb[name]
            hdr = next(r for r in rows if len(r) > 15 and "STATE ABBREVIATION" in r)
            gi = next(i for i, h in enumerate(hdr) if h.strip().upper() == "GENERAL VOTES")
            for r in rows:
                if len(r) <= gi or len(r) < 10:
                    continue
                label = r[9].strip().lower()
                if label not in ("total state votes:", "district votes:"):
                    continue
                st, dist = r[1], r[3].strip()
                try:
                    votes = int(float(r[gi]))
                except ValueError:
                    continue
                key = (int(year), office, st, None if office == "senate" else int(dist) if dist.isdigit() else dist)
                if key in out:
                    out[key]["multiple"] = True  # more than one contest of this kind in the state (specials); not comparable
                else:
                    out[key] = {"total": votes, "multiple": False}
    return out, files


def aggregate(zip_path, year, state):
    """Per contest: per-precinct votes by mode and side."""
    z = zipfile.ZipFile(zip_path)
    contests = {}
    for name in z.namelist():
        if not name.endswith(".csv"):
            continue
        for row in csv.DictReader(io.TextIOWrapper(z.open(name), encoding="utf-8", errors="replace")):
            office = OFFICES.get(row["office"])
            if office is None or row.get("stage", "GEN") != "GEN":
                continue
            district = None
            if office == "house":
                d = (row.get("district") or "").strip()
                if not d.isdigit() or int(d) not in TARGET_HOUSE.get(state, []):
                    continue
                district = int(d)
            special = (row.get("special") or "").upper() == "TRUE"
            key = (office, district, special)
            c = contests.setdefault(key, {"prec": collections.defaultdict(lambda: collections.defaultdict(lambda: {"D": 0, "R": 0, "OTHER": 0})), "county": {}, "noncand": collections.Counter()})
            party = row["party_simplified"]
            side = "D" if party == "DEMOCRAT" else "R" if party == "REPUBLICAN" else "OTHER"
            mode = (row.get("mode") or "").strip().upper()
            pk = (row.get("county_fips") or row.get("county_name") or "", row.get("jurisdiction_fips") or "", row["precinct"])
            try:
                v = int(float(row["votes"]))
            except ValueError:
                continue
            cname = (row.get("candidate") or "").strip().upper()
            if cname in NON_CANDIDATE:
                c["noncand"][f"{cname} | {mode or 'NO LABEL'}"] += v
                continue
            c["prec"][pk][mode][side] += v
            c["county"][pk] = row.get("county_fips") or row.get("county_name") or ""
    return contests


def metrics(c, certified, state, year, office, district):
    modes_tot = collections.defaultdict(lambda: {"D": 0, "R": 0, "OTHER": 0})
    rows_sum = total_rows_sum = method_rows_sum = 0
    both = both_equal = both_conflict = 0
    deduped = labeled = 0
    counties, counties_labeled = set(), set()
    label_votes = collections.Counter()
    conflict_examples = []
    for pk, modes in c["prec"].items():
        county = c["county"][pk]
        counties.add(county)
        msum = {m: sum(v.values()) for m, v in modes.items()}
        for m, v in modes.items():
            for s in ("D", "R", "OTHER"):
                modes_tot[m][s] += v[s]
        tot = msum.get("TOTAL")
        meth = {m: x for m, x in msum.items() if m not in NO_METHOD}
        unl = sum(x for m, x in msum.items() if m in NO_METHOD and m != "TOTAL")
        msum_all = sum(meth.values())
        rows_sum += sum(msum.values())
        total_rows_sum += tot or 0
        method_rows_sum += msum_all
        for m, x in meth.items():
            label_votes[m] += x
        if tot is not None and (meth or unl):
            both += 1
            if tot == msum_all + unl:
                both_equal += 1
            else:
                both_conflict += 1
                if len(conflict_examples) < 3:
                    conflict_examples.append({"precinct": pk[2], "county": county, "totalRow": tot, "methodRowsSum": msum_all + unl})
        # a precinct's votes: the TOTAL row when there is one, else its method rows
        pv = tot if tot is not None else msum_all + unl
        deduped += pv
        if meth:
            labeled += min(msum_all, pv)
            counties_labeled.add(county)
    cert = certified.get((year, office, state, district))
    out = {
        "totalsByMode": {m: dict(v, total=sum(v.values())) for m, v in sorted(modes_tot.items())},
        "rowsSum": rows_sum, "totalRowsSum": total_rows_sum, "methodRowsSum": method_rows_sum,
        "contestVotesDeduplicated": deduped, "methodLabeledVotes": labeled,
        "methodLabelCompleteness": round(labeled / deduped, 5) if deduped else None,
        "methodLabelCoverageOfContest": round(labeled / deduped, 5) if deduped else None,
        "jurisdictions": {"counties": len(counties), "countiesWithMethodLabels": len(counties_labeled),
                          "countyCoverage": round(len(counties_labeled) / len(counties), 5) if counties else None, "precincts": len(c["prec"])},
        "overlap": {"precinctsWithTotalAndMethodRows": both, "totalEqualsMethodSum": both_equal, "totalDiffersFromMethodSum": both_conflict, "examples": conflict_examples},
        "excludedNonCandidateRows": dict(sorted(c["noncand"].items())),
    }
    if cert is None:
        out["certified"] = {"status": "NO_CERTIFIED_SOURCE_RETRIEVED", "reason": "the federal certified-results workbook covers Senate and House only; no official certified export was retrieved for this contest"}
    elif cert["multiple"]:
        out["certified"] = {"status": "NOT_COMPARABLE", "reason": "the certified workbook lists more than one contest of this kind for the state (for example a special election); the contests cannot be separated by office"}
    else:
        diff = deduped - cert["total"]
        out["certified"] = {"status": "COMPARED", "total": cert["total"], "difference": diff, "differencePct": round(diff / cert["total"] * 100, 4),
                            "unmatchedVotes": cert["total"] - deduped, "methodLabeledShareOfCertified": round(labeled / cert["total"], 5)}
    # the verdict: arithmetic checks decide RECONCILED; what a label means is a separate caveat list
    reasons, caveats = [], []
    cs = out["certified"]
    if cs["status"] != "COMPARED":
        reasons.append("no certified total to reconcile against")
    elif abs(cs["difference"]) > RECONCILE_TOLERANCE * cs["total"]:
        reasons.append(f"candidate votes differ from the certified total by {cs['differencePct']}% ({cs['difference']:+,} votes unmatched)")
    if deduped and labeled / deduped < LABEL_COMPLETE_MIN:
        reasons.append(f"only {labeled / deduped:.1%} of the contest's votes carry a method label")
    if both_conflict:
        reasons.append(f"{both_conflict} precincts have a TOTAL row that differs from their method rows")
    if any(m.startswith("FAILSAFE") or "PROVISIONAL" in m for m in modes_tot) and state == "SC":
        caveats.append("labels FAILSAFE, PROVISIONAL and FAILSAFE PROVISIONAL may overlap; exclusivity cannot be established from the file")
    if any(m in ("ABSENTEE", "ADVANCED", "ADVANCE VOTING", "EARLY VOTING") for m in modes_tot) and state in ("GA", "IA"):
        caveats.append("ABSENTEE/ADVANCED labels may include early in-person voting; method meaning is the source's own label")
    if rows_sum != deduped:
        caveats.append(f"summing every row ({rows_sum:,}) double counts where TOTAL rows duplicate method rows; the deduplicated figure is {deduped:,}")
    out["verdict"] = {"status": "DATASET_RECONCILED" if not reasons else "NOT_RECONCILED", "reasons": reasons, "semanticCaveats": caveats,
                      "adjustmentEnabled": False,
                      "adjustmentNote": "No method adjustment is enabled by this verdict. A reconciled dataset removes one blocker; a backtest over timestamped returns is still required."}
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true", help="re-download cached inputs")
    args = ap.parse_args()
    cfg = json.load(open(os.path.join(HERE, "medsl_files.json")))
    try:
        certified, cert_files = certified_totals(cfg, args.refresh)
        files, contests = {}, []
        todo = [(s, y) for s, y in ORDER] + [(s, y) for y in YEARS for s in STATES if (s, y) not in ORDER]
        for st, yr in todo:
            f = cfg["files"][f"{yr}-{st.lower()}"]
            b = download(f["url"], f"{CACHE}/{yr}-{st.lower()}.zip", f["sha256"], args.refresh)
            files[f"{yr}-{st.lower()}"] = {"url": f["url"], "sha256": sha256(b), "bytes": len(b)}
            for (office, district, special), c in sorted(aggregate(f"{CACHE}/{yr}-{st.lower()}.zip", yr, st).items(), key=lambda kv: (kv[0][0], kv[0][1] or 0, kv[0][2])):
                m = metrics(c, certified, st, yr, office, district)
                modes = {mode: {"D": v["D"], "R": v["R"], "OTHER": v["OTHER"]} for mode, v in m["totalsByMode"].items()}
                contests.append({"year": yr, "state": st, "office": office, "district": "STATE" if district is None else str(district), "special": special,
                                 "modes": modes, "reconciliation": {k: v for k, v in m.items() if k != "totalsByMode"}})
    except RetrievalError as e:
        print(f"RETRIEVAL FAILED: {e}", file=sys.stderr)
        sys.exit(2)
    out = {"kind": "MEDSL_METHOD_AGGREGATES", "schemaVersion": SCHEMA_VERSION, "parserVersion": PARSER_VERSION,
           "builtAt": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
           "classification": "A for contests with method rows (RESEARCH_COMPILATION of official returns); E where only TOTAL rows exist",
           "transformation": "precinct rows with stage GEN; rows whose candidate is UNDER VOTES, OVER VOTES, NOT QUALIFIED, BLANK and similar are not candidate votes and are reported separately; side A = party_simplified DEMOCRAT, side B = REPUBLICAN, other = all else; votes summed by the source's own mode label; a precinct's contest total is its TOTAL row if present, else the sum of its method rows",
           "reconcileTolerance": RECONCILE_TOLERANCE, "labelCompleteMin": LABEL_COMPLETE_MIN,
           "files": files, "certifiedSources": cert_files, "contests": contests}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, "w"), indent=1)
    print(f"wrote {OUT}: {len(contests)} contests")


if __name__ == "__main__":
    main()
