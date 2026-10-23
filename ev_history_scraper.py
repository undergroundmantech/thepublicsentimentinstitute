#!/usr/bin/env python3
"""
Early Vote History Scraper  (2022 + 2024, all 50 states + DC)

Pulls every daily snapshot of the US Elections Project / UF Election Lab
early vote pages and writes tidy CSVs you can load into the Early Vote Tracker.

Two data routes, tried in order for each year:

  1. GIT HISTORY  (best: one commit per update, exact numbers)
     Clones github.com/ElectProject/Early-Vote-<YEAR>G and walks every commit,
     parsing each state's HTML page at that commit.

  2. WAYBACK MACHINE  (fallback: one capture per day per state page)
     Uses the CDX API to list captures of each state's page, downloads the
     raw archived HTML (id_ flag), parses it.

Usage:
    pip install requests beautifulsoup4 lxml pandas
    python ev_history_scraper.py                  # both years, auto route
    python ev_history_scraper.py --years 2024     # one year
    python ev_history_scraper.py --route wayback  # force wayback
    python ev_history_scraper.py --states GA NC PA
    python ev_history_scraper.py --workers 8      # more parallel downloads

Output (in ./ev_history/):
    ev_long_<year>.csv      one row per (date, state, section, category, metric)
    ev_toplines_<year>.csv  one row per (date, state): total, in person, mail returned, mail requested
    raw/<year>/<state>/<timestamp>.html   raw snapshots so you can re-parse later
"""

import argparse
import concurrent.futures as cf
import csv
import datetime as dt
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    sys.exit("pip install requests beautifulsoup4 lxml pandas")

# --------------------------------------------------------------------------- #
#  Config
# --------------------------------------------------------------------------- #

STATES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
    "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
    "DC": "District of Columbia", "FL": "Florida", "GA": "Georgia", "HI": "Hawaii",
    "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
    "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
    "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
    "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
    "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
    "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
    "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
    "WI": "Wisconsin", "WY": "Wyoming",
}

# Date windows for the Wayback CDX query
WINDOWS = {
    2022: ("20220915", "20221115"),
    2024: ("20240901", "20241115"),
}

# Candidate page URLs per year. The scraper tries each pattern and keeps
# whichever has captures. {slug} = lowercase hyphenated state name, {abbr} = GA
URL_PATTERNS = {
    2022: [
        "election.lab.ufl.edu/early-vote/2022-early-voting/2022-general-election-early-vote-{slug}/",
        "electproject.github.io/Early-Vote-2022G/{abbr}.html",
    ],
    2024: [
        "election.lab.ufl.edu/early-vote/2024-early-voting/2024-general-election-early-vote-{slug}/",
        "electproject.github.io/Early-Vote-2024G/{abbr}.html",
    ],
}

# 2022 lived on a single RPubs report covering every state. RPubs pages are a
# shell that iframes the real report from rstudio-pubs-static.s3.amazonaws.com,
# and every daily republish got a new static file, so we walk the archived
# shells, pull each iframe target, and parse that.
RPUBS_2022 = "rpubs.com/ElectProject/early_vote_2022"

GIT_REPOS = {
    # 2022 had no GitHub repo (it was published on RPubs), 2024 may not either.
    2024: "https://github.com/ElectProject/Early-Vote-2024G.git",
}

OUT = Path("ev_history")
RAW = OUT / "raw"
CDX = "https://web.archive.org/cdx/search/cdx"
UA = {"User-Agent": "OnPointPolling-EV-History/1.0 (research; contact via github)"}

SESSION = requests.Session()
SESSION.headers.update(UA)


def slug(name: str) -> str:
    return name.lower().replace(" ", "-")


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


# --------------------------------------------------------------------------- #
#  Parsing  (shared by both routes)
# --------------------------------------------------------------------------- #

NUM_RE = re.compile(r"^-?[\d,]+(\.\d+)?%?$")

TOPLINE_KEYS = {
    "total early votes": "total_early_votes",
    "total votes": "total_early_votes",
    "total voted": "total_early_votes",
    "in-person early votes": "in_person",
    "in person early votes": "in_person",
    "in-person votes": "in_person",
    "mail ballots returned": "mail_returned",
    "returned mail ballots": "mail_returned",
    "mail ballots requested": "mail_requested",
    "requested mail ballots": "mail_requested",
    "last updated": "last_updated",
    "source": "source",
}


def to_num(s: str):
    s = s.strip().replace(",", "")
    if s.endswith("%"):
        try:
            return float(s[:-1])
        except ValueError:
            return None
    try:
        return int(s)
    except ValueError:
        try:
            return float(s)
        except ValueError:
            return None


def parse_snapshot(html: str, year: int, abbr: str, ts: str) -> tuple[dict, list[dict]]:
    """
    Returns (topline_row, long_rows).
    Generic: grabs labelled toplines, every HTML table, and any inline JSON
    blobs that look like chart data.
    """
    soup = BeautifulSoup(html, "lxml")
    # collapse inline tags so "Label: <b>1,234</b>" stays on one line
    for tag in soup.find_all(["b", "strong", "span", "em", "a"]):
        tag.unwrap()
    text = soup.get_text("\n")
    text = re.sub(r":\s*\n\s*", ": ", text)
    date = f"{ts[0:4]}-{ts[4:6]}-{ts[6:8]}"

    topline = {"year": year, "state": abbr, "snapshot_ts": ts, "snapshot_date": date}
    long_rows: list[dict] = []

    def add(section, category, metric, value, raw=""):
        long_rows.append({
            "year": year, "state": abbr, "snapshot_ts": ts, "snapshot_date": date,
            "section": section, "category": category, "metric": metric,
            "value": value, "raw": raw,
        })

    # ---- 1. labelled toplines  ("Total Early Votes: 1,234,567") -------------
    for line in text.splitlines():
        line = line.strip()
        if ":" not in line:
            continue
        label, _, val = line.partition(":")
        key = TOPLINE_KEYS.get(label.strip().lower())
        if not key:
            continue
        val = val.strip()
        if key in ("last_updated", "source"):
            topline[key] = val
        else:
            n = to_num(val)
            if n is not None:
                topline[key] = n
                add("topline", "", key, n, val)

    # ---- 2. every HTML table --------------------------------------------------
    for ti, table in enumerate(soup.find_all("table")):
        # section = nearest preceding heading
        heading = ""
        for prev in table.find_all_previous(["h1", "h2", "h3", "h4", "caption"], limit=1):
            heading = prev.get_text(" ", strip=True)
        caption = table.find("caption")
        if caption:
            heading = caption.get_text(" ", strip=True) or heading
        heading = heading or f"table_{ti}"

        rows = table.find_all("tr")
        if not rows:
            continue
        header = [c.get_text(" ", strip=True) for c in rows[0].find_all(["th", "td"])]
        for tr in rows[1:]:
            cells = [c.get_text(" ", strip=True) for c in tr.find_all(["th", "td"])]
            if len(cells) < 2:
                continue
            category = cells[0]
            for hi, cell in enumerate(cells[1:], start=1):
                metric = header[hi] if hi < len(header) and header[hi] else f"col{hi}"
                n = to_num(cell)
                if n is not None:
                    add(heading, category, metric, n, cell)

    # ---- 3. inline JSON chart data (Highcharts / Plotly / custom) --------------
    for script in soup.find_all("script"):
        s = script.string or ""
        if not s or len(s) < 40:
            continue
        # look for "name": "...", "data": [...]  style series
        for m in re.finditer(r'"?name"?\s*:\s*"([^"]+)"\s*,\s*"?(?:data|y)"?\s*:\s*\[([^\]]*)\]', s):
            name, data = m.group(1), m.group(2)
            vals = [to_num(v) for v in data.split(",") if v.strip()]
            vals = [v for v in vals if v is not None]
            for i, v in enumerate(vals):
                add("inline_json", name, f"idx{i}", v)

    return topline, long_rows


# --------------------------------------------------------------------------- #
#  Route 1: git history
# --------------------------------------------------------------------------- #

def git_route(year: int, states: list[str]) -> tuple[list[dict], list[dict]] | None:
    repo_url = GIT_REPOS.get(year)
    if not repo_url:
        return None
    repo_dir = OUT / f"repo_{year}"
    if not repo_dir.exists():
        log(f"[{year}] cloning {repo_url}")
        r = subprocess.run(["git", "clone", "-q", repo_url, str(repo_dir)],
                           capture_output=True, text=True)
        if r.returncode != 0:
            log(f"[{year}] git clone failed, falling back to Wayback: {r.stderr.strip()[:120]}")
            shutil.rmtree(repo_dir, ignore_errors=True)
            return None

    commits = subprocess.run(
        ["git", "-C", str(repo_dir), "log", "--format=%H %ct", "--reverse"],
        capture_output=True, text=True).stdout.split()
    pairs = list(zip(commits[0::2], commits[1::2]))
    log(f"[{year}] {len(pairs)} commits in repo")

    # which file is each state's page?
    files = subprocess.run(["git", "-C", str(repo_dir), "ls-files"],
                           capture_output=True, text=True).stdout.splitlines()

    def state_file(abbr):
        for f in files:
            base = os.path.basename(f).lower()
            if base in (f"{abbr.lower()}.html", f"{slug(STATES[abbr])}.html"):
                return f
        return None

    state_files = {a: state_file(a) for a in states}
    missing = [a for a, f in state_files.items() if not f]
    if len(missing) == len(states):
        log(f"[{year}] repo has no state pages, falling back to Wayback")
        return None
    if missing:
        log(f"[{year}] no page in repo for: {' '.join(missing)}")

    toplines, longs = [], []
    seen = set()  # dedupe identical (state, blob) to skip no change commits
    for sha, ctime in pairs:
        ts = dt.datetime.utcfromtimestamp(int(ctime)).strftime("%Y%m%d%H%M%S")
        for abbr, path in state_files.items():
            if not path:
                continue
            blob = subprocess.run(["git", "-C", str(repo_dir), "rev-parse", f"{sha}:{path}"],
                                  capture_output=True, text=True).stdout.strip()
            if not blob or (abbr, blob) in seen:
                continue
            seen.add((abbr, blob))
            html = subprocess.run(["git", "-C", str(repo_dir), "show", f"{sha}:{path}"],
                                  capture_output=True, text=True, errors="replace").stdout
            if not html:
                continue
            rawp = RAW / str(year) / abbr / f"{ts}.html"
            rawp.parent.mkdir(parents=True, exist_ok=True)
            rawp.write_text(html, encoding="utf-8")
            t, l = parse_snapshot(html, year, abbr, ts)
            t["route"] = "git"
            toplines.append(t)
            longs.extend(l)
        log(f"[{year}] {ts[:8]} commit {sha[:7]} done")
    return toplines, longs


# --------------------------------------------------------------------------- #
#  Route 2: Wayback Machine
# --------------------------------------------------------------------------- #

def cdx_captures(url: str, year: int) -> list[str]:
    """Return list of timestamps, one per day (latest capture that day)."""
    frm, to = WINDOWS[year]
    params = {
        "url": url, "output": "json", "fl": "timestamp,statuscode",
        "filter": "statuscode:200", "from": frm, "to": to, "collapse": "timestamp:8",
    }
    for attempt in range(4):
        try:
            r = SESSION.get(CDX, params=params, timeout=60)
            if r.status_code == 200:
                rows = r.json()
                return [row[0] for row in rows[1:]] if rows else []
            if r.status_code == 429:
                time.sleep(10 * (attempt + 1))
                continue
            return []
        except Exception as e:  # noqa: BLE001
            time.sleep(5 * (attempt + 1))
    return []


def fetch_snapshot(url: str, ts: str) -> str | None:
    wb = f"https://web.archive.org/web/{ts}id_/https://{url}"
    for attempt in range(4):
        try:
            r = SESSION.get(wb, timeout=90)
            if r.status_code == 200 and len(r.text) > 500:
                return r.text
            if r.status_code in (429, 503):
                time.sleep(10 * (attempt + 1))
                continue
            return None
        except Exception:  # noqa: BLE001
            time.sleep(5 * (attempt + 1))
    return None


def wayback_state(year: int, abbr: str) -> tuple[list[dict], list[dict]]:
    toplines, longs = [], []
    name = STATES[abbr]
    chosen_url, stamps = None, []
    for pat in URL_PATTERNS[year]:
        url = pat.format(slug=slug(name), abbr=abbr)
        stamps = cdx_captures(url, year)
        if stamps:
            chosen_url = url
            break
        time.sleep(0.5)
    if not chosen_url:
        log(f"[{year}] {abbr}: no Wayback captures found")
        return toplines, longs

    log(f"[{year}] {abbr}: {len(stamps)} daily captures from {chosen_url}")
    for ts in stamps:
        rawp = RAW / str(year) / abbr / f"{ts}.html"
        if rawp.exists():
            html = rawp.read_text(encoding="utf-8", errors="replace")
        else:
            html = fetch_snapshot(chosen_url, ts)
            if not html:
                continue
            rawp.parent.mkdir(parents=True, exist_ok=True)
            rawp.write_text(html, encoding="utf-8")
            time.sleep(1.0)  # be polite to archive.org
        t, l = parse_snapshot(html, year, abbr, ts)
        t["route"] = "wayback"
        t["source_url"] = chosen_url
        # UF pages render numbers client side: if toplines are empty, chase the JSON
        if "total_early_votes" not in t and "in_person" not in t:
            l.extend(discover_json(html, ts, year, abbr))
        toplines.append(t)
        longs.extend(l)
    return toplines, longs


IFRAME_RE = re.compile(r'(?:src|href)=["\']([^"\']*(?:rstudio-pubs-static|api\.rpubs\.com|rpubs\.com/api)[^"\']*)["\']', re.I)
DATA_URL_RE = re.compile(r'["\'](https?://[^"\']+?(?:\.json|\.csv|wp-json[^"\']*|/api/[^"\']*)[^"\']*)["\']', re.I)


def fetch_live_or_wayback(url: str, ts: str) -> str | None:
    """S3 static report files usually still exist live. Try live first, then Wayback."""
    if url.startswith("//"):
        url = "https:" + url
    try:
        r = SESSION.get(url, timeout=60)
        if r.status_code == 200 and len(r.text) > 500:
            return r.text
    except Exception:  # noqa: BLE001
        pass
    bare = re.sub(r"^https?://", "", url)
    return fetch_snapshot(bare, ts)


def rpubs_route(year: int, states: list[str]) -> tuple[list[dict], list[dict]]:
    """2022: one national RPubs report per day; tables have a state column."""
    toplines, longs = [], []
    stamps = cdx_captures(RPUBS_2022, year)
    if not stamps:
        log(f"[{year}] no Wayback captures of {RPUBS_2022}")
        return toplines, longs
    log(f"[{year}] {len(stamps)} daily captures of the RPubs shell")

    seen_reports = set()
    for ts in stamps:
        shell_p = RAW / str(year) / "_rpubs_shell" / f"{ts}.html"
        if shell_p.exists():
            shell = shell_p.read_text(encoding="utf-8", errors="replace")
        else:
            shell = fetch_snapshot(RPUBS_2022, ts)
            if not shell:
                log(f"[{year}] {ts}: shell fetch failed")
                continue
            shell_p.parent.mkdir(parents=True, exist_ok=True)
            shell_p.write_text(shell, encoding="utf-8")
            time.sleep(1.0)

        m = IFRAME_RE.search(shell)
        if not m:
            log(f"[{year}] {ts}: no report iframe in shell")
            continue
        report_url = m.group(1)
        if report_url in seen_reports:
            continue  # same publish as a previous day
        seen_reports.add(report_url)

        rep_p = RAW / str(year) / "US" / f"{ts}.html"
        if rep_p.exists():
            html = rep_p.read_text(encoding="utf-8", errors="replace")
        else:
            html = fetch_live_or_wayback(report_url, ts)
            if not html:
                log(f"[{year}] {ts}: report fetch failed {report_url}")
                continue
            rep_p.parent.mkdir(parents=True, exist_ok=True)
            rep_p.write_text(html, encoding="utf-8")
            time.sleep(1.0)

        t, l = parse_snapshot(html, year, "US", ts)
        t["route"] = "rpubs"
        t["source_url"] = report_url
        toplines.append(t)
        # tag rows whose category is a state name with that state's code
        name_to_abbr = {v.lower(): k for k, v in STATES.items()}
        for row in l:
            ab = name_to_abbr.get(row["category"].strip().lower())
            if ab:
                row["state"] = ab
        longs.extend(l)
        log(f"[{year}] {ts[:8]} parsed {len(l)} rows from {report_url[-40:]}")
    if states and set(states) != set(STATES):
        longs = [r for r in longs if r["state"] in states or r["state"] == "US"]
    return toplines, longs


def discover_json(html: str, ts: str, year: int, abbr: str) -> list[dict]:
    """2024 UF pages load numbers client side. Find data URLs in the page and
    pull them from Wayback at the same timestamp."""
    rows = []
    urls = {u for u in DATA_URL_RE.findall(html) if "addtoany" not in u and "gravatar" not in u}
    for u in sorted(urls):
        bare = re.sub(r"^https?://", "", u)
        jp = RAW / str(year) / abbr / f"{ts}_{re.sub(r'[^A-Za-z0-9]+', '_', bare)[-80:]}.json"
        if jp.exists():
            body = jp.read_text(encoding="utf-8", errors="replace")
        else:
            body = fetch_snapshot(bare, ts)
            if not body:
                continue
            jp.parent.mkdir(parents=True, exist_ok=True)
            jp.write_text(body, encoding="utf-8")
            time.sleep(0.5)
        try:
            data = json.loads(body)
        except ValueError:
            continue

        def walk(node, path):
            if isinstance(node, dict):
                for k, v in node.items():
                    walk(v, path + [str(k)])
            elif isinstance(node, list):
                for i, v in enumerate(node):
                    walk(v, path + [str(i)])
            elif isinstance(node, (int, float)) and not isinstance(node, bool):
                rows.append({
                    "year": year, "state": abbr, "snapshot_ts": ts,
                    "snapshot_date": f"{ts[0:4]}-{ts[4:6]}-{ts[6:8]}",
                    "section": "json:" + bare[-60:], "category": "/".join(path[:-1]),
                    "metric": path[-1] if path else "", "value": node, "raw": "",
                })
        walk(data, [])
    return rows


def wayback_route(year: int, states: list[str], workers: int):
    toplines, longs = [], []
    with cf.ThreadPoolExecutor(max_workers=workers) as ex:
        for t, l in ex.map(lambda a: wayback_state(year, a), states):
            toplines.extend(t)
            longs.extend(l)
    return toplines, longs


# --------------------------------------------------------------------------- #
#  Output
# --------------------------------------------------------------------------- #

def write_csv(path: Path, rows: list[dict]):
    if not rows:
        log(f"nothing to write for {path.name}")
        return
    keys = []
    for r in rows:
        for k in r:
            if k not in keys:
                keys.append(k)
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=keys)
        w.writeheader()
        w.writerows(rows)
    log(f"wrote {len(rows):,} rows to {path}")


# --------------------------------------------------------------------------- #
#  Main
# --------------------------------------------------------------------------- #

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--years", nargs="+", type=int, default=[2022, 2024])
    ap.add_argument("--states", nargs="+", default=list(STATES), help="postal codes, default all")
    ap.add_argument("--route", choices=["auto", "git", "wayback"], default="auto")
    ap.add_argument("--workers", type=int, default=4, help="parallel Wayback downloads")
    args = ap.parse_args()

    states = [s.upper() for s in args.states]
    bad = [s for s in states if s not in STATES]
    if bad:
        sys.exit(f"unknown states: {bad}")

    OUT.mkdir(exist_ok=True)
    RAW.mkdir(exist_ok=True)

    for year in args.years:
        if year not in WINDOWS:
            log(f"no config for {year}, skipping")
            continue
        log(f"===== {year} =====")
        result = None
        if args.route in ("auto", "git"):
            result = git_route(year, states)
        if result is None and args.route in ("auto", "wayback"):
            if year == 2022:
                result = rpubs_route(year, states)
                if not result[0]:
                    log("[2022] RPubs route empty, trying per state pages")
                    result = wayback_route(year, states, args.workers)
            else:
                result = wayback_route(year, states, args.workers)
        if result is not None and not result[0]:
            log(f"[{year}] every source came back empty. Check that web.archive.org is reachable "
                f"from this machine:  curl -sI https://web.archive.org | head -1")
            result = None
        if result is None:
            log(f"[{year}] no data from any route")
            continue
        toplines, longs = result
        toplines.sort(key=lambda r: (r["state"], r["snapshot_ts"]))
        longs.sort(key=lambda r: (r["state"], r["snapshot_ts"], r["section"], r["category"]))
        write_csv(OUT / f"ev_toplines_{year}.csv", toplines)
        write_csv(OUT / f"ev_long_{year}.csv", longs)

        # quick QA summary
        by_state = {}
        for r in toplines:
            by_state.setdefault(r["state"], 0)
            by_state[r["state"]] += 1
        log(f"[{year}] snapshots per state: " +
            " ".join(f"{s}:{n}" for s, n in sorted(by_state.items())))

    log("done. Raw HTML kept in ev_history/raw/ so you can re-run parsing without re-downloading.")


if __name__ == "__main__":
    main()
