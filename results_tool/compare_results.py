#!/usr/bin/env python3
"""On Point Politics: 2026 results vs. final forecast.

Pulls every US Senate, governor and US House result for Nov. 3, 2026 from civicAPI, the same
source the onpointpolitics.us results desk reads, and compares each race to the final On Point
forecast in results/2026/index.json.

Run:    pip install requests
        python3 compare_results.py
Options:
        --index PATH_OR_URL   forecast index, default https://onpointpolitics.us/results/2026/index.json
        --out DIR             output folder, default ./results_out
        --civic-dir DIR       read saved civicAPI JSON instead of the network (offline rerun)
        --counties            also compare county by county: every Senate and governor race, and the
                              House vote by county in every state; pulls each race's county results
        --counties-url URL    forecast county file, default https://onpointpolitics.us/forecast/counties.json

Writes:
        results_vs_forecast.csv   one row per race
        results_vs_forecast.json  same rows, plus the summary
        civic_raw/*.json          the raw civicAPI pulls, so you can rerun offline
        with --counties:
        counties_vs_forecast.csv  one row per county per race: expected and actual margin, error, turnout
        county_summary.csv        per race: vote weighted county error, share of counties where Democrats
                                  beat the forecast, best and worst counties
Margins are Republican minus Democratic, in points. Negative means the Democratic side leads.
"""
import argparse, csv, json, os, re, sys, time, unicodedata

try:
    import requests
except ImportError:
    sys.exit('Install requests first: pip install requests')

CIVIC = 'https://civicapi.org/api/v2/race/search'
TYPES = ['US Senate', 'Governor', 'House of Representatives', 'US House']
UA = {'User-Agent': 'OnPointPolitics-results-compare/1.0', 'accept': 'application/json'}


def norm(s):
    s = unicodedata.normalize('NFKD', str(s or ''))
    s = ''.join(ch for ch in s if not unicodedata.combining(ch)).lower()
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]+', ' ', s)).strip()


def last(n):
    return re.sub(r' (jr|sr|ii|iii|iv)$', '', norm(n)).split(' ')[-1]


def side(p):
    x = norm(p)
    return 'D' if x.startswith('dem') else 'R' if x.startswith('rep') else 'I' if x.startswith('ind') else 'O'


def get_json(url, tries=4):
    for k in range(tries):
        try:
            r = requests.get(url, headers=UA, timeout=60)
            if r.status_code == 200:
                return r.json()
            print(f'  {r.status_code} from {url[:90]}, retrying', file=sys.stderr)
        except requests.RequestException as e:
            print(f'  {e.__class__.__name__}, retrying', file=sys.stderr)
        time.sleep(2 * (k + 1))
    sys.exit(f'Could not read {url}')


def load_index(src):
    if re.match(r'https?://', src):
        return get_json(src)
    return json.load(open(src, encoding='utf-8'))


def load_civic(out, civic_dir):
    races = []
    raw = os.path.join(out, 'civic_raw'); os.makedirs(raw, exist_ok=True)
    for t in TYPES:
        fn = re.sub(r'\W+', '_', t) + '.json'
        if civic_dir:
            p = os.path.join(civic_dir, fn)
            j = json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {'races': []}
        else:
            url = f'{CIVIC}?startDate=2026-11-03&endDate=2026-11-03&limit=20000&type={requests.utils.quote(t)}'
            print(f'civicAPI: {t}')
            j = get_json(url)
            json.dump(j, open(os.path.join(raw, fn), 'w', encoding='utf-8'))
        for x in j.get('races', []):
            x['_type'] = t
            races.append(x)
    return races


def match(fr, pool):
    types = {norm(t) for t in (fr.get('civ') or {}).get('t', [])}
    d = (fr.get('civ') or {}).get('d')
    al = (fr.get('civ') or {}).get('al')
    for c in pool:
        if norm(c.get('type') or c['_type']) not in types:
            continue
        if fr['k'] in ('sen', 'gov'):
            return c
        cd = c.get('district') or ''
        if cd == d or (al and re.search(r'(-AL|-00|-01|AT LARGE)$', cd, re.I)):
            return c
    return None


def read_sides(fr, cr):
    """Votes for the forecast's Democratic side and Republican side, matched by last name, then party."""
    fc = [c for c in fr['c'] if c[1] != 'O']
    dside = next((c for c in fc if c[1] in ('D', 'I', 'IND')), None)
    rside = next((c for c in fc if c[1] == 'R'), None)
    cands = cr.get('candidates') or []
    tot = sum(c.get('votes') or 0 for c in cands)
    def find(fc_):
        if not fc_:
            return None
        ln = last(fc_[0])
        hit = next((c for c in cands if last(c.get('name')) == ln), None)
        if hit is None:
            want = 'R' if fc_[1] == 'R' else ('I' if fc_[1] in ('I', 'IND') else 'D')
            hit = next((c for c in sorted(cands, key=lambda c: -(c.get('votes') or 0)) if side(c.get('party')) == want), None)
        return hit
    return find(dside), find(rside), tot, dside, rside


def race_detail(cid, out, civic_dir):
    raw = os.path.join(civic_dir or os.path.join(out, 'civic_raw'), 'race'); os.makedirs(raw, exist_ok=True)
    p = os.path.join(raw, f'{cid}.json')
    if os.path.exists(p):
        return json.load(open(p, encoding='utf-8'))
    if civic_dir:
        return None
    j = get_json(f'https://civicapi.org/api/v2/race/{cid}')
    json.dump(j, open(p, 'w', encoding='utf-8')); time.sleep(0.25)
    return j


def regions(j):
    out = {}
    for k, v in (j.get('region_results') or {}).items():
        f = str(v.get('fips') or k)
        if re.fullmatch(r'\d{4,5}', f): f = f.zfill(5)
        out[f] = v
    return out


def county_compare(fore, matched, out, civic_dir, counties_src):
    CO = load_index(counties_src)
    crow, srow = [], []
    def side_votes(cands, dname, rname):
        dv = rv = ov = 0
        for c in cands or []:
            v = c.get('votes') or 0; ln = last(c.get('name'))
            if dname and ln == last(dname): dv += v
            elif rname and ln == last(rname): rv += v
            else: ov += v
        return dv, rv, ov
    def summarize(rid, rows):
        rows = [r for r in rows if r['actual_total']]
        if not rows: return
        w = sum(r['actual_total'] for r in rows)
        we = sum(r['error'] * r['actual_total'] for r in rows) / w
        dbeat = sum(1 for r in rows if r['error'] < 0) / len(rows)
        best = min(rows, key=lambda r: r['error']); worst = max(rows, key=lambda r: r['error'])
        srow.append(dict(race=rid, counties=len(rows), vote_weighted_error=round(we, 2), share_counties_d_beat_forecast=round(dbeat, 3),
                         best_d_county=f"{best['county']} {best['error']:+.1f}", best_r_county=f"{worst['county']} {worst['error']:+.1f}"))
    n = 0
    for fr in fore:
        if fr['k'] not in ('sen', 'gov'): continue
        cr = matched.get(fr['id']); exp = CO.get(fr['id'])
        if not cr or not isinstance(exp, dict): continue
        j = race_detail(cr['id'], out, civic_dir); n += 1
        if not j: continue
        fc = [c for c in fr['c'] if c[1] != 'O']
        dname = next((c[0] for c in fc if c[1] in ('D', 'I', 'IND')), None); rname = next((c[0] for c in fc if c[1] == 'R'), None)
        rows = []
        for f, v in regions(j).items():
            e = exp.get(f)
            if not isinstance(e, list): continue
            dv, rv, ov = side_votes(v.get('candidates'), dname, rname); t = dv + rv + ov
            if not t: continue
            am = round((rv - dv) / t * 100, 2)
            rows.append(dict(race=fr['id'], fips=f, county=v.get('name'), pct_reporting=v.get('percent_reporting'), forecast_margin=e[0], actual_margin=am,
                             error=round(am - e[0], 2), forecast_total=e[3], actual_total=t, turnout_vs_forecast=round(t / e[3], 3) if e[3] else None))
        crow += rows; summarize(fr['id'], rows)
        print(f'  counties: {fr["id"]} {len(rows)} counties')
    # House: the House vote by county, summed over every district in the state, against house-ST in the county file
    hs = {}
    for fr in fore:
        if fr['k'] != 'house' or fr['id'] not in matched: continue
        hs.setdefault(fr['st'], []).append(fr)
    for st, frs in sorted(hs.items()):
        exp = CO.get(f'house-{st}')
        if not isinstance(exp, dict): continue
        agg = {}
        for fr in frs:
            j = race_detail(matched[fr['id']]['id'], out, civic_dir)
            if not j: continue
            for f, v in regions(j).items():
                a = agg.setdefault(f, [0, 0, 0, v.get('name'), v.get('percent_reporting')])
                for c in v.get('candidates') or []:
                    k = {'D': 0, 'R': 1}.get(side(c.get('party')), 2); a[k] += c.get('votes') or 0
        rows = []
        for f, (dv, rv, ov, nm, pr) in agg.items():
            e = exp.get(f); t = dv + rv + ov
            if not isinstance(e, list) or not t: continue
            am = round((rv - dv) / t * 100, 2)
            rows.append(dict(race=f'house-{st}', fips=f, county=nm, pct_reporting=pr, forecast_margin=e[0], actual_margin=am, error=round(am - e[0], 2),
                             forecast_total=e[3], actual_total=t, turnout_vs_forecast=round(t / e[3], 3) if e[3] else None))
        crow += rows; summarize(f'house-{st}', rows)
        print(f'  counties: House {st} {len(rows)} counties')
    if crow:
        with open(os.path.join(out, 'counties_vs_forecast.csv'), 'w', newline='', encoding='utf-8') as f:
            w = csv.DictWriter(f, fieldnames=list(crow[0])); w.writeheader(); w.writerows(crow)
        with open(os.path.join(out, 'county_summary.csv'), 'w', newline='', encoding='utf-8') as f:
            w = csv.DictWriter(f, fieldnames=list(srow[0])); w.writeheader(); w.writerows(srow)
        print(f'Wrote counties_vs_forecast.csv ({len(crow)} rows) and county_summary.csv ({len(srow)} races).')
    else:
        print('No county results matched yet.')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--index', default='https://onpointpolitics.us/results/2026/index.json')
    ap.add_argument('--out', default='results_out')
    ap.add_argument('--civic-dir', default=None)
    ap.add_argument('--counties', action='store_true')
    ap.add_argument('--counties-url', default='https://onpointpolitics.us/forecast/counties.json')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    idx = load_index(a.index)
    fore = [r for r in idx['races'] if r.get('k') in ('sen', 'gov', 'house')]
    civ = load_civic(a.out, a.civic_dir)
    by = {}
    for c in civ:
        p = (c.get('province') or '').upper()
        if p and p != 'US':
            by.setdefault(p, []).append(c)
    rows = []; matched = {}
    for fr in fore:
        cr = match(fr, by.get(fr['st'], []))
        if cr: matched[fr['id']] = cr
        row = {'id': fr['id'], 'office': {'sen': 'Senate', 'gov': 'Governor', 'house': 'House'}[fr['k']], 'state': fr['st'], 'race': fr['nm'],
               'forecast_margin': round(fr['m'], 2), 'forecast_pR': fr['pR'],
               'forecast_favorite': 'R' if fr['pR'] > .5 else 'D', 'forecast_fav_chance': round(max(fr['pR'], 1 - fr['pR']), 3)}
        if not cr:
            row.update(status='not found in civicAPI'); rows.append(row); continue
        dv, rv, tot, dside, rside = read_sides(fr, cr)
        dvotes = (dv or {}).get('votes') or 0; rvotes = (rv or {}).get('votes') or 0
        winner = next((c for c in cr.get('candidates') or [] if c.get('winner')), None)
        called = winner is not None
        if winner is not None:
            wside = 'R' if rv is not None and winner is rv else ('D' if dv is not None and winner is dv else side(winner.get('party')))
        else:
            wside = None
        actual = round((rvotes - dvotes) / tot * 100, 2) if tot else None
        lead = None if actual is None else ('R' if actual > 0 else 'D')
        row.update(status='called' if called else 'counting', pct_reporting=cr.get('percent_reporting'),
                   d_name=(dside or [None])[0], d_votes=dvotes, r_name=(rside or [None])[0], r_votes=rvotes, total_votes=tot,
                   actual_margin=actual, error=None if actual is None else round(actual - fr['m'], 2),
                   leader=lead, winner_side=wside or lead, called_for=(winner or {}).get('name'),
                   forecast_right=None if (wside or lead) is None else int((wside or lead) == ('D' if fr['pR'] < .5 else 'R')),
                   civic_id=cr.get('id'))
        rows.append(row)
    keys = []
    for r in rows:
        for k in r:
            if k not in keys: keys.append(k)
    with open(os.path.join(a.out, 'results_vs_forecast.csv'), 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=keys); w.writeheader(); w.writerows(rows)
    summary = {}
    for off in ('Senate', 'Governor', 'House'):
        rs = [r for r in rows if r['office'] == off and r.get('actual_margin') is not None and (r.get('pct_reporting') or 0) >= 50]
        called = [r for r in rs if r['status'] == 'called']
        if not rs:
            summary[off] = {}; continue
        err = [r['error'] for r in rs]
        summary[off] = dict(races_with_votes=len(rs), called=len(called),
                            right=sum(r['forecast_right'] for r in called), wrong=[r['id'] for r in called if not r['forecast_right']],
                            mean_error=round(sum(err) / len(err), 2), mean_abs_error=round(sum(abs(e) for e in err) / len(err), 2),
                            biggest_misses=[(r['id'], r['forecast_margin'], r['actual_margin']) for r in sorted(rs, key=lambda r: -abs(r['error']))[:8]])
    json.dump({'summary': summary, 'rows': rows}, open(os.path.join(a.out, 'results_vs_forecast.json'), 'w', encoding='utf-8'), indent=1)
    print('\nSummary, races with at least 50% reporting. Error is actual minus forecast margin; negative means Democrats beat the forecast.')
    for off, s in summary.items():
        if not s: print(off, 'no data yet'); continue
        print(f"{off}: {s['called']} called of {s['races_with_votes']}, forecast favorite won {s['right']} of {s['called']}, "
              f"mean error {s['mean_error']:+.2f}, mean absolute error {s['mean_abs_error']:.2f}")
        if s['wrong']: print('  missed:', ', '.join(s['wrong']))
    print(f"\nWrote {os.path.join(a.out, 'results_vs_forecast.csv')} and .json.")
    if a.counties:
        print('\nCounty by county: one civicAPI read per race, about 500 reads, a few minutes. Reruns reuse saved reads.')
        county_compare(fore, matched, a.out, a.civic_dir, a.counties_url)
    print('Send me the results_out folder zipped, or results_vs_forecast.csv plus county_summary.csv.')


if __name__ == '__main__':
    main()
