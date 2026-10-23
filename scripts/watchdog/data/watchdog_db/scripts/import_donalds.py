import csv,json,re,os,shutil
SRC='/mnt/user-data/uploads/Byron_Donalds_Watchdog_File.md'
OUT='/home/claude/watchdog/out/people/FL/FL-byron-donalds/'
os.makedirs(OUT,exist_ok=True)
L=open(SRC,encoding='utf-8').read().split('\n')
part4=next(i for i,l in enumerate(L) if l.startswith('# PART 4'))
part3=next(i for i,l in enumerate(L) if l.startswith('# PART 3'))
open(OUT+'profile.md','w').write('\n'.join(L[:part4]))
open(OUT+'notes.md','w').write('\n'.join(L[part4:]))
def cells(l): return [c.strip() for c in l.strip().strip('|').split('|')]
rows=[]
for l in L[part3:part4]:
    if not l.startswith('| ') or l.startswith('| Donor or Entity') : continue
    c=cells(l)
    if len(c)<8 or set(c[0])<=set('-'): continue
    name,typ,amt,date,rec,bloc,src,hop=c[:8]
    m=re.search(r'\((https?://[^)]+)\)',src); url=m.group(1) if m else src
    n=re.search(r'\$([\d,\.]+)\s*(million|M|billion|B|K)?',amt)
    v=''
    if n:
        x=float(n.group(1).replace(',','')); u=(n.group(2) or '').lower()
        x*= 1e6 if u in('million','m') else 1e9 if u in('billion','b') else 1e3 if u=='k' else 1
        v=str(int(x))
    primary=any(d in url for d in ('fec.gov','myflorida.com','sunbiz.org','floridalobbyist','ethics.state.fl.us'))
    st='Contested' if 'contest' in (amt+date+name).lower() else 'Provisional' if 'provisional' in (amt+date).lower() else ('Confirmed' if primary else 'Secondary')
    rows.append(dict(subject_id='FL-byron-donalds',donor_or_entity=name,type=typ,amount=amt,amount_usd=v,cumulative='yes' if 'cumulative' in amt.lower() else 'no',
        date_or_as_of=date,recipient_vehicle=rec,interest_bloc=bloc,source=url,hop=hop,status=st,note='Imported from the Tier 1 Donalds file, Part 3'))
F=['subject_id','donor_or_entity','type','amount','amount_usd','cumulative','date_or_as_of','recipient_vehicle','interest_bloc','source','hop','status','note']
with open(OUT+'edges.csv','w',newline='') as f:
    w=csv.DictWriter(f,fieldnames=F); w.writeheader(); w.writerows(rows)
# levers
i=next(i for i,l in enumerate(L) if l.startswith("## The governor's levers"))
lv=[]
for l in L[i+1:i+80]:
    if l.startswith('## '): break
    if l.startswith('| ') and not l.startswith('| Appointment') and not l.startswith('|---'):
        c=cells(l)+['']*4
        lv.append(dict(decision=c[0],who_holds_it_now=c[1],when=c[2],which_donors_care=c[3],stake='',subject_position='See profile.md Part 2',source='Byron Donalds Watchdog File, Part 2'))
with open(OUT+'levers.csv','w',newline='') as f:
    w=csv.DictWriter(f,fieldnames=list(lv[0])); w.writeheader(); w.writerows(lv)
meta=dict(person_id='FL-byron-donalds',name='Byron Donalds',party='Republican',state='FL',office_sought='Governor',current_office='U.S. House FL-19',
  opponents=['FL-david-jolly'],vehicles=[dict(name='Friends of Byron Donalds PAC',id='FL DOE 89043',kind='state political committee',treasurer='Bradley T. Crate, Red Curve Solutions'),
  dict(name='Byron Donalds for Governor',id='',kind='state candidate account',treasurer='Bradley T. Crate, Red Curve Solutions'),
  dict(name='Byron Donalds for Congress',id='FEC C00733329',kind='federal campaign',treasurer='Bradley T. Crate, Red Curve Solutions'),
  dict(name='Proven Conservatives PAC',id='FEC C00755728; C00894147',kind='leadership PAC',treasurer='Bradley T. Crate, Red Curve Solutions'),
  dict(name='Byron Donalds Victory Fund',id='FEC C00760108',kind='joint fundraising committee',treasurer='Bradley T. Crate, Red Curve Solutions')],
  top_blocs=['Billionaire megadonor','Gambling','Detention vendors','Utilities and energy','School choice and family'],
  headline_total=dict(amount_usd=149000000,label='about, raised across vehicles',as_of='2026-10-22',source='Byron Donalds Watchdog File'),
  research_tier='Tier 1 full file',compiled='2026-10-23',next_filing='Florida Division of Elections reports due 2026-10-30')
json.dump(meta,open(OUT+'meta.json','w'),indent=2)
shutil.copy('/mnt/user-data/uploads/Donalds_Connections_Board.html',OUT+'board.html')
print(len(rows),len(lv))
