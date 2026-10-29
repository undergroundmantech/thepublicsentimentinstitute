"""Hypothetical three-county example for docs/VAI_V1_MATHEMATICAL_DESIGN.md §12.

Not real data. Compares the current E1 estimator (app/results/2026/live.ts project/liveOdds,
re-implemented line for line) with the VAI v1 county model on one early mail batch.
"""
import math

import numpy as np

# expected votes [D, R, other, total] and the published forecast: D +2.0, sd 4 pts, P(D) = Phi(0.5)
EXP = {"A": [300_000, 200_000, 0, 500_000], "B": [150_000, 150_000, 0, 300_000], "C": [60_000, 140_000, 0, 200_000]}
REPORTED_A = (136_000, 64_000)  # first batch: early and mail ballots, D 68%
SIGMA_F = 4.0
P_PUBLISHED = 0.5 * (1 + math.erf((2.0 / SIGMA_F) / math.sqrt(2)))


def phi(x):
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def e1(pr_a):
    """live.ts project() + liveOdds() for this race (side A = D, side B = R; margin = B - A)."""
    exp_t = sum(e[3] for e in EXP.values())
    exp_m = 100 * (sum(e[1] for e in EXP.values()) - sum(e[0] for e in EXP.values())) / exp_t
    a, b = REPORTED_A
    t = a + b
    e = EXP["A"]
    gap = (b - a) / t - (e[1] - e[0]) / e[3]
    swing = gap * (t / (t + 0.08 * exp_t))
    fin_a = fin_b = 0.0
    for k, e in EXP.items():
        ea, eb = e[0] / e[3], e[1] / e[3]
        if k == "A":
            frac = min(1, pr_a / 100) if pr_a > 0 else min(1, t / e[3])
            final = max(t, t / frac) if frac >= 0.05 else max(e[3], t)
            left, w = max(0, final - t), min(1, 2 * frac)
            ra, rb = w * a / t + (1 - w) * (ea - swing / 2), w * b / t + (1 - w) * (eb + swing / 2)
            fin_a += a + left * ra / (ra + rb)
            fin_b += b + left * rb / (ra + rb)
        else:
            A, B = max(0, ea - swing / 2), max(0, eb + swing / 2)
            fin_a += e[3] * A / (A + B)
            fin_b += e[3] * B / (A + B)
    m = 100 * (fin_b - fin_a) / (fin_a + fin_b)
    f = min(1, t / (fin_a + fin_b))
    sdf = min(20, max(1.5, abs(exp_m) / max(0.15, abs(_phiinv(1 - P_PUBLISHED)))))
    sd = sdf * (1 - f) ** 0.9 + 0.35
    return -m, 1 - phi(m / sd), fin_a + fin_b


def _phiinv(p):
    lo, hi = -10.0, 10.0
    for _ in range(100):
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if phi(mid) < p else (lo, mid)
    return (lo + hi) / 2


def vai(n=20_000, seed=7, sigma_eps=0.10, sigma_gap=0.30, sigma_u=0.10):
    """VAI v1 county model, two candidates, log-ratio scale (D over R). Initial unfitted hyperparameters."""
    rng = np.random.default_rng(seed)
    keys = list(EXP)
    E = np.array([EXP[k][3] for k in keys], float)
    eta0 = np.array([math.log(EXP[k][0] / EXP[k][1]) for k in keys])
    wts = E / E.sum()
    # state shift: matched to the published sd of 4 margin points (d margin / d log-ratio ~ 0.5 near 0)
    sigma_delta = (SIGMA_F / 100) / 0.5
    a, b = REPORTED_A
    n_a = a + b
    y = math.log(a / b)
    # turnout of A: lognormal around expectation, truncated at what is already counted
    T_a = E[0] * np.exp(rng.normal(0, sigma_u, n * 3))
    T_a = T_a[T_a >= n_a][:n]
    pi = n_a / T_a
    # x = (delta, eps_A, eps_B, eps_C, g); eps sums to zero with expected-vote weights (anchor, §6)
    M = np.eye(3) - np.outer(np.ones(3), wts)
    P = np.zeros((5, 5))
    P[0, 0] = sigma_delta**2
    P[1:4, 1:4] = sigma_eps**2 * M @ M.T
    P[4, 4] = sigma_gap**2
    r_samp = 1 / a + 1 / b
    out_m = np.empty(len(T_a))
    out_rem = np.empty(len(T_a))
    for i, (p, T) in enumerate(zip(pi, T_a)):
        H = np.array([1, 1, 0, 0, 1 - p])
        S = H @ P @ H + r_samp
        K = P @ H / S
        mean = K * (y - eta0[0])
        cov = P - np.outer(K, H @ P)
        x = rng.multivariate_normal(mean, cov + 1e-12 * np.eye(5), check_valid="ignore")
        theta = eta0 + x[0] + x[1:4]
        rem_A = theta[0] - p * x[4]
        sD = 1 / (1 + np.exp(-np.array([rem_A, theta[1], theta[2]])))
        R = np.array([T - n_a, E[1] * math.exp(rng.normal(0, sigma_u)), E[2] * math.exp(rng.normal(0, sigma_u))])
        D = a + (R * sD).sum()
        tot = n_a + R.sum()
        out_m[i] = 100 * (2 * D - tot) / tot
        out_rem[i] = R[0]
    return out_m, out_rem


def prior_check(n=200_000, seed=11, sigma_eps=0.10, sigma_u=0.10):
    """Zero-reporting anchor: prior predictive margin should be centred on +2.0 with P(D) near the published value."""
    rng = np.random.default_rng(seed)
    keys = list(EXP)
    E = np.array([EXP[k][3] for k in keys], float)
    eta0 = np.array([math.log(EXP[k][0] / EXP[k][1]) for k in keys])
    wts = E / E.sum()
    delta = rng.normal(0, (SIGMA_F / 100) / 0.5, n)
    z = rng.normal(0, sigma_eps, (n, 3))
    eps = z - (z @ wts)[:, None]
    T = E * np.exp(rng.normal(0, sigma_u, (n, 3)))
    sD = 1 / (1 + np.exp(-(eta0 + delta[:, None] + eps)))
    m = 100 * (2 * (T * sD).sum(1) - T.sum(1)) / T.sum(1)
    return m


if __name__ == "__main__":
    print(f"published: D +2.0, P(D) = {P_PUBLISHED:.3f}")
    m0 = prior_check()
    print(f"VAI at zero reporting: median D {np.median(m0):+.2f}, sd {m0.std():.2f}, P(D) = {(m0 > 0).mean():.3f}")
    for pr in (0, 10, 40, 100):
        m, p, tot = e1(pr)
        print(f"E1 with county A pr={pr:>3}: margin D {m:+.1f}, P(D) = {p:.3f}, implied total {tot:,.0f}")
    m, rem = vai()
    q = np.percentile(m, [10, 50, 90])
    print(f"VAI: margin median D {q[1]:+.1f} (80%: {q[0]:+.1f} to {q[2]:+.1f}), P(D) = {(m > 0).mean():.3f}; "
          f"county A remaining median {np.median(rem):,.0f} (80%: {np.percentile(rem, 10):,.0f} to {np.percentile(rem, 90):,.0f})")
