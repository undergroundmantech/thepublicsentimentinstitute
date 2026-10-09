"""Fix 4: how the 2018 and 2022 misses were shared. Pairwise products of race misses (live blend, polled races),
grouped by how the two races are related: different region, same region, same state. Bootstrap over races."""
import json, numpy as np, pandas as pd
REG = json.load(open('/tmp/fc_v61/run_summary.json'))['state_region']
out = {}
rng = np.random.default_rng(11)
for H in (31, 1):
    T = pd.read_csv(f'mt_scored_{H}d.csv'); T = T[T.has_poll].copy()
    T['e'] = T.y - T.live_mu; T['reg'] = T.state.map(REG)
    def stats(T):
        r = {'diff_region': [], 'same_region': [], 'same_state': [], 'sen_sen_diffreg': [], 'gov_gov_diffreg': [], 'sen_gov_diffreg': []}
        for c, g in T.groupby('cycle'):
            g = g.reset_index(drop=True)
            for i in range(len(g)):
                for j in range(i + 1, len(g)):
                    a, b = g.loc[i], g.loc[j]; p = a.e * b.e
                    if a.state == b.state: r['same_state'].append(p)
                    elif a.reg == b.reg: r['same_region'].append(p)
                    else:
                        r['diff_region'].append(p)
                        k = 'sen_sen' if a.office == b.office == 'senate' else 'gov_gov' if a.office == b.office == 'governor' else 'sen_gov'
                        r[k + '_diffreg'].append(p)
        v = float(np.mean(T.e ** 2))
        return {k: float(np.mean(x)) for k, x in r.items()} | {'var': v, 'n': len(T)}
    s = stats(T)
    # bootstrap by resampling races within cycle
    bs = []
    for _ in range(60):
        Tb = pd.concat([g.sample(len(g), replace=True, random_state=int(rng.integers(1e9))) for _, g in T.groupby('cycle')])
        Tb = Tb.reset_index(drop=True); Tb['state'] = Tb['state'] + '_' + Tb.index.astype(str).str[-0:]  # keep duplicates distinct from same state
        bs.append(stats(Tb)['diff_region'])
    s['diff_region_boot_90'] = [float(np.quantile(bs, .05)), float(np.quantile(bs, .95))]
    s['corr_diff_region'] = s['diff_region'] / s['var']; s['corr_same_region'] = s['same_region'] / s['var']; s['corr_same_state'] = s['same_state'] / s['var']
    s['sd_nat_logit'] = float(np.sqrt(max(s['diff_region'], 0))); s['sd_region_logit'] = float(np.sqrt(max(s['same_region'] - s['diff_region'], 0)))
    s['sd_samestate_logit'] = float(np.sqrt(max(s['same_state'] - s['same_region'], 0)))
    out[H] = s
    print(H, json.dumps({k: (round(v, 5) if isinstance(v, float) else v) for k, v in s.items()}))
json.dump(out, open('mt_corr.json', 'w'), indent=1)
