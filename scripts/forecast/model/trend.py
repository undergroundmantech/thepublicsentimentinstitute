"""County trend carry, Oct 1 2026.

Before this change the only county trend in the model was inside the office history leg: half of the difference
between the state's last two races for the office, times 0.55. The census leg starts from the 2024 presidential
result and carried no trend at all, so a county that had moved the same way in 2016, 2020 and 2024 was projected
as if it had stopped moving.

Now:
  * every county gets a presidential trend: its lean relative to its state, 2016 to 2020 and 2020 to 2024, weighted
    0.4 and 0.6, so the more recent cycle counts more;
  * the 2026 primary decides how much of that trend to trust. Where the county's 2026 primary electorate, relative to
    the state, has moved the same way as the trend against its 2024 general election lean, up to 1.5 times the trend
    is carried; where it moved the other way, as little as 0.5 times;
  * the census leg carries PRES_CARRY of one cycle's trend, a midterm being half a cycle on, the office history leg
    half that on top of its own office trend, whose carry rises from 0.55 to 0.65;
  * the term is centered on each state's turnout weighted mean, so it moves votes between counties and never moves
    the state, which the polls and the national anchor set.
TREND_V2=0 restores the old behavior.
"""
import os
import numpy as np, pandas as pd

ON = os.environ.get("TREND_V2", "1") != "0"
PRES_CARRY = float(os.environ.get("PRES_CARRY", "0.35"))
M3_PRES_SHARE = 0.5
OFFICE_CARRY = 0.65
W_RECENT, W_PRIOR = 0.6, 0.4
PRIM_RANGE = 0.5
CAP = 0.35            # largest county trend term, log odds

lg = lambda p: np.log(np.clip(p, 1e-6, 1 - 1e-6) / (1 - np.clip(p, 1e-6, 1 - 1e-6)))


def rel(P, fl):
    D = P.votes_dem.reindex(fl).astype(float); R = P.votes_gop.reindex(fl).astype(float)
    ok = (D + R) > 0
    stt = D[ok].sum() / (D[ok] + R[ok]).sum()
    return (lg(D / (D + R)) - lg(stt)).where(ok)


def county_trend(st, fl, P16, P20, P24, prim, turnout):
    """Series of per county trend in log odds, one presidential cycle, centered on the state."""
    if not ON: return pd.Series(0.0, index=fl), None
    try:
        r16, r20, r24 = rel(P16, fl), rel(P20, fl), rel(P24, fl)
    except Exception as e:
        return pd.Series(0.0, index=fl), dict(error=str(e))
    s = (W_RECENT * (r24 - r20) + W_PRIOR * (r20 - r16)).fillna((r24 - r20)).fillna(0.0)
    # the 2026 primary: the county's primary electorate relative to the state's, against its 2024 general lean
    agree = pd.Series(1.0, index=fl); used = False
    try:
        ps = prim.pD / (prim.pD + prim.pR)
        pst = prim.pD.sum() / (prim.pD.sum() + prim.pR.sum())
        pdev = (lg(ps) - lg(pst)).reindex(fl) - r24
        pdev = pdev - np.nanmean(pdev)
        sd = np.nanstd(pdev)
        if np.isfinite(sd) and sd > 0 and pdev.notna().sum() >= max(3, 0.5 * len(fl)):
            z = (np.sign(s) * pdev / sd).clip(-1, 1).fillna(0.0)
            agree = 1.0 + PRIM_RANGE * z
            used = True
    except Exception:
        pass
    t = (s * agree).clip(-CAP / PRES_CARRY, CAP / PRES_CARRY)
    w = pd.Series(np.asarray(turnout, float), index=fl)
    t = t - float((t * w).sum() / w.sum())
    aud = dict(primary_used=used, trend_sd_logit=round(float(t.std()), 4),
               primary_agreement_mean=round(float(agree.mean()), 3), carry_census=PRES_CARRY, carry_history=PRES_CARRY * M3_PRES_SHARE,
               office_trend_carry=OFFICE_CARRY,
               largest_county_terms={str(k): round(float(v) * PRES_CARRY, 3) for k, v in t.abs().sort_values(ascending=False).head(3).items()})
    return t, aud
