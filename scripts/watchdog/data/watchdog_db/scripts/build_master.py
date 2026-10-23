import csv,glob,collections,json
R='/home/claude/watchdog/out/roster/'
inc={r['person_id']:r for r in csv.DictReader(open(R+'incumbents_congress.csv'))}
nom=[]
for f in sorted(glob.glob(R+'nominees_g*.csv')): nom+=list(csv.DictReader(open(f)))
M={}
def get(pid,base):
    if pid not in M:
        M[pid]=dict(person_id=pid,name=base.get('name',''),party=base.get('party',''),state=base.get('state',''),
          district='',current_office='',office_sought_2026='',district_sought='',race_status='',role='',
          competitive_rating='',incumbent_in_seat='',groups=set(),bioguide='',fec_ids='',opensecrets='',
          committees='',roster_source='',roster_note='')
    return M[pid]
for pid,r in inc.items():
    m=get(pid,r); m['district']=r['district']; m['current_office']=r['current_office']+(f" {r['state']}-{r['district']}" if r['district'] else f" {r['state']}")
    m['groups'].add('Sitting Congress'); 
    for k in ('bioguide','fec_ids','opensecrets','committees'): m[k]=r[k]
for r in nom:
    pid=r['person_id']; m=get(pid,r)
    os_=r['office_sought']; st=r['race_status']
    if 'sitting governor' in r['role'] or (r['current_office'].lower().startswith('governor') ):
        m['groups'].add('Sitting governor')
    if os_ and st not in ('not on ballot','withdrawn after nomination',''):
        g={'U.S. House':'2026 House nominee','U.S. Senate':'2026 Senate nominee','U.S. Senate special':'2026 Senate nominee','Governor':'2026 Governor nominee'}.get(os_,'2026 other nominee')
        m['groups'].add(g)
        if m['office_sought_2026'] and m['office_sought_2026']!=os_: m['office_sought_2026']+=' | '+os_
        else: m['office_sought_2026']=os_
        m['district_sought']=r['district']; m['race_status']=st; m['role']=r['role']
        m['competitive_rating']=r['competitive_rating']; m['incumbent_in_seat']=r['incumbent_in_seat']
    elif not m['role']:
        m['role']=r['role']; m['race_status']=m['race_status'] or st
    if not m['current_office'] and r['current_office']: m['current_office']=r['current_office']
    m['roster_source']=m['roster_source'] or r['source_url']
    if r['notes']: m['roster_note']=(m['roster_note']+' | ' if m['roster_note'] else '')+r['notes']
# keep only current officeholders or active candidates
out=[m for m in M.values() if m['groups']]
dropped=[m['person_id'] for m in M.values() if not m['groups']]
def prio(m):
    g=m['groups']; rt=(m['competitive_rating'] or '').lower()
    if '2026 Governor nominee' in g or 'Sitting governor' in g: return 1
    if '2026 Senate nominee' in g or m['current_office'].startswith('U.S. Senate'): return 2
    if any(k in rt for k in ('toss','lean')): return 3
    return 4
for m in out:
    m['research_priority']=prio(m); m['groups']='; '.join(sorted(m['groups'])); m['research_status']='queued'
out.sort(key=lambda m:(m['research_priority'],m['state'],m['person_id']))
with open(R+'master_roster.csv','w',newline='') as f:
    w=csv.DictWriter(f,fieldnames=list(out[0])); w.writeheader(); w.writerows(out)
print(len(out),'dropped',dropped)
print(collections.Counter(m['research_priority'] for m in out))
c=collections.Counter()
for m in out:
    for g in m['groups'].split('; '): c[g]+=1
print(c)
