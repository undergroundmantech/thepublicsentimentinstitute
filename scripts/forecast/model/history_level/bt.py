import numpy as np, pandas as pd, itertools
lg=lambda p: np.log(p/(1-p))
d=pd.read_csv("/tmp/realsite/site/scripts/forecast/model/depolarization/history_statewide.csv")
exec(open("/tmp/realsite/site/scripts/forecast/model/depolarization/fit.py").read().split("def lean")[0].split('d=pd.read_csv')[0])  # imports only
src=open("/tmp/realsite/site/scripts/forecast/model/depolarization/fit.py").read()
ns={}; exec(src.split("def build")[0].replace('d=pd.read_csv("/tmp/depol/history_statewide.csv")','d=None'),ns)
INC,HOUSE,PN=ns["INC"],ns["HOUSE"],ns["PN"]
HOUSE={**HOUSE,2008:65_237_840/(65_237_840+52_249_491),2016:61_776_554/(61_776_554+63_173_815)}
def lean(r,y):
    L={k:lg(r[f"p{k}"])-lg(PN[k]) for k in PN}
    return {2008:L[2016],2014:L[2016],2016:L[2016],2018:(L[2016]+L[2020])/2,2020:L[2020],2022:(L[2020]+L[2024])/2,2024:L[2024]}[y]
d=d[d.year.isin(HOUSE)].copy()
d["x"]=[lean(r,r.year) for _,r in d.iterrows()]; d["env"]=[lg(HOUSE[y]) for y in d.year]; d["y"]=lg(d.D2)
d["inc"]=[INC.get(r.year,{}).get(r.race,0) if r.office=="governor" else 0 for _,r in d.iterrows()]
def run(off, targets, beta, lam, wts, H_grid):
    g=d[d.office==off]
    out=[]
    for T in targets:
        tr=g[g.year!=T]; te=g[g.year==T]
        cols=["env","x"]+(["inc"] if off=="governor" else [])
        X=np.column_stack([np.ones(len(tr))]+[tr[c] for c in cols]); b,*_=np.linalg.lstsq(X,tr.y.values,rcond=None)
        gam=b[3] if off=="governor" else 0.0
        for _,r in te.iterrows():
            F=b[0]+b[1]*r.env+b[2]*r.x+gam*r.inc
            prev=g[(g.race==r.race)&(g.year<T)].sort_values("year",ascending=False)
            if not len(prev): continue
            hs=[]; ws=[]
            for i,(_,p) in enumerate(prev.head(len(wts)).iterrows()):
                hs.append(p.y+beta*(r.env-p.env)+lam*(r.x-p.x)+gam*(r.inc-p.inc)); ws.append(wts[i])
            Hh=np.average(hs,weights=ws)
            out.append(dict(T=T,race=r.race,y=r.y,F=F,H=Hh))
    o=pd.DataFrame(out)
    res={}
    for h in H_grid:
        pr=(1-h)*o.F+h*o.H
        res[h]=float(np.sqrt(np.mean(((1/(1+np.exp(-pr))-1/(1+np.exp(-o.y)))*200)**2)))
    return o,res
H=[0,0.1,0.2,0.25,0.3,0.35,0.4,0.5,0.6,0.7]
for off,T,beta,lam in [("governor",[2018,2022],0.6,0.6),("senate",[2014,2020],1.0,0.95)]:
    for wts in [(1,),(0.6,0.4),(0.5,0.3,0.2)]:
        o,res=run(off,T,beta,lam,wts,H)
        best=min(res,key=res.get)
        print(off,wts,"n",len(o),"rmse by h",{k:round(v,2) for k,v in res.items()},"best",best)
    for T0 in T:
        o,res=run(off,[T0],beta,lam,(0.6,0.4),H); print('   ',T0,'n',len(o),'best',min(res,key=res.get),{k:round(v,2) for k,v in res.items() if k in (0,0.25,0.35,0.5)})
