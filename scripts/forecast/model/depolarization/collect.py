import os, sys, json
RR="/tmp/claude-0/-home-claude/2fe66b6b-24b4-5fab-b0f7-c44b6f59cc0e/scratchpad/rerun"
sys.path.insert(0,RR); os.chdir(RR)
import numpy as np, pandas as pd
import senate_mode as sm
rows=[]
for st,cfg in sm.STATES.items():
    off=cfg.get("office","senate")
    try:
        S,years,_=sm.history(st)
        P16,P20,P24=sm.pres_frames(st)
    except Exception as e:
        print("skip",st,e); continue
    fl=sm.county_list(st)
    pres={}
    for y,P in ((2016,P16),(2020,P20),(2024,P24)):
        p=P.reindex(fl); pres[y]=float(p.votes_dem.sum()/(p.votes_dem.sum()+p.votes_gop.sum()))
    for y in years:
        s=S[y]; D=float(s.D.sum()); R=float(s.R.sum()); O=float(s.O.sum()) if "O" in s else 0.0
        rows.append(dict(race=st,office=off,year=int(y),D2=D/(D+R),third=O/(D+R+O),**{f"p{k}":v for k,v in pres.items()}))
pd.DataFrame(rows).to_csv("/tmp/depol/history_statewide.csv",index=False)
print(len(rows))
