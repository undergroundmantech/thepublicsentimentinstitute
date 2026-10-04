"""Midterm statewide backtest dataset, 2018 and 2022 Senate and governor.

Builds one row per race and forecast date: the polling average the live model would have computed (the poll_daily port,
with the LOWESS Election Day level at 8 or more polls), the nonpartisan house count, a presidential lean fundamentals
proxy and the certified result. Nothing from the results enters any input.
"""
import glob, math, os, sys
import numpy as np, pandas as pd

RR = "/tmp/claude-0/-home-claude/2fe66b6b-24b4-5fab-b0f7-c44b6f59cc0e/scratchpad/rerun"
GEO = os.path.join(RR, "..", "geo")
sys.path.insert(0, RR)
import poll_daily as pdly
import lowess_trend as lt

logit = lambda p: np.log(p / (1 - p))
EDAY = {2018: pd.Timestamp("2018-11-06"), 2022: pd.Timestamp("2022-11-08")}
# final public generic ballot averages, RealClearPolitics: D+7.3 in 2018 and R+2.5 in 2022, as decided two party shares
GB = {2018: 0.5 + 7.3 / 200, 2022: 0.5 - 2.5 / 200}
# races left out: split Democratic jungle field where the listed Democrat was not the main anti Republican vote
DROP = {(2022, "LAS")}

def _state_d2():
    p16 = pd.read_csv(f"{GEO}/pres16.csv"); g16 = p16.groupby("state_abbr")[["votes_dem", "votes_gop"]].sum()
    p20 = pd.read_csv(f"{GEO}/pres20.csv", dtype={"county_fips": str})
    p20["fips2"] = p20.county_fips.str.zfill(5).str[:2]
    f2a = p16.assign(f2=p16.combined_fips.astype(int).astype(str).str.zfill(5).str[:2]).groupby("f2").state_abbr.first()
    p20["st"] = p20.fips2.map(f2a)
    g20 = p20.groupby("st")[["votes_dem", "votes_gop"]].sum()
    d16 = g16.votes_dem / (g16.votes_dem + g16.votes_gop); d20 = g20.votes_dem / (g20.votes_dem + g20.votes_gop)
    n16 = g16.votes_dem.sum() / (g16.votes_dem.sum() + g16.votes_gop.sum())
    n20 = g20.votes_dem.sum() / (g20.votes_dem.sum() + g20.votes_gop.sum())
    return {2018: (d16, n16), 2022: (d20, n20)}

def load():
    P = pd.concat([pd.read_csv(f) for f in sorted(glob.glob("/tmp/mt/polls_*.csv"))], ignore_index=True)
    R = pd.concat([pd.read_csv(f) for f in sorted(glob.glob("/tmp/mt/results_*.csv"))], ignore_index=True)
    P = P[P.dem.notna() & P.rep.notna()].copy()
    P["pop"] = P["pop"].fillna("").astype(str).str.upper().str.strip()
    P["pop_imputed"] = P["pop"] == ""
    P.loc[P["pop"] == "", "pop"] = "LV"          # Wikipedia leaves the label off most final likely voter polls
    P.loc[P["pop"] == "V", "pop"] = "RV"
    P["partisan"] = P.partisan.fillna("").astype(str).str.upper().str.strip()
    P["n"] = pd.to_numeric(P.n, errors="coerce")
    P["end"] = pd.to_datetime(P.end); P["start"] = pd.to_datetime(P.start, errors="coerce")
    P = P[[(c, r) not in DROP for c, r in zip(P.cycle, P.race)]]
    R = R[[(c, r) not in DROP for c, r in zip(R.cycle, R.race)]]
    # one row per poll: LV kept over an RV version of the same poll
    P["key"] = P.pollster.str.lower().str.replace(r"[^a-z0-9]", "", regex=True) + "|" + P.end.astype(str) + "|" + P.race + "|" + P.cycle.astype(str)
    lvkeys = set(P.key[P["pop"] == "LV"])
    P = P[~((P["pop"] == "RV") & P.key.isin(lvkeys))]
    P = P.drop_duplicates(["key", "pop", "dem", "rep"])
    return P, R

def poll_level(p, as_of):
    """The live model's statewide polling level on as_of."""
    p = p[p.end <= as_of]
    if len(p) == 0: return None
    polls = []
    for r in p.itertuples():
        res = {"D": float(r.dem), "R": float(r.rep)}
        if pd.notna(r.other): res["Other"] = float(r.other)
        if pd.notna(r.undecided): res["Undecided"] = float(r.undecided)
        src = r.pollster + (f" ({r.partisan})" if r.partisan in ("D", "R") and f"({r.partisan})" not in r.pollster else "")
        polls.append(dict(pollster=src, endDate=r.end.date().isoformat(), sampleSize=float(r.n) if pd.notna(r.n) else 600.0,
                          sampleType=r.pop if r.pop in ("LV", "RV") else "A", results=res))
    ser = pdly.daily_series(polls, ["D", "R"], min(q["endDate"] for q in polls), as_of.date().isoformat())
    last = ser[-1]; D, R = last["D"], last["R"]
    out = dict(psiD=D, psiR=R, D2=D / (D + R), level="psi", n_polls=len(p))
    fr = pd.DataFrame(dict(source=[q["pollster"] for q in polls], dates=[s.isoformat() if pd.notna(s) else "" for s in p.start],
                           end=p.end.values, D=p.dem.values, R=p.rep.values))
    proj = lt.projection(fr, as_of)
    if proj is not None:
        T = D + R; m = max(-0.98 * T, min(0.98 * T, proj["eday_margin"]))
        out.update(D2=(T + m) / 2 / T, level="lowess")
    days = (as_of - p.end).dt.days
    nonp = p.partisan == ""
    house = p.pollster.str.replace(r"\s+(for|with|/).*$", "", regex=True).str.replace(r"\(.*?\)", "", regex=True).str.strip().str.lower()
    n_fresh = house[nonp & (days <= 45)].nunique(); n_recent = house[nonp & (days <= 60)].nunique()
    out["houses"] = float(n_fresh) + 0.5 * float(max(n_recent - n_fresh, 0))
    out["undecided"] = float(np.nanmean(p.undecided)) if p.undecided.notna().any() else np.nan
    out["other"] = float(np.nanmean(p.other)) if p.other.notna().any() else 0.0
    return out

# lowess_trend reads field start from a dates string; here the start is already an ISO date
_orig_sfd = lt.start_from_dates
lt.start_from_dates = lambda d, e: (pd.Timestamp(d) if d and d[:2] in ("20",) else _orig_sfd(d, e))

def build(days_out_list=(31, 1)):
    P, R = load()
    SD = _state_d2()
    rows = []
    for r in R.itertuples():
        d16, n16 = SD[r.cycle]
        st = r.state
        lean = logit(d16[st]) - logit(n16) if st in d16 else np.nan
        inc = {"D": 1, "R": -1}.get(str(r.incumbent_party).strip(), 0) * (1 if str(r.incumbent_ran).strip().lower().startswith("y") else 0)
        open_party = {"D": 1, "R": -1}.get(str(r.incumbent_party).strip(), 0) * (0 if inc else 1)
        act = r.dem_pct / (r.dem_pct + r.rep_pct)
        for dout in days_out_list:
            as_of = EDAY[r.cycle] - pd.Timedelta(days=dout)
            p = P[(P.cycle == r.cycle) & (P.race == r.race)]
            pl = poll_level(p, as_of)
            rows.append(dict(cycle=r.cycle, race=r.race, office=r.office, state=st, days_out=dout,
                             dem=r.dem_candidate, rep=r.rep_candidate, actual_d2=act, actual_margin=r.dem_pct - r.rep_pct,
                             lean=lean, nat=logit(GB[r.cycle]), inc=inc, open_party=open_party,
                             inc_party=str(r.incumbent_party).strip(),
                             poll_d2=pl["D2"] if pl else np.nan, poll_level=pl["level"] if pl else "none",
                             n_polls=pl["n_polls"] if pl else 0, houses=pl["houses"] if pl else 0.0,
                             undecided=pl["undecided"] if pl else np.nan, other=pl["other"] if pl else np.nan,
                             psi_d2=pl["psiD"] / (pl["psiD"] + pl["psiR"]) if pl else np.nan))
    return pd.DataFrame(rows), P, R

if __name__ == "__main__":
    df, P, R = build()
    out = os.path.join(os.path.dirname(__file__), "mt_races.csv")
    df.to_csv(out, index=False)
    print(df.groupby(["cycle", "days_out"]).agg(races=("race", "size"), polled=("n_polls", lambda x: (x > 0).sum())))
    print("pop imputed share", P.pop_imputed.mean().round(3), "polls", len(P))
