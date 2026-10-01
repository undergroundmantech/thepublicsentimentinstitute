import numpy as np, pandas as pd, json
exec(open('/tmp/histbt/bt.py').read().split("def run(")[0])
iv=lambda z: 1/(1+np.exp(-z))
# incumbency slope for governors, all years
g=d[d.office=="governor"]; X=np.column_stack([np.ones(len(g)),g.env,g.x,g.inc]); b,*_=np.linalg.lstsq(X,g.y.values,rcond=None); gam=float(b[3])
print("gov fit",np.round(b,3))
m=json.load(open('/tmp/fcout20/model.json'))
races={r['id']:r for r in m['races']}
S=json.load(open('/tmp/fc_v33/run_summary.json'))['results']
ENV26=lg(0.553)
BETA={"governor":0.6,"senate":1.0}; LAM={"governor":0.6,"senate":0.95}
W=(0.65,0.35)
rows=[]
for k,v in S.items():
    gov=k.endswith("G") and len(k)==3; off="governor" if gov else "senate"
    prev=d[(d.race==k)&(d.office==off)].sort_values("year",ascending=False).head(2)
    if not len(prev): rows.append((k,off,None,None,0)); continue
    st=k[:2]; rid=("gov-" if gov else "sen-")+st
    r=races.get(rid); inc26=-(r['inc'] if r else 0) if gov else 0
    p=prev.iloc[0]; lean26=lg(p.p2024)-lg(PN[2024])
    hs=[pp.y+BETA[off]*(ENV26-pp.env)+LAM[off]*(lean26-pp.x)+(gam*(inc26-pp.inc) if gov else 0) for _,pp in prev.iterrows()]
    H=float(np.average(hs,weights=W[:len(hs)]))
    cs=v['components_statewide']; bw=v['blend_weights']
    cur=(bw['M1']*cs['M1']+bw['M2']*cs['M2'])/(bw['M1']+bw['M2'])/100   # the model's fundamentals level, M1 and M2
    rows.append((k,off,H,lg(cur),len(prev)))
df=pd.DataFrame(rows,columns=['key','office','H','cur','n'])
ok=df.dropna()
# drop races where history is from uncontested or wildly off (|H-cur|>1.2 logit) from the centering estimate
for off in ("senate","governor"):
    z=ok[ok.office==off]; dd=(z.H-z.cur); off_med=float(dd[dd.abs()<1.2].median()); print(off,"n",len(z),"median H-cur logit",round(off_med,3),"pts",round(off_med*50,1))
    df.loc[df.office==off,'Hc']=df.loc[df.office==off,'H']-off_med
df['hist_d2']=iv(df.Hc); df['cur_d2']=iv(df.cur)
df['gap_pts']=(df.hist_d2-df.cur_d2)*200
print(df.sort_values('gap_pts')[['key','n','cur_d2','hist_d2','gap_pts']].round(3).to_string())
# NE is left out: Dan Osborn runs as an independent, and no past Nebraska Senate race for this seat is comparable
json.dump({r.key:round(float(r.hist_d2),5) for r in df.itertuples() if pd.notna(r.hist_d2) and r.key != "NE"},open('/tmp/histbt/hist_level.json','w'),indent=1)
