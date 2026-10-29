# Oct 26 2026: settings of the final methodology inside the engine, on top of flags_v128.sh
export N_SIMS=2000 FIVE_STATE_IN_FITS=1 AS_OF_DAILY=2026-10-26
export SEN_FINANCE=/tmp/fcrun/fin_1029/sen_finance.json GOV_FINANCE=/tmp/fcrun/fin_1029/gov_finance.json HOUSE_FINANCE=/tmp/fcrun/fin_1029/house_finance.json FIN_REF_PATH=/tmp/fcrun/fin_1029/fin_ref.json
export POLL_AVG_SITE=/tmp/fcrun/siteavg/site_avg_S1026GF.json
export DONOR_SIGNALS=/tmp/fcrun/donors/donor_signals.json
# Gallup party ID D50 R39 as the national environment in every leg, Gallup leg at full strength, 0.6 for incumbent governors
export NAT_ANCHOR=gallup M2_ANCHOR=gallup GALLUP_FULL=1 GALLUP_INC_BETA=0.6
# Trump approval: county approvals calibrated to the national average, 37.1 approve 60.6 disapprove, net -23.5
export APPROVAL_NAT_TWO_WAY=0.3797
# early vote as the party electorate; leg weights by share of the vote cast
# Oct 28 2026 late, by the user: the early vote leaves the engine electorate and returns as the post run correction
# (scripts/forecast/earlyvote/ev_adjust.py, strength measured each run); the banked share still slides the leg weights
export EV_ELECTORATE= FINAL_W=1 FINAL_W_BANKED=/tmp/fcrun/fm/ev_enth.json
# local conditions, gas and data centers at half size; primaries into the seat history too
export LOCAL_W=0.5 SEAT_PRIM=1.0
export PRIOR_CARRY='{"NE": 8.45, "AK": 6.55, "OH": 4.65, "NC": 3.55}'
export SITE_AVG_AK=1
# Oct 27 2026, by the user's choice: polls upweighted 10 points, statewide 0.55 sliding to 0.45 as the vote is banked;
# House runs set W_POLL_DIST=0.45 on their command line
# Oct 28 2026 late, by the user: 10 more points again, statewide 0.65 sliding to 0.55, House W_POLL_DIST=0.55
export POLL_UP=0.20
# Oct 29 2026, by the user's choice: one national anchor of D+13 for every leg (On Point Oct 28 poll D+13.0 alongside Gallup
# D+11), each state's response to the national environment measured from its 2016 to 2024 presidential swings and the Oct 28
# state MRP (/tmp/fcrun/blend/state_beta.py), the poll weight measured per race from the weighted average's effective poll
# count (BLEND=precision), and the primary electorate term read only from 2026 primary ballots (ENTH_REAL_ONLY=1)
export NAT_D2_FIX=0.565 BLEND=precision BLEND_SF=7.5 BLEND_SSYS=3.5 BLEND_S1=6.0 BLEND_CAP=0.85 ENTH_REAL_ONLY=1
export NAT_ELAST_CACHE=/tmp/fcrun/blend/nat_elasticity_beta.csv AS_OF_DAILY=2026-10-27
export BLEND_HALF_DAYS=28
