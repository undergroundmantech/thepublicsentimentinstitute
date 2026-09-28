"""PSI LOWESS Election Day polling average, the forecast side of app/polling/lib/lowessTrend.ts.

Every poll counts once, at the midpoint of its field dates, with the margin D minus R. Published
polling averages are left out. Robust LOWESS, a line for line match of statsmodels' lowess(it=3),
at spans 0.30, 0.45 and 0.60. The Election Day polling average is 0.40 x the recent trend plus
0.60 x the long-term trend where the newest poll sits, carried flat: the blend that missed the later
polling least in a backtest of the site's own polls (scripts/polling/lowess in the site repo).
Races with fewer than 8 polls return None, and the forecast keeps the PSI weighted average there.
"""
import re
import numpy as np
import pandas as pd

SPANS = {"recent": 0.30, "balanced": 0.45, "long": 0.60}
EDAY_W = {"recent": 0.40, "balanced": 0.0, "long": 0.60}
MIN_POLLS = 8
HALF_FIELD = 1.5            # days before the end date, for a poll with no parsable start
PUBLISHED_AVERAGE = re.compile(r"\b(?:avg|average|aggregate|consensus)\b", re.I)
MONTHS = {m: i for i, m in enumerate(["january", "february", "march", "april", "may", "june", "july", "august",
                                      "september", "october", "november", "december"], 1)}
MON3 = {k[:3]: v for k, v in MONTHS.items()}
def _window(x, x0, k):
    n = len(x); left, right = 0, k
    while right < n and x0 > (x[left] + x[right]) / 2.0:
        left += 1; right += 1
    return left, right

def _fit_at(x0, x, y, w_rob, k, own=None):
    left, right = _window(x, x0, k)
    xs, ys = x[left:right], y[left:right]
    radius = max(x0 - xs[0], xs[-1] - x0)
    d = np.abs(xs - x0) / radius if radius > 0 else np.zeros_like(xs)
    w = np.where(d < 1, (1 - d ** 3) ** 3, 0.0) * w_rob[left:right]
    if (w > 1e-12).sum() < 2:
        return own if own is not None else np.nan
    w = w / w.sum()
    xm = (w * xs).sum()
    sq = max((w * (xs - xm) ** 2).sum(), 1e-12)
    return float((w * (1.0 + (x0 - xm) * (xs - xm) / sq) * ys).sum())

def lowess(x, y, frac, iters=3, grid=None):
    x = np.asarray(x, float); y = np.asarray(y, float)
    o = np.argsort(x, kind="stable"); xs, ys = x[o], y[o]; n = len(xs)
    k = int(frac * n + 1e-10)
    w_rob = np.ones(n)
    for it in range(iters + 1):
        fit = np.empty(n)
        for i in range(n):   # a poll on the same date as the one before takes that poll's fit
            fit[i] = fit[i - 1] if i and xs[i] == xs[i - 1] else _fit_at(xs[i], xs, ys, w_rob, k, own=ys[i])
        if it == iters: break
        e = np.abs(ys - fit); m = np.median(e)
        u = (e > 0).astype(float) if m == 0 else np.minimum(e / (6.0 * m), 1.0)
        w_rob = (1 - u ** 2) ** 2
    out = np.empty(n); out[o] = fit
    g = None
    if grid is not None:
        grid = np.asarray(grid, float)
        g = np.array([_fit_at(g0, xs, ys, w_rob, k) for g0 in grid])
        bad = ~np.isfinite(g)
        if bad.any():   # thin windows: interpolate from the good grid points, or the fitted polls
            good = ~bad
            src_x = grid[good] if good.sum() >= 2 else xs
            src_y = g[good] if good.sum() >= 2 else fit
            g[bad] = np.interp(grid[bad], src_x, src_y)
    return out, g, w_rob


def start_from_dates(dates, end):
    """Field start from a dates string like 'September 16-17 2026', 'September 19 - October 1 2025'
    or 'September 21-23, 2026', checked against the end date. None when it cannot be read."""
    s = str(dates).lower().replace(",", " ").replace("–", "-").replace("—", "-")
    months = [(m.start(), MON3[m.group(1)]) for m in re.finditer(r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?", s)]
    if not months: return None
    first = re.sub(r"^[a-z]+\.?", lambda m: m.group(0).rstrip("."), s[months[0][0]:])
    m = re.match(r"[a-z]+\s+(\d{1,2})", first)
    if not m: return None
    day, month = int(m.group(1)), months[0][1]
    for year in (end.year, end.year - 1):
        try:
            st = pd.Timestamp(year=year, month=month, day=day)
        except ValueError:
            return None
        if st <= end and (end - st).days <= 60:
            return st
    return None


def projection(frame, as_of):
    """frame: one row per poll with source, dates, end, D, R. Returns the trends and the Election Day
    polling average as a D minus R margin, or None below MIN_POLLS."""
    f = frame[~frame.source.astype(str).str.contains(PUBLISHED_AVERAGE)].copy()
    f = f[pd.to_datetime(f.end) <= pd.Timestamp(as_of)]
    f = f[np.isfinite(f.D.astype(float)) & np.isfinite(f.R.astype(float))]
    if len(f) < MIN_POLLS: return None
    mids, imputed = [], 0
    for d, e in zip(f.dates, pd.to_datetime(f.end)):
        st = start_from_dates(d, e)
        if st is None:
            imputed += 1; mids.append(e - pd.Timedelta(days=HALF_FIELD))
        else:
            mids.append(st + (e - st) / 2)
    t0 = min(mids)
    x = np.array([(m - t0).total_seconds() / 86400 for m in mids])
    y = (f.D.astype(float) - f.R.astype(float)).to_numpy()
    o = np.argsort(x, kind="stable"); x, y = x[o], y[o]
    latest = {}
    for k, frac in SPANS.items():
        fit, _, _ = lowess(x, y, frac, 3)
        latest[k] = float(fit[-1])
    value = sum(EDAY_W[k] * latest[k] for k in SPANS)
    return dict(n=int(len(f)), imputed=imputed, recent=latest["recent"], balanced=latest["balanced"], long=latest["long"],
                eday_margin=float(value), newest=str(max(mids).date()))
