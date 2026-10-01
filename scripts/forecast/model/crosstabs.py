"""TPSI estimated exit poll crosstabs for every published Senate and governor race.

Method, per state:
1. Electorate composition. Each county's projected voters are split into the 32 age x race x education cells used by the
   census model: ACS 2024 adults in each cell times the TPSI turnout propensity for that cell, scaled to the county's
   projected vote total.
2. Donor voters. Every cell is filled with the TPSI respondents in that cell, weighted by turnout propensity, with
   respondents from the state's region counted double. The respondents carry the attributes the census does not have:
   gender, income, party ID, ideology, 2024 vote and Trump approval.
3. Individual vote model. A ridge logistic model of the two way generic ballot on age, race, education, gender, region,
   income, party ID, ideology, 2024 vote and Trump approval gives every respondent a Democratic probability.
4. County calibration, two steps. First, donors are reweighted inside each cell so the county electorate's Harris share of
   Harris plus Trump voters equals the county's certified 2024 presidential result; the census composition never changes.
   Second, one logit shift per county makes those voters reproduce the county forecast exactly, so a candidate who runs
   ahead of his party wins crossover voters rather than an electorate reshaped toward his party. Minor candidates' county share is given to voters in proportion to a
   propensity: Independents 2.5 times partisans for independent and minor party candidates, and partisans of the matching
   party for minor Democrats or Republicans.
5. Statewide crosstabs are the county results summed over voters in each group.
"""
import json, re, os, sys, importlib.util
import numpy as np, pandas as pd

BASE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("sm", f"{BASE}/senate_mode.py"); sm = importlib.util.module_from_spec(spec); spec.loader.exec_module(sm)
logit, inv = sm.logit, sm.inv
AGE, RACE, COL = sm.AGE, sm.RACE, sm.COL
REGION_DOUBLE = 2.0
IND_FACTOR = 2.5

# ── respondents ───────────────────────────────────────────────────────────────
R = sm.RESP.dropna(subset=["age_band", "race4", "college", "region8"]).copy().reset_index(drop=True)
R["cell"] = [AGE.index(a) * 8 + RACE.index(r) * 2 + COL.index(c) for a, r, c in zip(R.age_band, R.race4, R.college)]
inc = R.income_band.fillna("$50k-$79k")
R["inc3"] = np.where(inc.isin(["Under $25k", "$25k-$49k"]), "Under $50K", np.where(inc.isin(["$50k-$79k", "$80k-$124k"]), "$50K to $124K", "$125K and up"))
# the September export drops the _est imputation variants and keeps the resolved column,
# so take whichever of the pair this build of the database actually carries
_col = lambda n: R[n + "_est"] if (n + "_est") in R.columns else R[n]
ide = _col("ideology5")
R["ide3"] = np.where(ide.str.contains("liberal", case=False), "Liberal", np.where(ide.str.contains("conservative", case=False), "Conservative", "Moderate"))
R["pid"] = _col("party_id")
R["v24"] = np.where(_col("recall_2024") == "Harris", "Harris", np.where(_col("recall_2024") == "Trump", "Trump", "Other or did not vote"))
ap = _col("trump_approve")
R["appr"] = np.where(ap.str.contains("approve") & ~ap.str.contains("disapprove"), "Approve", np.where(ap.str.contains("disapprove"), "Disapprove", "Neutral"))
R["sex"] = np.where(R.gender == "Female", "Women", "Men")
LV = R.turnout_propensity.values

FEATS = [("age_band", AGE), ("race4", RACE), ("college", COL), ("sex", ["Men", "Women"]), ("region8", sorted(R.region8.unique())),
         ("inc3", ["Under $50K", "$50K to $124K", "$125K and up"]), ("pid", ["Independent", "Democrat", "Republican"]),
         ("ide3", ["Moderate", "Liberal", "Conservative"]), ("v24", ["Other or did not vote", "Harris", "Trump"]),
         ("appr", ["Neutral", "Approve", "Disapprove"])]
def X_of(df):
    cols = [np.ones(len(df))]
    for f, lv in FEATS:
        for v in lv[1:]:
            cols.append((df[f].values == v).astype(float))
    return np.vstack(cols).T
X = X_of(R)
m = R.gb_2way.notna().values
b = sm.irls(X[m], (R.gb_2way[m] == "Democrat").values.astype(float), LV[m], ridge=2.0)
P = np.clip(inv(X @ b), 0.01, 0.99)
LP = logit(P)
NCELL = 32
ONEHOT = np.zeros((len(R), NCELL)); ONEHOT[np.arange(len(R)), R.cell.values] = 1

MODEL = sm.fit_respondents()
# race coefficients (White baseline) from the census vote model, used to scale racial polarization per state
BETA_RACE = np.r_[0.0, MODEL["bvote"][1 + 3:1 + 3 + 3]]
RACE_IDX = np.array([RACE.index(x) for x in R.race4])
# A free county level fit of racial polarization never settles: the more polarized the model, the better it matches county
# spread, because race also stands in for urban and rural differences inside each state. So one national scale is used for every
# state, set so the pooled Black minus White Democratic gap across all modeled races matches the 2024 national exit poll gap of
# 44 points (Harris 86 percent of Black voters, 42 percent of White voters). fit_gamma is kept for reference.
RACE_GAMMA = float(os.environ.get("RACE_GAMMA", 2.8))

def fit_gamma(V, dw, d2, votes):
    """Ecological step: pick the racial polarization scale that best reproduces the spread of county results
    with a single statewide shift, weighting counties by projected votes."""
    best = None
    ls = logit(d2)
    for gmm in GAMMAS:
        lp = LP + (gmm - 1.0) * BETA_RACE[RACE_IDX]
        wm = dw[None, :]
        cellsum = (dw @ ONEHOT)[None, :]
        u = (V / np.maximum(cellsum, 1e-12))[:, R.cell.values] * wm
        lo, hi = -10.0, 10.0
        for _ in range(40):
            mid = (lo + hi) / 2
            pr = (u * inv(lp + mid)[None, :]).sum(axis=1) / u.sum(axis=1)
            tot = (pr * votes).sum() / votes.sum()
            if tot < (d2 * votes).sum() / votes.sum(): lo = mid
            else: hi = mid
        pr = (u * inv(lp + (lo + hi) / 2)[None, :]).sum(axis=1) / u.sum(axis=1)
        sse = float((votes * (logit(pr) - ls) ** 2).sum() / votes.sum())
        if best is None or sse < best[1]:
            best = (gmm, sse)
    return best

def group_defs(adults_by_county):
    size = np.where(adults_by_county >= 250_000, "Large, 250K+ adults", np.where(adults_by_county >= 50_000, "Midsize, 50K to 250K", "Small, under 50K"))
    race_sex = np.where(R.race4 == "White", "White " + R.sex.str.lower(), np.where(R.race4 == "Black", "Black " + R.sex.str.lower(), np.where(R.race4 == "Hispanic", "Latino " + R.sex.str.lower(), "All other races")))
    race_col = np.where(R.race4 == "White", np.where(R.college == "COLLEGE", "White college graduates", "White, no college degree"),
                        np.where(R.college == "COLLEGE", "Nonwhite college graduates", "Nonwhite, no college degree"))
    resp = [
        ("Gender", R.sex.values, ["Men", "Women"]),
        ("Age", np.array([a.replace("-", " to ") for a in R.age_band]), ["18 to 29", "30 to 44", "45 to 64", "65+"]),
        ("Race", np.where(R.race4 == "Hispanic", "Latino", np.where(R.race4 == "Asian/Other", "Asian and other", R.race4)), ["White", "Black", "Latino", "Asian and other"]),
        ("Race and gender", race_sex, ["White men", "White women", "Black men", "Black women", "Latino men", "Latino women", "All other races"]),
        ("Education", np.where(R.college == "COLLEGE", "College graduate", "No college degree"), ["College graduate", "No college degree"]),
        ("Race and education", race_col, ["White college graduates", "White, no college degree", "Nonwhite college graduates", "Nonwhite, no college degree"]),
        ("Income", R.inc3.values, ["Under $50K", "$50K to $124K", "$125K and up"]),
        ("Party ID", R.pid.values, ["Democrat", "Republican", "Independent"]),
        ("Ideology", R.ide3.values, ["Liberal", "Moderate", "Conservative"]),
        ("2024 presidential vote", R.v24.values, ["Harris", "Trump", "Other or did not vote"]),
        ("Trump job approval", R.appr.values, ["Approve", "Disapprove"]),
    ]
    return resp, size

def minor_factor(cands, shares):
    """per respondent propensity to vote for the minor candidates, mixing by each minor's statewide share"""
    tot = sum(shares[2:])
    if tot <= 0:
        return np.ones(len(R))
    f = np.zeros(len(R)); pid = R.pid.values
    for (nm, pty), s in zip(cands[2:], shares[2:]):
        if pty == "D":
            g = np.where(pid == "Democrat", 3.0, np.where(pid == "Independent", 1.0, 0.3))
        elif pty == "R":
            g = np.where(pid == "Republican", 3.0, np.where(pid == "Independent", 1.0, 0.3))
        else:
            g = np.where(pid == "Independent", IND_FACTOR, 1.0)
        f += s / tot * g
    return f

RACE_LIMIT_AUDIT = {}

def run_race(race, abbr):
    counties = race["counties"]; fl = [c["f"] for c in counties]
    reg = MODEL["state_region"][abbr]
    pops, eta, turn, adults, _ = sm.census_components(MODEL, fl, lambda f: reg)
    V = pops * turn; votes = np.array([c["w"] for c in counties], float)
    V = V / np.maximum(V.sum(axis=1, keepdims=True), 1e-9) * votes[:, None]            # C x 32 projected voters by cell
    dw = LV * np.where(R.region8.values == reg, REGION_DOUBLE, 1.0)                      # donor weights
    p = np.array([c["p"] for c in counties], float) / 100                                # first choice shares
    a, bb = p[:, 0], p[:, 1]; o = np.clip(1 - a - bb, 0, 1)
    d2 = a / np.maximum(a + bb, 1e-9)
    fmin = minor_factor(race["cands"], race["statewide"])
    C = len(counties)
    gamma = RACE_GAMMA
    LPg = LP + (gamma - 1.0) * BETA_RACE[RACE_IDX]; Pg = inv(LPg)

    # step 1: tilt donors within each cell so each county's electorate matches its certified 2024 presidential vote,
    # Harris share of Harris plus Trump voters; step 2: one logit shift per county reproduces the county forecast
    H = np.where(R.v24.values == "Harris", 1.0, np.where(R.v24.values == "Trump", -1.0, 0.0))
    p24 = (sm.pres_frames("AK")[2] if abbr == "AK" else sm.P24).reindex(fl)
    h24 = (p24.votes_dem / (p24.votes_dem + p24.votes_gop)).values
    def weights(tau):
        wm = dw[None, :] * np.exp(tau[:, None] * H[None, :])
        cellsum = wm @ ONEHOT
        return wm * (V / np.maximum(cellsum, 1e-12))[:, R.cell.values]
    have = np.isfinite(h24)
    lo, hi = np.full(C, -8.0), np.full(C, 8.0)
    for _ in range(40):
        mid = (lo + hi) / 2
        u = weights(mid)
        hs = (u * (H > 0)).sum(axis=1) / np.maximum((u * (H != 0)).sum(axis=1), 1e-12)
        up = hs < np.where(have, h24, hs)
        lo = np.where(up, mid, lo); hi = np.where(up, hi, mid)
    tau = np.where(have, (lo + hi) / 2, 0.0)
    u = weights(tau)
    tot = u.sum(axis=1)
    cmin = o * tot / np.maximum((u * fmin[None, :]).sum(axis=1), 1e-12)
    om = np.clip(cmin[:, None] * fmin[None, :], 0, 0.98)
    # Sept 30 2026 group top out (bounds.py): a county moves each respondent's preference only inside the band of
    # the respondent's race and party, widened only in a county the bands cannot otherwise fit
    import bounds as _bd
    if _bd.ON:
        _lo, _hi = _bd.group_bands(sm)
        _rc = np.array([sm.RACE.index(x) if x in sm.RACE else 3 for x in R.race4.values])
        _j = R.party_id.map({"Democrat": 0, "Republican": 1}).fillna(2).astype(int).values
        BLO = np.tile(_lo[_rc, _j], (C, 1)); BHI = np.tile(_hi[_rc, _j], (C, 1))
    LP0 = LPg.copy()
    def evaluate(t):
        tt = _bd.softclip(t[:, None], BLO, BHI) if _bd.ON else t[:, None]
        q = inv(LPg[None, :] + tt)
        two = (u * (1 - om)).sum(axis=1)
        return (u * (1 - om) * q).sum(axis=1) / np.maximum(two, 1e-12), q
    def fit():
        for _wid in range(6):
            lo, hi = np.full(C, -12.0), np.full(C, 12.0)
            for _ in range(45):
                mid = (lo + hi) / 2
                got, _ = evaluate(mid)
                up = got < d2
                lo = np.where(up, mid, lo); hi = np.where(up, hi, mid)
            got, q = evaluate((lo + hi) / 2)
            bad = np.abs(got - d2) > 5e-4
            if not _bd.ON or not bad.any(): break
            BLO[bad] *= 1.5; BHI[bad] *= 1.5
        return got, q
    got, q = fit()
    if _bd.ON:
        # statewide floors and ceilings for Black, Hispanic and Asian and other voters (bounds.race_limits)
        _bd.race_limits(sm)
        _race = np.array([x if x in sm.RACE else "Asian/Other" for x in R.race4.values])
        vw = u * (1 - om)
        def _shares(kap):
            nonlocal LPg, got, q
            LPg = LP0 + np.array([kap.get(x, 0.0) for x in _race])
            got, q = fit()
            return {x: float((vw[:, _race == x] * q[:, _race == x]).sum() / max(vw[:, _race == x].sum(), 1e-9)) for x in sm.RACE}
        _kap, RACE_LIMIT_AUDIT[abbr] = _bd.enforce_race(_race, _shares)
    h_err = np.nanmax(np.abs(np.where(have, (u * (H > 0)).sum(axis=1) / np.maximum((u * (H != 0)).sum(axis=1), 1e-12) - h24, 0)))
    err = np.abs(got - d2).max()
    pD = (1 - om) * q; pR = (1 - om) * (1 - q)
    resp_groups, size = group_defs(adults)
    total = u.sum()
    rows = []
    def add(cat, label, mask_voters):
        w = mask_voters.sum()
        if w / total < 0.01:
            return
        rows.append([cat, label, round(100 * w / total, 1), round(100 * (mask_voters * pD).sum() / w, 1),
                     round(100 * (mask_voters * pR).sum() / w, 1), round(100 * (mask_voters * om).sum() / w, 1)])
    add("All voters", "Total", u)
    for cat, vals, order in resp_groups:
        for lab in order:
            add(cat, lab, u * (vals == lab)[None, :])
    for lab in ["Large, 250K+ adults", "Midsize, 50K to 250K", "Small, under 50K"]:
        add("County size", lab, u * (size == lab)[:, None])
    sw = [round(100 * pD.__mul__(u).sum() / total, 2), round(100 * (pR * u).sum() / total, 2)]
    return rows, max(err, h_err), sw, gamma

def pages():
    return {"senate": f"{BASE}/../onpoint-senate-forecast.html", "governor": f"{BASE}/../onpoint-governor-forecast.html"}

def main():
    f2a = {v: k[:2] for k, v in sm.FIPS.items()}
    global GAP; GAP = []
    report = {}
    for office, path in pages().items():
        h = open(path).read()
        mt = re.search(r'(<script[^>]*id="data"[^>]*>)(.*?)(</script>)', h, re.S)
        D = json.loads(mt.group(2))
        outdir = f"{BASE}/{'output' if office == 'senate' else 'output_gov'}/exit_polls"; os.makedirs(outdir, exist_ok=True)
        for fips, race in D["races"].items():
            abbr = f2a[fips]
            rows, err, sw, gamma = run_race(race, abbr)
            race["xt"] = dict(rows=[r[:3] + r[3:] for r in rows])
            slug = race["state"].lower().replace(" ", "_")
            cn = [c[0] for c in race["cands"][:2]]
            pd.DataFrame(rows, columns=["category", "group", "share_of_voters", cn[0], cn[1], "other"]).to_csv(f"{outdir}/{slug}_2026_{office}_exit_poll_estimates.csv", index=False)
            report[f"{office}:{race['state']}"] = dict(max_county_err=float(err), statewide_model=sw, statewide_page=race["statewide"][:2], race_polarization_scale=float(gamma))
            wb = {r[1]: r[3] for r in rows if r[0] == "Race"}; ws = {r[1]: r[2] for r in rows if r[0] == "Race"}
            GAP.append((wb.get("Black"), wb.get("White"), ws.get("Black", 0) * sum(c["w"] for c in race["counties"]) / 100))
            print(office, race["state"], "err", f"{err:.1e}", "sum", sw, "page", race["statewide"][:2], "gamma", gamma, "W/B/L", wb.get("White"), wb.get("Black"), wb.get("Latino"))
        new = mt.group(1) + json.dumps(D, separators=(",", ":"), ensure_ascii=False) + mt.group(3)
        h = h[:mt.start()] + new + h[mt.end():]
        open(path, "w").write(h)
    g = [(b - w, n) for b, w, n in GAP if b is not None]
    pooled = sum(x * n for x, n in g) / sum(n for _, n in g)
    print("pooled Black minus White gap, weighted by Black voters", round(pooled, 1), "gamma", RACE_GAMMA)
    report["_pooled_black_white_gap"] = pooled; report["_race_gamma"] = RACE_GAMMA
    json.dump(report, open(f"{BASE}/output_gov/exit_poll_check.json", "w"), indent=1)

if __name__ == "__main__":
    main()
