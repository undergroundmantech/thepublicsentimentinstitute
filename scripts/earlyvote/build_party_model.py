"""Build public/earlyvote-party-model.json, the TPSI party estimate for early vote
ballots in states that report no party.

Twelve states send every early ballot as Unspecified. This script estimates what
share of those ballots come from Democrats, Republicans and Independents, and the
Early Vote page applies the estimate to the live county counts in the browser.

The respondent file never leaves this machine. The page receives only fourteen
numbers per simulation draw plus public county figures.

How the estimate is built
-------------------------
1. County baseline. Each county's 2024 Trump two party share, moved by the swing
   TPSI measures inside its own sample from 2024 recall to the 2026 generic
   ballot. The same respondents answer both questions, so the panel's own
   partisan tilt cancels out of the swing.
2. Party mix of the county's likely voters. TPSI likely voters split into
   Democrats, Republicans and Independents, and each group voted Trump at its own
   rate in 2024. With the Independent share and the three rates fixed, exactly
   one Democrat and Republican mix reproduces the county's two party share.
3. Early vote skew. Among TPSI likely voters at the same local lean, people who
   plan to vote by mail are far more Democratic than the electorate as a whole,
   and early in person voters are slightly more so. A multinomial logit on
   party_id gives those shifts in log odds, applied on top of step 2. The shift
   is allowed to vary with the county's lean, because the mail gap is widest in
   Democratic counties and narrows in Republican ones. Mail shifts
   apply to requested and returned ballots, the early shift to in person ballots.
4. Uncertainty. Steps 1 to 3 are refit on 300 bootstrap resamples of
   respondents. The page runs every draw against the live county counts, so its
   ranges are real simulation ranges.

Run from the repository root:

    TPSI_DB=path/to/TPSI_National_Respondent_Database.csv \
    TPSI_COUNTY=path/to/TPSI_Trump_Approval_By_County_Combined_FULL.csv \
    python3 scripts/earlyvote/build_party_model.py
"""
import json, os, datetime
import numpy as np
import pandas as pd

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DB = os.environ.get("TPSI_DB", "TPSI_National_Respondent_Database.csv")
COUNTY = os.environ.get("TPSI_COUNTY", "TPSI_Trump_Approval_By_County_Combined_FULL.csv")
DRAWS = int(os.environ.get("DRAWS", "300"))
OUT = os.path.join(ROOT, "public", "earlyvote-party-model.json")

rng = np.random.default_rng(20260926)
d = pd.read_csv(DB, low_memory=False)
c = pd.read_csv(COUNTY)
c["fips"] = c.county_fips.astype(int).map(lambda f: f"{f:05d}")
c["t"] = c.trump_2024_two_party_pct / 100
state_t = c.groupby("state_abbr").apply(
    lambda g: (g.t * g.adult_population_18plus).sum() / g.adult_population_18plus.sum())
county_t = dict(zip(c.county_fips.astype(int), c.t))

# Likely voters only. Respondents with a county get that county's lean, the CINT
# waves carry only a state and get the state's.
base = d[(d.analysis_ready == 1) & (d.likely_voter == 1) & d.state.notna()].copy()
base["t"] = [county_t.get(int(f), state_t.get(s, np.nan)) if pd.notna(f) else state_t.get(s, np.nan)
             for f, s in zip(base.county_fips, base.state)]
base = base[base.t.notna()]

PID = {"Democrat": 0, "Republican": 1, "Independent": 2}


def softmax(eta):
    e = np.column_stack([np.zeros(len(eta)), eta])
    e -= e.max(1, keepdims=True)
    p = np.exp(e)
    return p / p.sum(1, keepdims=True)


def mnl(F, y, w, lam=0.5):
    """Weighted multinomial logit, Democrat as reference, small ridge for stability."""
    K = F.shape[1]
    B = np.zeros((K, 2))
    Y = np.eye(3)[y]
    for _ in range(50):
        P = softmax(F @ B)
        G = np.zeros((K, 2))
        H = np.zeros((2 * K, 2 * K))
        for j in (1, 2):
            G[:, j - 1] = F.T @ (w * (Y[:, j] - P[:, j])) - lam * B[:, j - 1]
        for a in (1, 2):
            for b in (1, 2):
                s = w * P[:, a] * ((a == b) - P[:, b])
                H[(a - 1) * K:a * K, (b - 1) * K:b * K] = -(F.T * s) @ F
        H -= lam * np.eye(2 * K)
        step = np.linalg.solve(H, G.T.reshape(-1))
        B -= step.reshape(2, K).T
        if np.abs(step).max() < 1e-9:
            break
    return B


def params(s):
    p = s[s.party_id_source.eq("asked directly") & s.party_id.notna()]
    w = p.turnout_propensity.values
    i_share = (w * (p.party_id == "Independent")).sum() / w.sum()

    r = p[p.recall_2024.isin(["Trump", "Harris"])]
    rw = r.turnout_propensity
    rate = {}
    for k, nm in (("rD", "Democrat"), ("rR", "Republican"), ("rI", "Independent")):
        g = r.party_id == nm
        rate[k] = ((r.recall_2024 == "Trump") & g).mul(rw).sum() / rw[g].sum()

    q = s[s.recall_2024.isin(["Trump", "Harris"]) & s.gb_2way.notna()]
    qw = q.turnout_propensity
    swing = ((q.gb_2way == "Republican") * qw).sum() / qw.sum() - ((q.recall_2024 == "Trump") * qw).sum() / qw.sum()

    bm = p.ballot_method.fillna("")
    mail = bm.str.startswith("Mail").astype(float).values
    early = bm.str.startswith("Early").astype(float).values
    x = np.log(p.t.values / (1 - p.t.values))
    xm = x.mean()
    x = x - xm
    cint = (p.panel == "CINT/Qualtrics").astype(float).values
    # The skew is allowed to change with local lean: in TPSI data the mail gap is
    # widest in Democratic counties and narrows as counties get redder.
    B = mnl(np.column_stack([np.ones_like(x), x, mail, early, mail * x, early * x, cint]),
            p.party_id.map(PID).values, w)
    mix = np.array([(w * mail).sum(), (w * early).sum(), (w * (1 - mail - early)).sum()]) / w.sum()
    at = lambda xx, m, e: softmax(np.array([[1, xx, m, e, m * xx, e * xx, 0.5]]) @ B)[0]
    lr = lambda v: np.log(v[1:] / v[0])

    def skew(xx):
        pm, pe, po = at(xx, 1, 0), at(xx, 0, 1), at(xx, 0, 0)
        pall = mix[0] * pm + mix[1] * pe + mix[2] * po
        return lr(pm) - lr(pall), lr(pe) - lr(pall)
    (m0, e0), (m1, e1) = skew(0.0), skew(1.0)
    ms, es = m1 - m0, e1 - e0
    # order matches paramKeys in the output and partyShares in app/earlyvote/lib.ts
    return [swing, i_share, rate["rD"], rate["rR"], rate["rI"],
            m0[0], ms[0], m0[1], ms[1], e0[0], es[0], e0[1], es[1], xm]


def shares(t, v):
    swing, I, rD, rR, rI, mR, mRs, mI, mIs, eR, eRs, eI, eIs, xm = v
    x = np.log(t / (1 - t)) - xm
    mR, mI = mR + mRs * x, mI + mIs * x
    t = np.clip(t + swing, 0.02, 0.98)
    R = np.clip((t - rD * (1 - I) - rI * I) / (rR - rD), 0.01, 1 - I - 0.01)
    D = 1 - I - R
    lr = np.log(np.stack([R / D, I / D], -1)) + np.stack([mR, mI], -1)
    e = np.exp(np.concatenate([np.zeros(lr.shape[:-1] + (1,)), lr], -1))
    return e / e.sum(-1, keepdims=True)


point = params(base)
n = len(base)
draws = [params(base.iloc[rng.integers(0, n, n)]) for _ in range(DRAWS)]

# Check against states that do report party. Registration is not party ID, so
# this is a sanity check, not a score: Kentucky and Oklahoma still carry large
# ancestral Democratic registration that no party ID model should reproduce.
REPORTED = {"FL": (584201, 438071, 284016), "NC": (36873, 14898, 36083), "NJ": (511821, 168490, 199243),
            "PA": (668426, 241933, 96379), "OK": (17685, 19692, 5810), "KY": (8476, 3951, 2507)}
check = []
for st, (a, b, o) in REPORTED.items():
    g = c[c.state_abbr == st]
    wt = g.adult_population_18plus.values
    sims = np.array([(shares(g.t.values, v)[:, :] * wt[:, None]).sum(0) / wt.sum() for v in draws])
    mg = (sims[:, 0] - sims[:, 1]) * 100
    T = a + b + o
    check.append({"st": st, "modelMargin": round(float(mg.mean()), 1),
                  "lo": round(float(np.percentile(mg, 10)), 1), "hi": round(float(np.percentile(mg, 90)), 1),
                  "reportedMargin": round((a - b) / T * 100, 1)})

out = {
    "meta": {
        "built": datetime.date.today().isoformat(),
        "respondents": int(n),
        "draws": DRAWS,
        "paramKeys": ["swing", "iShare", "rD", "rR", "rI", "mailR", "mailRslope", "mailI", "mailIslope",
                      "earlyR", "earlyRslope", "earlyI", "earlyIslope", "leanCenter"],
        "check": check,
    },
    "point": [round(float(x), 5) for x in point],
    "draws": [[round(float(x), 5) for x in v] for v in draws],
    # fips: [2024 Trump two party share, adults 18+]
    "counties": {f: [round(float(t), 4), int(p)] for f, t, p in zip(c.fips, c.t, c.adult_population_18plus)},
}
json.dump(out, open(OUT, "w"), separators=(",", ":"))
print(f"wrote {OUT}: {n} respondents, {DRAWS} draws, {len(out['counties'])} counties, "
      f"{os.path.getsize(OUT) // 1024} KB")
print("point", dict(zip(out["meta"]["paramKeys"], out["point"])))
for r in check:
    print(f"  {r['st']}  model D{r['modelMargin']:+.1f} [{r['lo']:+.1f}, {r['hi']:+.1f}]   reported D{r['reportedMargin']:+.1f}")
