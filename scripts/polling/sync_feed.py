"""Bring the polling average pages up to date with every poll in the forecast's poll feed.

For each Senate and governor race, every poll in the model's poll file that the page does not carry yet is added
to app/_polling/senatepolling/<state>.ts or governorpolling/<state>.ts, with the candidates the page names.
A poll counts as already there when the page has the same end date and either the same sample size or a pollster
name that starts the same way. Wedgewood Polls is never added. Ranked choice races and the Rhode Island governor
block file are left to hand entry.

usage: python3 -I scripts/polling/sync_feed.py SITE MODEL_DIR [--dry]
"""
import sys, os, re, json, csv, glob
SITE, MODEL = sys.argv[1], sys.argv[2]; DRY = "--dry" in sys.argv
SKIP = {"AK", "AKG", "MT", "RIG"}
EXCLUDE = re.compile(r"wedgewood", re.I)
MON = {m: i for i, m in enumerate(["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"], 1)}
norm = lambda s: re.sub(r"[^a-z]", "", re.sub(r"\((?:r|d|i)\)|^the |^fox news/", "", str(s).lower()))[:6]

from datetime import date
def days(iso):
    y, m, d = map(int, iso[:10].split("-")); return date(y, m, d).toordinal()

def start_of(dates, end):
    d = str(dates).lower(); y = end[:4]
    m = re.search(r"([a-z]+)\s+(\d{1,2})\s*(?:-|to)\s*(?:([a-z]+)\s+)?(\d{1,2})", d)
    if m and m.group(1) in MON: return f"{y}-{MON[m.group(1)]:02d}-{int(m.group(2)):02d}"
    m = re.search(r"(\d{4}-\d{2}-\d{2})", d)
    if m: return m.group(1)
    return end

model = json.load(open(f"{SITE}/public/forecast/model.json"))
mapf = json.load(open("/tmp/fcrun/model_polls_oct.json"))["files"]
hook = json.load(open(f"{MODEL}/polls_oct12_hook.json"))
slug = lambda s: re.sub(r"[^a-z]", "", s.lower())
added = {}
for r in model["races"]:
    if r["office"] not in ("senate", "governor"): continue
    key = r["st"] + ("G" if r["office"] == "governor" else "")
    if key in SKIP: continue
    page = f"{SITE}/app/_polling/{'senatepolling' if r['office'] == 'senate' else 'governorpolling'}/{slug(r['state'])}.ts"
    if not os.path.exists(page): continue
    src = open(page).read()
    cm = re.search(r"candidates: \[([^\]]*)\]", src)
    if not cm: continue
    cands = re.findall(r'"([^"]+)"', cm.group(1))
    dk = next((c for c in cands if c.endswith("(D)") or c.endswith("(I)")), None); rk = next((c for c in cands if c.endswith("(R)")), None)
    if not dk or not rk: continue
    rid = re.search(r'DEFAULT_RACE_ID = "([^"]+)"', src).group(1)
    have = [(p["endDate"], p.get("sampleSize"), norm(p["pollster"])) for p in (json.loads(x) for x in re.findall(r'^\s*(\{"raceId".*\})\s*,?\s*$', src, re.M))]
    rows = []
    if key in ("OH", "MI"):
        rows = [dict(source=p["source"], dates=p["dates"], end=p["end"], n=p["n"], pop=p["pop"], R=p["R"], D=p["D"], O=p.get("O", 0), U=p.get("U", 0)) for p in hook[key]]
    else:
        f = mapf.get(key) or next(iter(glob.glob(f"{MODEL}/{key}/polls_{key.lower()}.csv")), None)
        if not f or not os.path.exists(f): continue
        rows = list(csv.DictReader(open(f)))
    new = []
    for p in rows:
        try:
            end = str(p["end"]).strip(); n = int(float(p["n"])); D = float(p["D"]); R = float(p["R"])
        except (ValueError, KeyError, TypeError): continue
        if not re.match(r"2026-\d{2}-\d{2}$", end) or EXCLUDE.search(str(p["source"])): continue
        nn = norm(p["source"])
        if any((e == end and (sz == n or nm == nn)) or (nm == nn and sz == n and abs(days(e) - days(end)) <= 10) for e, sz, nm in have): continue
        O = float(p.get("O") or 0); U = float(p.get("U") or 0)
        res = {dk: D, rk: R}
        if O > 0: res["Other"] = O
        if U > 0: res["Undecided"] = U
        pop = str(p["pop"]).strip().upper(); pop = pop if pop in ("LV", "RV", "A") else "LV"
        new.append({"raceId": rid, "pollster": str(p["source"]).strip(), "startDate": start_of(p["dates"], end), "endDate": end, "sampleSize": n, "sampleType": pop, "results": res})
        have.append((end, n, norm(p["source"])))
    if not new: continue
    new.sort(key=lambda x: x["endDate"])
    added[r["id"]] = [(x["pollster"], x["endDate"]) for x in new]
    if DRY: continue
    i = src.rindex("\n  ],\n};")
    body = src[:i].rstrip()
    if not body.endswith(","): body += ","
    src = body + "\n" + ",\n".join("    " + json.dumps(x, ensure_ascii=False) for x in new) + src[i:]
    newest = max([x["endDate"] for x in new] + [e for e, _, _ in have])
    src = re.sub(r"Newest poll: \d{4}-\d{2}-\d{2}\.", f"Newest poll: {newest}.", src, count=1)
    os.unlink(page) if os.path.islink(page) else None
    open(page, "w").write(src)
tot = sum(len(v) for v in added.values())
print("races", len(added), "polls added", tot)
for k, v in sorted(added.items()): print(k, len(v), v if "--all" in sys.argv else v[-3:])
