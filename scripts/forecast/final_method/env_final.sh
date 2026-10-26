# Oct 26 2026: settings of the final methodology inside the engine, on top of flags_v128.sh
export N_SIMS=2000 FIVE_STATE_IN_FITS=1 AS_OF_DAILY=2026-10-26
export SEN_FINANCE=/tmp/fcrun/fin_1025d/sen_finance.json GOV_FINANCE=/tmp/fcrun/fin_1025d/gov_finance.json HOUSE_FINANCE=/tmp/fcrun/fin_1025d/house_finance.json FIN_REF_PATH=/tmp/fcrun/fin_1025d/fin_ref.json
export POLL_AVG_SITE=/tmp/fcrun/siteavg/site_avg_S1026GF.json
export DONOR_SIGNALS=/tmp/fcrun/donors/donor_signals.json
# Gallup party ID D50 R39 as the national environment in every leg, Gallup leg at full strength, 0.6 for incumbent governors
export NAT_ANCHOR=gallup M2_ANCHOR=gallup GALLUP_FULL=1 GALLUP_INC_BETA=0.6
# Trump approval: county approvals calibrated to the national average, 37.1 approve 60.6 disapprove, net -23.5
export APPROVAL_NAT_TWO_WAY=0.3797
# early vote as the party electorate; leg weights by share of the vote cast
export EV_ELECTORATE=/tmp/fcrun/fm/ev_enth.json FINAL_W=1 FINAL_W_BANKED=/tmp/fcrun/fm/ev_enth.json
# local conditions, gas and data centers at half size; primaries into the seat history too
export LOCAL_W=0.5 SEAT_PRIM=1.0
export PRIOR_CARRY='{"NE": 8.45, "AK": 6.55, "OH": 4.65, "NC": 3.55}'
export SITE_AVG_AK=1
