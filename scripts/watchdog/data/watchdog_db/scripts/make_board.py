"""Build board.html for one person folder from edges.csv, levers.csv, meta.json and profile.md.
Usage: python3 make_board.py PERSON_FOLDER [PERSON_FOLDER ...]
"""
import csv, json, os, re, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = open(os.path.join(HERE, 'board_template.html'), encoding='utf-8').read()


def norm(s):
    return re.sub(r'[^a-z0-9]+', ' ', (s or '').lower()).strip()


def num(s):
    try:
        return float(str(s).replace(',', '').replace('$', '').strip())
    except ValueError:
        return 0.0


def bluf(profile):
    m = re.search(r'##\s*Bottom line[^\n]*\n(.*?)(\n## )', profile, re.S)
    if not m:
        return []
    items = re.findall(r'^\s*(?:\d+\.|[-*])\s+(.*)$', m.group(1), re.M)
    out = []
    for it in items[:5]:
        it = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', it).replace('**', '')
        parts = re.split(r'(?<=[.!?])\s', it)
        txt = ' '.join(parts[:2])
        out.append(txt if len(txt) <= 300 else txt[:297] + '...')
    return out


def build(folder):
    meta = json.load(open(os.path.join(folder, 'meta.json'), encoding='utf-8'))
    rows = []
    for fn in ('edges.csv', 'edges_fec.csv'):
        p = os.path.join(folder, fn)
        if os.path.exists(p):
            rows += list(csv.DictReader(open(p, encoding='utf-8')))
    levers = []
    lp = os.path.join(folder, 'levers.csv')
    if os.path.exists(lp):
        levers = list(csv.DictReader(open(lp, encoding='utf-8')))
    profile = open(os.path.join(folder, 'profile.md'), encoding='utf-8').read() if os.path.exists(os.path.join(folder, 'profile.md')) else ''
    name = meta.get('name', '')
    nodes, ids = {}, {}
    vehicle_names = {norm(v.get('name')) for v in meta.get('vehicles', []) if v.get('name')}
    subj_keys = {norm(name), norm(meta.get('person_id', '').split('-', 1)[-1].replace('-', ' '))}
    last = norm(name).split(' ')[-1] if name else ''

    def nid(label):
        k = norm(label)
        if k in subj_keys:
            return 'hub'
        if k not in ids:
            ids[k] = 'n%d' % len(ids)
        return ids[k]

    nodes['hub'] = dict(id='hub', label=name, ring=0, bloc='', amt=0)
    # vehicles: declared ones plus any hop 1 recipient that names the subject or is declared
    recv_hop1 = collections.Counter(r['recipient_vehicle'] for r in rows if r.get('hop') == '1' and r.get('type') not in ('Relationship',))
    def is_vehicle(label):
        k = norm(label)
        if k in vehicle_names:
            return True
        return bool(last) and last in k.split() and k not in subj_keys and recv_hop1.get(label, 0) > 0
    edges = []
    blocs_of = collections.defaultdict(collections.Counter)
    amt_of = collections.defaultdict(float)
    hop_of = {}
    for r in rows:
        a, b = r.get('donor_or_entity', ''), r.get('recipient_vehicle', '')
        if not a or not b:
            continue
        ia, ib = nid(a), nid(b)
        for lab, i in ((a, ia), (b, ib)):
            if i not in nodes:
                nodes[i] = dict(id=i, label=lab.split(',')[0][:60] if len(lab) > 60 else lab, full=lab, ring=None, bloc='', amt=0)
        v = num(r.get('amount_usd'))
        hop = r.get('hop', '1') or '1'
        for i in (ia, ib):
            if i != 'hub':
                blocs_of[i][r.get('interest_bloc') or 'Other'] += 1
                amt_of[i] = max(amt_of[i], v) if (r.get('cumulative') or '').lower() == 'yes' else amt_of[i] + v
                hop_of[i] = min(hop_of.get(i, 9), int(hop) if hop.isdigit() else 2)
        edges.append(dict(s=ia, t=ib, amt=v, amount=r.get('amount', ''), date=r.get('date_or_as_of', ''), type=r.get('type', ''),
                          hop=hop, status=r.get('status', ''), note=r.get('note', ''), src=r.get('source', '')))
    for i, n in nodes.items():
        if i == 'hub':
            continue
        if is_vehicle(n.get('full', n['label'])):
            n['ring'] = 1
        else:
            n['ring'] = 2 if hop_of.get(i, 2) <= 1 else 3
        n['bloc'] = blocs_of[i].most_common(1)[0][0] if blocs_of[i] else 'Other'
        n['amt'] = amt_of[i]
    # tie vehicles to hub if no explicit edge
    linked = {(e['s'], e['t']) for e in edges} | {(e['t'], e['s']) for e in edges}
    for i, n in nodes.items():
        if n['ring'] == 1 and (i, 'hub') not in linked:
            edges.append(dict(s=i, t='hub', amt=0, amount='', date='', type='Relationship', hop='1', status='Confirmed', note='Money vehicle for the subject', src=''))
    # levers ring 4, linked to nodes named or blocs named in which_donors_care
    for j, lv in enumerate(levers):
        lid = 'lv%d' % j
        dec = lv.get('decision', '')
        care = norm(lv.get('which_donors_care', ''))
        nodes[lid] = dict(id=lid, label=dec[:48], full=dec, ring=4, bloc='', amt=0,
                          note=f"{dec}. Holds it now: {lv.get('who_holds_it_now','')}. When: {lv.get('when','')}. Stake: {lv.get('stake','')}. Subject position: {lv.get('subject_position','')}")
        hits = [i for i, n in nodes.items() if n['ring'] in (2, 3) and len(norm(n['label'])) > 3 and norm(n['label']) in care]
        bl = collections.Counter(nodes[i]['bloc'] for i in hits)
        nodes[lid]['bloc'] = bl.most_common(1)[0][0] if bl else ''
        if not hits:
            # fall back to bloc words
            for i, n in nodes.items():
                if n['ring'] in (2, 3) and n['bloc'] and norm(n['bloc']).split(' ')[0] in care.split():
                    nodes[lid]['bloc'] = n['bloc']
                    break
        for i in hits[:8]:
            edges.append(dict(s=i, t=lid, amt=0, amount='', date=lv.get('when', ''), type='Lever', hop='2', status='', note=lv.get('which_donors_care', ''), src=lv.get('source', '')))
    for n in nodes.values():
        if n['ring'] == 4 and not n['bloc']:
            n['bloc'] = 'Decision'
    ht = meta.get('headline_total') or {}
    sub = f"{meta.get('party','')} · {meta.get('office_sought') or meta.get('current_office','')} · compiled {meta.get('compiled','')}"
    if ht.get('amount_usd'):
        sub += f" · {ht.get('label','raised')} ${num(ht['amount_usd']):,.0f} as of {ht.get('as_of','')}"
    data = dict(name=name, subtitle=sub,
                blurb=f"{meta.get('research_tier','')}. Top blocs: {', '.join(meta.get('top_blocs', []))}.",
                bluf=bluf(profile), nodes=list(nodes.values()), edges=edges, rows=rows)
    html = TEMPLATE.replace('/*__DATA__*/null', json.dumps(data, ensure_ascii=False).replace('</', '<\\/')).replace('__TITLE__', f'{name} Connections Board')
    open(os.path.join(folder, 'board.html'), 'w', encoding='utf-8').write(html)
    return len(nodes), len(edges)


if __name__ == '__main__':
    for f in sys.argv[1:]:
        print(f, build(f))
