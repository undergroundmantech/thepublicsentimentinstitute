"""Registered voter universe (RV_BENCH=1), rebuilt Oct 29 2026 at the user's request after the Oct 14 module was lost.

The census cells are citizen adults by age, race and college. With RV_BENCH=1 each state's cells are raked to its
2026 registered voter benchmarks (census/rv_benchmarks_2026.json, built Oct 14 from the Bonfire voter file counts, the
model's own registration estimate and the ACS): the registered total, and the age, race and college composition of
registrants. One factor per state and cell, the registration rate of that kind of citizen, held between 0.30 and 1.0,
applies to every county of the state, so a county keeps its own mix of people while the state's registered electorate
matches the file. Counties of a state without benchmarks are left as citizen adults. The audit reports each state's
citizen adults, registered voters and the benchmark total."""
import os, json, numpy as np
AUDIT = {}
ON = os.environ.get("RV_BENCH") == "1"
_B = {}
AGE = ["18-29", "30-44", "45-64", "65+"]; RACE = ["White", "Black", "Hispanic", "Asian/Other"]
AB = {"01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV","55":"WI","56":"WY"}

def _bench():
    if "b" not in _B:
        p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "census", "rv_benchmarks_2026.json")
        _B["b"] = json.load(open(p))["states"]
    return _B["b"]

def factor(sm, fips_list, with_cvap=False, pops=None):
    """n x 32 registration factors (cell k = age * 8 + race * 2 + college), or None when RV_BENCH is off."""
    if not ON or pops is None: return None
    B = _bench(); pops = np.asarray(pops, float); n = len(fips_list)
    out = np.ones((n, 32))
    st = np.array([AB.get(str(f).zfill(5)[:2]) for f in fips_list])
    ai = np.repeat(np.arange(4), 8); ri = np.tile(np.repeat(np.arange(4), 2), 4); ci = np.tile(np.arange(2), 16)
    for s in set(st):
        if s not in B: continue
        m = st == s; P = pops[m].sum(0)
        if P.sum() <= 0: continue
        b = B[s]; tot = float(b["total"])
        ta = np.array([b["Age4"][a] for a in AGE]) / 100; tr = np.array([b["Race4"][r] for r in RACE]) / 100
        tc = (b["Edu4"]["College grad"] + b["Edu4"]["Postgrad"]) / 100; tcol = np.array([1 - tc, tc])
        f = np.full(32, min(1.0, tot / P.sum()))
        for _ in range(60):
            R = P * f
            for idx, tgt in ((ai, ta), (ri, tr), (ci, tcol)):
                cur = np.array([R[idx == j].sum() for j in range(len(tgt))]) / R.sum()
                f = f * np.where(cur[idx] > 0, tgt[idx] / np.maximum(cur[idx], 1e-12), 1.0); R = P * f
            f = f * tot / max((P * f).sum(), 1.0)
            f = np.clip(f, 0.30, 1.0)
        out[m] = f
        AUDIT[s] = dict(citizen_adults=int(P.sum()), registered=int((P * f).sum()), benchmark_registered=int(tot),
                        rate=round(float((P * f).sum() / P.sum()), 4))
    return out
