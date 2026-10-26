#!/bin/bash
# Oct 26 2026: Alaska governor rerun with the Aug 18 2026 primary ballots for its party term (it had the 2022 governor vote).
# Oct 26 2026 afternoon, full rerun of every Senate, governor and House race at the user's request, as the current model
# for the final methodology: same settings as S1025DN with today's polls (site averages S1026CN), today's daily average
# date, the early vote inside the electorate (EV_ELECTORATE, replacing ev_adjust.py), and two of the final methodology's settings that the engine already carries: local conditions at half size
# (LOCAL_W=0.5) and an incumbent governor's Gallup leg at 0.6 of the national environment (GALLUP_INC_BETA=0.6).
TAG=S1026AK
cd /tmp/fcrun/TPSI_B
source /tmp/fcrun/flags_v128.sh
export N_SIMS=2000 FIVE_STATE_IN_FITS=1 AS_OF_DAILY=2026-10-26
export SEN_FINANCE=/tmp/fcrun/fin_1025d/sen_finance.json GOV_FINANCE=/tmp/fcrun/fin_1025d/gov_finance.json HOUSE_FINANCE=/tmp/fcrun/fin_1025d/house_finance.json FIN_REF_PATH=/tmp/fcrun/fin_1025d/fin_ref.json
export POLL_AVG_SITE=/tmp/fcrun/siteavg/site_avg_S1026GF.json
export DONOR_SIGNALS=/tmp/fcrun/donors/donor_signals.json
export LOCAL_W=0.5 GALLUP_INC_BETA=0.6
# the early vote as the party electorate inside the engine, replacing ev_adjust.py
export EV_ELECTORATE=/tmp/fcrun/fm/ev_enth.json
R=/tmp/fcrun/runs/$TAG; mkdir -p $R/lane1 $R/lane2 $R/house
( OUT_DYN=$R/lane1 python3 model/dynamic_mode.py AKG > $R/lane1.log 2>&1; touch $R/lane1.done ) &
wait
touch $R/all.done
