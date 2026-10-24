"""Oct 24 2026 finance books: the Oct 16 FEC books with outside money brought up to the watchdog's Oct 23 race totals.
Senate: each side's outside money is the larger of the Oct 16 FEC figure and the watchdog's Oct 23 figure, since outside
money only accumulates and the watchdog's later count shows spending made after Oct 16. The two sources define a side
slightly differently, so the smaller figure is never mixed in. Maine: Troy Jackson's third quarter report was not in the
FEC pull; both campaigns' third quarter spending (Jackson $16.5M, Collins $10.9M, Newsweek Oct 16) now joins the outside
money. Governors and House keep the Oct 16 books. fin_ref.json gets the new statewide totals and its reference
distribution is recomputed."""
import json, copy, numpy as np
S = json.load(open('/tmp/fcrun/fin_1016/sen_finance.json')); G = json.load(open('/tmp/fcrun/fin_1016/gov_finance.json'))
W = json.load(open('/tmp/site/public/watchdog/money.json')); REF = json.load(open('/tmp/fcrun/TPSI_B/model/finance/fin_ref.json'))
log = []
for r in W['races']:
    if not r['office'].startswith('Senate') or r.get('forD') is None: continue
    k = r['st']; b = S.get(k)
    if not b: log.append((k, 'no book')); continue
    old = b['money_share_d']
    for s, wv in (('D', r['forD']), ('R', r['forR'])):
        x = b[s]; o = float(x.get('outside_for') or 0)
        if wv > o:
            x['outside_for'] = float(wv); x['outside_for_watchdog'] = float(wv); x['outside_for_fec_1016'] = o
            x['items'] = [it for it in x.get('items', []) if it[0] != 'outside for'] + [['outside for, watchdog Oct 23', float(wv)]]
    if k == 'ME':
        b['D']['spent'] = 16.5e6; b['R']['spent'] = max(float(b['R'].get('spent') or 0), 10.9e6)
        b['D']['items'] = [it for it in b['D']['items'] if it[0] != 'spent'] + [['spent, Jackson Q3 per Newsweek Oct 16', 16.5e6]]
        b['basis'] = 'spent plus outside; Jackson nominated July 25, so third quarter spending for both campaigns'
        b['notes'] = ['Jackson third quarter: raised 20.4M, spent 16.5M; Collins third quarter: raised 5.2M, spent 10.9M']
    for s in 'DR':
        x = b[s]; x['individual'] = float(x.get('spent') or 0) + float(x.get('outside_for') or 0)
    b['money_share_d'] = round(b['D']['individual'] / (b['D']['individual'] + b['R']['individual']), 4)
    b['checked'] = '2026-10-24'; b['source'] = b.get('source', '') + '; outside money refreshed from the watchdog money page as of 2026-10-23'
    tot = b['D']['individual'] + b['R']['individual']
    if k in REF['statewide']:
        REF['statewide'][k]['total'] = max(REF['statewide'][k]['total'], tot)
        REF['statewide'][k]['spv'] = REF['statewide'][k]['total'] / REF['statewide'][k]['voters']
    log.append((k, old, b['money_share_d']))
l = np.log([v['spv'] for v in REF['statewide'].values() if v['spv'] > 0])
REF['statewide_ref'] = dict(mu=float(l.mean()), sd=float(l.std(ddof=1)), n=int(len(l)))
json.dump(S, open('/tmp/fcrun/fin_1024/sen_finance.json', 'w'), indent=1)
json.dump(G, open('/tmp/fcrun/fin_1024/gov_finance.json', 'w'), indent=1)
json.dump(REF, open('/tmp/fcrun/fin_1024/fin_ref.json', 'w'), indent=1)
import shutil; shutil.copy('/tmp/fcrun/fin_1016/house_finance.json', '/tmp/fcrun/fin_1024/house_finance.json')
for x in log: print(x)
print(REF['statewide_ref'])
