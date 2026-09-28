import numpy as np, pandas as pd
lg=lambda p: np.log(p/(1-p))
d=pd.read_csv("/tmp/depol/history_statewide.csv")
INC={2014:dict(FLG=-1,TXG=0,IAG=-1,OHG=-1,GAG=-1,WIG=-1,MIG=-1,NYG=1,PAG=-1,AZG=0,NVG=-1,CAG=1,ORG=1,KSG=-1,NEG=0,OKG=-1,ALG=-1,SDG=-1,VTG=1,COG=1,TNG=-1,MNG=1,SCG=-1,IDG=-1,WYG=-1,AKG=-1,MEG=-1,CTG=1,RIG=0,MAG=0,MDG=0,NMG=-1,ARG=0,ILG=1,HIG=0),
     2018:dict(FLG=0,TXG=-1,IAG=-1,OHG=0,GAG=0,WIG=-1,MIG=0,NYG=1,PAG=1,AZG=-1,NVG=0,CAG=0,ORG=1,KSG=0,NEG=-1,OKG=0,ALG=-1,SDG=0,VTG=-1,COG=0,TNG=0,MNG=0,SCG=-1,IDG=0,WYG=0,AKG=0,MEG=0,CTG=0,RIG=1,MAG=-1,MDG=-1,NMG=0,ARG=-1,ILG=-1,HIG=1),
     2022:dict(FLG=-1,TXG=-1,IAG=-1,OHG=-1,GAG=-1,WIG=1,MIG=1,NYG=1,PAG=0,AZG=0,NVG=1,CAG=1,ORG=0,KSG=1,NEG=0,OKG=-1,ALG=-1,SDG=-1,VTG=-1,COG=1,TNG=-1,MNG=1,SCG=-1,IDG=-1,WYG=-1,AKG=-1,MEG=1,CTG=1,RIG=1,MAG=0,MDG=0,NMG=1,ARG=0,ILG=1,HIG=0),
     2020:dict(NHG=-1),2024:dict(NHG=0)}
INC[2022]["NHG"]=-1
HOUSE={2014:35_368_840/(35_368_840+39_926_526),2018:60_319_623/(60_319_623+50_467_181),2020:77_560_000/(77_560_000+72_790_000),
       2022:51_280_463/(51_280_463+54_227_992),2024:70_571_330/(70_571_330+74_390_864)}
PN={2016:65_853_514/(65_853_514+62_984_828),2020:81_283_501/(81_283_501+74_223_975),2024:75_017_613/(75_017_613+77_302_580)}
def lean(r,y):
    L={k:lg(r[f"p{k}"])-lg(PN[k]) for k in PN}
    return {2014:L[2016],2018:(L[2016]+L[2020])/2,2020:L[2020],2022:(L[2020]+L[2024])/2,2024:L[2024]}[y]
def build(off):
    g=d[(d.office==off)&d.year.isin(HOUSE)].copy()
    g["x"]=[lean(r,r.year) for _,r in g.iterrows()]
    g["env"]=[lg(HOUSE[y]) for y in g.year]
    g["y"]=lg(g.D2)
    if off=="governor": g["inc"]=[INC[r.year][r.race] for _,r in g.iterrows()]
    return g
def ols(X,y):
    b,*_=np.linalg.lstsq(X,y,rcond=None); return b
g=build("governor"); s=build("senate")
print("gov n",len(g),"sen n",len(s))
for nm,df,cols in [("gov",g,["env","x","inc"]),("gov no inc",g,["env","x"]),("sen",s,["env","x"])]:
    X=np.column_stack([np.ones(len(df))]+[df[c] for c in cols]); b=ols(X,df.y.values)
    res=df.y.values-X@b
    print(nm, dict(zip(["c"]+cols,np.round(b,3))), "resid sd pts", round(float(np.std(res))*50,1))
# fixed-effects by year: slope on lean only (env absorbed)
for nm,df in [("gov",g),("sen",s)]:
    yy=df.y-df.groupby("year").y.transform("mean"); xx=df.x-df.groupby("year").x.transform("mean")
    X=[xx]; 
    if nm=="gov": ii=df.inc-df.groupby("year").inc.transform("mean"); X.append(ii)
    b=ols(np.column_stack(X),yy.values); print(nm,"year FE lambda",np.round(b,3))
# year means vs env: pass-through
for nm,df in [("gov",g),("sen",s)]:
    m=df.groupby("year").apply(lambda z: pd.Series(dict(res=(z.y- (z.x*(0.62 if nm=="gov" else 0.95))).mean(), env=z.env.iloc[0], n=len(z))))
    print(nm); print(m.round(3))
g.to_csv("/tmp/depol/gov_fit.csv",index=False); s.to_csv("/tmp/depol/sen_fit.csv",index=False)
