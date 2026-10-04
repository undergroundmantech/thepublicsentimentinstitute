"""Poll weight check inside the live structure: shift the floor (one house) and ceiling (eight houses) anchors of the
proximity ramp and score polled races in each cycle separately, fundamentals fit on the other cycle."""
import numpy as np, pandas as pd, json, importlib.util, sys
spec=importlib.util.spec_from_file_location('mc','mt_calib.py')
src=open('mt_calib.py').read().split('res = dict(by_horizon')[0]
ns={'__file__':'mt_calib.py'}; exec(src,ns)
d=ns['d']; fit_fund=ns['fit_fund']; pred_fund=ns['pred_fund']
base=ns['PROX']
def level(r,f,dlo,dhi):
    if not r.has_poll: return f
    ns['PROX'][:]=[(a,b+dhi,c+dlo) if a<=60 else (a,b,c) for a,b,c in base0]
    w3=ns['live_w3'](r.houses,r.days_out)
    a=r.n_polls/(r.n_polls+4); f2=f+float(np.clip(0.5*a*(r.poll-f),-0.12,0.12))
    return w3*r.poll+(1-w3)*f2
base0=list(base)
out={}
for H in (31,1):
    for dlo in (0,0.05,0.10,0.15,0.20,0.25):
        for dhi in (-0.05,0,0.05,0.10):
            rec={}
            for test in (2018,2022):
                te=d[(d.cycle==test)&(d.days_out==H)&(d.n_polls>0)]
                f=pred_fund(fit_fund(d[d.cycle!=test]),te)
                mu=np.array([level(r,x,dlo,dhi) for r,x in zip(te.itertuples(),f)])
                e=200*(1/(1+np.exp(-te.y.values))-1/(1+np.exp(-mu)))
                rec[test]=round(float(np.mean(np.abs(e))),3)
            rec['both']=round((rec[2018]+rec[2022])/2,3)
            out[f'{H}|{dlo}|{dhi}']=rec
ns['PROX'][:]=base0
for H in (31,1):
    rows=sorted([(v['both'],k,v) for k,v in out.items() if k.startswith(f'{H}|')])
    print(H,'live',out[f'{H}|0|0']); [print('  ',r) for r in rows[:6]]
json.dump(out,open('mt_weights.json','w'),indent=1)
