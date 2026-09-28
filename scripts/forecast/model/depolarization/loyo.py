import numpy as np, pandas as pd
g=pd.read_csv("/tmp/depol/gov_fit.csv")
g=g[g.year.isin([2014,2018,2022])]
def fit(tr, beta=None, lam=None):
    # y - beta*env - lam*x = c + gamma*inc  (fit free ones)
    cols=[np.ones(len(tr)), tr.inc.values]
    y=tr.y.values.copy()
    if beta is None: cols.append(tr.env.values)
    else: y=y-beta*tr.env.values
    if lam is None: cols.append(tr.x.values)
    else: y=y-lam*tr.x.values
    b,*_=np.linalg.lstsq(np.column_stack(cols),y,rcond=None)
    c,gm=b[0],b[1]; k=2
    B=b[k] if beta is None else beta; k+= beta is None
    L=b[k] if lam is None else lam
    return c,gm,B,L
res=[]
for beta,lam,name in [(1,1,"partisan: beta 1, lambda 1"),(0.8,0.8,"0.8 / 0.8"),(0.6,0.6,"0.6 / 0.6"),(0.5,0.5,"0.5 / 0.5"),(0.6,0.45,"0.6 / 0.45"),(None,None,"fitted each fold")]:
    err=[];hit=[]
    for yv in (2014,2018,2022):
        tr=g[g.year!=yv]; te=g[g.year==yv]
        c,gm,B,L=fit(tr,beta,lam)
        p=c+gm*te.inc+B*te.env+L*te.x
        e=(te.y-p)*50; err+=list(e); hit+=list(np.sign(p)==np.sign(te.y))
    err=np.array(err)
    res.append((name, round(float(np.sqrt((err**2).mean())),2), round(float(np.abs(err).mean()),2), round(100*np.mean(hit),1)))
for r in res: print(r)
# lambda by year FE with inc, per fold
