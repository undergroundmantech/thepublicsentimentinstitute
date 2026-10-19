"""Swingometer voter types (Oct 18 2026).

For every Senate and governor race, reads the forecast run's simulated voter types (behavior_types_<KEY>.npz:
adults, turnout and Democratic preference by county for 1,152 types = 32 age, race and college cells x party x
2022/2024 vote history x Trump approval) and writes public/forecast/swing_types.json with the electorate split
four more ways for the swingometer:

  prop        turnout propensity: each county type's modeled chance of voting, high 80 percent and up,
              medium 55 to 80, low under 55
  voteprop    2024 vote crossed with propensity, high or low, plus third party and 2024 nonvoters
  partyprop   party identification crossed with propensity
  approval    Trump job approval: approve, no opinion, disapprove

A type's 2024 vote is not part of the type, so each type is split by the share of On Point Polling respondents of the same
party, vote history and Trump approval who recalled voting for Trump, Harris, a third party or not at all, and
each part's Democratic preference is the respondents' 2026 ballot preference for that recall, moved by one common
log odds offset so the parts add back to the type's own preference. Only aggregates are written.

Usage: python3 build_swing_types.py [SITE_DIR]   (run from anywhere; reads /tmp/fcrun)
"""
import glob, json, os, sys
import numpy as np

SITE = sys.argv[1] if len(sys.argv) > 1 else "/tmp/site"
MODEL_DIR = "/tmp/fcrun/TPSI_B/model"
RUN_ORDER = os.environ.get("SWING_RUNS", "S1018,S1017C,S1017B,S1017,B2").split(",")
HI, MID = 0.80, 0.55

sys.path.insert(0, MODEL_DIR); os.chdir(MODEL_DIR)
import senate_mode as sm, voters as vf  # noqa: E402

inv = lambda x: 1 / (1 + np.exp(-x))
lg = lambda p: np.log(np.clip(p, 1e-4, 1 - 1e-4) / (1 - np.clip(p, 1e-4, 1 - 1e-4)))

# respondent aggregates by party j, history h and approval a
r = vf.prep(sm)
REC = ["Trump", "Harris", "Third party", "Did not vote"]
APP = ["Approve", "Neutral", "Disapprove"]
glob_rec = np.array([(r.recall == x).mean() for x in REC])
recw = np.zeros((3, 4, 3, 4)); qD = np.zeros((3, 4, 3, 4))
gb = r.gb_2way
qall = {x: ((gb == "Democrat") & (r.recall == x)).sum() / max(((gb.isin(["Democrat", "Republican"])) & (r.recall == x)).sum(), 1) for x in REC}
for j in range(3):
    for h in range(4):
        for a, an in enumerate(APP):
            g = r[(r.j == j) & (r.h == h) & (r.appr == an)]
            gj = r[(r.j == j) & (r.h == h)]
            prior = np.array([(gj.recall == x).mean() if len(gj) else glob_rec[i] for i, x in enumerate(REC)])
            cnt = np.array([(g.recall == x).sum() for x in REC], float)
            w = (cnt + 8 * prior) / (cnt.sum() + 8)
            if h == 3 or h == 1:            # did not vote in 2024
                w = np.array([0.0, 0.0, 0.0, 1.0])
            elif h in (0, 2):               # voted in 2024
                w[3] = 0.0
            recw[j, h, a] = w / max(w.sum(), 1e-9)
            for i, x in enumerate(REC):
                gg = g[(g.recall == x) & gb.loc[g.index].isin(["Democrat", "Republican"])]
                n = len(gg); d = (gb.loc[gg.index] == "Democrat").sum()
                qD[j, h, a, i] = (d + 6 * qall[x]) / (n + 6)

def find(key):
    for t in RUN_ORDER:
        f = sorted(glob.glob(f"/tmp/fcrun/runs/{t}/lane*/behavior_types_{key}.npz"))
        if f: return f[0], t
    return None, None

model = json.load(open(f"{SITE}/public/forecast/model.json"))
out, used = {}, {}
for race in model["races"]:
    if race["office"] == "house": continue
    key = race["st"] + ("G" if race["office"] == "governor" else "")
    f, tag = find(key)
    if not f: continue
    z = np.load(f)
    pops = z["pops"].astype(float); t = inv(z["lt"].astype(float)); p = inv(z["eta"].astype(float))
    gg = z["gg"].astype(int); side = z["side"].astype(int)
    j = (gg // 4) % 3; h = gg % 4; a = np.where(side == 1, 0, np.where(side == 0, 1, 2))
    V = pops * t                                    # [C, K] voters
    tier = np.where(t >= HI, 0, np.where(t >= MID, 1, 2))
    # split each type by 2024 recall: weights [K, 4] and Democratic preference [C, K, 4]
    W = recw[j, h, a]                               # [K, 4]
    Q = qD[j, h, a]                                 # [K, 4]
    pk = (V * p).sum(0) / np.maximum(V.sum(0), 1e-9)  # type preference, state level
    delta = np.zeros(len(gg))
    for _ in range(30):                             # common offset per type so the parts add back to the type
        mix = (W * inv(lg(Q) + delta[:, None])).sum(1)
        delta += (lg(pk) - lg(np.clip(mix, 1e-4, 1 - 1e-4)))
    Pr = inv(lg(Q) + delta[:, None])                # [K, 4] preference by recall
    tot = V.sum()
    def grp(mask_cv, pr=None):
        v = (V * mask_cv).sum()
        if v <= 0: return [0.0, 0.0]
        d = (V * mask_cv * (p if pr is None else pr)).sum()
        return [round(100 * v / tot, 1), round(100 * (2 * d / v - 1), 1)]
    res = {}
    res["prop"] = [grp(tier == k) for k in range(3)]
    hiT = (tier == 0)
    vp = []
    for i, nm in ((0, "Trump"), (1, "Harris")):
        for hi in (True, False):
            m = (hiT if hi else ~hiT) * W[None, :, i]
            vp.append(grp(m, Pr[None, :, i] * np.ones_like(V)))
    vp.append(grp(np.ones_like(V) * W[None, :, 2], Pr[None, :, 2] * np.ones_like(V)))
    vp.append(grp(np.ones_like(V) * W[None, :, 3], Pr[None, :, 3] * np.ones_like(V)))
    res["voteprop"] = vp
    pp = []
    for jj in range(3):
        for hi in (True, False):
            pp.append(grp(((j == jj)[None, :]) & (hiT if hi else ~hiT)))
    res["partyprop"] = pp
    res["approval"] = [grp(np.broadcast_to((a == k)[None, :], V.shape)) for k in range(3)]
    out[race["id"]] = res; used[race["id"]] = tag

json.dump({"thresholds": {"high": HI, "medium": MID}, "runs": used, "races": out}, open(f"{SITE}/public/forecast/swing_types.json", "w"), separators=(",", ":"))
print(len(out), "races written;", sorted(set(used.values())))
for k in ("sen-GA", "sen-MI", "gov-PA"):
    if k in out: print(k, json.dumps(out[k]))
