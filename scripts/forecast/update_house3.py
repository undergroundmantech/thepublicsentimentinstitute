import re, json, csv, os, sys, collections
import numpy as np

RES = os.environ.get("RES_HOUSE", "/tmp/house_v3")
LIVE = "/tmp/hpub/house.html"
OUT  = "/tmp/hpub/house.html"

h = open(LIVE, encoding="utf-8").read()
# The working copy carries no publish skeleton, so the marker is usually absent. find()
# returning -1 used to slice 20 characters off the front of the page on every run, which
# is what silently ate the House page's <title> line over two passes.
MARK = "</style></head><body>"
i = h.find(MARK)
body = h[i + len(MARK):].lstrip("\n") if i >= 0 else h
m = re.search(r'(<script type="application/json" id="data">)(.*?)(</script>)', body, re.S)
D = json.loads(m.group(2))

def slug(n): return re.sub(r"_+","_",re.sub(r"[^a-z0-9]+","_",n.lower())).strip("_")
RANGE = re.compile(r"Middle 80 percent of simulated outcomes: .*$")
def mg(x): return ("D+%.1f" % x) if x >= 0 else ("R+%.1f" % -x)

stats = collections.Counter(); touched = []
for fp, S in D["states"].items():
    nm = slug(S["name"])
    dcsv = f"{RES}/{nm}_2026_house_district_forecast.csv"
    rsum = f"{RES}/{nm}_house_run_summary.json"
    if not (os.path.exists(dcsv) and os.path.exists(rsum)):
        stats["state missing from run"] += 1; continue
    new = {int(r["district"]): r for r in csv.DictReader(open(dcsv))}
    R = json.load(open(rsum))
    for row in S["rows"]:
        c = new.get(row["n"])
        if not c: stats["district missing"] += 1; continue
        f = lambda k: float(c[k]) if c.get(k) not in (None, "") else None
        if c.get("dem_pct") in (None, ""):
            # uncontested seat: the page already carries nulls here and a fx marker
            pv = f("projected_votes")
            if pv is not None: row["tv"] = int(round(pv))
            stats["uncontested"] += 1
            continue
        row["dp"] = round(f("dem_pct"), 2); row["rp"] = round(f("rep_pct"), 2); row["op"] = round(f("third_pct"), 2)
        row["dv"] = int(round(f("dem_votes"))); row["rv"] = int(round(f("rep_votes")))
        row["ov"] = int(round(f("third_votes"))); row["tv"] = int(round(f("projected_votes")))
        row["m"] = round(f("margin"), 2); row["rate"] = c["rating"]
        row["p"] = round(f("dem_win_prob"), 1)
        lo, hi = f("margin_p10"), f("margin_p90")
        if lo is not None: row["lo"] = round(lo, 1)
        if hi is not None: row["hi"] = round(hi, 1)
        row["e"] = round(f("elasticity"), 2)
        fl = f("flip")
        if fl is not None: row["flip"] = round(fl, 2)
        # no flip value in the run: keep whatever the page already carries
        cp = f("cand_pts")
        row["cand"] = round(cp, 2) if cp is not None else 0.0
        row["poll"] = c.get("poll_d2") not in (None, "")
        if isinstance(row.get("note"), str) and RANGE.search(row["note"]):
            row["note"] = RANGE.sub("Middle 80 percent of simulated outcomes: %s to %s" % (mg(row["lo"]), mg(row["hi"])), row["note"])
        stats["districts"] += 1
    # County layer. This script used to refresh districts only, so every state's county
    # projection stayed whatever the page was first built with: Johnson County, Iowa read
    # D+47.2 on the page against D+46.4 in the Sept 24 run. The county file is rewritten
    # from the run now, keeping the 2024 comparison fields the run does not produce.
    ccsv = f"{RES}/{nm}_2026_house_county_projection.csv"
    if os.path.exists(ccsv) and S.get("counties"):
        cnew = {r["county_fips"]: r for r in csv.DictReader(open(ccsv))}
        for cr in S["counties"]:
            c = cnew.get(cr["f"])
            if not c: stats["county missing"] += 1; continue
            g = lambda k: float(c[k]) if c.get(k) not in (None, "") else None
            cr["m"] = round(g("dem_margin"), 1); cr["dp"] = round(g("dem_pct"), 1); cr["rp"] = round(g("rep_pct"), 1)
            cr["w"] = int(round(g("projected_turnout"))); cr["dv"] = int(round(g("dem_votes"))); cr["rv"] = int(round(g("rep_votes")))
            for k2, col in (("m1", "m1_fundamental_d2"), ("m2", "m2_census_d2"), ("m3", "m3_history_d2")):
                if g(col) is not None: cr[k2] = round(g(col), 1)
            stats["counties"] += 1
    sim = R["simulation"]
    S["sim"] = {"mean": sim["mean_dem_seats"], "median": sim["median_dem_seats"], "dist": sim["dist"]}
    S["comp"] = R["components"]
    S["state_margin"] = round(R["statewide_house_margin"], 2)
    S["seats_d"] = R["dem_seats_point"]; S["seats_r"] = R["rep_seats_point"]
    S["votes"] = int(round(R["state_votes"])); S["dem_votes"] = int(round(R["dem_votes"])); S["rep_votes"] = int(round(R["rep_votes"]))
    if R.get("sensitivity"): S["sens"] = R["sensitivity"]
    touched.append(S["ab"]); stats["states"] += 1

# national
nat = json.load(open(f"{RES}/national_summary.json"))
D["odds"] = {"d_majority": round(nat["d_majority"], 2), "mean": nat["mean"],
             "median": nat["median"], "p10": nat["p10"], "p90": nat["p90"]}
sd = sum(S["seats_d"] for S in D["states"].values()); sr = sum(S["seats_r"] for S in D["states"].values())
nv = D["natvote"]
cast = {"d": 0, "r": 0, "o": 0, "votes": 0, "n": 0}
extra = {"d": 0.0, "r": 0.0, "o": 0.0, "votes": 0}
for fp, S in D["states"].items():
    nm = slug(S["name"])
    try:
        cs = {int(r["district"]): r for r in csv.DictReader(open(f"{RES}/{nm}_2026_house_district_forecast.csv"))}
    except Exception:
        cs = {}
    for row in S["rows"]:
        if row.get("dp") is not None:
            cast["d"] += row["dv"]; cast["r"] += row["rv"]; cast["o"] += row["ov"]
            cast["votes"] += row["tv"]; cast["n"] += 1
        else:
            # uncontested: the vote splits on the district's own final two party share
            c = cs.get(row["n"]); tv = row.get("tv") or 0
            extra["votes"] += tv
            if c and c.get("final_d2") not in (None, ""):
                f2 = float(c["final_d2"]); th = float(c.get("third_share") or 0)
                extra["o"] += tv * th; extra["d"] += tv * (1 - th) * f2; extra["r"] += tv * (1 - th) * (1 - f2)
nv["cast"] = cast
nv["full"] = {"d": int(round(cast["d"] + extra["d"])), "r": int(round(cast["r"] + extra["r"])),
              "o": int(round(cast["o"] + extra["o"])), "votes": cast["votes"] + extra["votes"]}
nv["seats_d"] = sd; nv["seats_r"] = sr
# natgen and settled are left as published: natgen is a national input the census leg
# anchor does not touch, and settled's vote definition is not reproducible from the run
print("states", stats["states"], "districts", stats["districts"], "counties", stats["counties"], dict((k,v) for k,v in stats.items() if "missing" in k) or "")
print("seats", sd, "D /", sr, "R | odds", D["odds"])
print("natgen left at %.5f | cast n %d | full votes %d" % (D["natgen"], cast["n"], nv["full"]["votes"]))

out = body[:m.start(2)] + json.dumps(D, separators=(",",":"), ensure_ascii=False) + body[m.end(2):]
open(OUT, "w", encoding="utf-8").write(out)
json.dump(D, open("/tmp/hpub/house-data.json","w"), separators=(",",":"), ensure_ascii=False)
print("wrote", OUT, len(out), "bytes")
