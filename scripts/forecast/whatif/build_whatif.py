"""Build public/forecast/whatif.json for the What if page.

Every race keeps its own published forecast, and the page moves races together using the model's own joint
simulations: run k of every Senate, governor and House race shares the same national environment, regional and
demographic group shocks, because every lane runs on the same seed. For each statewide race this stores the
2,000 simulated margins as deviations from that race's simulated mean, in tenths of a point, Republican minus
Democrat, rescaled to the published 80 percent range. For the House it stores each district's simulated wins.

usage: python3 build_whatif.py SITE RUN [RUN ...]   newest run first; each race comes from the first run that has it
"""
import sys, os, glob, json, base64
import numpy as np

SITE, RUNS = sys.argv[1], sys.argv[2:]
R = "/tmp/fcrun/runs"
model = json.load(open(f"{SITE}/public/forecast/model.json"))
byid = {r["id"]: r for r in model["races"]}

def key_id(k):
    return f"gov-{k[:-1]}" if k.endswith("G") and len(k) == 3 else f"sen-{k}"

sims, src = {}, {}
for run in RUNS:
    for f in glob.glob(f"{R}/{run}/lane*/sim_margin_*.npy"):
        k = os.path.basename(f)[11:-4]
        if k not in sims and key_id(k) in byid:
            sims[k] = np.load(f).astype(float); src[k] = run
N = len(next(iter(sims.values())))
races, devs = [], []
for k in sorted(sims, key=lambda x: key_id(x)):
    rid = key_id(k); r = byid[rid]; x = -sims[k]            # to Republican minus Democrat, the site's sign
    dev = x - x.mean()
    run_w = np.percentile(x, 90) - np.percentile(x, 10)
    pub_w = (r["est"].get("p90", r["est"]["margin"]) - r["est"].get("p10", r["est"]["margin"]))
    scale = float(np.clip(pub_w / run_w, 0.6, 1.6)) if run_w > 0.1 and pub_w > 0.1 else 1.0
    devs.append(np.clip(np.round(dev * scale * 10), -32000, 32000).astype(np.int16))
    ind = bool(r.get("dem") and r["id"] == "sen-NE") or bool(r.get("ind"))
    races.append(dict(id=rid, k=k, office=r["office"], st=r["st"], state=r["state"], name=r["name"], dem=r["dem"], gop=r["gop"],
                      m=round(r["est"]["margin"], 2), p=round(1 - r["est"]["prob"], 4), ind=bool(r["id"] == "sen-NE"), run=src[k], scale=round(scale, 3)))
D = np.stack(devs)                                            # races x sims
# House: each state from the first run that has its win file
house, bits = [], []
seen = set()
for run in RUNS:
    for f in sorted(glob.glob(f"{R}/{run}/house/win_*.npy")):
        slug = os.path.basename(f)[4:-4]
        if slug in seen: continue
        sj = f"{R}/{run}/house/{slug}_house_run_summary.json"
        csv = f"{R}/{run}/house/{slug}_2026_house_district_forecast.csv"
        if not (os.path.exists(sj) and os.path.exists(csv)): continue
        seen.add(slug)
        ab = json.load(open(sj))["abbr"]; ab = ab[:2] if len(ab) == 3 and ab.endswith("G") else ab
        import pandas as pd
        dist = list(pd.read_csv(csv)["district"])
        w = np.load(f)
        for j, d in enumerate(dist):
            rid = f"house-{ab}-{int(d):02d}"
            r = byid.get(rid)
            if not r: continue
            house.append(dict(id=rid, st=ab, d=int(d), name=r["name"], dem=r["dem"], gop=r["gop"], m=round(r["est"]["margin"], 2), p=round(1 - r["est"]["prob"], 4)))
            bits.append(w[:, j].astype(bool))
H = np.stack(bits)                                            # districts x sims
ch = model["chambers"]
out = dict(meta=dict(updated=model["meta"]["updated"], sims=N, runs=sorted(set(src.values()), reverse=True), house_districts=len(house),
                     senNotUpD=model["meta"]["senNotUpD"], senNotUpR=model["meta"]["senNotUpR"], govNotUpD=model["meta"]["govNotUpD"], govNotUpR=model["meta"]["govNotUpR"]),
           chambers={k: dict(demControl=ch[k]["demControl"], demSeats=ch[k]["demSeats"]) for k in ("senate", "governor", "house")},
           races=races, dev=base64.b64encode(D.astype("<i2").tobytes()).decode(),
           house=house, hwin=base64.b64encode(np.packbits(H, axis=1).tobytes()).decode(), hbytes=int(np.packbits(H, axis=1).shape[1]))
json.dump(out, open(f"{SITE}/public/forecast/whatif.json", "w"), separators=(",", ":"))
# check: the recentred simulations against the published odds
X = np.array([r["m"] for r in races])[:, None] + D / 10.0
sen = [i for i, r in enumerate(races) if r["office"] == "senate"]; gov = [i for i, r in enumerate(races) if r["office"] == "governor"]
sd = out["meta"]["senNotUpD"] + (X[sen] < 0).sum(0); gd = out["meta"]["govNotUpD"] + (X[gov] < 0).sum(0); hd = H.sum(0)
print("races", len(races), "house", len(house), "sims", N, "runs", out["meta"]["runs"])
print("senate sims D>=51", round((sd >= 51).mean(), 4), "D>=50", round((sd >= 50).mean(), 4), "published", ch["senate"]["demControl"], "mean", sd.mean(), ch["senate"]["demSeats"])
print("governor D>=26", round((gd >= 26).mean(), 4), "published", ch["governor"]["demControl"], "mean", gd.mean(), ch["governor"]["demSeats"])
print("house D>=218", round((hd >= 218).mean(), 4), "published", ch["house"]["demControl"], "mean", hd.mean(), ch["house"]["demSeats"])
print("kb", os.path.getsize(f"{SITE}/public/forecast/whatif.json") // 1024)
