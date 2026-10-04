"""Spread check for polled races: the multiplier k on the live statewide spread that makes the interval honest,
by horizon and by house count, with a bootstrap range."""
import numpy as np, pandas as pd, json
from scipy.stats import norm, t as tdist
out={}
rng=np.random.default_rng(7)
for H in (31,1):
    T=pd.read_csv(f'mt_scored_{H}d.csv'); P=T[T.has_poll].copy()
    z=(P.y-P.live_mu)/P.live_sd
    def k_mle(zz): return float(np.sqrt(np.mean(zz**2)))
    def k_cov(zz,q=0.8): return float(np.quantile(np.abs(zz),q)/norm.ppf(0.5+q/2))
    bs=[k_cov(rng.choice(z.values,len(z))) for _ in range(2000)]
    rows=dict(n=len(P),k_rms=k_mle(z),k_cover80=k_cov(z),k_cover50=k_cov(z,0.5),k_cover95=k_cov(z,0.95),k80_range=[float(np.quantile(bs,.1)),float(np.quantile(bs,.9))])
    for nm,m in (('houses<4',P.houses<4),('houses4plus',P.houses>=4)):
        rows[nm]=dict(n=int(m.sum()),k_cover80=k_cov(z[m]),k_rms=k_mle(z[m]))
    # miss sd in margin points, robust
    mm=200*(1/(1+np.exp(-P.y))-1/(1+np.exp(-P.live_mu)))
    rows['miss_pts_sd']=float(mm.std()); rows['miss_pts_mad_sd']=float(1.4826*np.median(np.abs(mm-mm.median())))
    rows['kurtosis']=float(((z-z.mean())**4).mean()/z.var()**2)
    out[H]=rows
print(json.dumps(out,indent=1))
json.dump(out,open('mt_scale.json','w'),indent=1)
