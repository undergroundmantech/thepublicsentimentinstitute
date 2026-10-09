import os, sys, json
sys.path.insert(0, '/tmp/claude-0/-home-claude/2fe66b6b-24b4-5fab-b0f7-c44b6f59cc0e/scratchpad/rerun')
os.environ.setdefault('AS_OF', '2026-10-03')
import senate_mode as sm, poll_daily, house_effects as he, lv_gap
poll_daily.install(sm)
out = {}
for st in sm.STATES:
    try:
        he.ON = True; lv_gap.ON = True; _, a1 = sm.parse_polls(st)
        he.ON = False; lv_gap.ON = False; _, a0 = sm.parse_polls(st)
    except Exception as e:
        continue
    if a0.get('D2') is None or a0.get('no_polls'): continue
    out[st] = dict(before=round(a0['D'] - a0['R'], 2), after=round(a1['D'] - a1['R'], 2))
json.dump(out, open('/tmp/claude-0/-home-claude/2fe66b6b-24b4-5fab-b0f7-c44b6f59cc0e/scratchpad/mtbt/avg_shift_2026.json', 'w'), indent=1)
for k, v in sorted(out.items(), key=lambda kv: kv[1]['after'] - kv[1]['before']):
    print(k, v, round(v['after'] - v['before'], 2))
