#!/usr/bin/env python3
"""Probe systems that might preserve election-night observation times for 2022 and 2024.

For every system this records what was asked, what came back, and what kind of time (if any) the answer carries. It
fetches nothing from unrelated periods: only the election-night windows below are queried. A capture's own time is the
archive's crawl time, which is when the archive looked, not when the source published; a source time exists only if the
captured content states one, and the check below looks for it without storing the content.

Output: data/intelligence/historical/timestamp-search-<date>.json
Re-run with:  python3 scripts/intelligence/research/probe_timestamp_sources.py
Retrieval failures are recorded with the error text. They are never treated as "no data exists".
"""
import hashlib
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

PROBE_VERSION = "1"
ROOT = Path(__file__).resolve().parents[3]
OUT_DIR = ROOT / "data/intelligence/historical"
CDX = "http://web.archive.org/cdx/search/cdx"
WINDOWS = {"2022": ("20221108", "20221111"), "2024": ("20241105", "20241108")}
UA = "TPSI-research-probe/1 (election-night evidence search; contact via repository)"

# system id -> (description, CDX url pattern, what the state/vendor says it publishes)
SYSTEMS = [
    ("AZ_results_arizona_vote", "Arizona SoS results site", "results.arizona.vote/*"),
    ("PA_electionreturns", "Pennsylvania DOS election returns", "electionreturns.pa.gov/*"),
    ("GA_clarity_enr", "Georgia SoS results via Clarity ENR", "results.enr.clarityelections.com/GA/*"),
    ("GA_results_sos", "Georgia SoS results site", "results.sos.ga.gov/*"),
    ("FL_results", "Florida Division of Elections results", "results.elections.myflorida.com/*"),
    ("SC_scvotes", "South Carolina Election Commission ENR", "enr.scvotes.sc.gov/*"),
    ("IA_results", "Iowa SoS results", "results.iowa.gov/*"),
    ("AK_results", "Alaska Division of Elections results", "results.elections.alaska.gov/*"),
    ("NYT_elections_assets", "New York Times election data files", "static01.nyt.com/elections-assets/*"),
    ("NYT_newsgraphics", "New York Times newsgraphics data", "static01.nyt.com/newsgraphics/*"),
    ("CIVICAPI", "civicAPI (the live feed this project reads)", "civicapi.org/*"),
    ("AP_elections", "Associated Press election results API", "api.ap.org/*"),
]

TS_KEYS = re.compile(r'"(?:timestamp|lastupdated|last_updated|updated|asof|as_of|dateupdated|reportingtime|publishedat)"', re.I)


def get(url, timeout=45, tries=3):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.status, r.read(), None
        except urllib.error.HTTPError as e:
            last = f"HTTP {e.code}"
            if e.code not in (429, 500, 502, 503, 504):
                return e.code, b"", last
        except Exception as e:  # noqa: BLE001 - report any network failure as text
            last = f"{type(e).__name__}: {e}"
        time.sleep(2 + 3 * i)
    return None, b"", last


def cdx(pattern, frm, to):
    q = {"url": pattern, "output": "json", "from": frm, "to": to, "filter": "statuscode:200", "limit": "4000"}
    status, body, err = get(f"{CDX}?{urllib.parse.urlencode(q)}")
    if err and status is None:
        return {"error": err, "rows": None}
    text = body.decode("utf-8", "replace")
    if not text.lstrip().startswith("["):
        return {"error": f"non-JSON answer ({text[:80].strip()!r})", "rows": None, "httpStatus": status}
    rows = json.loads(text)
    return {"error": None, "rows": rows[1:] if rows else [], "httpStatus": status}


ASSET = re.compile(r"\.(?:svg|woff2?|ttf|otf|eot|png|gif|jpe?g|ico|css|js|mp4|pdf|map)$", re.I)
RESULT_KEYS = re.compile(r'"(?:votes|totalvotes|candidates|precinctsreporting|precincts_reporting|contests|choices|ballotcount|results)"', re.I)
SAMPLES = 6


def strip_query(url):
    """Stored URLs carry no query string: a query can hold a credential belonging to the source's own client."""
    return url.split("?", 1)[0]


def result_candidates(rows):
    out = [r for r in rows if any(k in (r[3] or "") for k in ("json", "csv", "xml")) and not ASSET.search(strip_query(r[2]))]
    return sorted(out, key=lambda x: x[1])


def content_check(row):
    """Fetch one captured data file and report whether it looks like results and states its own time. Content is not kept."""
    ts, orig = row[1], row[2]
    status, body, err = get(f"http://web.archive.org/web/{ts}id_/{orig}", timeout=60, tries=2)
    if body == b"" or err:
        return {"checked": strip_query(orig), "captureTimestamp": ts, "error": err or "empty body", "httpStatus": status}
    text = body.decode("utf-8", "replace")
    return {
        "checked": strip_query(orig), "captureTimestamp": ts, "bytes": len(body), "sha256": hashlib.sha256(body).hexdigest(),
        "isJson": text.lstrip()[:1] in "[{", "looksLikeResults": bool(RESULT_KEYS.search(text)), "statesOwnTime": bool(TS_KEYS.search(text)),
        "looksLikeHtmlShell": "<html" in text[:500].lower() or "<!doctype html" in text[:500].lower(),
    }


def sample_checks(cands):
    if not cands:
        return []
    step = max(1, len(cands) // SAMPLES)
    picks = cands[::step][:SAMPLES]
    out = []
    for r in picks:
        out.append(content_check(r))
        time.sleep(1)
    return out


def classify(rows, checks):
    """Conservative: a source-time verdict needs a sampled file that both looks like results and states its own time."""
    if rows is None:
        return "RETRIEVAL_FAILED"
    if not rows:
        return "NO_CAPTURES"
    if not result_candidates(rows):
        return "NO_DATA_FILES_CAPTURED"
    ok = [c for c in checks if not c.get("error")]
    if not ok:
        return "DATA_FILES_LISTED_NOT_RETRIEVABLE"
    res = [c for c in ok if c.get("looksLikeResults")]
    if not res:
        return "DATA_FILES_SAMPLED_NONE_LOOK_LIKE_RESULTS"
    if any(c.get("statesOwnTime") for c in res):
        return "RESULT_FILES_STATE_THEIR_OWN_TIME"
    return "RESULT_FILES_WITHOUT_SOURCE_TIME_ARCHIVE_TIME_ONLY"


def main():
    started = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    results = []
    for sid, desc, pattern in SYSTEMS:
        for year, (frm, to) in WINDOWS.items():
            r = cdx(pattern, frm, to)
            rows = r["rows"]
            entry = {"system": sid, "description": desc, "year": int(year), "window": [frm, to], "query": f"{CDX}?url={pattern}&from={frm}&to={to}&filter=statuscode:200", "error": r["error"]}
            if rows is not None:
                times = sorted(x[1] for x in rows)
                data = [x for x in rows if any(k in (x[3] or "") for k in ("json", "csv", "xml"))]
                entry.update({
                    "captures": len(rows), "dataCaptures": len(data), "distinctContentDigests": len({x[5] for x in rows}),
                    "mimetypes": sorted({x[3] for x in rows})[:8], "firstCapture": times[0] if times else None, "lastCapture": times[-1] if times else None,
                    "distinctUrls": len({x[2] for x in rows}),
                })
            cands = result_candidates(rows) if rows else []
            checks = sample_checks(cands)
            entry["resultCandidateFiles"] = len(cands)
            entry["resultCandidateCaptureSpread"] = {"distinctDays": len({x[1][:8] for x in cands}), "distinctHours": len({x[1][:10] for x in cands})}
            entry["contentChecks"] = checks
            entry["verdict"] = classify(rows, checks)
            results.append(entry)
            print(f"{sid} {year}: {entry['verdict']} ({entry.get('captures')})", flush=True)
            time.sleep(1)
    doc = {
        "schemaVersion": "TPSI_TIMESTAMP_SEARCH/1", "probeVersion": PROBE_VERSION, "startedAt": started,
        "finishedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "interpretation": {
            "captureTime": "the archive's crawl time: when the archive looked at the URL. It is an observation time, not the source's publication time.",
            "sourceTime": "exists only when the captured content states one (contentChecks[].statesOwnTime on a file that looksLikeResults). Without it the sequence of source updates is unknown.",
            "retrievalFailures": "an error is a failed probe, not evidence that nothing exists",
            "notUsed": "no scrape from an unrelated period, and no reconstructed or invented sequence, is used anywhere",
        },
        "results": results,
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"timestamp-search-{started[:10]}.json"
    out.write_text(json.dumps(doc, indent=2) + "\n")
    print("wrote", out.relative_to(ROOT))


if __name__ == "__main__":
    sys.exit(main())
