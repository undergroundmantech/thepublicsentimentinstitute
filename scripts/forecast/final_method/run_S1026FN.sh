#!/bin/bash
# Oct 26 2026 evening: full rerun of every Senate, governor and House race with the final methodology built into the
# engine, so the old model's terms stay in: county Trump approvals set to 37.1 approve 60.6 disapprove, money term,
# donor term, local conditions, gas and data centers at half size, primary party, candidate and unity terms (also in the
# seat history), incumbent personal vote, the early vote as the party electorate, Gallup D50 R39 as the national
# environment, and the section 6.1 leg weights. House: Gallup and electorate legs at the method's shares, district polls 0.35.
TAG=S1026FN
cd /tmp/fcrun/TPSI_B
source /tmp/fcrun/flags_v128.sh
source /tmp/fcrun/fm/env_final.sh
R=/tmp/fcrun/runs/$TAG; mkdir -p $R/lane1 $R/lane2 $R/house
( OUT_DYN=$R/lane1 python3 model/dynamic_mode.py TX AK ALG AZG COG FL HIG ID ILG KY MAG MEG MN MT NH NM NYG OK ORG RIG TN VA WV SC NC AL ARG CO DE GAG IAG > $R/lane1.log 2>&1; touch $R/lane1.done ) &
( OUT_DYN=$R/lane2 python3 model/dynamic_mode.py GA AKG AR CAG CTG FLG IA IDG KS LA MDG MI MNG NE NHG NMG OH OKG PAG SD TNG VTG WY SCG IL KSG MA ME MIG MS NEG NJ NVG OHG OR RI SDG TXG WIG WYG > $R/lane2.log 2>&1; touch $R/lane2.done ) &
( cd model/FLH && LEGW=0.43,0.285,0.285 W_POLL_DIST=0.35 OUT_HOUSE_DYN=$R/house python3 house_dyn.py > $R/house.log 2>&1; touch $R/house.done ) &
wait
touch $R/all.done
