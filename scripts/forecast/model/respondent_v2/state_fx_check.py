# Split half and leave one wave out checks of the TPSI state swing effects (respondent_v2)
import sys, os, json
RR = "/tmp/claude-0/-home-claude/2fe66b6b-24b4-5fab-b0f7-c44b6f59cc0e/scratchpad/rerun"
sys.path.insert(0, RR); os.chdir(RR); sys.argv = ["x"]
os.environ.update(AS_OF="2026-09-29", APPROVAL_SRC="combined", HIST_COMP_CENTER="0.0452", M2_ANCHOR="gallup")
import numpy as np, pandas as pd
import senate_mode as sm, respondent_v2 as rv
model = sm.fit_respondents()
base = pd.DataFrame(rv.STATE_FX).T
r = sm.RESP.dropna(subset=["age_band", "race4", "college", "region8"]).copy()
X = np.vstack([sm.design(a, b, c, g, model["regions"]) for a, b, c, g in zip(r.age_band, r.race4, r.college, r.region8)])
def raw(mask):
    rv.fit_state_effects(None, r[mask].reset_index(drop=True), X[mask], model)
    return pd.Series({k: v["raw"] for k, v in rv.STATE_FX.items()}), pd.Series({k: v["n"] for k, v in rv.STATE_FX.items()}), dict(rv.AUDIT["state_effects"])
rng = np.random.default_rng(7); out = {}
cors = []
for rep in range(20):
    h = rng.random(len(r)) < 0.5
    a, na, _ = raw(h); b, nb, _ = raw(~h)
    j = a.index.intersection(b.index); j = [s for s in j if na[s] >= 20 and nb[s] >= 20]
    cors.append(float(np.corrcoef(a[j], b[j])[0, 1]))
out["split_half_correlation_mean"] = round(float(np.mean(cors)), 3)
out["split_half_correlation_range"] = [round(min(cors), 3), round(max(cors), 3)]
out["split_half_states"] = len(j)
lowo = {}
for w in sorted(r.wave.unique()):
    m = (r.wave != w).values
    _, _, aud = raw(m)
    lowo[w] = dict(respondents=int(m.sum()), tau_state=round(aud["tau_state_logit"], 4), tau_state_race=round(aud["tau_state_race_logit"], 4))
out["leave_one_wave_out"] = lowo
# Q statistic on the full sample
S = base
w = 1 / S.raw_se.astype(float) ** 2; mu = (w * S.raw).sum() / w.sum()
out["Q"] = round(float((w * (S.raw - mu) ** 2).sum()), 1); out["df"] = int(len(S) - 1)
out["raw_sd_across_states"] = round(float(S.raw.astype(float).std()), 4)
out["median_raw_se"] = round(float(S.raw_se.astype(float).median()), 4)
json.dump(out, open("/tmp/v2val/state_fx_check.json", "w"), indent=1)
print(json.dumps(out, indent=1))
