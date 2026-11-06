#!/usr/bin/env python3
"""On Point Politics: 2026 state legislative results vs. the final forecast.

Pulls every State Senate and State House chamber result for Nov. 3, 2026 from civicAPI, district by district,
and compares each district and each chamber to the final On Point state legislative forecast,
public/forecast/statehouse.json.

Run, from the repo root:
        pip install requests
        python3 compare_legislature.py
Options:
        --forecast PATH_OR_URL   forecast file, default public/forecast/statehouse.json,
                                 or https://onpointpolitics.us/forecast/statehouse.json
        --out DIR                output folder, default ./leg_results_out
        --civic-dir DIR          read saved civicAPI JSON instead of the network, for an offline rerun

Writes:
        leg_districts_vs_forecast.csv   one row per district: forecast margin and odds, actual votes, margin, seats won
        leg_chambers_vs_forecast.csv    one row per chamber: forecast seats and control odds against seats won
        leg_unmatched.csv               districts the tool could not pair, both directions, to check by hand
        civic_raw/                      every civicAPI read, so the run can be repeated offline
Margins are Republican minus Democratic, in points of all votes cast. Negative means the Democratic side leads.
Send back the leg_results_out folder, zipped.
"""
import argparse, csv, json, os, re, sys, time

try:
    import requests
except ImportError:
    requests = None

API = 'https://civicapi.org/api/v2'
TYPES = ['State Senate', 'State House']
UA = {'User-Agent': 'OnPointPolitics-legislature-compare/1.0', 'accept': 'application/json'}
HOUSE_WORDS = ('house', 'assembly', 'delegates', 'legislature')
ORD = {'FIRST': '1', 'SECOND': '2', 'THIRD': '3', 'FOURTH': '4', 'FIFTH': '5', 'SIXTH': '6', 'SEVENTH': '7', 'EIGHTH': '8',
       'NINTH': '9', 'TENTH': '10', 'ELEVENTH': '11', 'TWELFTH': '12', 'THIRTEENTH': '13', 'FOURTEENTH': '14', 'FIFTEENTH': '15',
       'SIXTEENTH': '16', 'SEVENTEENTH': '17', 'EIGHTEENTH': '18', 'NINETEENTH': '19', 'TWENTIETH': '20'}


def get_json(url, tries=5):
    if requests is None:
        sys.exit('Install requests first: pip install requests')
    for k in range(tries):
        try:
            r = requests.get(url, headers=UA, timeout=90)
            if r.status_code == 200:
                return r.json()
            print(f'  {r.status_code} from {url[:100]}, retrying', file=sys.stderr)
        except requests.RequestException as e:
            print(f'  {e.__class__.__name__}, retrying', file=sys.stderr)
        time.sleep(2 * (k + 1))
    sys.exit(f'Could not read {url}')


def cached(path, url, offline):
    if os.path.exists(path):
        return json.load(open(path, encoding='utf-8'))
    if offline:
        return None
    j = get_json(url)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(j, open(path, 'w', encoding='utf-8'))
    time.sleep(0.3)
    return j


def side(party):
    p = str(party or '').strip().lower()
    if p.startswith('democratic / republican') or p.startswith('democratic/republican'):
        return 'O'
    if p.startswith('dem') or p in ('working families', 'democratic farmer labor', 'dfl'):
        return 'D'
    if p.startswith('rep'):
        return 'R'
    return 'O'


def key(name):
    """Normalized district name: upper case, no 'district', ordinals as numbers, leading zeros dropped."""
    s = str(name or '').upper().replace('&', ' AND ')
    s = re.sub(r'\b(STATE )?(SENATE|HOUSE|ASSEMBLY|LEGISLATIVE|REPRESENTATIVE)?\s*DISTRICT\b', ' ', s)
    s = re.sub(r'\bDIST\b\.?', ' ', s)
    s = re.sub(r'[^A-Z0-9 \-]+', ' ', s)
    s = ' '.join(ORD.get(t, t) for t in s.split())
    s = re.sub(r'\b(\d+)(ST|ND|RD|TH)\b', r'\1', s)
    s = re.sub(r'\b0+(\d)', r'\1', s)
    return re.sub(r'\s+', ' ', s).strip()


def tokens(name):
    return frozenset(t for t in re.split(r'[ \-]+', key(name)) if t and t != 'AND')


def base_num(name):
    """'1-2', '1A', 'POSITION 2 OF DISTRICT 1' and the like back to the district number, for multi seat districts."""
    m = re.match(r'^(\d+)', key(name))
    return m.group(1) if m else None


def load_forecast(src):
    if re.match(r'https?://', src):
        return get_json(src)
    return json.load(open(src, encoding='utf-8'))


def search(t, raw, offline):
    races, off = [], 0
    while True:
        url = f'{API}/race/search?startDate=2026-11-03&endDate=2026-11-03&limit=200&offset={off}&type={requests.utils.quote(t) if requests else t}'
        j = cached(os.path.join(raw, f'search_{re.sub(r"\W+", "_", t)}_{off}.json'), url, offline)
        if not j:
            break
        got = j.get('races', [])
        races += got
        print(f'civicAPI: {t}, offset {off}, {len(got)} races')
        if len(got) < 200:
            break
        off += 200
    return races


def district_rows(detail):
    """One entry per district: name, percent reporting, party votes and seats."""
    out = []
    for k, v in (detail.get('region_results') or {}).items():
        name = v.get('name') or k.replace('district_', 'District ')
        votes = {'D': 0, 'R': 0, 'O': 0}; seats = {'D': 0, 'R': 0, 'O': 0}; seat_field = False; cands = []
        for c in v.get('candidates') or []:
            s = side(c.get('party')); n = c.get('votes') or 0
            votes[s] += n
            if c.get('seats') is not None:
                seat_field = True; seats[s] += int(c.get('seats') or 0)
            if c.get('winner'):
                seat_field = True; seats[s] += 0 if c.get('seats') else 1
            cands.append((c.get('name'), s, n))
        out.append(dict(name=name, key=key(name), tokens=tokens(name), num=base_num(name), pct=v.get('percent_reporting'),
                        votes=votes, seats=seats, seat_field=seat_field, cands=cands))
    return out


def match_districts(fd, cd):
    """Pair forecast districts with civicAPI districts: exact key, then token set, then shared district number."""
    pairs, used = {}, set()
    by_key = {}
    for i, c in enumerate(cd):
        by_key.setdefault(c['key'], []).append(i)
    by_tok = {}
    for i, c in enumerate(cd):
        by_tok.setdefault(c['tokens'], []).append(i)
    for f in fd:
        k = key(f['d'])
        hit = [i for i in by_key.get(k, []) if i not in used] or [i for i in by_tok.get(tokens(f['d']), []) if i not in used]
        if hit:
            pairs[f['d']] = hit[0]; used.add(hit[0])
    # several forecast seats in one reported district, such as Washington's 1-1 and 1-2 or Idaho's 1A and 1B
    for f in fd:
        if f['d'] in pairs:
            continue
        n = base_num(f['d'])
        if n is None:
            continue
        hit = [i for i, c in enumerate(cd) if c['key'] == n]
        if hit:
            pairs[f['d']] = hit[0]
    return pairs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--forecast', default='public/forecast/statehouse.json')
    ap.add_argument('--out', default='leg_results_out')
    ap.add_argument('--civic-dir', default=None)
    a = ap.parse_args()
    out = a.out; os.makedirs(out, exist_ok=True)
    raw = a.civic_dir or os.path.join(out, 'civic_raw'); offline = bool(a.civic_dir)
    fore = load_forecast(a.forecast)
    F = {c['id']: c for c in fore['chambers']}
    pool = []
    for t in TYPES:
        pool += [dict(r, _type=t) for r in search(t, raw, offline)]
    chambers_found = {}
    for r in pool:
        if str(r.get('election_type') or '').lower() != 'statewide':
            continue
        st = r.get('province'); nm = str(r.get('election_name') or '').lower()
        ch = 'senate' if 'senate' in nm else 'house' if any(w in nm for w in HOUSE_WORDS) else None
        cid = f'sl-{st}-{ch}'
        if ch and cid in F and cid not in chambers_found:
            chambers_found[cid] = r
    drows, crows, unmatched = [], [], []
    for cid, c in sorted(F.items()):
        r = chambers_found.get(cid)
        hold = c.get('hold') or {}
        base = dict(chamber=cid, state=c['st'], name=c['name'], seats=c['seats'], up=c['up'], majority=c['majority'],
                    forecast_dem_seats=c['demSeats'], forecast_gop_seats=c['gopSeats'], forecast_p10=c['p10'], forecast_p90=c['p90'],
                    forecast_dem_control=c['demControl'], forecast_gop_control=c['gopControl'], forecast_tie=c.get('tie'),
                    holdover_D=hold.get('D', 0), holdover_R=hold.get('R', 0), holdover_O=hold.get('O', 0))
        if not r:
            crows.append(dict(base, civic_id='', status='not found in civicAPI')); continue
        det = cached(os.path.join(raw, 'race', f'{r["id"]}.json'), f'{API}/race/{r["id"]}', offline)
        if not det:
            crows.append(dict(base, civic_id=r['id'], status='no detail read')); continue
        cd = district_rows(det)
        pairs = match_districts(c['districts'], cd)
        won = {'D': 0, 'R': 0, 'O': 0}; leaders_only = 0; nm = 0; npct = []
        shared = {}
        for f in c['districts']:
            if f['d'] in pairs:
                shared.setdefault(pairs[f['d']], []).append(f)
        for f in c['districts']:
            i = pairs.get(f['d'])
            if i is None:
                unmatched.append(dict(chamber=cid, side='forecast', district=f['d'], status=f.get('status'))); continue
            x = cd[i]; nm += 1
            group = shared.get(i, [f]); share = 1.0 / len(group)
            v = x['votes']; tot = sum(v.values())
            am = round((v['R'] - v['D']) / tot * 100, 2) if tot else None
            fm = f.get('margin')
            # seats won in this forecast district: the district's reported seats, split evenly when several
            # forecast seats share one reported district; without seat fields, the vote leader takes the seat
            if x['seat_field'] and sum(x['seats'].values()) > 0:
                sw = {p: x['seats'][p] * share for p in 'DRO'}; how = 'reported'
            elif tot:
                lead = max('DRO', key=lambda p: v[p]); sw = {p: (f['seats'] if p == lead else 0) for p in 'DRO'}; how = 'vote leader'; leaders_only += 1
            else:
                sw = {p: 0 for p in 'DRO'}; how = 'no votes'
            for p in 'DRO':
                won[p] += sw[p]
            if x['pct'] is not None:
                npct.append(float(x['pct']))
            fparty = None if fm is None else ('R' if fm > 0 else 'D')
            if fm is None:
                fparty = 'D' if (f.get('probD') or 0) >= 0.5 else 'R'
            aparty = max('DRO', key=lambda p: sw[p]) if sum(sw.values()) else None
            drows.append(dict(chamber=cid, district=f['d'], civic_district=x['name'], seats=f['seats'], status=f.get('status'),
                              forecast_margin=fm, forecast_prob_d=f.get('probD'), forecast_party=fparty,
                              d_votes=v['D'], r_votes=v['R'], other_votes=v['O'], total_votes=tot, actual_margin=am,
                              error=(round(am - fm, 2) if am is not None and fm is not None and abs(fm) < 99.9 else None),
                              pct_reporting=x['pct'], seats_D=round(sw['D'], 3), seats_R=round(sw['R'], 3), seats_O=round(sw['O'], 3),
                              seat_source=how, actual_party=aparty, called_right=(None if aparty is None else int(aparty == fparty)),
                              shared_district=len(group)))
        for i, x in enumerate(cd):
            if i not in pairs.values():
                unmatched.append(dict(chamber=cid, side='civicAPI', district=x['name'], status=f"pct {x['pct']}"))
        dS = won['D'] + base['holdover_D']; rS = won['R'] + base['holdover_R']; oS = won['O'] + base['holdover_O']
        ctrl = 'D' if dS >= c['majority'] else 'R' if rS >= c['majority'] else 'none yet'
        fav = 'D' if c['demControl'] > c['gopControl'] else 'R'
        crows.append(dict(base, civic_id=r['id'], status='read', civic_pct=r.get('percent_reporting'), districts_forecast=len(c['districts']),
                          districts_matched=nm, districts_civic=len(cd), districts_vote_leader_only=leaders_only,
                          median_district_pct=(sorted(npct)[len(npct) // 2] if npct else None),
                          actual_dem_seats=round(dS, 2), actual_gop_seats=round(rS, 2), actual_other_seats=round(oS, 2),
                          seat_error_dem=round(dS - c['demSeats'], 2), inside_80=int(c['p10'] <= dS <= c['p90']),
                          actual_control=ctrl, forecast_favorite=fav, control_right=(None if ctrl == 'none yet' else int(ctrl == fav))))
        print(f'{cid}: {nm} of {len(c["districts"])} districts matched, D {dS:.1f} R {rS:.1f} against forecast D {c["demSeats"]}')
    def write(fn, rows):
        if not rows:
            return
        keys = list(dict.fromkeys(k for r in rows for k in r))
        with open(os.path.join(out, fn), 'w', newline='', encoding='utf-8') as fh:
            w = csv.DictWriter(fh, fieldnames=keys); w.writeheader(); w.writerows(rows)
    write('leg_districts_vs_forecast.csv', drows); write('leg_chambers_vs_forecast.csv', crows); write('leg_unmatched.csv', unmatched)
    ok = [r for r in crows if r.get('status') == 'read']
    print(f'\n{len(ok)} of {len(crows)} chambers read, {len(drows)} districts matched, {len(unmatched)} unmatched rows')
    print(f'Send back the {out} folder, zipped.')


if __name__ == '__main__':
    main()
