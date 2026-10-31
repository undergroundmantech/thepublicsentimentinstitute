#!/usr/bin/env python3
"""
L2 Early Vote scraper for On Point Polling

Source: the JSON files behind https://early.l2datamapping.com/
  https://www.l2datamapping.com/json/early/<year>/US-DATA.json
  https://www.l2datamapping.com/json/early/<year>/<ST>-DATA.json

Each state file looks like:
  _metadata: {all, early_requested, early_returned, early_date, timestamp, ...}
  County / State / US_Congressional_District / State_House_District / State_Senate_District:
      "FL##ALACHUA": {
          _geo: "12001",
          all:             {_total, Parties_Description: {cat: n}, Voters_AgeRange: {...}, ...},
          early_requested: {...same...},
          early_returned:  {...same...},
      }

Output in data/<run time>/ and data/latest/:
  long.csv                  every count: state, area, metric, dimension, category, count
  demographics.csv          one row per area x dimension x category with all, requested,
                            returned, composition shares, turnout rate and over/under
                            representation in points
  county_summary.csv        one row per county: totals, turnout, party composition of the
                            returned vote vs registration, and the bluer/redder shift
  county_wide.csv           one row per county, every metric x dimension x category a column
  district_summary.csv      same as county_summary for CDs, State House, State Senate
  statewide_summary.csv     one row per state plus US
  metadata.csv              L2 timestamps and totals per file
  raw/                      the original JSON
data/history/               county and statewide summaries appended every run, deduped
                            on L2's timestamp, for the early vote tracker

Usage:
  pip install -r requirements.txt
  python l2_early_scraper.py
  python l2_early_scraper.py --states FL,GA,NC
  python l2_early_scraper.py --year 2024
"""
import argparse
import json
import re
import shutil
import sys
import time
from datetime import datetime
from pathlib import Path

import pandas as pd
import requests

DASH = "https://early.l2datamapping.com/"
DATA_ROOT = "https://www.l2datamapping.com/json/early/{year}/"

ALL_STATES = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID",
    "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO",
    "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA",
    "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]
METRICS = ["all", "early_requested", "early_returned"]
SUMMARY_AREAS = {"County": "county", "US_Congressional_District": "district",
                 "State_House_District": "district", "State_Senate_District": "district"}

session = requests.Session()
session.headers.update({
    "User-Agent": ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/130 Safari/537.36"),
    "Referer": DASH,
    "Origin": DASH.rstrip("/"),
    "Accept": "application/json, text/plain, */*",
})


def fetch_json(url, tries=3):
    for attempt in range(tries):
        try:
            r = session.get(url, timeout=120)
            if r.status_code in (403, 404, 410):
                return None, None
            r.raise_for_status()
            return r.json(), r.text
        except ValueError:
            return None, None
        except requests.RequestException as e:
            if attempt == tries - 1:
                print(f"   ! failed {url}: {e}")
                return None, None
            time.sleep(2 * (attempt + 1))
    return None, None


def area_name(key):
    return key.split("##", 1)[1] if "##" in key else key


def parse_file(st, obj):
    """Return (long rows, metadata row)."""
    meta = obj.get("_metadata", {}) or {}
    as_of = meta.get("early_date")
    stamp = meta.get("timestamp")
    meta_row = {"file": st, **{k: v for k, v in meta.items() if not isinstance(v, (dict, list))}}
    if isinstance(meta.get("states"), list):
        meta_row["states"] = ",".join(map(str, meta["states"]))

    rows = []
    for area_type, areas in obj.items():
        if area_type.startswith("_") or not isinstance(areas, dict):
            continue
        for akey, node in areas.items():
            if not isinstance(node, dict):
                continue
            base = {"file": st, "state": akey.split("##")[0] if "##" in akey else st,
                    "area_type": area_type, "area_key": akey, "area_name": area_name(akey),
                    "geo": node.get("_geo"), "as_of": as_of, "l2_timestamp": stamp}
            for metric in METRICS:
                m = node.get(metric)
                if not isinstance(m, dict):
                    continue
                if "_total" in m:
                    rows.append({**base, "metric": metric, "dimension": "_total",
                                 "category": "_total", "count": m["_total"]})
                for dim, cats in m.items():
                    if dim.startswith("_") or not isinstance(cats, dict):
                        continue
                    for cat, n in cats.items():
                        if isinstance(n, (int, float)):
                            rows.append({**base, "metric": metric, "dimension": dim,
                                         "category": cat if str(cat).strip() else "Unknown",
                                         "count": n})
    return rows, meta_row


def party_bucket(cat):
    c = str(cat).lower()
    if c.startswith("democrat"):
        return "D"
    if c.startswith("republican"):
        return "R"
    return "O"


def build_summary(long, area_types):
    keys = ["file", "state", "area_type", "area_key", "area_name", "geo", "as_of", "l2_timestamp"]
    sub = long[long["area_type"].isin(area_types)]
    if sub.empty:
        return pd.DataFrame()

    tot = (sub[sub["dimension"] == "_total"]
           .pivot_table(index=keys, columns="metric", values="count", aggfunc="sum")
           .add_prefix("total_"))
    out = tot.copy()
    if "total_early_returned" in out and "total_all" in out:
        out["returned_turnout_pct"] = 100 * out["total_early_returned"] / out["total_all"]
    if "total_early_requested" in out and "total_all" in out:
        out["requested_pct_of_rv"] = 100 * out["total_early_requested"] / out["total_all"]

    party = sub[sub["dimension"] == "Parties_Description"].copy()
    if not party.empty:
        party["bucket"] = party["category"].map(party_bucket)
        p = party.pivot_table(index=keys, columns=["metric", "bucket"], values="count",
                              aggfunc="sum").fillna(0)
        for metric in METRICS:
            if metric not in p.columns.get_level_values(0):
                continue
            block = p[metric]
            denom = block.sum(axis=1).replace(0, float("nan"))
            tag = {"all": "rv", "early_requested": "req", "early_returned": "ret"}[metric]
            for b in ("D", "R", "O"):
                cnt = block[b] if b in block else 0
                out[f"{tag}_{b}"] = cnt
                out[f"{tag}_{b}_pct"] = 100 * cnt / denom
            out[f"{tag}_margin_D_minus_R"] = out[f"{tag}_D_pct"] - out[f"{tag}_R_pct"]
        if "ret_margin_D_minus_R" in out and "rv_margin_D_minus_R" in out:
            # positive means the returned vote is bluer than registration
            out["ret_vs_rv_shift_pts"] = out["ret_margin_D_minus_R"] - out["rv_margin_D_minus_R"]
    return out.reset_index().round(3)


def build_demographics(long):
    keys = ["file", "state", "area_type", "area_key", "area_name", "geo", "dimension", "category"]
    d = long[long["dimension"] != "_total"]
    w = d.pivot_table(index=keys, columns="metric", values="count", aggfunc="sum").reset_index()
    for m in METRICS:
        w[m] = w[m].fillna(0) if m in w else 0
    grp = ["file", "area_type", "area_key", "dimension"]
    for m, tag in (("all", "rv"), ("early_requested", "req"), ("early_returned", "ret")):
        w[f"{tag}_share_pct"] = 100 * w[m] / w.groupby(grp)[m].transform("sum").replace(0, float("nan"))
    w["returned_turnout_pct"] = 100 * w["early_returned"] / w["all"].replace(0, float("nan"))
    w["ret_over_under_pts"] = w["ret_share_pct"] - w["rv_share_pct"]
    return w.round(3)


def append_history(path, df, subset):
    if df.empty:
        return
    if path.exists():
        old = pd.read_csv(path, dtype={"geo": str})
        df = pd.concat([old, df], ignore_index=True)
    df.drop_duplicates(subset=subset, keep="last").to_csv(path, index=False)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", default="2026")
    ap.add_argument("--states", default="", help="comma list, default every state L2 covers")
    ap.add_argument("--out", default="data")
    ap.add_argument("--delay", type=float, default=0.4)
    ap.add_argument("--no-raw", action="store_true", help="skip saving raw JSON")
    args = ap.parse_args()

    root = DATA_ROOT.format(year=args.year)
    run = datetime.now().strftime("%Y-%m-%d_%H%M")
    outdir = Path(args.out) / run
    rawdir = outdir / "raw"
    rawdir.mkdir(parents=True, exist_ok=True)

    print(f"Pulling US-DATA.json from {root}")
    us, us_txt = fetch_json(root + "US-DATA.json")
    if us is None:
        print("Could not load US-DATA.json. Check the year or the network.")
        sys.exit(1)
    if not args.no_raw:
        (rawdir / "US-DATA.json").write_text(us_txt)

    if args.states:
        states = [s.strip().upper() for s in args.states.split(",") if s.strip()]
    else:
        listed = (us.get("_metadata") or {}).get("states")
        states = [str(s).upper() for s in listed] if isinstance(listed, list) and listed else ALL_STATES
    print(f"{len(states)} states to pull")

    all_rows, meta_rows = [], []
    rows, meta = parse_file("US", us)
    all_rows += rows
    meta_rows.append(meta)

    for st in states:
        obj, txt = fetch_json(f"{root}{st}-DATA.json")
        time.sleep(args.delay)
        if obj is None:
            print(f"  {st}: no file")
            continue
        if not args.no_raw:
            (rawdir / f"{st}-DATA.json").write_text(txt)
        rows, meta = parse_file(st, obj)
        all_rows += rows
        meta_rows.append(meta)
        n_cty = len((obj.get("County") or {}))
        print(f"  {st}: {n_cty} counties, {len(rows):,} counts, as of {meta.get('early_date')}")

    long = pd.DataFrame(all_rows)
    for col in ["file", "state", "area_type", "area_key", "area_name", "geo", "as_of", "l2_timestamp"]:
        long[col] = long[col].fillna("").astype(str).replace({"None": "", "nan": ""})
    long.to_csv(outdir / "long.csv", index=False)
    pd.DataFrame(meta_rows).to_csv(outdir / "metadata.csv", index=False)

    demo = build_demographics(long)
    demo.to_csv(outdir / "demographics.csv", index=False)

    county = build_summary(long, ["County"])
    county.to_csv(outdir / "county_summary.csv", index=False)
    district = build_summary(long, [k for k, v in SUMMARY_AREAS.items() if v == "district"])
    district.to_csv(outdir / "district_summary.csv", index=False)
    statewide = build_summary(long, ["State"])
    statewide.to_csv(outdir / "statewide_summary.csv", index=False)

    c = long[long["area_type"] == "County"].copy()
    if not c.empty:
        c["column"] = c["metric"] + "|" + c["dimension"] + "|" + c["category"].astype(str)
        wide = c.pivot_table(index=["state", "area_key", "area_name", "geo"],
                             columns="column", values="count", aggfunc="sum")
        wide.reset_index().to_csv(outdir / "county_wide.csv", index=False)

    hist = Path(args.out) / "history"
    hist.mkdir(parents=True, exist_ok=True)
    append_history(hist / "county_summary_history.csv", county, ["area_key", "l2_timestamp"])
    append_history(hist / "statewide_summary_history.csv", statewide, ["area_key", "l2_timestamp"])
    append_history(hist / "district_summary_history.csv", district,
                   ["area_type", "area_key", "l2_timestamp"])

    latest = Path(args.out) / "latest"
    if latest.exists():
        shutil.rmtree(latest)
    shutil.copytree(outdir, latest, ignore=shutil.ignore_patterns("raw"))

    print(f"\nDone. {len(county):,} counties, {len(district):,} districts, "
          f"{len(statewide):,} statewide rows")
    print(f"Output: {outdir}  and  {latest}")


if __name__ == "__main__":
    main()
