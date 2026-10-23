"""Reads the saved 2022 US Elections Project national early vote pages, Michael McDonald at the University of Florida,
archived on RPubs, and writes scripts/earlyvote/data/ev2022_national.json: one row per snapshot with the national total,
in person and mail counts, and the registered party split of ballots in the states that report party.

Run once with the folder of saved pages:  python3 -I scripts/earlyvote/extract_ev2022_national.py <ev_history folder>
The saved pages are not shipped; only the extracted numbers are.
"""
import html, json, os, re, sys
from datetime import date, datetime

SRC = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
ED = date(2022, 11, 8)
num = lambda s: int(s.replace(",", "")) if s and s.replace(",", "").isdigit() else None


def tables(s):
    out = []
    for t in re.findall(r"<table.*?</table>", s, flags=re.S):
        rows = [[html.unescape(re.sub(r"<[^>]+>", "", c)).strip() for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", r, flags=re.S)] for r in re.findall(r"<tr.*?</tr>", t, flags=re.S)]
        if rows and rows[0]:
            out.append(rows)
    return out


def text(s):
    t = re.sub(r"<script.*?</script>|<style.*?</style>", "", s, flags=re.S)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", t)))


snaps = []
d = os.path.join(SRC, "raw", "2022", "US")
for f in sorted(os.listdir(d)):
    s = open(os.path.join(d, f), errors="ignore").read()
    t = text(s)
    m = re.search(r"Last updated: (\d\d/\d\d/\d{4}) (\d\d?:\d\d [AP]M)", t)
    if not m:
        continue
    when = datetime.strptime(m.group(1) + " " + m.group(2), "%m/%d/%Y %I:%M %p")
    # days before Election Day, to the hour, so a late night update sits next to the following morning
    dout = max(0.0, round((datetime(ED.year, ED.month, ED.day) - when).total_seconds() / 86400, 2))
    g = lambda lab: num((re.search(lab + r": ([\d,]+)", t) or [None, None])[1])
    row = {"asOf": f"{when.date().isoformat()} {m.group(2)} ET", "daysOut": dout,
           "total": g("Total Early Votes"), "inperson": g("In-Person Early Votes"), "mail": g("Mail Ballots Returned"), "requested": g("Mail Ballots Requested")}
    # the party tables come in page order: total voted, in person early, mail returned
    sect = {}
    for tb in tables(s):
        if tb[0][0] != "Party":
            continue
        key = "total" if "total" not in sect else "inperson" if tb[0][1] == "Count" else "mail"
        sect[key] = {r[0]: num(r[1]) for r in tb[1:] if len(r) > 1}
    rs = re.findall(r"Reporting states with party registration data: ([A-Z, ]+?) Party", t)
    for k, v in sect.items():
        row[f"party_{k}"] = {"D": v.get("Democrat"), "R": v.get("Republican"), "O": v.get("None/Minor"), "N": v.get("TOTAL")}
    if rs:
        row["partyStates"] = [x.strip() for x in rs[0].split(",")]
    snaps.append(row)

snaps.sort(key=lambda r: -r["daysOut"])
out = {"source": "US Elections Project, 2022 General Election Early Voting Statistics, Michael McDonald, University of Florida, saved RPubs pages",
       "url": "https://rpubs.com/ElectProject", "electionDay": ED.isoformat(), "snapshots": snaps}
json.dump(out, open(os.path.join(HERE, "data", "ev2022_national.json"), "w"), indent=1)
print(len(snaps), [(r["daysOut"], r["total"]) for r in snaps])
