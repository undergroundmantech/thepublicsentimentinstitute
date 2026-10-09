"""Fix 2 test: do house effects measured on the OTHER races of the same cycle make a race's polling average better?
Leave one race out, 2018 and 2022, election eve and 31 days out, over a grid of shrinkage strengths."""
import sys, json, numpy as np, pandas as pd
sys.path.insert(0, '.'); sys.path.insert(0, '/tmp/claude-0/-home-claude/2fe66b6b-24b4-5fab-b0f7-c44b6f59cc0e/scratchpad/rerun')
import mt_data as md, house_effects as he
P, R = md.load()
P = P.copy()
P['house'] = P.pollster.map(he.house_key); P['sponsor'] = [he.sponsor(a, b) for a, b in zip(P.pollster, P.partisan)]
P['y'] = np.log(P.dem / P.rep)
act = {(r.cycle, r.race): r.dem_pct / (r.dem_pct + r.rep_pct) for r in R.itertuples()}
L = lambda p: np.log(p / (1 - p))
out = {}
for tau in [float(x) for x in sys.argv[1].split(",")]:
    errs = {1: [], 31: []}
    for cyc in (2018, 2022):
        C = P[P.cycle == cyc]
        for race in sorted(C.race.unique()):
            if (cyc, race) not in act: continue
            for H in (1, 31):
                as_of = md.EDAY[cyc] - pd.Timedelta(days=H)
                tr = C[(C.race != race) & (C.end <= as_of)].copy()
                tr['w'] = 0.5 ** ((as_of - tr.end).dt.days.clip(lower=0) / he.HALF_LIFE) * np.sqrt(tr.n.fillna(600).clip(upper=2000) / 600)
                tr = tr.rename(columns={'race': 'race'})
                p = C[C.race == race].copy()
                if (p.end <= as_of).sum() == 0: continue
                if tau > 0:
                    fit = he.estimate(tr[['race', 'house', 'sponsor', 'y', 'w']], tau=tau)
                    eff = p.house.map(fit['house']).fillna(0) + p.sponsor.map(fit['sponsor']).fillna(0)
                    T = p.dem + p.rep; d2 = p.dem / T; d2n = 1 / (1 + np.exp(-(L(d2) - eff)))
                    p['dem'], p['rep'] = T * d2n, T * (1 - d2n)
                pl = md.poll_level(p, as_of)
                e = 200 * (act[(cyc, race)] - pl['D2'])
                errs[H].append((cyc, race, e))
    out[tau] = {H: dict(mae=float(np.mean([abs(e) for _, _, e in v])), rmse=float(np.sqrt(np.mean([e * e for _, _, e in v]))),
                         mae18=float(np.mean([abs(e) for c, _, e in v if c == 2018])), mae22=float(np.mean([abs(e) for c, _, e in v if c == 2022])),
                         bias=float(np.mean([e for _, _, e in v])), n=len(v)) for H, v in errs.items()}
    print(tau, {H: {k: round(x, 3) for k, x in o.items()} for H, o in out[tau].items()})
json.dump(out, open(f'mt_house_{sys.argv[1]}.json', 'w'), indent=1)
