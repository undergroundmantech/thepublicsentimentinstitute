"""Robust LOWESS, a line for line match of statsmodels' lowess(frac, it, delta=0).

Local linear fits over the k = int(frac * n) nearest polls, found as a sliding window over
the sorted x values; tricube weights on distance over the window radius, so the farthest
neighbour gets zero; bisquare robustness weights from residuals over six times their median.
A window with fewer than two usable weights returns the poll's own value at data points, and
is interpolated from its neighbours on an evaluation grid."""
import numpy as np

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
