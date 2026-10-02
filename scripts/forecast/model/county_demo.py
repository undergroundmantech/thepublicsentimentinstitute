"""County demographic regressors for the midterm calibration, Oct 2 2026: Hispanic share by region group, Black share
in and outside the South, Asian and other share, white college share, all college share and log citizen adults."""
import glob, numpy as np, pandas as pd
import os
RR = os.path.dirname(os.path.abspath(__file__))
_D = {}
def table():
    if "t" in _D: return _D["t"]
    acs = pd.read_csv(glob.glob(f"{RR}/fc2609fd*/JULIUISMICHIGAN/ACSST5Y2024.S1501*/*Data.csv")[0], skiprows=[1], low_memory=False)
    acs["f"] = acs.GEO_ID.str[-5:]; acs = acs.set_index("f")
    g = lambda k: pd.to_numeric(acs[f"S1501_C01_{k:03d}E"], errors="coerce")
    p25 = g(6).clip(lower=1)
    cv = pd.read_csv(f"{RR}/census/cvap_county_2020_2024.csv", dtype={"fips": str}).set_index("fips")
    t = pd.DataFrame(index=cv.index)
    tot = cv.cvap_tot.clip(lower=1)
    t["his"] = cv.cvap_his / tot; t["blk"] = cv.cvap_bnh / tot; t["oth"] = cv.cvap_oth / tot
    t["wcol"] = (g(33) / p25).reindex(t.index); t["col"] = (g(15) / p25).reindex(t.index)
    t["lsize"] = np.log(tot)
    t = t.fillna(t.median(numeric_only=True))
    _D["t"] = t
    return t
# Hispanic groups whose politics differ: South Florida, Texas, the rest of the Southwest and West, everywhere else
HGROUP = {"12": "FL", "48": "TX", "04": "SW", "06": "SW", "08": "SW", "32": "SW", "35": "SW"}
def X(fips, center_w=None):
    """Design matrix of within state demographic contrasts. Columns are centered on the state, weighted by votes."""
    t = table().reindex(fips)
    t = t.fillna(table().median())          # a county the census tables do not carry gets the national median
    st = pd.Index(fips).str[:2]
    hg = np.array([HGROUP.get(s, "OT") for s in st])
    cols = {}
    for k in ("FL", "TX", "SW", "OT"):
        cols[f"his_{k}"] = np.where(hg == k, t.his.values, 0.0)
    south = np.isin(st, ["01", "05", "12", "13", "21", "22", "28", "37", "45", "47", "48", "51", "54"])
    cols["blk_S"] = np.where(south, t.blk.values, 0.0); cols["blk_N"] = np.where(~south, t.blk.values, 0.0)
    cols["oth"] = t.oth.values; cols["wcol"] = t.wcol.values; cols["col"] = t.col.values; cols["lsize"] = t.lsize.values / 10
    M = pd.DataFrame(cols, index=fips)
    if center_w is not None:
        w = np.asarray(center_w, float)
        for s in np.unique(st):
            m = (st == s)
            M.loc[m] = M.loc[m] - (M.loc[m].values * w[m, None]).sum(0) / w[m].sum()
    return M
