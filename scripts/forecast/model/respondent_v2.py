"""TPSI respondent component, version 2 (Sept 29 2026).

What changed from version 1, all behind RESP_V2 (default on, RESP_V2=0 restores version 1):

1. Source. The unified respondent dataset replaces the national database. It holds the same 4,238
   analysis ready respondents with identical survey answers, plus model imputed values for items a
   respondent skipped, each with a source flag and a confidence. Every consumer now drops the same
   rows: analysis_ready = 0 (already absent) and rqcm_flag = 1 (speeders, incoherent or incomplete).
   Imputed values are used only where their confidence is at least IMPUTE_MIN_CONF, and never for
   the two vote outcomes the preference model is fitted on.

2. Universe. County cells were adults 18+ times turnout. They are now adults 18+ times a citizenship
   rate by race group (CVAP), times turnout. Registration is estimated for the audit trail so each state
   reports VAP, CVAP, registered and likely voters.

3. State effects. The census leg used national cell coefficients plus a region effect, so two states
   in one region with the same demographics moved identically from 2024. A partially pooled state
   effect on the 2024 to 2026 swing is now estimated from TPSI respondents in that state, with a
   second nested level for state by race group. Each level is shrunk by an empirical Bayes
   (DerSimonian and Laird) estimate of its between state variance, so a state with 20 respondents
   moves little and a state with 400 moves in proportion to what its respondents show.

4. Audit. Every quantity above is written to the run summary under respondent_model.

The model uses the respondent file internally only. Nothing here copies or exports respondent rows.
"""
import os, hashlib
import numpy as np, pandas as pd

ON = os.environ.get("RESP_V2", "1") != "0"
IMPUTE_MIN_CONF = float(os.environ.get("RESP_IMPUTE_MIN_CONF", "0.7"))
UNIFIED = "TPSI_Unified_Respondent_Dataset.csv"
LEGACY = "TPSI_National_Respondent_Database.csv"
# Citizen share of adults 18+ by race group. National ACS 2023 ratios of CVAP to VAP, rounded. The
# package holds no state or county CVAP table, so one national rate per group is applied everywhere.
# This is an assumption, and the largest known gap is Hispanic adults, whose citizen share runs from
# about 0.6 in some California and Texas counties to above 0.9 in New Mexico.
CVAP_RATE = {"White": 0.985, "Black": 0.950, "Hispanic": 0.770, "Asian/Other": 0.800}
# outcome columns whose imputed values are never used
NO_IMPUTE = {"generic_ballot", "gb_2way", "recall_2024"}
IMPUTED_COLS = ["party_id", "political_type", "ideology5", "issue_top1", "trump_approve", "close_contacts",
                "ballot_method", "right_track", "econ_strain", "registered_to_vote"]

AUDIT = {}
STATE_FX = {}          # abbr -> dict(state=, race={group: fx}, sd=)


def _logit(p): return np.log(p / (1 - p))
def _inv(x): return 1 / (1 + np.exp(-x))


def load(base):
    """Respondent table used by every part of the model."""
    uni = f"{base}/tpsi_db/{UNIFIED}"
    path = uni if (ON and os.path.exists(uni)) else f"{base}/tpsi_db/{LEGACY}"
    r = pd.read_csv(path, low_memory=False)
    a = dict(source_file=os.path.basename(path), sha256_12=hashlib.sha256(open(path, "rb").read()).hexdigest()[:12],
             rows_in_file=int(len(r)))
    if not ON:
        AUDIT["load"] = a; return r
    keep = (r.get("analysis_ready", 1) == 1) & (r.get("rqcm_flag", 0).fillna(0) != 1)
    a["dropped_not_analysis_ready"] = int((r.get("analysis_ready", 1) != 1).sum())
    a["dropped_quality_flag"] = int(((r.get("analysis_ready", 1) == 1) & (r.get("rqcm_flag", 0).fillna(0) == 1)).sum())
    r = r[keep].copy()
    used = {}
    for c in IMPUTED_COLS:
        est, src, conf = f"{c}_est", f"{c}_src", f"{c}_conf"
        if est not in r or src not in r: continue
        ok = r[src].eq("modeled") & r[est].notna() & (r[conf].fillna(0) >= IMPUTE_MIN_CONF if conf in r else True)
        # the legacy database leaves a skipped item blank; the unified file already fills some of them. Put back the
        # blank where the imputation is weak, keep it where it is confident.
        weak = r[src].eq("modeled") & ~ok
        r.loc[weak, c] = np.nan
        r.loc[ok, c] = r.loc[ok, est]
        used[c] = int(ok.sum())
    for c in NO_IMPUTE:
        src = f"{c}_src" if f"{c}_src" in r else ("generic_ballot_src" if c == "gb_2way" else None)
        if src and src in r:
            r.loc[r[src].eq("modeled"), c] = np.nan
    if "registered_to_vote" in r:
        r["registered_to_vote"] = r.registered_to_vote.astype(str).str.strip(" ,").replace({"nan": np.nan})
    a.update(rows_used=int(len(r)), imputed_values_used=used, impute_min_confidence=IMPUTE_MIN_CONF,
             waves={str(k): int(v) for k, v in r.wave.value_counts().sort_index().items()} if "wave" in r else {})
    AUDIT["load"] = a
    return r


# ── state and state by race group effects on the 2024 to 2026 swing ──────────────────────────────
def _dl(est, var):
    """DerSimonian and Laird between unit variance, and the shrunk estimates."""
    est, var = np.asarray(est, float), np.asarray(var, float)
    if len(est) < 3: return 0.0, est * 0.0, np.sqrt(var)
    w = 1 / var; mu = (w * est).sum() / w.sum()
    Q = (w * (est - mu) ** 2).sum()
    c = w.sum() - (w ** 2).sum() / w.sum()
    tau2 = max(0.0, (Q - (len(est) - 1)) / c) if c > 0 else 0.0
    k = tau2 / (tau2 + var)
    return tau2, est * k, np.sqrt(tau2 * var / (tau2 + var)) if tau2 > 0 else np.sqrt(var) * 0.0


TAU_CAP = float(os.environ.get("RESP_TAU_CAP", "0.10"))
SPLITS = 40


def _state_table(d):
    rows = []
    for s, g in d.groupby("st"):
        W = g.w.sum(); n_eff = W ** 2 / (g.w ** 2).sum()
        m = (g.w * g.res).sum() / W; v = ((g.w * (g.res - m) ** 2).sum() / W) / max(n_eff, 1)
        s2 = max(v, 0.0625 / max(n_eff, 1))   # floor: a state with one or two identical answers is not certain
        pqm = (g.w * g.pq).sum() / W
        rows.append((s, len(g), n_eff, m / pqm, s2 / pqm ** 2))
    return pd.DataFrame(rows, columns=["st", "n", "n_eff", "raw", "var"])


def _split_tau2(d, reps=SPLITS, min_half=10, seed=20260929):
    rng = np.random.default_rng(seed); covs = []
    for _ in range(reps):
        h = rng.random(len(d)) < 0.5
        a, b = _state_table(d[h]).set_index("st"), _state_table(d[~h]).set_index("st")
        j = [x for x in a.index.intersection(b.index) if a.n[x] >= min_half and b.n[x] >= min_half]
        if len(j) < 8: continue
        w = np.minimum(a.n[j].values, b.n[j].values).astype(float)
        ca = a.raw[j].values - np.average(a.raw[j].values, weights=w); cb = b.raw[j].values - np.average(b.raw[j].values, weights=w)
        covs.append(float(np.average(ca * cb, weights=w)))
    return float(np.mean(covs)) if covs else float("nan")


def fit_state_effects(sm, r, X, model):
    """r: the respondent frame the census leg was fitted on (rows of X). Swing residual per respondent, 2026 generic
    ballot residual minus 2024 recalled vote residual, both against the national cell model."""
    STATE_FX.clear()
    if not ON: return
    both = r.gb_2way.isin(["Democrat", "Republican"]).values & r.recall_2024.isin(["Harris", "Trump"]).values
    p26 = _inv(X @ model["bvote"]); p24 = _inv(X @ model["b24"])
    y26 = (r.gb_2way == "Democrat").values.astype(float); y24 = (r.recall_2024 == "Harris").values.astype(float)
    res = (y26 - p26) - (y24 - p24)
    pq = 0.5 * (p26 * (1 - p26) + p24 * (1 - p24))
    w = r.turnout_propensity.fillna(r.turnout_propensity.median()).values
    d = pd.DataFrame(dict(st=r.state.values, race=r.race4.values, res=res, pq=pq, w=w))[both]
    d = d[d.st.notna()]
    S = _state_table(d)
    # Between state variance. The DerSimonian and Laird estimate relies on each state's sampling variance, which the
    # turnout weights inflate, and it returns zero on this sample (Q = 42 on 50 degrees of freedom). The split half
    # moment estimate does not: two random halves of a state's respondents share its true effect and nothing else, so
    # the covariance of the two half estimates across states estimates the true variance directly. 40 fixed seed
    # splits, states with 10 or more respondents in each half, weighted by the smaller half. Capped at TAU_CAP, the
    # upper end of the spread of state swings around their region in recent cycles.
    tau2_dl, _, _ = _dl(S.raw, S["var"])
    tau2 = _split_tau2(d)
    how = "split half moment"
    if not np.isfinite(tau2) or tau2 <= 0:
        tau2, how = tau2_dl, "DerSimonian and Laird"
    tau2 = min(tau2, TAU_CAP ** 2)
    k = tau2 / (tau2 + S["var"])
    S["fx"], S["sd"] = S.raw * k, np.sqrt(tau2 * S["var"] / (tau2 + S["var"]))
    # nested level: state by race group, on what is left after the state effect
    d = d.merge(S[["st", "raw"]], on="st")
    rows2 = []
    for (s, rc), g in d.groupby(["st", "race"]):
        if len(g) < 5: continue
        W = g.w.sum(); n_eff = W ** 2 / (g.w ** 2).sum(); pqm = (g.w * g.pq).sum() / W
        m = (g.w * g.res).sum() / W; v = ((g.w * (g.res - m) ** 2).sum() / W) / max(n_eff, 1)
        v = max(v, 0.0625 / max(n_eff, 1))
        rows2.append((s, rc, len(g), m / pqm - g.raw.iloc[0], v / pqm ** 2))
    R2 = pd.DataFrame(rows2, columns=["st", "race", "n", "raw", "var"])
    tau2_r, shr_r, sd_r = _dl(R2.raw, R2["var"]) if len(R2) else (0.0, [], [])
    if len(R2): R2["fx"], R2["sd"] = shr_r, sd_r
    # center on the respondent weighted national mean so the effects redistribute and do not move the nation;
    # national_shift recalibrates the level in any case
    nw = S.n_eff / S.n_eff.sum(); S["fx"] = S.fx - (nw * S.fx).sum()
    for _, x in S.iterrows():
        race = {}
        if len(R2):
            for _, y in R2[R2.st == x.st].iterrows(): race[y.race] = float(y.fx)
        STATE_FX[x.st] = dict(state=float(x.fx), sd=float(x.sd), n=int(x.n), n_eff=float(x.n_eff), raw=float(x.raw),
                              raw_se=float(np.sqrt(x["var"])), race=race)
    AUDIT["state_effects"] = dict(respondents_with_both_votes=int(both.sum()), states=int(len(S)),
                                  tau_state_logit=float(np.sqrt(tau2)), tau_state_estimator=how,
                                  tau_state_dl_logit=float(np.sqrt(tau2_dl)), tau_state_race_logit=float(np.sqrt(tau2_r)),
                                  state_by_race_cells=int(len(R2)),
                                  shrinkage_median=float(np.median(S.fx.abs() / np.maximum(S.raw.abs(), 1e-9))) if len(S) else None)


def cell_offsets(abbr, race_labels):
    """2026 vote logit offset per cell for one state."""
    fx = STATE_FX.get(abbr)
    if not fx: return np.zeros(len(race_labels))
    return np.array([fx["state"] + fx["race"].get(rc, 0.0) for rc in race_labels])


def cvap(race_labels):
    return np.array([CVAP_RATE.get(rc, 0.9) if ON else 1.0 for rc in race_labels])


# ── registration, for the universe audit ────────────────────────────────────────────────────────
def fit_registration(irls, r, X):
    if not ON or "registered_to_vote" not in r: return None
    y = r.registered_to_vote.map({"Yes": 1.0, "No": 0.0})
    if "registered_to_vote_p_Yes" in r:
        y = y.fillna(r["registered_to_vote_p_Yes"])
    m = y.notna().values
    return irls(X[m], y[m].values.astype(float), np.ones(m.sum()))


def universe(sm, model, fl, abbr, region_of):
    """VAP, CVAP, registered and likely voters for one state's counties, from the county cells."""
    ageS, raceS, colR, adults = sm.county_cells(fl)
    tot = dict(vap=0.0, cvap=0.0, registered=0.0, likely_voters=0.0)
    by_race = {rc: dict(vap=0.0, cvap=0.0, lv=0.0) for rc in sm.RACE}
    breg = model.get("breg")
    cache = {}
    for i, f in enumerate(fl):
        reg = region_of(f)
        for ai, a in enumerate(sm.AGE):
            for ri, rc in enumerate(sm.RACE):
                for ci, c in enumerate(sm.COL):
                    pc = colR[i, ri] if c == "COLLEGE" else 1 - colR[i, ri]
                    v = adults[i] * ageS[i, ai] * raceS[i, ri] * pc
                    key = (a, rc, c, reg)
                    if key not in cache:
                        x = sm.design(a, rc, c, reg, model["regions"])
                        cache[key] = (_inv(x @ model["bturn"]), _inv(x @ breg) if breg is not None else np.nan)
                    t, g = cache[key]
                    cv = v * float(cvap_county([f], [rc])[0, 0])
                    tot["vap"] += v; tot["cvap"] += cv; tot["registered"] += cv * g if np.isfinite(g) else 0.0
                    tot["likely_voters"] += cv * t
                    by_race[rc]["vap"] += v; by_race[rc]["cvap"] += cv; by_race[rc]["lv"] += cv * t
    out = {k: round(v) for k, v in tot.items()}
    V, C, L = tot["vap"] or 1, tot["cvap"] or 1, tot["likely_voters"] or 1
    out["share_by_race"] = {rc: dict(vap=round(100 * b["vap"] / V, 1), cvap=round(100 * b["cvap"] / C, 1),
                                     likely_voters=round(100 * b["lv"] / L, 1)) for rc, b in by_race.items()}
    return out


def race_audit(abbr):
    fx = STATE_FX.get(abbr)
    base = dict(version=2 if ON else 1, source=AUDIT.get("load"), cvap_rates=(dict(AUDIT.get("cvap") or {}, state_rates={rc: round(float(_CV["state"][rc].get(abbr_fips(abbr), np.nan)), 3) for rc in _GRP}) if CVAP_COUNTY and _cvap_table() is not None else CVAP_RATE) if ON else None)
    if fx:
        base["state_effect"] = dict(respondents=fx["n"], effective_n=round(fx["n_eff"], 1), raw_logit=round(fx["raw"], 4),
                                    raw_se=round(fx["raw_se"], 4), pooled_logit=round(fx["state"], 4), pooled_sd=round(fx["sd"], 4),
                                    race_group_logit={k: round(v, 4) for k, v in fx["race"].items()})
    else:
        base["state_effect"] = None
    base["pooling"] = AUDIT.get("state_effects")
    return base


# ── county citizen rates, Sept 30 2026 ────────────────────────────────────────────────────────────
# Census CVAP special tabulation, 2020 to 2024 ACS five year, released Jan 30 2026, county level. Each county gets
# its own citizen share of adults for each race group, shrunk toward its state's rate with CVAP_PSEUDO adults so a
# county of a few hundred Hispanic adults does not swing on sampling noise. White is White alone not Hispanic, Black
# is Black alone not Hispanic, Hispanic is Hispanic of any race, and Asian and other is the remainder. CVAP_COUNTY=0
# restores the national rates.
CVAP_COUNTY = ON and os.environ.get("CVAP_COUNTY", "1") != "0"
CVAP_PSEUDO = 300.0
_CV = {}
_GRP = {"White": "wnh", "Black": "bnh", "Hispanic": "his", "Asian/Other": "oth"}


def _cvap_table():
    if "t" in _CV: return _CV["t"]
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "census", "cvap_county_2020_2024.csv")
    if not os.path.exists(p):
        _CV["t"] = None; return None
    t = pd.read_csv(p, dtype={"fips": str}).set_index("fips")
    st = t.groupby(t.index.str[:2]).sum()
    rates = {}
    for rc, g in _GRP.items():
        s_rate = (st[f"cvap_{g}"] / st[f"adu_{g}"].clip(lower=1)).clip(0.2, 1.0)
        a, c = t[f"adu_{g}"].astype(float), t[f"cvap_{g}"].astype(float)
        prior = s_rate.reindex(t.index.str[:2]).values
        rates[rc] = ((c + CVAP_PSEUDO * prior) / (a + CVAP_PSEUDO)).clip(0.2, 1.0)
    _CV["t"] = pd.DataFrame(rates, index=t.index)
    _CV["state"] = {rc: (st[f"cvap_{g}"] / st[f"adu_{g}"].clip(lower=1)).to_dict() for rc, g in _GRP.items()}
    _CV["cvap_total"] = t.cvap_tot.astype(float).to_dict()
    AUDIT["cvap"] = dict(source="Census CVAP special tabulation 2020 to 2024 ACS, county", counties=int(len(t)), pseudo_adults=CVAP_PSEUDO)
    return _CV["t"]


def cvap_county(fips_list, race_labels):
    """[n, len(race_labels)] citizen share of adults by county and race group."""
    base = cvap(race_labels)
    t = _cvap_table() if CVAP_COUNTY else None
    if t is None: return np.tile(base, (len(fips_list), 1))
    out = np.empty((len(fips_list), len(race_labels)))
    for i, f in enumerate(fips_list):
        if f in t.index:
            out[i] = [t.at[f, rc] for rc in race_labels]
        else:
            s = str(f)[:2]
            out[i] = [_CV["state"][rc].get(s, CVAP_RATE[rc]) for rc in race_labels]
    return out


def cvap_total(f):
    _cvap_table()
    return _CV.get("cvap_total", {}).get(f)


_AB2F = {'AL':'01','AK':'02','AZ':'04','AR':'05','CA':'06','CO':'08','CT':'09','DE':'10','DC':'11','FL':'12','GA':'13','HI':'15','ID':'16','IL':'17','IN':'18','IA':'19','KS':'20','KY':'21','LA':'22','ME':'23','MD':'24','MA':'25','MI':'26','MN':'27','MS':'28','MO':'29','MT':'30','NE':'31','NV':'32','NH':'33','NJ':'34','NM':'35','NY':'36','NC':'37','ND':'38','OH':'39','OK':'40','OR':'41','PA':'42','RI':'44','SC':'45','SD':'46','TN':'47','TX':'48','UT':'49','VT':'50','VA':'51','WA':'53','WV':'54','WI':'55','WY':'56'}
def abbr_fips(a): return _AB2F.get(a, "00")
