#!/usr/bin/env python3
"""
AP Elections API scraper for GA Governor Runoff county-level results.
Race: 20260616GA12385 (GA Governor Republican Runoff, June 16 2026)

Fetches data directly from AP's JSON API — no browser needed.
Outputs:
  - Console table of all 159 counties
  - CSV at ga_gov_runoff_county_results.csv (workspace root)
"""

import csv
import gzip
import json
import sys
import urllib.request
from datetime import datetime, timezone

BASE = "https://interactives.apelections.org/election-results/data-live/2026-06-16/results/races/GA/20260616GA12385"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; results-scraper/1.0)",
    "Referer": "https://apnews.com/",
    "Accept-Encoding": "gzip",
}
OUT_CSV = "/workspaces/thepublicsentimentinstitute/ga_gov_runoff_county_results.csv"


def fetch(url: str) -> dict:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=15) as r:
        data = r.read()
    try:
        data = gzip.decompress(data)
    except Exception:
        pass
    return json.loads(data)


def build_cand_map(meta: dict) -> dict:
    """Return {candidateID: 'First Last'} from metadata.candidates dict."""
    cands = meta.get("candidates", {})
    return {
        str(cid): f"{info['first']} {info['last']}"
        for cid, info in cands.items()
    }


def parse_counties(detail: dict, cand_map: dict) -> list:
    rows = []
    for key, unit in detail.items():
        if unit.get("reportingunitLevel") != 2:
            continue

        county_name   = unit["reportingunitName"]
        eevp          = unit.get("eevp", 0)
        precincts_pct = unit.get("precinctsReportingPct", 0)
        last_updated  = unit.get("lastUpdated", "")
        fips          = unit.get("fipsCode", "")

        cands       = sorted(unit.get("candidates", []), key=lambda c: -c.get("votePct", 0))
        total_votes = sum(c.get("voteCount", 0) for c in cands)

        leader_id    = str(cands[0]["candidateID"]) if cands else ""
        leader_name  = cand_map.get(leader_id, leader_id)
        leader_pct   = cands[0].get("votePct", 0) if cands else 0
        leader_votes = cands[0].get("voteCount", 0) if cands else 0

        second_name  = ""
        second_pct   = 0
        second_votes = 0
        if len(cands) > 1:
            cid2         = str(cands[1]["candidateID"])
            second_name  = cand_map.get(cid2, cid2)
            second_pct   = cands[1].get("votePct", 0)
            second_votes = cands[1].get("voteCount", 0)

        rows.append({
            "county":                  county_name,
            "fips":                    fips,
            "leader":                  leader_name,
            "leader_votes":            leader_votes,
            "leader_pct":              leader_pct,
            "second":                  second_name,
            "second_votes":            second_votes,
            "second_pct":              second_pct,
            "total_votes":             total_votes,
            "eevp":                    eevp,
            "precincts_reporting_pct": precincts_pct,
            "last_updated":            last_updated,
            "fetched_at":              datetime.now(timezone.utc).isoformat(),
        })

    rows.sort(key=lambda r: r["county"])
    return rows


def print_table(rows: list, summary: dict, cand_map: dict) -> None:
    eevp  = summary.get("eevp", 0)
    prp   = summary.get("precinctsReportingPct", 0)
    cands = sorted(summary.get("candidates", []), key=lambda c: -c.get("votePct", 0))

    print(f"\n{'='*74}")
    print(f"  GEORGIA GOVERNOR  REPUBLICAN RUNOFF  JUNE 16, 2026")
    print(f"  {eevp:.1f}% est. vote   {prp:.1f}% precincts reporting")
    print(f"{'-'*74}")
    for c in cands:
        name   = cand_map.get(str(c["candidateID"]), str(c["candidateID"]))
        winner = " <<< WINNER" if c.get("winner") else ""
        print(f"  {name:<22}  {c['voteCount']:>9,}  {c['votePct']:5.1f}%{winner}")
    print(f"{'='*74}\n")

    print(f"  {'COUNTY':<22}  {'LEADER':<14}  {'PCT':>5}  {'VOTES':>7}  EEVP")
    print(f"  {'-'*22}  {'-'*14}  {'-'*5}  {'-'*7}  {'-'*5}")
    for r in rows:
        last = r["leader"].split()[-1] if r["leader"] else "---"
        print(f"  {r['county']:<22}  {last:<14}  {r['leader_pct']:>5.1f}  {r['total_votes']:>7,}  {r['eevp']:>4.0f}%")
    print(f"\n  {len(rows)} counties listed\n")


def save_csv(rows: list, path: str) -> None:
    if not rows:
        print("No data to save.", file=sys.stderr)
        return
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    print(f"Saved {len(rows)} rows -> {path}")


def main() -> None:
    print("Fetching AP election results...")
    summary  = fetch(f"{BASE}/summary.json")
    detail   = fetch(f"{BASE}/detail.json")
    meta     = fetch(f"{BASE}/metadata.json")

    cand_map = build_cand_map(meta)
    rows     = parse_counties(detail, cand_map)

    print_table(rows, summary, cand_map)
    save_csv(rows, OUT_CSV)


if __name__ == "__main__":
    main()
