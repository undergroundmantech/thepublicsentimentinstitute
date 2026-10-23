import yaml,csv,re,unicodedata,sys
SRC='/home/claude/watchdog/src/congress-legislators/'
L=yaml.safe_load(open(SRC+'legislators-current.yaml'))
CM=yaml.safe_load(open(SRC+'committee-membership-current.yaml'))
C=yaml.safe_load(open(SRC+'committees-current.yaml'))
names={}
for c in C:
    names[c['thomas_id']]=c['name']
    for s in c.get('subcommittees',[]): names[c['thomas_id']+s['thomas_id']]=c['name']+': '+s['name']
mem={}
for cid,ms in CM.items():
    for m in ms:
        mem.setdefault(m['bioguide'],[]).append((cid, names.get(cid,cid), m.get('title','')))
def slug(s):
    s=unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+','-',s).strip('-')
TERR={'DC','PR','GU','VI','AS','MP'}
rows=[]
for x in L:
    t=x['terms'][-1]; n=x['name']
    full=n.get('official_full') or f"{n['first']} {n['last']}"
    office='U.S. Senate' if t['type']=='sen' else ('U.S. House delegate' if t['state'] in TERR else 'U.S. House')
    dist='' if t['type']=='sen' else str(t.get('district'))
    comms=[f"{nm}{' ('+ti+')' if ti else ''}" for cid,nm,ti in mem.get(x['id']['bioguide'],[]) if len(cid)==4]
    subs=[nm for cid,nm,ti in mem.get(x['id']['bioguide'],[]) if len(cid)>4]
    rows.append(dict(person_id=f"{t['state']}-{slug(full)}",name=full,party=t.get('party'),state=t['state'],district=dist,
      current_office=office,senate_class=t.get('class',''),term_end=t['end'],
      status_2026='', seeking_2026='', bioguide=x['id']['bioguide'],fec_ids=';'.join(x['id'].get('fec',[])),
      opensecrets=x['id'].get('opensecrets',''),ballotpedia=x['id'].get('ballotpedia',''),
      committees='; '.join(comms), subcommittees='; '.join(subs)))
with open('/home/claude/watchdog/out/roster/incumbents_congress.csv','w',newline='') as f:
    w=csv.DictWriter(f,fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
print(len(rows), sum(1 for r in rows if r['committees']))
