"""Turn the Oct 19 2026 research on the remaining partisan statewide offices into down ballot research entries.

usage: python3 convert_new_offices.py OUT_JSON IN_JSON [IN_JSON ...]
Offices: comptroller, land commissioner, superintendent, insurance commissioner, labor commissioner, utility commissions,
mine inspector, the elected education boards and the partisan supreme court and criminal appeals seats. A state with
more than one race for an office (two utility commission seats, seven Texas court seats, Michigan's four boards) gets a
seat slug, so each race has its own page."""
import sys, json, re, collections
OUT, INS = sys.argv[1], sys.argv[2:]
rows = []
for f in INS: rows += json.load(open(f))
rows = [r for r in rows if r.get("statewide", True) and r.get("partisan", True)]
slug = lambda s: re.sub(r"[^a-z0-9]+", "-", str(s).lower()).strip("-")
n = collections.Counter((r["state"], r["office"]) for r in rows)
out = []
for r in rows:
    k = (r["state"], r["office"])
    seat = r.get("seat")
    tag = seat or (r.get("office_label") if n[k] > 1 else None)
    if seat and "criminal" in str(r.get("office_label", "")).lower(): tag = f"criminal-appeals-{seat}"   # Texas has both courts
    multi = (r.get("seats_up") or 1) > 1
    dn = " and ".join(r.get("d_names") or []) if multi and r.get("d_names") else r.get("d_name")
    rn = " and ".join(r.get("r_names") or []) if multi and r.get("r_names") else r.get("r_name")
    label = r.get("office_label") or r["office"].replace("-", " ").capitalize()
    out.append(dict(state=r["state"], office=r["office"], office_label=label, seat=seat, seat_slug=slug(tag) if tag and n[k] > 1 else None,
                    seats_up=r.get("seats_up") or 1, d_name=dn, r_name=rn, others=r.get("others") or [],
                    incumbent_name=r.get("incumbent_name"), incumbent_party=r.get("incumbent_party"), incumbent_running=bool(r.get("incumbent_running")),
                    uncontested=r.get("uncontested"), primary_files={}, polls=r.get("polls") or [], sources=r.get("sources") or [],
                    note=r.get("note"), election_date=r.get("election_date", "2026-11-03")))
json.dump(out, open(OUT, "w"), indent=1)
print(len(out), "races;", collections.Counter(r["office"] for r in out))
