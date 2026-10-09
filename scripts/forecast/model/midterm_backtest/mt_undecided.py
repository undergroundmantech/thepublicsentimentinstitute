"""Fix 5: do undecided voters break in a predictable direction? 2018 and 2022 polled races, fit on one cycle and
scored on the other. The miss of the polling average (log odds) is regressed on the undecided share times
incumbency, the state's presidential lean and the out party of the White House."""
import json, numpy as np, pandas as pd
L = lambda p: np.log(p / (1 - p))
d = pd.read_csv('mt_races.csv'); d = d[(d.n_polls > 0)].copy()
d['y'] = L(d.actual_d2); d['poll'] = L(d.poll_d2.clip(.02, .98)); d['miss'] = d.y - d.poll
d['U'] = d.undecided.fillna(d.undecided.median()) / 100
# the White House party: R in 2018 and D in 2022; +1 means the undecided lean toward the out party favors Democrats
d['outp'] = np.where(d.cycle == 2018, 1, -1)
feats = {'incumbent': lambda t: t.U * t.inc, 'lean': lambda t: t.U * t.lean, 'out_party': lambda t: t.U * t.outp,
         'open_seat_party': lambda t: t.U * t.open_party}
def X(t, fs): return np.c_[[feats[f](t) for f in fs]].T if fs else np.zeros((len(t), 0))
out = {}
for H in (31, 1):
    D = d[d.days_out == H]
    for fs in ([], ['incumbent'], ['lean'], ['out_party'], ['incumbent', 'lean'], ['incumbent', 'lean', 'out_party'], ['incumbent', 'out_party']):
        rec = {}
        for test in (2018, 2022):
            tr, te = D[D.cycle != test], D[D.cycle == test]
            if fs:
                Xt = X(tr, fs); b = np.linalg.lstsq(Xt, tr.miss.values, rcond=None)[0]
                pred = X(te, fs) @ b
            else:
                pred = np.zeros(len(te)); b = []
            e = 200 * (1 / (1 + np.exp(-te.y.values)) - 1 / (1 + np.exp(-(te.poll.values + pred))))
            rec[test] = round(float(np.mean(np.abs(e))), 3); rec[f'coef_fit_on_other_{test}'] = [round(float(x), 3) for x in b]
        rec['both'] = round((rec[2018] + rec[2022]) / 2, 3)
        # pooled fit
        if fs:
            bp = np.linalg.lstsq(X(D, fs), D.miss.values, rcond=None)[0]; rec['pooled_coef'] = [round(float(x), 3) for x in bp]
        out[f'{H}|{"+".join(fs) or "none"}'] = rec
        print(H, '+'.join(fs) or 'none', rec)
print('median undecided', d.groupby(['cycle', 'days_out']).undecided.median().to_dict())
json.dump(out, open('mt_undecided.json', 'w'), indent=1)
