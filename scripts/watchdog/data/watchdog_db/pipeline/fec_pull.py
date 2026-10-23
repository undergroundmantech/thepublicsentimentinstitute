"""FEC pipeline for the On Point Politics watchdog database.

Pulls, for every federal subject in roster/master_roster.csv:
  hop 1 money in:  candidate totals, every PAC, party and committee receipt, individuals at $5,000 and up
                   in aggregate, top employers, self funding, unitemized small dollar total
  hop 1 money out: top vendors by recipient, leadership PAC gifts to other candidates
  outside money:   independent expenditures for and against the subject, by committee
  hop 2:           top funders of each outside group over $100,000, and where the subject's top PAC donors
                   also give
Writes into each person folder: edges_fec.csv, fec_meta.json, fec_summary.md, and raw JSON under fec_raw/.
Then run: python3 scripts/build_all.py   to rebuild boards, the master ledger and the index.

Setup in the Codespace:
  pip install requests
  export FEC_API_KEY=your_key        free at https://api.data.gov/signup/
  python3 pipeline/fec_pull.py --priority 1,2,3 --limit 50     try a small batch first
  python3 pipeline/fec_pull.py                                    everyone, resumable

A standard key allows 1,000 calls an hour. Email APIinfo@fec.gov to ask for the 7,200 an hour tier and pass
--rate 7000. Every response is cached under pipeline/cache, so a rerun after a stop only fetches what is missing.
Use --refresh to ignore the cache after a new filing deadline.
"""
import argparse, csv, hashlib, json, os, re, sys, time, collections, datetime
try:
    import requests
except ImportError:
    sys.exit('pip install requests first')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blocs import tag_bloc

API = 'https://api.open.fec.gov/v1'
CACHE = os.path.join(ROOT, 'pipeline', 'cache')
CYCLE = 2026
EDGE_FIELDS = ['subject_id', 'donor_or_entity', 'type', 'amount', 'amount_usd', 'cumulative', 'date_or_as_of', 'recipient_vehicle',
               'interest_bloc', 'source', 'hop', 'status', 'note']
ENTITY_TYPE = {'PAC': 'PAC', 'COM': 'Political committee', 'PTY': 'Party', 'CCM': 'Candidate transfer', 'ORG': 'Corporation',
               'CAN': 'Self funding', 'IND': 'Individual'}


class FEC:
    def __init__(self, key, rate, refresh=False):
        self.key, self.gap, self.refresh, self.last, self.calls = key, 3600.0 / rate, refresh, 0.0, 0
        os.makedirs(CACHE, exist_ok=True)

    def get(self, path, **params):
        params = {k: v for k, v in params.items() if v not in (None, '')}
        h = hashlib.sha1((path + json.dumps(params, sort_keys=True)).encode()).hexdigest()
        cp = os.path.join(CACHE, h[:2], h + '.json')
        if os.path.exists(cp) and not self.refresh:
            return json.load(open(cp, encoding='utf-8'))
        params['api_key'] = self.key
        for attempt in range(6):
            wait = self.last + self.gap - time.time()
            if wait > 0:
                time.sleep(wait)
            self.last = time.time()
            try:
                r = requests.get(API + path, params=params, timeout=60)
            except requests.RequestException as ex:
                print('  network error', ex); time.sleep(10 * (attempt + 1)); continue
            self.calls += 1
            if r.status_code == 429:
                print('  rate limited, sleeping 5 minutes'); time.sleep(300); continue
            if r.status_code >= 500:
                time.sleep(15 * (attempt + 1)); continue
            if r.status_code != 200:
                print('  HTTP', r.status_code, path, r.text[:200]); return {'results': [], 'error': r.status_code}
            data = r.json()
            os.makedirs(os.path.dirname(cp), exist_ok=True)
            json.dump(data, open(cp, 'w', encoding='utf-8'))
            return data
        return {'results': [], 'error': 'gave up'}

    def pages(self, path, max_pages=5, **params):
        """Keyset pagination for schedule endpoints, page pagination for others."""
        out, p = [], dict(params)
        for _ in range(max_pages):
            d = self.get(path, **p)
            res = d.get('results', [])
            out += res
            pg = d.get('pagination', {})
            li = pg.get('last_indexes')
            if li:
                if not res or len(res) < int(p.get('per_page', 20)):
                    break
                p.update(li)
            else:
                if pg.get('page', 1) >= pg.get('pages', 1):
                    break
                p['page'] = pg.get('page', 1) + 1
        return out


def money(v):
    return f'${v:,.0f}'


def norm(s):
    return re.sub(r'[^a-z ]', '', (s or '').lower())


def resolve_candidates(fec, r):
    """Return list of (candidate_id, confidence). Uses roster IDs when present, else searches by name."""
    office = r['office_sought_2026'] or r['current_office']
    want = 'S' if 'Senate' in office else 'H' if 'House' in office else None
    ids = [x for x in r['fec_ids'].split(';') if x]
    if ids:
        if want:
            pref = [i for i in ids if i.startswith(want)]
            if pref:
                return [(pref[0], 'roster')]
        return [(ids[0], 'roster')]
    if not want:
        return []
    parts = r['name'].replace('.', '').split()
    last = [p for p in parts if p.lower() not in ('jr', 'sr', 'ii', 'iii', 'iv')][-1]
    d = fec.get('/candidates/search/', q=last, state=r['state'],
                office=want, election_year=CYCLE, per_page=50)
    best = []
    first = norm(parts[0])
    for c in d.get('results', []):
        nm = norm(c.get('name'))
        score = 0
        if norm(last) in nm:
            score += 2
        if first and first[:4] in nm:
            score += 2
        if want == 'H' and r['district_sought'] and r['district_sought'] not in ('', 'AL'):
            if str(c.get('district', '')).lstrip('0') == r['district_sought'].lstrip('0'):
                score += 2
        if CYCLE in (c.get('election_years') or []):
            score += 1
        best.append((score, c['candidate_id']))
    best.sort(reverse=True)
    if best and best[0][0] >= 5:
        conf = 'search, strong' if (len(best) == 1 or best[0][0] > best[1][0]) else 'search, tie'
        return [(best[0][1], conf)]
    return [(best[0][1], 'search, weak')] if best and best[0][0] >= 4 else []


def edge(sid, donor, typ, amt, date, recv, bloc, src, hop, note, cumulative='no', status='Confirmed'):
    return dict(subject_id=sid, donor_or_entity=donor, type=typ, amount=money(amt) if amt else '', amount_usd=f'{amt:.0f}' if amt else '',
                cumulative=cumulative, date_or_as_of=date, recipient_vehicle=recv, interest_bloc=bloc, source=src, hop=str(hop),
                status=status, note=note)


def pull_person(fec, r, args, pac_cache):
    sid = r['person_id']
    folder = os.path.join(ROOT, 'people', r['state'], sid)
    os.makedirs(folder, exist_ok=True)
    cands = resolve_candidates(fec, r)
    if not cands:
        return 'no FEC match'
    cid, conf = cands[0]
    cand_url = f'https://www.fec.gov/data/candidate/{cid}/?cycle={CYCLE}'
    edges, vehicles, summary = [], [], []
    # committees
    cm = fec.get(f'/candidate/{cid}/committees/', cycle=CYCLE, per_page=50).get('results', [])
    lp = fec.get('/committees/', sponsor_candidate_id=cid, per_page=50).get('results', [])
    principal = None
    for c in cm + lp:
        des = c.get('designation') or ''
        kind = {'P': 'principal campaign committee', 'A': 'authorized committee', 'J': 'joint fundraising committee', 'D': 'leadership PAC'}.get(des, c.get('committee_type_full', 'committee'))
        if c in lp:
            kind = 'leadership PAC'
        v = dict(name=c.get('name'), id='FEC ' + c['committee_id'], kind=kind, treasurer=c.get('treasurer_name') or '')
        if v not in vehicles:
            vehicles.append(v)
        if des == 'P' and not principal:
            principal = c
        if c.get('treasurer_name'):
            edges.append(edge(sid, c['treasurer_name'], 'Relationship', 0, f'as of {datetime.date.today()}', c.get('name'), 'Party and leadership',
                              f"https://www.fec.gov/data/committee/{c['committee_id']}/", 1, f'Treasurer of {kind}'))
    if not principal and cm:
        principal = cm[0]
    if not principal:
        return f'{cid} has no committee for {CYCLE}'
    pid, pname = principal['committee_id'], principal['name']
    # totals
    tot = (fec.get(f'/candidate/{cid}/totals/', cycle=CYCLE, election_full='false').get('results') or [{}])[0]
    rec, cash, endd = tot.get('receipts') or 0, tot.get('last_cash_on_hand_end_period') or 0, (tot.get('coverage_end_date') or '')[:10]
    unit = tot.get('individual_unitemized_contributions') or 0
    selfc = (tot.get('candidate_contribution') or 0)
    loans = (tot.get('loans_made_by_candidate') or 0)
    pacs = tot.get('other_political_committee_contributions') or 0
    party = tot.get('political_party_committee_contributions') or 0
    summary.append(f"Candidate ID {cid}, matched by {conf}. Principal committee {pname}, FEC {pid}, treasurer {principal.get('treasurer_name') or 'not listed'}.")
    summary.append(f"2025 to {CYCLE} cycle through {endd or 'latest report'}: raised {money(rec)}, spent {money(tot.get('disbursements') or 0)}, cash on hand {money(cash)}. "
                   f"Itemized individuals {money(tot.get('individual_itemized_contributions') or 0)}, small unitemized {money(unit)}, PACs and other committees {money(pacs)}, "
                   f"party {money(party)}, candidate's own contributions {money(selfc)} and loans {money(loans)}. Source: {cand_url}")
    if unit:
        edges.append(edge(sid, 'Unitemized small donors, under $200 each', 'Individual', unit, f'cycle to {endd}', pname, 'Small donors', cand_url, 1, 'Aggregate from FEC totals', 'yes'))
    if selfc or loans:
        edges.append(edge(sid, r['name'], 'Self funding', selfc + loans, f'cycle to {endd}', pname, 'Self funding', cand_url, 1,
                          f'Contributions {money(selfc)} and loans {money(loans)}', 'yes'))
    # receipts from committees
    sa = fec.pages('/schedules/schedule_a/', max_pages=args.pages, committee_id=pid, two_year_transaction_period=CYCLE,
                   is_individual='false', sort='-contribution_receipt_amount', per_page=100)
    agg = collections.defaultdict(lambda: dict(amt=0.0, n=0, last='', src='', etype='', cid=''))
    for x in sa:
        if (x.get('memo_code') or '') == 'X':
            continue
        k = x.get('contributor_name') or ''
        a = agg[k]; a['amt'] += x.get('contribution_receipt_amount') or 0; a['n'] += 1
        d = (x.get('contribution_receipt_date') or '')[:10]
        if d > a['last']:
            a['last'] = d; a['src'] = x.get('pdf_url') or cand_url
        a['etype'] = x.get('entity_type') or a['etype']; a['cid'] = x.get('contributor_id') or a['cid']
    top_pacs = []
    for name, a in sorted(agg.items(), key=lambda kv: -kv[1]['amt']):
        if a['amt'] <= 0:
            continue
        typ = ENTITY_TYPE.get(a['etype'], 'PAC')
        bloc = tag_bloc(name, typ)
        edges.append(edge(sid, name, typ, a['amt'], f"{a['n']} receipts, latest {a['last']}", pname, bloc, a['src'], 1,
                          f"FEC Schedule A sum this cycle; committee ID {a['cid'] or 'n/a'}", 'yes' if a['n'] > 1 else 'no'))
        if a['cid'] and typ in ('PAC', 'Political committee'):
            top_pacs.append((a['amt'], name, a['cid'], bloc))
    # individuals at $5,000 and up in aggregate
    si = fec.pages('/schedules/schedule_a/', max_pages=args.pages, committee_id=pid, two_year_transaction_period=CYCLE,
                   is_individual='true', min_amount=1000, sort='-contribution_receipt_amount', per_page=100)
    ind = collections.defaultdict(lambda: dict(amt=0.0, n=0, emp='', last='', src=''))
    for x in si:
        if (x.get('memo_code') or '') == 'X':
            continue
        k = (x.get('contributor_name') or '', x.get('contributor_state') or '')
        a = ind[k]; a['amt'] += x.get('contribution_receipt_amount') or 0; a['n'] += 1
        a['emp'] = a['emp'] or (x.get('contributor_employer') or '')
        d = (x.get('contribution_receipt_date') or '')[:10]
        if d > a['last']:
            a['last'] = d; a['src'] = x.get('pdf_url') or cand_url
    for (name, st), a in sorted(ind.items(), key=lambda kv: -kv[1]['amt']):
        if a['amt'] < 5000:
            continue
        bloc = tag_bloc(a['emp'], 'Individual', fallback='Large individual donors')
        edges.append(edge(sid, f"{name}, {a['emp']}".strip(', '), 'Individual', a['amt'], f"{a['n']} receipts, latest {a['last']}", pname, bloc, a['src'], 1,
                          f'Employer as filed: {a["emp"] or "not given"}; donor state {st}', 'yes' if a['n'] > 1 else 'no'))
    # top employers, an industry proxy
    emp = fec.get('/schedules/schedule_a/by_employer/', committee_id=pid, cycle=CYCLE, sort='-total', per_page=25).get('results', [])
    emp_lines = [f"{e.get('employer')}: {money(e.get('total') or 0)} from {e.get('count')} receipts" for e in emp
                 if e.get('employer') and norm(e.get('employer')) not in ('retired', 'none', 'not employed', 'self employed', 'selfemployed', 'information requested', 'na', 'homemaker')][:12]
    # vendors
    vend = fec.get('/schedules/schedule_b/by_recipient/', committee_id=pid, cycle=CYCLE, sort='-total', per_page=25).get('results', [])
    for v in vend[:args.vendors]:
        if not v.get('total'):
            continue
        edges.append(edge(sid, pname, 'Vendor payment', v['total'], f'cycle {CYCLE}', v.get('recipient_name'), 'Campaign vendors',
                          f'https://www.fec.gov/data/disbursements/?committee_id={pid}&two_year_transaction_period={CYCLE}', 1,
                          f"{v.get('count')} payments, FEC Schedule B by recipient", 'yes'))
    # leadership PAC gifts out
    for c in lp:
        out = fec.get('/schedules/schedule_b/by_recipient/', committee_id=c['committee_id'], cycle=CYCLE, sort='-total', per_page=40).get('results', [])
        for v in out[:25]:
            edges.append(edge(sid, c['name'], 'PAC', v.get('total') or 0, f'cycle {CYCLE}', v.get('recipient_name'), 'Party and leadership',
                              f"https://www.fec.gov/data/disbursements/?committee_id={c['committee_id']}&two_year_transaction_period={CYCLE}", 1,
                              'Leadership PAC disbursement to this recipient, may include vendors', 'yes'))
    # independent expenditures
    ie = fec.get('/schedules/schedule_e/by_candidate/', candidate_id=cid, cycle=CYCLE, per_page=100, sort='-total').get('results', [])
    outside = []
    for x in ie:
        if not x.get('total'):
            continue
        so = 'for' if x.get('support_oppose_indicator') == 'S' else 'against'
        nm = x.get('committee_name') or x.get('committee_id')
        edges.append(edge(sid, nm, f'Independent expenditure {so}', x['total'], f'cycle {CYCLE}', r['name'], tag_bloc(nm, 'Super PAC'),
                          f"https://www.fec.gov/data/independent-expenditures/?committee_id={x.get('committee_id')}&candidate_id={cid}&cycle={CYCLE}", 1,
                          f'Independent expenditures {so} the subject, FEC Schedule E total', 'yes'))
        outside.append((x['total'], nm, x.get('committee_id'), so))
    # hop 2a: funders of the biggest outside groups
    for total, nm, ocid, so in sorted(outside, reverse=True)[:args.outside]:
        if not ocid:
            continue
        key = ('funders', ocid)
        if key not in pac_cache:
            pac_cache[key] = fec.get('/schedules/schedule_a/', committee_id=ocid, two_year_transaction_period=CYCLE,
                                     sort='-contribution_receipt_amount', per_page=60).get('results', [])
        fa = collections.defaultdict(lambda: [0.0, '', '', ''])
        for x in pac_cache[key]:
            if (x.get('memo_code') or '') == 'X':
                continue
            f = fa[x.get('contributor_name') or '']
            f[0] += x.get('contribution_receipt_amount') or 0
            f[1] = max(f[1], (x.get('contribution_receipt_date') or '')[:10]); f[2] = x.get('pdf_url') or f[2]
            f[3] = x.get('contributor_employer') or x.get('entity_type') or f[3]
        for fn, (amt, d, src, emp_) in sorted(fa.items(), key=lambda kv: -kv[1][0])[:10]:
            if amt < 100000:
                break
            edges.append(edge(sid, fn, 'Individual' if emp_ and emp_ not in ENTITY_TYPE else ENTITY_TYPE.get(emp_, 'PAC'), amt, f'latest {d}', nm,
                              tag_bloc(f'{fn} {emp_}', 'Individual', fallback='Billionaire megadonor' if amt >= 1e6 else 'Large individual donors'),
                              src or f'https://www.fec.gov/data/committee/{ocid}/', 2, f'Funder of an outside group that spent {so} the subject; largest receipts in the top 60 rows', 'yes'))
    # hop 2b: where the top PAC donors also give
    for amt, nm, pcid, bloc in sorted(top_pacs, reverse=True)[:args.sideways]:
        key = ('gives', pcid)
        if key not in pac_cache:
            pac_cache[key] = fec.get('/schedules/schedule_b/by_recipient/', committee_id=pcid, cycle=CYCLE, sort='-total', per_page=15).get('results', [])
        for v in pac_cache[key][:8]:
            rn = v.get('recipient_name') or ''
            if norm(rn) == norm(pname) or not v.get('total'):
                continue
            edges.append(edge(sid, nm, 'PAC', v['total'], f'cycle {CYCLE}', rn, bloc,
                              f'https://www.fec.gov/data/disbursements/?committee_id={pcid}&two_year_transaction_period={CYCLE}', 2,
                              'Where this donor PAC also sends money this cycle', 'yes'))
    # write
    with open(os.path.join(folder, 'edges_fec.csv'), 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=EDGE_FIELDS); w.writeheader(); w.writerows(edges)
    blocs = collections.Counter()
    for e in edges:
        if e['hop'] == '1' and e['amount_usd'] and e['interest_bloc'] not in ('Campaign vendors', 'Small donors', 'Self funding', 'Party and leadership', 'Unresolved PAC', 'Large individual donors'):
            blocs[e['interest_bloc']] += float(e['amount_usd'])
    meta = dict(candidate_id=cid, match=conf, vehicles=vehicles, top_blocs=[b for b, _ in blocs.most_common(3)],
                headline_total=dict(amount_usd=rec, label=f'raised by the campaign this cycle', as_of=endd, source=cand_url), pulled=datetime.date.today().isoformat())
    json.dump(meta, open(os.path.join(folder, 'fec_meta.json'), 'w', encoding='utf-8'), indent=2)
    S = ['### From FEC filings', '', *summary, '']
    if blocs:
        S.append('Largest identified blocs in direct PAC and large donor money, by dollars: ' + '; '.join(f'{b} {money(v)}' for b, v in blocs.most_common(6)) + '.')
        S.append('Bloc tags in pipeline rows come from keyword matching on donor names and employers. Check them before publishing.')
    if emp_lines:
        S += ['', 'Top employers of individual donors: ' + '; '.join(emp_lines) + '.']
    if outside:
        S += ['', 'Outside spending: ' + '; '.join(f'{n} {money(t)} {so}' for t, n, _, so in sorted(outside, reverse=True)[:8]) + '.']
    if vend:
        S += ['', 'Largest vendors: ' + '; '.join(f"{v.get('recipient_name')} {money(v.get('total') or 0)}" for v in vend[:8] if v.get('total')) + '.']
    S += ['', f'Pipeline rows: {len(edges)} in edges_fec.csv, pulled {meta["pulled"]}. All amounts are cycle sums and labeled cumulative where more than one receipt is summed.']
    if conf.startswith('search'):
        S.append(f'Caution: the FEC candidate ID was matched by name search with confidence "{conf}". Confirm it before publishing.')
    open(os.path.join(folder, 'fec_summary.md'), 'w', encoding='utf-8').write('\n'.join(S) + '\n')
    return f'{cid} ok, {len(edges)} rows'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--priority', default='1,2,3,4', help='comma list of research priorities to include')
    ap.add_argument('--only', default='', help='comma list of person_ids')
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--rate', type=float, default=950, help='calls per hour')
    ap.add_argument('--pages', type=int, default=3, help='pages of 100 rows for each schedule A pull')
    ap.add_argument('--vendors', type=int, default=15)
    ap.add_argument('--outside', type=int, default=4, help='outside groups to trace funders for')
    ap.add_argument('--sideways', type=int, default=5, help='top PAC donors to trace other recipients for')
    ap.add_argument('--refresh', action='store_true')
    ap.add_argument('--skip-done', action='store_true', help='skip people who already have fec_meta.json')
    args = ap.parse_args()
    key = os.environ.get('FEC_API_KEY')
    if not key:
        sys.exit('Set FEC_API_KEY first. Free key: https://api.data.gov/signup/')
    fec = FEC(key, args.rate, args.refresh)
    roster = list(csv.DictReader(open(os.path.join(ROOT, 'roster', 'master_roster.csv'), encoding='utf-8')))
    pr = set(args.priority.split(','))
    only = set(x for x in args.only.split(',') if x)
    todo = [r for r in roster if (r['research_priority'] in pr) and (not only or r['person_id'] in only)
            and ('House' in (r['office_sought_2026'] + r['current_office']) or 'Senate' in (r['office_sought_2026'] + r['current_office']))]
    if args.skip_done:
        todo = [r for r in todo if not os.path.exists(os.path.join(ROOT, 'people', r['state'], r['person_id'], 'fec_meta.json'))]
    if args.limit:
        todo = todo[:args.limit]
    print(f'{len(todo)} federal subjects to pull')
    log = open(os.path.join(ROOT, 'pipeline', 'fec_run_log.csv'), 'a', newline='', encoding='utf-8')
    lw = csv.writer(log)
    pac_cache = {}
    for i, r in enumerate(todo, 1):
        try:
            res = pull_person(fec, r, args, pac_cache)
        except Exception as ex:
            res = f'error {ex}'
        print(f'[{i}/{len(todo)}] {r["person_id"]}: {res}  calls so far {fec.calls}')
        lw.writerow([datetime.datetime.now().isoformat(timespec='seconds'), r['person_id'], res]); log.flush()
    print('Done. Now run: python3 scripts/build_all.py')


if __name__ == '__main__':
    main()
