"""Pollster house effects, Oct 3 2026.

A house effect is how far a pollster's two party margin runs from the other polls of the same races, measured across
every Senate and governor race it has polled this cycle. Each race gets its own level, so a house is compared only with
the polls of the races it actually polled. The effects are shrunk toward zero, a house with one or two polls barely
moves, and they are centered so the polls' own weighted average house effect is exactly zero: the adjustment moves
pollsters relative to each other and never moves the polling average as a whole. No aggregate bias is assumed.

Polls sponsored by a campaign or party committee get a separate sponsor term, D sponsored and R sponsored, measured the
same way, so a firm's partisan releases do not set its effect on its public polls.

estimate(frame) returns {house: effect}; the effect is in log odds of the Democratic two party share, positive meaning
the house runs Democratic. apply(p) subtracts each poll's effect from its D and R, holding D + R fixed.
HOUSE_EFFECTS=0 turns the adjustment off.
"""
import json, os, re
import numpy as np, pandas as pd

BASE = os.path.dirname(os.path.abspath(__file__))
ON = os.environ.get("HOUSE_EFFECTS", "1") != "0"
TAU = float(os.environ.get("HOUSE_TAU", "0.06"))        # prior sd of a house effect, log odds; best leave one race out fit on 2018 and 2022, mtbt/mt_house.py
HALF_LIFE = 90.0                                          # days, so a house's spring polls count less than its fall ones
FILE = os.path.join(BASE, "house_effects_2026.json")
_SPONSOR = re.compile(r"\((?:[^)]*\b)?(D|R)(?:\b[^)]*)?\)")

def _pd():
    import poll_daily
    return poll_daily

ALIASES = [(r"siena", "siena"), (r"beacon|shaw\s*&\s*co", "beacon/shaw"), (r"data for progress", "data for progress"),
           (r"emerson", "emerson"), (r"marist", "marist"), (r"yougov", "yougov"), (r"quinnipiac", "quinnipiac"),
           (r"\bssrs\b|\bcnn\b", "cnn/ssrs"), (r"new hampshire|\bunh\b", "u. new hampshire"), (r"trafalgar", "trafalgar"),
           (r"insider\s*advantage", "insideradvantage"), (r"atlas\s*intel", "atlasintel"), (r"quantus", "quantus"),
           (r"public policy polling|\bppp\b", "ppp"), (r"co/efficient", "co/efficient"), (r"cygnal", "cygnal"),
           (r"fabrizio,?\s*lee", "fabrizio lee"), (r"suffolk", "suffolk"), (r"mason.dixon", "mason-dixon"),
           (r"hendrix", "hendrix college")]   # Oct 8: Talk Business & Politics / Hendrix College and Hendrix College are one firm

def house_key(name):
    """One id per polling firm: an alias for firms that publish under several names, else the TPSI scorecard key
    where the name matches one, else the cleaned name."""
    s = str(name)
    low = s.lower()
    for pat, key in ALIASES:
        if re.search(pat, low): return key
    s0 = re.sub(r"\(.*?\)", "", s).strip()
    s0 = re.sub(r"\s+(for|with)\s+.*$", "", s0, flags=re.I).strip()
    g, w, k = _pd().pollster_entry(s0)
    if k: return k
    return re.sub(r"[^a-z0-9]+", " ", s0.lower()).strip()

def sponsor(name, flag=""):
    if flag in ("D", "R"): return flag
    m = _SPONSOR.search(str(name))
    return m.group(1) if m else ""

def estimate(F, tau=TAU, sig_eps=None, iters=60):
    """F: one row per poll with race, house, sponsor, y (logit D2), w (recency x sample weight)."""
    F = F.copy()
    F["w"] = F.w.clip(lower=1e-6)
    if sig_eps is None:
        # within race spread net of house effects is unknown before fitting; start from the raw within race spread
        r = F.y - F.groupby("race").y.transform("mean")
        sig_eps = float(np.sqrt(np.average(r ** 2, weights=F.w)))
    lam = (sig_eps / tau) ** 2
    h = pd.Series(0.0, index=sorted(F.house.unique()))
    sp = {"D": 0.0, "R": 0.0}
    mu = F.groupby("race").y.mean()
    for _ in range(iters):
        adj = F.house.map(h) + F.sponsor.map(lambda s: sp.get(s, 0.0))
        mu = (F.w * (F.y - adj)).groupby(F.race).sum() / F.w.groupby(F.race).sum()
        res = F.y - F.race.map(mu) - F.sponsor.map(lambda s: sp.get(s, 0.0))
        # effective poll count per house: weights normalized so a fresh full weight poll counts one
        wn = F.w / F.w.max()
        num = (wn * res).groupby(F.house).sum(); den = wn.groupby(F.house).sum()
        h = (num / (den + lam)).reindex(h.index).fillna(0.0)
        # center: the polls' weighted mean house effect is zero
        hb = float(np.average(F.house.map(h), weights=F.w)); h = h - hb
        res2 = F.y - F.race.map(mu) - F.house.map(h)
        for s in ("D", "R"):
            m = F.sponsor == s
            sp[s] = float((wn[m] * res2[m]).sum() / (wn[m].sum() + lam)) if m.any() else 0.0
        # sponsor terms are relative to unsponsored polls; re-center the whole adjustment on zero
        tot = F.house.map(h) + F.sponsor.map(lambda s: sp.get(s, 0.0))
        c = float(np.average(tot, weights=F.w)); h = h - c
    n = F.groupby("house").size()
    return dict(house={k: float(v) for k, v in h.items()}, sponsor=sp, n_polls={k: int(v) for k, v in n.items()},
                tau=tau, sigma_poll=sig_eps, lam=lam)

def poll_frame_2026(sm, as_of):
    # registered voter only polls are first moved by the measured likely voter gap (lv_gap.py), so a house that
    # polls registered voters is not charged with the likely voter screen as a house effect
    import lv_gap
    _g = lv_gap.load(); _gap = float(_g.get("gap") or 0.0) if (_g and lv_gap.ON) else 0.0
    rows = []
    for st in sm.STATES:
        try:
            p, _ = sm.parse_polls(st)
        except Exception:
            continue
        if p is None or len(p) == 0 or "D" not in p: continue
        p = p[(p.D > 0) & (p.R > 0)]
        for r in p.itertuples():
            days = max((as_of - pd.Timestamp(r.end)).days, 0)
            n = float(r.n) if pd.notna(r.n) and r.n > 0 else 600.0
            rows.append(dict(race=st, source=r.source, house=house_key(r.source), sponsor=sponsor(r.source),
                             pop=getattr(r, "pop", "LV"), end=pd.Timestamp(r.end), n=n,
                             y=float(np.log(r.D / r.R)) + (_gap if getattr(r, "pop", "LV") != "LV" else 0.0), w=0.5 ** (days / HALF_LIFE) * np.sqrt(min(n, 2000) / 600)))
    return pd.DataFrame(rows)

_FIT = None
def load():
    global _FIT
    if _FIT is None and os.path.exists(FILE):
        _FIT = json.load(open(FILE))
    return _FIT

def effect_for(source):
    fit = load()
    if not fit: return 0.0
    return fit["house"].get(house_key(source), 0.0) + fit["sponsor"].get(sponsor(source), 0.0)

def apply(p):
    """Subtract each poll's house effect from its D and R shares, D + R held fixed. Returns a copy."""
    if not ON or load() is None or len(p) == 0: return p
    p = p.copy()
    eff = p.source.map(effect_for).astype(float)
    T = p.D.astype(float) + p.R.astype(float)
    d2 = (p.D.astype(float) / T).clip(1e-4, 1 - 1e-4)
    d2n = 1 / (1 + np.exp(-(np.log(d2 / (1 - d2)) - eff)))
    p["house_effect"] = eff
    p["D"], p["R"] = T * d2n, T * (1 - d2n)
    return p

if __name__ == "__main__":
    import sys
    sys.path.insert(0, BASE)
    os.environ.setdefault("AS_OF", "2026-10-03")
    import senate_mode as sm
    F = poll_frame_2026(sm, pd.Timestamp(os.environ["AS_OF"]))
    fit = estimate(F)
    fit["as_of"] = os.environ["AS_OF"]; fit["n_polls_total"] = int(len(F)); fit["n_races"] = int(F.race.nunique())
    json.dump(fit, open(FILE, "w"), indent=1)
    h = pd.Series(fit["house"]); n = pd.Series(fit["n_polls"])
    tab = pd.DataFrame(dict(effect_pts=(h * 50).round(2), polls=n)).sort_values("effect_pts")
    print(tab[tab.polls >= 3].to_string())
    print("sponsor", {k: round(v * 50, 2) for k, v in fit["sponsor"].items()}, "polls", len(F), "races", F.race.nunique(),
          "lam", round(fit["lam"], 2), "sigma", round(fit["sigma_poll"], 4))
