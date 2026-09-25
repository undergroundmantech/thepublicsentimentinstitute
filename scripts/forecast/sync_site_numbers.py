"""Copy the forecast's race numbers onto the pages that do not read the forecast data.

Only /forecast reads public/forecast/model.json. The home page swarm, the coverage
globes, the electoral map and the situation room read app/components/senateModel.ts,
and /forecastratings reads its own SENATE_RAW and GOV_RAW tables. All of those were
typed in by hand on Sept 23 and never touched by a forecast run, so every re-run since
reached one page and left the rest of the site showing numbers two days old.

Run this after every forecast build, from the repository root:

    python3 scripts/forecast/sync_site_numbers.py

It rewrites the Senate margins in senateModel.ts and the modeledResult and pollingAvg
fields in both ratings pages, and prints every value it changed. Margins are GOP
positive throughout, the convention all three files already use.
"""
import json, re, sys, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
M = json.load(open(os.path.join(ROOT, "public/forecast/model.json")))
races = {(r["office"], r["st"]): r for r in M["races"] if r["office"] in ("senate", "governor")}
fmt = lambda x: "null" if x is None else f"{round(float(x), 1):.1f}"
changes = []

# ── senateModel.ts ─────────────────────────────────────────────────────────────
p = os.path.join(ROOT, "app/components/senateModel.ts")
t = open(p).read()
m = re.search(r"(export const SENATE_MODEL: SenateRace\[\] = \[\n)(.*?)(\n\];)", t, re.S)
old = {x.group(1): float(x.group(2)) for x in re.finditer(r'st: "([A-Z]{2})", m: (-?[\d.]+)', m.group(2))}
rows = sorted((r for (o, _), r in races.items() if o == "senate"), key=lambda r: r["st"])
cells = [f'{{ st: "{r["st"]}", m: {fmt(r["est"]["margin"])}' + (", open: true" if r.get("open") else "") + " }" for r in rows]
body = "\n".join("  " + ", ".join(cells[i:i + 3]) + "," for i in range(0, len(cells), 3))
t = t[:m.start(2)] + body + t[m.end(2):]
open(p, "w").write(t)
for r in rows:
    was = old.get(r["st"]); now = round(r["est"]["margin"], 1)
    if was is None or abs(was - now) > 0.05:
        changes.append(("senateModel.ts", r["st"], was, now))

# ── ratings pages ──────────────────────────────────────────────────────────────
ROW = re.compile(r'(\{ state:\s*"([A-Z]{2})",.*?pollingAvg:\s*)(-?[\d.]+|null)(,\s*modeledResult:\s*)(-?[\d.]+|null)(\s*\})')
for fn in ("app/forecastratings/ForecastRatingsV2.tsx", "app/forecastratings/ForecastRatingsV1.tsx"):
    p = os.path.join(ROOT, fn)
    if not os.path.exists(p): continue
    t = open(p).read()
    for table, office in (("SENATE_RAW", "senate"), ("GOV_RAW", "governor")):
        mm = re.search(rf"const {table} = \[\n(.*?)\n\];", t, re.S)
        if not mm: continue
        def sub(x):
            r = races.get((office, x.group(2)))
            if not r: return x.group(0)
            pa = r.get("pollAvg")
            new_pa, new_mr = fmt(pa), fmt(r["est"]["margin"])
            if x.group(3) != new_pa or x.group(5) != new_mr:
                changes.append((os.path.basename(fn) + " " + office, x.group(2), f"{x.group(5)} / poll {x.group(3)}", f"{new_mr} / poll {new_pa}"))
            return x.group(1) + new_pa + x.group(4) + new_mr + x.group(6)
        block = ROW.sub(sub, mm.group(1))
        t = t[:mm.start(1)] + block + t[mm.end(1):]
    open(p, "w").write(t)

for c in changes:
    print(f"  {c[0]:<34} {c[1]}  {c[2]}  ->  {c[3]}")
print(f"{len(changes)} values updated from public/forecast/model.json (updated {M['meta']['updated']})")
