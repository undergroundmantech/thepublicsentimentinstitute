#!/usr/bin/env python3
"""Ohio early vote by party, from the Secretary of State's absentee and early voting dashboard.

Ohio has no party registration; the state counts a voter's party from the last party primary they voted in, and its
dashboard at data.ohiosos.gov/portal/election-dashboards/absentee breaks the early vote down that way. The dashboard
is a JavaScript app, so this script finds the data feeds it loads and saves them. Run it in Codespaces:

    python3 scripts/earlyvote/party/pull_oh_party.py

Step one, every run: it reads the app's scripts, lists every data address that mentions absentee or early voting,
downloads each one that answers with JSON or CSV into scripts/earlyvote/party/oh_raw, and prints what it found.
Step two, once a feed with party columns is found: it writes public/earlyvote-party/OH.json, the statewide split the
early vote tracker applies to Ohio's ballot count. If it cannot find party columns on its own, push scripts/earlyvote/party/oh_raw
to the repo and On Point can map the columns.
"""
import json, os, re, sys, urllib.parse, urllib.request
from datetime import datetime, timezone

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
CACHE = os.path.join(ROOT, "scripts/earlyvote/party/oh_raw")
OUT = os.path.join(ROOT, "public/earlyvote-party/OH.json")
BASE = "https://data.ohiosos.gov"
PAGE = BASE + "/portal/election-dashboards/absentee"
UA = {"User-Agent": "Mozilla/5.0 OnPointPolitics research", "Accept": "*/*"}


def get(url, timeout=60):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
        return r.read(), r.headers.get("content-type", "")


def main():
    os.makedirs(CACHE, exist_ok=True)
    html = get(PAGE)[0].decode("utf-8", "replace")
    scripts = [urllib.parse.urljoin(PAGE, s) for s in re.findall(r'<script[^>]+src="([^"]+)"', html)]
    print(f"{len(scripts)} scripts on the dashboard page")
    cands = set()
    for s in scripts:
        try:
            js = get(s)[0].decode("utf-8", "replace")
        except Exception as e:
            print("  could not read", s, e); continue
        # chunk files the app loads later
        for c in re.findall(r'"(static/js/[^"]+\.chunk\.js)"', js):
            scripts.append(urllib.parse.urljoin(BASE + "/", c))
        for m in re.findall(r'["\'`](https?://[^"\'`\s]+|/[A-Za-z0-9_\-/.]*(?:api|data|json|csv|absentee|early)[A-Za-z0-9_\-/.?=&]*)["\'`]', js):
            if re.search(r"absentee|early|abs|ballot|dashboard|api", m, re.I):
                cands.add(urllib.parse.urljoin(BASE + "/", m))
    print(f"{len(cands)} candidate data addresses")
    saved = []
    for u in sorted(cands):
        try:
            body, ct = get(u, 30)
        except Exception as e:
            print("  no answer", u, str(e)[:60]); continue
        kind = "json" if "json" in ct or body[:1] in (b"{", b"[") else "csv" if "csv" in ct or b"," in body[:200] and b"<" not in body[:50] else None
        if not kind:
            continue
        name = re.sub(r"[^A-Za-z0-9]+", "_", urllib.parse.urlparse(u).path + "_" + urllib.parse.urlparse(u).query).strip("_")[:120] + "." + kind
        with open(os.path.join(CACHE, name), "wb") as f:
            f.write(body)
        saved.append((u, name, len(body)))
        print(f"  saved {name} {len(body):,} bytes from {u}")
    with open(os.path.join(CACHE, "_found.json"), "w") as f:
        json.dump({"page": PAGE, "scripts": scripts, "candidates": sorted(cands), "saved": saved}, f, indent=1)

    # look for a table with party columns in what was saved
    split = None
    for _, name, _ in saved:
        txt = open(os.path.join(CACHE, name), encoding="utf-8", errors="replace").read()
        if not re.search(r"democrat", txt, re.I) or not re.search(r"republican", txt, re.I):
            continue
        try:
            data = json.loads(txt)
        except Exception:
            continue
        acc = {"dem": 0, "rep": 0, "una": 0, "oth": 0}

        def walk(o):
            if isinstance(o, dict):
                keys = {k.lower(): k for k in o}
                for lk, k in keys.items():
                    v = o[k]
                    if isinstance(v, (int, float)):
                        if "democrat" in lk: acc["dem"] += v
                        elif "republican" in lk: acc["rep"] += v
                        elif "unaffiliated" in lk or "nonpartisan" in lk or "unaff" in lk: acc["una"] += v
                for v in o.values(): walk(v)
            elif isinstance(o, list):
                for v in o: walk(v)
        walk(data)
        if acc["dem"] and acc["rep"]:
            split = (name, acc); break
    if split:
        name, acc = split
        os.makedirs(os.path.dirname(OUT), exist_ok=True)
        with open(OUT, "w") as f:
            json.dump({"asof": datetime.now(timezone.utc).strftime("%Y-%m-%d"), "source": f"Ohio Secretary of State absentee and early voting dashboard, {name}",
                       "statewide": acc}, f, indent=1)
        print(f"wrote {OUT}: {acc}. Check these against the dashboard before pushing; a feed can repeat totals.")
    else:
        print("no party table found automatically; push scripts/earlyvote/party/oh_raw so the columns can be mapped")


if __name__ == "__main__":
    main()
