"""Make every race page agree with the published forecast after the Oct 26 full rerun.
  cands     the two nominees' vote shares and votes from the race's own vote totals, which patch_sweep keeps in step
            with the margin; other candidates share what is left in their old proportions (ranked choice races keep theirs)
  stages    the Fundamentals step from the run: for Senate and governor the run's blend without its poll leg, for the
            House each district's model share before polls, as Republican minus Democratic points of the whole vote
  crosstabs every Senate and governor estimated exit poll from the run itself
usage: python3 -I fix_race_pages.py PUBLIC_FORECAST_DIR RUN[,RUN2]"""
import json, glob, os, sys
import pandas as pd
P, RUNS = sys.argv[1], sys.argv[2].split(",")
m = json.load(open(f"{P}/model.json")); X = json.load(open(f"{P}/crosstabs.json"))
R = {}
for t in RUNS:
    for f in sorted(glob.glob(f"/tmp/fcrun/runs/{t}/lane*/run_summary.json")):
        for k, v in json.load(open(f))["results"].items(): R.setdefault(k, v)
H = {}
for t in RUNS:
    for f in glob.glob(f"/tmp/fcrun/runs/{t}/house/*_2026_house_district_forecast.csv"):
        slug = os.path.basename(f).split("_2026_")[0]
        for x in pd.read_csv(f).itertuples(): H.setdefault((slug, int(x.district)), x)
key_of = lambda r: r["st"] if r["office"] == "senate" else r["st"] + "G"
nc = nf = nx = 0
for r in m["races"]:
    v = r.get("votes") or {}; e = r["est"]
    if abs(e["margin"]) >= 99.9 or not v.get("total"): continue
    T = v["total"]; two = (v["dem"] + v["rep"]) / T
    if not r.get("rcv"):
        cs = r.get("cands") or []
        dn = next((c for c in cs if c["name"] == r["dem"]), None); rn = next((c for c in cs if c["name"] == r["gop"]), None)
        if dn and rn:
            dn["votes"], rn["votes"] = int(v["dem"]), int(v["rep"])
            dn["pct"], rn["pct"] = round(100 * v["dem"] / T, 2), round(100 * v["rep"] / T, 2)
            rest = [c for c in cs if c is not dn and c is not rn]
            left = max(0, T - v["dem"] - v["rep"]); old = sum(float(c.get("pct") or 0) for c in rest)
            for c in rest:
                sh = (float(c.get("pct") or 0) / old) if old > 0 else 1 / len(rest)
                c["votes"] = int(round(left * sh)); c["pct"] = round(100 * left * sh / T, 2)
            nc += 1
    if r["office"] in ("senate", "governor"):
        k = key_of(r); x = R.get(k)
        if x:
            comp = x.get("components_statewide") or {}; bw = x.get("blend_weights") or {}
            wp = float(bw.get("M3") or 0); fin, m3 = comp.get("final_d2"), comp.get("M3")
            if fin is not None and m3 is not None and wp < 0.999:
                fd2 = (float(fin) - wp * float(m3)) / (1 - wp)
                fund = round(-(2 * fd2 - 100) * two, 2)
                r["stages"]["fund"] = fund; r["fundamentals"] = fund; nf += 1
            xt = (x.get("crosstabs") or {}).get("rows")
            if xt:
                X[r["id"]] = [[str(a[0]), str(a[1]), round(float(a[2]), 1), round(float(a[3]), 1), round(float(a[4]), 1), round(sum(float(b) for b in a[5:]), 1)] for a in xt]
                nx += 1
    elif r["office"] == "house":
        slug = r["state"].lower().replace(" ", "_"); dnum = int(r["district"]) if r["district"] else 1
        x = H.get((slug, dnum)) or H.get((slug, 0))
        if x is not None and not pd.isna(x.model_d2):
            fund = round(-(200 * float(x.model_d2) - 100) * two, 2)
            r["stages"]["fund"] = fund; r["fundamentals"] = fund; nf += 1
        for s in ("poll", "rate", "market"):
            if s in r["stages"]: r["stages"][s] = e["margin"]
json.dump(m, open(f"{P}/model.json", "w"), separators=(",", ":")); json.dump(X, open(f"{P}/crosstabs.json", "w"), separators=(",", ":"))
print("cands", nc, "fundamentals", nf, "crosstabs", nx)
