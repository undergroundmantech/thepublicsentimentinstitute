"""S1026FM: the final methodology layer as a run patch_sweep can publish.

Every statewide race and House district is moved to its target from targets.json: half the current model without the
retired early vote term, half the final method. Each statewide race keeps its base run's lane files; its run_summary
deterministic margin and its county file carry the change, so patch_sweep applies exactly target minus published, county
by county. The three way races the two party legs cannot read (Montana Senate, Idaho and Rhode Island governor) move only
by taking out the retired early vote term. House district files are S1025DN's with each district's two party margin moved
by its change, published with HOUSE_BASE=S1025DN.
"""
import glob, json, os, shutil
import pandas as pd
R = "/tmp/fcrun/runs"; OUT = f"{R}/{os.environ.get('FM_TAG', 'S1026FM')}"; HB = f"{R}/{os.environ.get('FM_HOUSE_BASE', 'S1025DN')}/house"
LATEST = "/tmp/claude-0/-home-claude/2fe66b6b-24b4-5fab-b0f7-c44b6f59cc0e/scratchpad/LATEST.json"
T = json.load(open(os.environ.get("FM_TARGETS", "/tmp/fcrun/fm/targets.json")))
m = json.load(open("/tmp/site/public/forecast/model.json"))
C = json.load(open("/tmp/site/public/forecast/counties.json"))
base_runs = [x for x in os.environ.get("FM_RUNS_FIRST", "").split(",") if x] + json.load(open(LATEST))["base_runs_for_next_sweep"].split(",")
loc = {}
for run in base_runs:
    for f in sorted(glob.glob(f"{R}/{run}/lane*/run_summary.json")):
        for k, v in json.load(open(f))["results"].items(): loc.setdefault(k, os.path.dirname(f))
key_of = lambda r: r["st"] if r["office"] == "senate" else r["st"] + "G"

# statewide changes, D minus R points: target minus published, and the same per county
delta, cdelta = {}, {}
for r in m["races"]:
    if r["office"] not in ("senate", "governor"): continue
    k = key_of(r)
    if k not in loc or abs(r["est"]["margin"]) >= 99.9: continue
    if k in T["statewide"]:
        t = T["statewide"][k]; delta[k] = t["delta_d"]; cdelta[k] = t["counties"]
    else:
        sh = (r.get("ev") or {}).get("shift", 0.0)
        if abs(sh) < 1e-9: continue
        delta[k] = sh
        evm = (C.get(r["id"]) or {}).get("_ev") or {}
        cdelta[k] = {f: evm.get(f, 0.0) for f in (C.get(r["id"]) or {}) if not f.startswith("_")}

shutil.rmtree(OUT, ignore_errors=True); os.makedirs(OUT)
dirs = sorted({loc[k] for k in delta})
nk = 0
for i, src in enumerate(dirs):
    dst = f"{OUT}/lane{i + 1:02d}"; os.makedirs(dst)
    rs = json.load(open(f"{src}/run_summary.json"))
    keys = [k for k in rs["results"] if k in delta and loc[k] == src]
    rewrite = set()
    for k in keys:
        v = rs["results"][k]; off = "governor" if len(k) == 3 and k.endswith("G") else "senate"
        rewrite.add(f"{v['state'].lower().replace(' ', '_')}_2026_{off}_county_forecast.csv")
    for f in os.listdir(src):
        if f != "run_summary.json" and f not in rewrite: os.symlink(f"{src}/{f}", f"{dst}/{f}")
    out = {}
    for k in keys:
        v = rs["results"][k]; d = delta[k]
        if isinstance(v["deterministic_margin"], (int, float)): v["deterministic_margin"] = float(v["deterministic_margin"]) + d
        else: v["deterministic_margin"]["margin"] = float(v["deterministic_margin"]["margin"]) + d
        v["final_method"] = {kk: T["statewide"][k].get(kk) for kk in ("gallup", "electorate", "polls", "weights", "final_method", "current_d", "target_d")} if k in T["statewide"] else {"ev_retired_only": True}
        out[k] = v; nk += 1
        off = "governor" if len(k) == 3 and k.endswith("G") else "senate"
        fn = f"{v['state'].lower().replace(' ', '_')}_2026_{off}_county_forecast.csv"
        c = pd.read_csv(f"{src}/{fn}", dtype={"county_fips": str})
        cd = cdelta[k]
        def get(f):
            for g in (f, f.lstrip("0"), f.zfill(5)):
                if g in cd: return cd[g]
            return d
        dd = c.county_fips.map(get)
        if "dem_margin" in c: c["dem_margin"] = c.dem_margin + dd
        elif "bloc_margin" in c: c["bloc_margin"] = c.bloc_margin + dd
        else: c["dem_pct"] = c.dem_pct + dd / 2; c["rep_pct"] = c.rep_pct - dd / 2
        c.to_csv(f"{dst}/{fn}", index=False)
    rs["results"] = out
    json.dump(rs, open(f"{dst}/run_summary.json", "w"))

# House
os.makedirs(f"{OUT}/house")
hd = {(v["slug"], v["district"]): v["delta_d"] for v in T["house"].values()}
nh = 0
for f in glob.glob(f"{HB}/*"):
    b = os.path.basename(f)
    if not b.endswith("_2026_house_district_forecast.csv"): os.symlink(f, f"{OUT}/house/{b}"); continue
    slug = b.split("_2026_")[0]; a = pd.read_csv(f)
    for i, x in a.iterrows():
        d = hd.get((slug, int(x.district)))
        if d is None: continue
        a.at[i, "dem_pct"] = x.dem_pct + d / 2; a.at[i, "rep_pct"] = x.rep_pct - d / 2; nh += 1
    a.to_csv(f"{OUT}/house/{b}", index=False)
print("statewide races", nk, "lanes", len(dirs), "house districts", nh, "of", len(hd))
