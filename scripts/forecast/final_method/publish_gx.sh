#!/bin/bash
# Oct 26 2026 evening: the final methodology at full weight on the S1026FR full rerun, Alaska governor from S1026AK.
set -e
cd /tmp/site
rm -rf public/forecast && cp -a /tmp/fcrun/pub_backup_1026fr public/forecast
NEW_RUN=S1026AK BASE_RUNS=S1026FR HOUSE_BASE=S1026FR TODAY=2026-10-26 DAYS_OUT=8 PREV=2026-10-26 python3 /tmp/fcrun/patch_sweep.py public/forecast > /tmp/fcrun/patch_1026ak.log
python3 -I /tmp/fs5/work/sameday_trend.py public/forecast /tmp/fcrun/pub_backup_1026ne /tmp/fcrun/pub_backup_1026fr
rm -rf /tmp/fcrun/pub_backup_1026ak && cp -a public/forecast /tmp/fcrun/pub_backup_1026ak
cd /tmp/fcrun/fm
FM_BLEND=1.0 FM_RUNS_FIRST=S1026AK,S1026FR FM_SITE_AVG=/tmp/fcrun/siteavg/site_avg_S1026GF.json python3 -I final_method.py
FM_TAG=S1026GX FM_RUNS_FIRST=S1026AK,S1026FR FM_HOUSE_BASE=S1026FR python3 -I make_S1026FM.py
cd /tmp/site
NEW_RUN=S1026GX BASE_RUNS=S1026AK,S1026FR HOUSE_BASE=S1026FR TODAY=2026-10-26 DAYS_OUT=8 PREV=2026-10-26 python3 /tmp/fcrun/patch_sweep.py public/forecast > /tmp/fcrun/patch_1026gx.log
python3 -I /tmp/fs5/work/sameday_trend.py public/forecast /tmp/fcrun/pub_backup_1026ne /tmp/fcrun/pub_backup_1026ak
echo GX_OK
