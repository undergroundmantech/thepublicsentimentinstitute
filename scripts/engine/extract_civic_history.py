# Streams each race history out of civicAPI's history export (a zip of one JSON file per race) into a compact file per
# race, for scripts/engine/build_civic_replay.ts. Data only; nothing in the zip is executed. Needs: pip install ijson
#
#   python3 scripts/engine/extract_civic_history.py <CivicAPI_..._History.zip> <history dir>
#
# Kept: every snapshot's time, percent reporting, call time, candidates (name, party, votes, winner flag) in the
# provider's order, each county or town row when it changed, and the rows it stopped listing. Dropped: colours, map
# names, precinct rows.
import sys, zipfile, json, gzip, ijson, collections, os, time
src, out = sys.argv[1], sys.argv[2]
z = zipfile.ZipFile(src); keys = collections.Counter(); t0 = time.time(); done = 0
for info in z.infolist():
    if not info.filename.endswith('.json'): continue
    rid = info.filename.split('/')[-1].split('_')[0]; dst = f'{out}/{rid}.json.gz'
    if os.path.exists(dst): continue
    with z.open(info) as f:
        head = {}; cur = None; names = []; idx = {}; regions = {}; last = {}; snaps = []
        def ci(c, seen):
            # a candidate is its name and party; two candidates with the same name and party in one race stay apart
            base = (c.get('name') or '', c.get('party')); seen[base] = seen.get(base, 0) + 1; n = base + (seen[base],)
            if n not in idx: idx[n] = len(names); names.append([n[0], n[1], c.get('candidate_id')])
            elif names[idx[n]][2] is None and c.get('candidate_id') is not None: names[idx[n]][2] = c.get('candidate_id')
            return idx[n]
        def pack(d, track=True):
            # candidates stay in the provider's own order: [[candidate index, votes], ...]
            v = []; w = []; seen = {}
            for c in d.get('candidates') or []:
                i = ci(c, seen); v.append([i, c.get('votes')])
                if c.get('winner'): w.append(i)
                if c.get('advanced'): w.append(-1 - i)
            r = {}; here = set()
            for k, g in (d.get('region_results') or {}).items():
                if g.get('type') not in (None, 'County', 'county', 'Parish', 'Borough', 'Town', 'City', 'Municipality', 'District', 'State'):
                    if g.get('type') != 'Precinct': keys['regiontype:' + str(g.get('type'))] += 1
                    if g.get('type') == 'Precinct': continue
                here.add(k)
                if k not in regions: regions[k] = [g.get('fips'), g.get('name'), g.get('type')]
                rs = {}; row = [g.get('percent_reporting')] + [[ci(c, rs), c.get('votes')] for c in g.get('candidates') or []]
                s = json.dumps(row)
                if last.get(k) != s: last[k] = s; r[k] = row
            # rows the provider no longer lists (it renames and drops rows during the night) are recorded as removed
            gone = sorted(k for k in list(last) if k not in here) if track else []
            for k in gone: del last[k]
            return v, w, r, gone
        p = ijson.parse(f, use_float=True)
        # top-level scalars, then `current`, then each snapshot
        for prefix, ev, val in p:
            if prefix in ('id', 'name', 'state', 'category', 'type', 'election_date') and ev in ('string', 'number'): head[prefix] = val
            elif prefix == 'current' and ev == 'start_map':
                b = ijson.ObjectBuilder(); b.event(ev, val)
                for pf, e2, v2 in p:
                    b.event(e2, v2)
                    if pf == 'current' and e2 == 'end_map': break
                cur = b.value
            elif prefix == 'snapshots.item' and ev == 'start_map':
                b = ijson.ObjectBuilder(); b.event(ev, val)
                for pf, e2, v2 in p:
                    b.event(e2, v2)
                    if pf == 'snapshots.item' and e2 == 'end_map': break
                s = b.value; d = s.get('data') or {}
                for k in d: keys[k] += 1
                for k in s: keys['snap:' + k] += 1
                v, w, r, gone = pack(d)
                snaps.append({'x': gone, 't': s.get('timestamp'), 'ck': s.get('change_kind'), 'pr': d.get('percent_reporting'), 'ca': d.get('called_at'), 'lu': d.get('last_updated'), 'pc': d.get('polls_close'),
                              'td': d.get('test_data'), 'rd': d.get('round'), 'dis': d.get('is_disputed'), 'v': v, 'w': w, 'r': r})
        fin = None
        if cur:
            for k in cur: keys['cur:' + k] += 1
            last = {}; v, w, r, _ = pack(cur, False)
            fin = {'pr': cur.get('percent_reporting'), 'ca': cur.get('called_at'), 'lu': cur.get('last_updated'), 'pc': cur.get('polls_close'), 'district': cur.get('district'), 'scope': cur.get('election_scope'),
                   'ename': cur.get('election_name'), 'etype': cur.get('election_type'), 'v': v, 'w': w, 'r': r}
        with gzip.open(dst + '.tmp', 'wt') as g: json.dump({**head, 'file': info.filename, 'cands': names, 'regions': regions, 'final': fin, 'snaps': snaps}, g, separators=(',', ':'))
        os.rename(dst + '.tmp', dst)
    done += 1
    if done % 25 == 0: print(done, info.filename, round(time.time() - t0), 's', flush=True)
print('DONE', done, round(time.time() - t0), 's'); print(json.dumps(keys.most_common()))
