"""Refresh the published Senate and Governor pages from the re-run outputs, race by race.
Only races whose numbers moved are touched, and every rebuilt race is checked against the run summary
topline before it is written back."""
import re, json, os, sys, importlib.util
import pandas as pd, numpy as np
SC = "/tmp/claude-0/-home-claude/2fe66b6b-24b4-5fab-b0f7-c44b6f59cc0e/scratchpad"
B = f"{SC}/rerun"
RES = os.environ.get("RES_DIR", f"{B}/output")
S = json.load(open(f"{RES}/run_summary.json"))["results"]
FIPS = {'AL':'01','AK':'02','AZ':'04','AR':'05','CA':'06','CO':'08','CT':'09','DE':'10','FL':'12','GA':'13','HI':'15',
 'ID':'16','IL':'17','IN':'18','IA':'19','KS':'20','KY':'21','LA':'22','ME':'23','MD':'24','MA':'25','MI':'26','MN':'27',
 'MS':'28','MO':'29','MT':'30','NE':'31','NV':'32','NH':'33','NJ':'34','NM':'35','NY':'36','NC':'37','ND':'38','OH':'39',
 'OK':'40','OR':'41','PA':'42','RI':'44','SC':'45','SD':'46','TN':'47','TX':'48','UT':'49','VT':'50','VA':'51','WA':'53',
 'WV':'54','WI':'55','WY':'56'}
slug = lambda s: re.sub(r"_+", "_", re.sub(r"[^a-z0-9]+", "_", s.lower())).strip("_")

# Four of the page's crosstab cuts are survey material the county forecast cannot regenerate.
# xt.run_race returns only the thirteen it computes, so writing its output straight back used
# to delete the other four from every race. They are carried across in published order.
CARRY_CUTS = ("Direction of the country", "Top issue", "Affording daily costs", "Vote history")

def merge_rows(prior, fresh):
    """Fresh rows for every cut the model recomputes, carried rows for the rest, page order kept."""
    if not prior: return fresh
    have = {r[0] for r in fresh}
    order = []
    for r in prior:
        if r[0] not in order: order.append(r[0])
    out = []
    for cat in order:
        if cat in have: out += [r for r in fresh if r[0] == cat]
        elif cat in CARRY_CUTS: out += [r for r in prior if r[0] == cat]
    for r in fresh:
        if r[0] not in order: out.append(r)
    return out

def columns_for(cands, cols):
    out = []
    for i, (nm, party) in enumerate(cands):
        c = slug(nm) + "_pct"
        if c in cols: out.append(c); continue
        if party == "D" and "dem_pct" in cols: out.append("dem_pct"); continue
        if party == "R" and "rep_pct" in cols: out.append("rep_pct"); continue
        # Nebraska runs independent Dan Osborn in the Democratic column after the Democratic
        # nominee withdrew, so a first slot candidate of neither party takes that column.
        if i == 0 and "dem_pct" in cols: out.append("dem_pct"); continue
        if i == 1 and "rep_pct" in cols: out.append("rep_pct"); continue
        raise SystemExit(f"no column for {nm} {party} in {cols}")
    return out

def rebuild(key, race):
    v = S[key]; office = "governor" if key.endswith("G") else "senate"
    nm = v["state"].lower().replace(" ", "_")
    d = pd.read_csv(f"{RES}/{nm}_2026_{office}_county_forecast.csv", dtype={"county_fips": str})
    cols = columns_for(race["cands"], set(d.columns))
    # pick the margin column the page already uses, by agreement with the values it holds, so a race with several
    # margin definitions (a bloc margin and a leader margin, say) keeps the one it was published with
    old_by_f = {c["f"]: c for c in race["counties"]}
    mcands = [c for c in d.columns if c.endswith("_margin")]
    idx = d.set_index("county_fips")
    def misfit(c):
        return max(abs(old_by_f[f]["m"] - idx.loc[f, c]) for f in old_by_f if f in idx.index)
    mcol = "dem_margin" if len(mcands) == 1 and mcands[0] == "dem_margin" else min(mcands, key=misfit)
    counties = []; dmax = 0.0
    for r in d.itertuples():
        old = old_by_f.get(r.county_fips, {})
        nmc = old.get("n") or r.county
        mm = round(getattr(r, mcol), 2)
        if "m" in old: dmax = max(dmax, abs(mm - old["m"]))
        rec = dict(f=r.county_fips, n=nmc, p=[round(getattr(r, c), 1) for c in cols],
                   m=mm, w=int(r.projected_turnout))
        # carry forward anything the page holds that the forecast CSV does not produce:
        # the 2024 comparison, the counterpart and 2018 margins, the presidential vote
        # counts and the ranked choice rounds. A rerun refreshes the projection, it does
        # not get to silently delete the history layered on top of it.
        for extra in ("m24", "mL", "m18", "v24", "t24v", "rcv", "rv", "pw"):
            if extra in old and extra not in rec:
                rec[extra] = old[extra]
        # county elasticity is a model output, so it comes from the new run rather than the page.
        # It used to be neither carried nor rewritten, which deleted it from every county.
        if "elasticity" in d.columns and pd.notna(getattr(r, "elasticity", None)):
            rec["e"] = round(float(r.elasticity), 4)
        elif "e" in old:
            rec["e"] = old["e"]
        counties.append(rec)
    t = d.projected_turnout.values
    sw = [round(float((d[c].values * t).sum() / t.sum()), 2) for c in cols]
    # verify against the run summary topline before anything is written
    import unicodedata
    fold = lambda x: unicodedata.normalize("NFKD", x).encode("ascii", "ignore").decode().lower().strip()
    tl = {fold(k2): val for k2, val in v["topline"].items()}
    for (cn, _), got in zip(race["cands"], sw):
        want = v["topline"].get(cn, tl.get(fold(cn)))   # the page may carry accents the summary does not
        if want is None: raise SystemExit(f"{key}: {cn} not in topline {list(v['topline'])}")
        if abs(want - got) > 0.03: raise SystemExit(f"{key}: {cn} page {got} vs summary {want:.2f}")
    print(f"    {key}: margin column {mcol}, largest county margin change {dmax:.2f}")
    race["counties"] = counties; race["statewide"] = sw
    # A ranked choice race is decided by the final round, so that is the margin the page
    # carries. This used to write v["margin"], the FIRST CHOICE margin, while the check
    # above for whether a race had moved compared the final round one, so Alaska Senate
    # went onto the page as +2.49 when the model's answer was -0.63 and Alaska Governor
    # as +30.53 against a final round of +12.55. The rcv block itself was never rewritten
    # at all, so it kept whatever an older run had left there and drifted away from the
    # counties underneath it. Both now come from the run.
    if v.get("rcv_final_margin") is not None:
        race["margin"] = round(float(v["rcv_final_margin"]), 2)
        if "rcv_final_dem_votes" in d.columns and "rcv_final_rep_votes" in d.columns:
            fd = float(d.rcv_final_dem_votes.sum()); fr = float(d.rcv_final_rep_votes.sum())
            race["rcv"] = dict(pct=[round(fd / (fd + fr) * 100, 2), round(fr / (fd + fr) * 100, 2)],
                               votes=[int(round(fd)), int(round(fr))],
                               exhausted=int(round(float(v.get("rcv_exhausted_votes") or 0))),
                               # the first-choice margin, which used to be readable off
                               # race["margin"] and no longer is now that that field holds
                               # the final round
                               first=round(float(v["margin"]), 2))
    else:
        race["margin"] = round(float(v["margin"]), 2)
    race["totalVotes"] = int(d.projected_turnout.sum())
    return race

def go(path, keys, label):
    h = open(path).read()
    m = re.search(r'(<script type="application/json" id="data">)(.*?)(</script>)', h, re.S)
    D = json.loads(m.group(2))
    spec = importlib.util.spec_from_file_location("xt", f"{B}/crosstabs.py")
    xt = importlib.util.module_from_spec(spec); spec.loader.exec_module(xt)
    done = []
    for k in keys:
        st = k[:-1] if k.endswith("G") else k; fp = FIPS[st]
        if fp not in D["races"]: print("  race not on page, skipped:", k); continue
        prior_rows = (D["races"][fp].get("xt") or {}).get("rows") or []
        race = rebuild(k, D["races"][fp])
        if race.get("xt"):
            rows, err, swm, gamma = xt.run_race(race, st)
            race["xt"] = dict(rows=merge_rows(prior_rows, rows))
            done.append((k, race["margin"], f"{err:.0e}"))
        else:
            done.append((k, race["margin"], "no xt"))
    open(path, "w").write(h[:m.start(2)] + json.dumps(D, separators=(",", ":"), ensure_ascii=False) + h[m.end(2):])
    print(f"{label}: updated {len(done)} races")
    for k, mg, e in done: print(f"   {k:5s} margin {mg:+7.2f}   crosstab max county error {e}")

# which races actually moved: compare the page's stored margin against the fresh run summary
def changed(path, gov):
    h = open(path).read()
    D = json.loads(re.search(r'<script type="application/json" id="data">(.*?)</script>', h, re.S).group(1))
    out = []
    for k, v in S.items():
        if k.endswith("G") != gov: continue
        st = k[:-1] if k.endswith("G") else k
        fp = FIPS.get(st)
        if fp is None or fp not in D["races"]: continue
        page = D["races"][fp].get("margin")
        want = v.get("rcv_final_margin", v["margin"]) if v.get("rcv_final_margin") is not None else v["margin"]
        if page is None or abs(page - want) > 0.005: out.append(k)
    return out
CH_SEN = changed('/tmp/artifacts4/onpoint-senate-forecast.html', False)
CH_GOV = changed('/tmp/artifacts4/onpoint-governor-forecast.html', True)
print("races to refresh:", len(CH_SEN), "Senate,", len(CH_GOV), "Governor")
go('/tmp/artifacts4/onpoint-senate-forecast.html', CH_SEN, "Senate")
go('/tmp/artifacts4/onpoint-governor-forecast.html', CH_GOV, "Governor")
