"""Build or refresh the whole watchdog folder.
- Creates a folder for every person in roster/master_roster.csv that lacks one, with meta.json, profile.md, levers.csv.
- Hand researched folders, meaning a meta.json whose research_tier does not start with Queued, are never overwritten.
- Regenerates board.html wherever there are money edges, from edges.csv and edges_fec.csv.
- Writes ledger_master.csv, research_queue.csv and index.html at the root.
Run from anywhere: python3 scripts/build_all.py [ROOT]   ROOT defaults to the folder above scripts.
"""
import csv, json, os, sys, glob, datetime, html
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from levers_lib import levers_for
import make_board

ROOT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.dirname(HERE)
PEOPLE = os.path.join(ROOT, 'people')
TODAY = datetime.date.today().isoformat()
EDGE_FIELDS = ['subject_id', 'donor_or_entity', 'type', 'amount', 'amount_usd', 'cumulative', 'date_or_as_of', 'recipient_vehicle', 'interest_bloc', 'source', 'hop', 'status', 'note']
LEVER_FIELDS = ['decision', 'who_holds_it_now', 'when', 'which_donors_care', 'stake', 'subject_position', 'source']

roster = list(csv.DictReader(open(os.path.join(ROOT, 'roster', 'master_roster.csv'), encoding='utf-8')))
by_race = {}
for r in roster:
    if r['office_sought_2026']:
        for o in r['office_sought_2026'].split(' | '):
            k = (r['state'], o.replace(' special', ''), r['district_sought'] if o == 'U.S. House' else '')
            by_race.setdefault(k, []).append(r)


def opponents(r):
    out = []
    for o in (r['office_sought_2026'] or '').split(' | '):
        if not o:
            continue
        k = (r['state'], o.replace(' special', ''), r['district_sought'] if o == 'U.S. House' else '')
        out += [x for x in by_race.get(k, []) if x['person_id'] != r['person_id']]
    return out


def links(r):
    L = []
    for fid in [x for x in r['fec_ids'].split(';') if x]:
        L.append(f'FEC candidate {fid}: https://www.fec.gov/data/candidate/{fid}/')
    if r['opensecrets']:
        L.append(f"OpenSecrets: https://www.opensecrets.org/members-of-congress/summary?cid={r['opensecrets']}")
    if r['bioguide']:
        L.append(f"Congress.gov: https://www.congress.gov/member/{r['bioguide']}")
        L.append(f"Capitol Trades: https://www.capitoltrades.com/politicians/{r['bioguide']}")
        L.append(f"Quiver Quantitative: https://www.quiverquant.com/congresstrading/politician/{r['bioguide']}")
    L.append('Ballotpedia: https://ballotpedia.org/' + r['name'].replace(' ', '_'))
    if r['roster_source']:
        L.append('Roster source: ' + r['roster_source'])
    return L


def stub(r, folder):
    comms = [c.strip() for c in r['committees'].split(';') if c.strip()]
    office = r['office_sought_2026'] or r['current_office']
    if 'Sitting governor' in r['groups'] and 'Governor' not in office:
        office = 'Governor ' + office
    opp = opponents(r)
    fec_sum = os.path.join(folder, 'fec_summary.md')
    meta = dict(person_id=r['person_id'], name=r['name'], party=r['party'], state=r['state'],
                office_sought=r['office_sought_2026'], current_office=r['current_office'],
                opponents=[o['person_id'] for o in opp], vehicles=[], top_blocs=[],
                headline_total={}, research_tier='Queued, roster and office levers only', compiled=TODAY,
                next_filing='FEC pre general report covers through Oct 14, 2026; post general report due Dec 3, 2026',
                groups=r['groups'], competitive_rating=r['competitive_rating'], research_priority=r['research_priority'])
    if os.path.exists(os.path.join(folder, 'fec_meta.json')):
        fm = json.load(open(os.path.join(folder, 'fec_meta.json'), encoding='utf-8'))
        meta['vehicles'] = fm.get('vehicles', [])
        meta['headline_total'] = fm.get('headline_total', {})
        meta['top_blocs'] = fm.get('top_blocs', [])
        meta['research_tier'] = 'Queued, FEC pipeline data only'
    json.dump(meta, open(os.path.join(folder, 'meta.json'), 'w', encoding='utf-8'), indent=2)
    lv = levers_for(('Governor ' if 'Governor' in office else '') + office, comms)
    with open(os.path.join(folder, 'levers.csv'), 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=LEVER_FIELDS); w.writeheader()
        for d, who, b in lv:
            w.writerow(dict(decision=d, who_holds_it_now=who, when='', which_donors_care=b, stake='', subject_position='Not yet researched', source='Template from office and committee assignments'))
    P = [f"# {r['name']} Watchdog File", '',
         f"Subject: {r['name']}, {r['party']}, {r['state']}" + (f", running for {r['office_sought_2026']}" + (f" district {r['district_sought']}" if r['district_sought'] and r['district_sought'] not in ('', 'AL') else '') + ' in 2026' if r['office_sought_2026'] else ''),
         f"Current office: {r['current_office'] or 'none listed'}",
         f"Compiled: {TODAY} for the On Point Politics watchdog database, onpointpolitics.us",
         f"Status: queued for hand research, priority {r['research_priority']}. This file holds the roster facts, the office levers, and FEC pipeline data when the pipeline has run. It is not yet a finished Tier 2 profile.", '']
    P += ['## Race', '']
    if r['office_sought_2026']:
        P.append(f"Race status: {r['race_status'] or 'unknown'}. Rating: {r['competitive_rating'] or 'not rated in roster'}. Current holder of the seat: {r['incumbent_in_seat'] or 'not listed'}.")
        P.append('Opponents: ' + (', '.join(f"{o['name']}, {o['party']}" for o in opp) or 'none listed in roster') + '.')
    else:
        P.append('Not on the 2026 ballot. ' + (r['role'] or ''))
    if r['roster_note']:
        P.append('Roster note: ' + r['roster_note'])
    P += ['', '## Committee assignments', '']
    P += [f'- {c}' for c in comms] or ['None in the roster file. Governors and challengers have none.']
    P += ['', '## Money', '']
    if os.path.exists(fec_sum):
        P.append(open(fec_sum, encoding='utf-8').read().strip())
    else:
        P.append('Not yet pulled. Run pipeline/fec_pull.py for federal subjects. Governors and other state candidates need hand research in the state campaign finance system.')
    P += ['', '## Levers this office controls', '',
          'Template rows from the office and committee assignments. Each needs the specific decision, the date, and the subject position before it counts as a finding.', '',
          '| Decision | Where it sits | Which blocs care |', '|---|---|---|']
    P += [f'| {d} | {who} | {b} |' for d, who, b in lv]
    P += ['', '## Where to start', ''] + [f'- {x}' for x in links(r)]
    P += ['', '## What we could not verify', '', 'Everything beyond the roster row. This subject has not been hand researched yet.']
    open(os.path.join(folder, 'profile.md'), 'w', encoding='utf-8').write('\n'.join(P) + '\n')
    if not os.path.exists(os.path.join(folder, 'edges.csv')):
        with open(os.path.join(folder, 'edges.csv'), 'w', newline='', encoding='utf-8') as f:
            csv.DictWriter(f, fieldnames=EDGE_FIELDS).writeheader()


def is_hand(folder):
    mp = os.path.join(folder, 'meta.json')
    if not os.path.exists(mp):
        return False
    try:
        return not json.load(open(mp, encoding='utf-8')).get('research_tier', '').startswith('Queued')
    except Exception:
        return True


def read_edges(folder):
    out = []
    for fn in ('edges.csv', 'edges_fec.csv'):
        p = os.path.join(folder, fn)
        if os.path.exists(p):
            for x in csv.DictReader(open(p, encoding='utf-8')):
                x['_file'] = fn
                out.append(x)
    return out


def main():
    os.makedirs(PEOPLE, exist_ok=True)
    status = {}
    for r in roster:
        folder = os.path.join(PEOPLE, r['state'], r['person_id'])
        os.makedirs(folder, exist_ok=True)
        if not is_hand(folder):
            stub(r, folder)
        status[r['person_id']] = 'hand researched' if is_hand(folder) else 'queued'
    # boards and ledger
    ledger, idx = [], []
    for r in roster:
        folder = os.path.join(PEOPLE, r['state'], r['person_id'])
        ed = read_edges(folder)
        meta = json.load(open(os.path.join(folder, 'meta.json'), encoding='utf-8'))
        money = [e for e in ed if e.get('amount_usd')]
        has_board = False
        if money and not (meta.get('research_tier', '').startswith('Tier 1') and os.path.exists(os.path.join(folder, 'board.html'))):
            try:
                make_board.build(folder); has_board = True
            except Exception as ex:
                print('board failed', r['person_id'], ex)
        has_board = has_board or os.path.exists(os.path.join(folder, 'board.html'))
        for e in ed:
            row = {k: e.get(k, '') for k in EDGE_FIELDS}
            row['subject_id'] = row['subject_id'] or r['person_id']
            row['origin'] = 'FEC pipeline' if e['_file'] == 'edges_fec.csv' else 'hand research'
            ledger.append(row)
        ht = meta.get('headline_total') or {}
        idx.append(dict(id=r['person_id'], name=r['name'], party=r['party'], state=r['state'], office=r['office_sought_2026'] or '',
                        cur=r['current_office'], dist=r['district_sought'], rating=r['competitive_rating'], groups=r['groups'],
                        status=status[r['person_id']], tier=meta.get('research_tier', ''), edges=len(ed), board=has_board,
                        raised=ht.get('amount_usd') or '', blocs=', '.join(meta.get('top_blocs', [])), prio=r['research_priority'],
                        path=f"people/{r['state']}/{r['person_id']}/"))
    with open(os.path.join(ROOT, 'ledger_master.csv'), 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=EDGE_FIELDS + ['origin']); w.writeheader(); w.writerows(ledger)
    with open(os.path.join(ROOT, 'research_queue.csv'), 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f); w.writerow(['priority', 'person_id', 'name', 'party', 'state', 'office_sought', 'district', 'rating', 'status', 'edges'])
        for x in sorted(idx, key=lambda x: (x['status'] != 'queued', int(x['prio']), x['state'], x['id'])):
            w.writerow([x['prio'], x['id'], x['name'], x['party'], x['state'], x['office'], x['dist'], x['rating'], x['status'], x['edges']])
    tpl = open(os.path.join(HERE, 'index_template.html'), encoding='utf-8').read()
    stats = dict(people=len(idx), hand=sum(1 for x in idx if x['status'] != 'queued'), edges=len(ledger), built=TODAY)
    out = tpl.replace('/*__DATA__*/null', json.dumps(dict(rows=idx, stats=stats), ensure_ascii=False).replace('</', '<\\/'))
    open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(out)
    print(stats)


if __name__ == '__main__':
    main()
