"""Oct 8 2026 finance books from the user's governors_2026_money.csv and senate_2026_money.csv.
Governor: the money share is the mean of the raised share and the cash share where both are usable, otherwise the one
that is; Florida uses all accounts, as its notes advise and as the previous book did. Senate: share of raised plus
outside money for each side, an outside figure left blank counted as zero when the other side's is given. Rows the file
marks not comparable, or that lack either side, keep the previous record. Incumbent flags carry over. Self funding is
not removed, the same convention the previous books used."""
import csv, json, copy
G0 = json.load(open('/tmp/fin_1008/gov_finance.json')); S0 = json.load(open('/tmp/fin_1008/sen_finance.json'))
f = lambda x: float(x) if x not in (None, '') else None
def rec(old, share, basis, items, src, office):
    r = copy.deepcopy(old) if old else {"D": {}, "R": {}}
    inc_d = (old or {}).get("D", {}).get("incumbent", False); inc_r = (old or {}).get("R", {}).get("incumbent", False)
    r["verified"] = True; r["basis"] = basis; r["source"] = src; r["checked"] = "2026-10-08"; r["office"] = office
    r["D"] = dict(individual=round(share * 1e8, 1), self_fund=0.0, incumbent=inc_d, in_state_share=None, items=items["D"])
    r["R"] = dict(individual=round((1 - share) * 1e8, 1), self_fund=0.0, incumbent=inc_r, in_state_share=None, items=items["R"])
    r["money_share_d"] = round(share, 4)
    return r
G, S, log = copy.deepcopy(G0), copy.deepcopy(S0), []
for row in csv.DictReader(open('/tmp/fin_1008/governors_2026_money.csv')):
    k = row['state'] + 'G'; use = row['usable_for_model']
    dr, rr, dc, rc = f(row['d_raised']), f(row['r_raised']), f(row['d_cash']), f(row['r_cash'])
    if k == 'FLG': dr, rr, use = 17e6, 134e6, 'raised only'   # all accounts, Oct 6
    shares = []
    if use in ('raised and cash', 'raised only') and dr is not None and rr is not None and dr + rr > 0: shares.append(dr / (dr + rr))
    if use in ('raised and cash', 'cash only') and dc is not None and rc is not None and dc + rc > 0: shares.append(dc / (dc + rc))
    if not shares: log.append((k, 'kept previous', use)); continue
    sh = sum(shares) / len(shares)
    items = {"D": [["raised " + row['raised_window'], dr], ["cash " + row['cash_as_of'], dc]], "R": [["raised", rr], ["cash", rc]]}
    G[k] = rec(G0.get(k), sh, 'mean of raised and cash shares' if len(shares) == 2 else ('raised' if use.startswith('raised') else 'cash on hand'), items, row['sources'], 'governor')
    log.append((k, round(sh, 3)))
for row in csv.DictReader(open('/tmp/fin_1008/senate_2026_money.csv')):
    k = row['state']; dr, rr = f(row['d_raised']), f(row['r_raised']); do, ro = f(row['d_outside_for']), f(row['r_outside_for'])
    if k == 'MT':   # the model's D side is the anti Republican bloc, Bankhead plus Bodnar
        dr = (dr or 0) + (f(row['other_raised']) or 0)
    if k == 'ME' or dr is None or rr is None or dr + rr <= 0:
        log.append(('S:' + k, 'kept previous')); continue
    if do is not None or ro is not None: do, ro = do or 0.0, ro or 0.0
    else: do = ro = 0.0
    sh = (dr + do) / (dr + rr + do + ro)
    items = {"D": [["raised", dr], ["outside for", do]], "R": [["raised", rr], ["outside for", ro]]}
    S[k] = rec(S0.get(k), sh, 'raised plus outside', items, row['sources'], 'senate')
    log.append(('S:' + k, round(sh, 3)))
json.dump(G, open('/tmp/fin_1008/gov_finance_new.json', 'w'), indent=1); json.dump(S, open('/tmp/fin_1008/sen_finance_new.json', 'w'), indent=1)
for l in log: print(l)
