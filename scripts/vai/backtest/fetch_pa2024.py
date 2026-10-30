#!/usr/bin/env python3
"""Acquire the Internet Archive's captures of Pennsylvania's 2024 General presidential county feed.

Provenance class of every record: HISTORICAL_OBSERVED_CAPTURE_TIME. The timestamp is the archive's crawl time, an
observation time and an upper bound on when the numbers were public. It is not the state's publication time.

Endpoint: https://www.electionreturns.pa.gov/api/ElectionReturn/GetCountyBreak (electionid=105, officeId=1 = President).
Output: data/vai/backtest/pa2024_president_observed.json (derived county totals plus a SHA-256 of every raw payload).
The raw payloads are not committed; re-run this script to re-fetch them. The script is deterministic given the archive.

No final or certified result is fetched or used here. This feed ends before the count was complete.
"""
import gzip
import hashlib
import json
import sys
import time
import urllib.request

CDX = ("http://web.archive.org/cdx/search/cdx?url=electionreturns.pa.gov/api/ElectionReturn/GetCountyBreak*"
       "&from=20241105&to=20241130&collapse=digest&limit=400&output=json&fl=timestamp,original,statuscode,digest")
OUT = sys.argv[1] if len(sys.argv) > 1 else "data/vai/backtest/pa2024_president_observed.json"


def get(url, tries=4):
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "vai-research/1.0"}), timeout=60) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            if k == tries - 1:
                raise
            time.sleep(2 * (k + 1))


def decode(raw):
    try:
        raw = gzip.decompress(raw)
    except OSError:
        pass
    d = json.loads(raw)
    return json.loads(d) if isinstance(d, str) else d


def num(x):
    try:
        return int(x)
    except (TypeError, ValueError):
        return 0


def main():
    rows = json.loads(get(CDX))[1:]
    caps = [r for r in rows if r[2] == "200" and "officeId=1&" in r[1] + "&" and "electionid=105" in r[1]]
    snaps, failures = [], []
    for ts, orig, _st, digest in caps:
        raw = get(f"http://web.archive.org/web/{ts}id_/{orig}")
        try:
            d = decode(raw)
            d["Election"]["Statewide"]
        except Exception as e:  # noqa: BLE001  a failed retrieval is recorded, never filled in
            failures.append({"capturedAt": ts, "url": orig, "error": type(e).__name__, "bytes": len(raw), "head": raw[:40].hex()})
            continue
        counties = {}
        for blk in d["Election"]["Statewide"]:
            for county, lst in blk.items():
                c = counties.setdefault(county, {"dem": 0, "rep": 0, "other": 0, "demMail": 0, "repMail": 0, "demProv": 0, "repProv": 0})
                for r in lst:
                    v, mail, prov = num(r["Votes"]), num(r["MailInVotes"]), num(r["ProvisionalVotes"])
                    k = {"DEM": "dem", "REP": "rep"}.get(r["PartyName"], "other")
                    c[k] += v
                    if k == "dem":
                        c["demMail"] += mail; c["demProv"] += prov
                    elif k == "rep":
                        c["repMail"] += mail; c["repProv"] += prov
        snaps.append({"capturedAt": ts, "sha256": hashlib.sha256(raw).hexdigest(), "url": orig, "counties": counties})
        time.sleep(0.4)
    snaps.sort(key=lambda s: s["capturedAt"])
    out = {
        "schema": "vai-observed-series/1",
        "class": "HISTORICAL_OBSERVED_CAPTURE_TIME",
        "contest": {"state": "PA", "year": 2024, "office": "President", "sideA": "DEM", "sideB": "REP"},
        "timeSemantics": "capturedAt is the Internet Archive crawl time (UTC, YYYYMMDDhhmmss): an observation time, not the state's publication time",
        "finalTruth": None,
        "finalTruthNote": "No final or certified result is held. The latest capture precedes completion. MEDSL's county file needs a Dataverse guestbook acceptance and was not downloaded.",
        "retrievalFailures": failures,
        "snapshots": snaps,
    }
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"), sort_keys=True)
    print(len(snaps), "snapshots,", len(failures), "failures ->", OUT)


if __name__ == "__main__":
    main()
