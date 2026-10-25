"""Which candidate each FEC committee raises for. Shared by fec_cycle_map.py and conduit_pull.py so both credit gifts the
same way.

Sources, in order, each only filling committees the earlier ones did not link:
  1. ccl, the candidate committee linkage file: principal (P), authorized (A) and joint fundraising (J) committees; a joint
     fundraising committee counts only when it is linked to one candidate. When a committee is linked to more than one
     candidate, the link for this cycle's election wins.
  2. cn, the candidate file: each candidate's principal campaign committee (CAND_PCC).
  3. cm, the committee file: principal and authorized committees that name their candidate (CAND_ID).
  4. NAMED_JFC: joint fundraising committees of the presidential nominees, found by committee name in cm, since the
     linkage file often leaves them out (Trump National Committee JFC, Trump 47, Harris Victory Fund).
Then SPLITS hands a committee's gifts from one candidate to another by date: Biden's 2024 committee became Harris's on
July 21 2024, so gifts from that day on are Harris's.
FALLBACK fills a nominee's name and office when the candidate file for the cycle does not carry them.
"""
import re
from types import SimpleNamespace

NAMED_JFC = {
    2024: [(r"^TRUMP (?:NATIONAL COMMITTEE JFC|47 COMMITTEE|SAVE AMERICA JFC|VICTORY)\b", "P80001571"),
           (r"^(?:BIDEN|HARRIS) (?:VICTORY|ACTION) FUND\b", "P80000722")],
}
SPLITS = {2024: [("P80000722", 20240721, "P00009423")]}  # from this date on, the first candidate's gifts are the second's
WATCH = {2024: ["P80001571", "P00009423", "P80000722"]}
FALLBACK = {
    "P80001571": ("TRUMP, DONALD J.", "REP"),
    "P00009423": ("HARRIS, KAMALA D.", "DEM"),
    "P80000722": ("BIDEN, JOSEPH R JR", "DEM"),
}
CM = ["CMTE_ID", "CMTE_NM", "TRES_NM", "CMTE_ST1", "CMTE_ST2", "CMTE_CITY", "CMTE_ST", "CMTE_ZIP", "CMTE_DSGN", "CMTE_TP",
      "CMTE_PTY_AFFILIATION", "CMTE_FILING_FREQ", "ORG_TP", "CONNECTED_ORG_NM", "CAND_ID"]


def build(cn, ccl, cm, cy, log=print):
    """cn: candidate rows already limited to the offices wanted. Returns (cmte2cand, CAND, split) where split(cand, ymd)
    gives the candidate a gift belongs to on its date."""
    cy = int(cy); known = set(cn.CAND_ID)
    c = ccl[ccl.CMTE_DSGN.isin(["P", "A", "J"]) & ccl.CAND_ID.isin(known)]
    n = c.groupby("CMTE_ID").CAND_ID.nunique()
    c = c[(c.CMTE_DSGN != "J") | c.CMTE_ID.isin(n[n == 1].index)]
    c = c.assign(_now=(c.CAND_ELECTION_YR.fillna("") == str(cy)).astype(int)).sort_values("_now", kind="stable")
    link = dict(zip(c.CMTE_ID, c.CAND_ID))  # this cycle's links come last, so they win
    how = {k: "ccl" for k in link}
    for r in cn.itertuples():
        p = (r.CAND_PCC or "") if isinstance(r.CAND_PCC, str) else ""
        if re.fullmatch(r"C\d{8}", p) and p not in link: link[p] = r.CAND_ID; how[p] = "pcc"
    if cm is not None:
        for r in cm[cm.CMTE_DSGN.isin(["P", "A"]) & cm.CAND_ID.isin(known | set(FALLBACK))].itertuples():
            if r.CMTE_ID not in link: link[r.CMTE_ID] = r.CAND_ID; how[r.CMTE_ID] = "cm"
        for rx, cid in NAMED_JFC.get(cy, []):
            hit = cm[(cm.CMTE_DSGN == "J") & cm.CMTE_NM.fillna("").str.upper().str.contains(rx, regex=True)]
            for r in hit.itertuples():
                if r.CMTE_ID not in link: link[r.CMTE_ID] = cid; how[r.CMTE_ID] = "named jfc"
    CAND = {r.CAND_ID: r for r in cn.itertuples()}
    for cid in set(link.values()) | {b for _, _, b in SPLITS.get(cy, [])}:
        if cid not in CAND and cid in FALLBACK:
            nm, pty = FALLBACK[cid]
            CAND[cid] = SimpleNamespace(CAND_ID=cid, CAND_NAME=nm, CAND_PTY_AFFILIATION=pty, CAND_ELECTION_YR=str(cy), CAND_OFFICE_ST="US",
                                        CAND_OFFICE="P", CAND_OFFICE_DISTRICT="00", CAND_ICI="", CAND_STATUS="", CAND_PCC="")
    for cid in WATCH.get(cy, []):
        cm_names = dict(zip(cm.CMTE_ID, cm.CMTE_NM)) if cm is not None else {}
        mine = [f"{k} {cm_names.get(k, '')[:40]} [{how[k]}]" for k, v in link.items() if v == cid]
        log(f"  {cid} {FALLBACK.get(cid, ('', ''))[0]}: {'in' if cid in known else 'NOT in'} the candidate file, {len(mine)} committees: " + "; ".join(mine[:8]))
    sp = SPLITS.get(cy, [])

    def split(cand, ymd):
        """Works on single values and on pandas Series."""
        for a, day, b in sp:
            if hasattr(cand, "where"): cand = cand.where(~((cand == a) & (ymd >= day)), b)
            elif cand == a and ymd >= day: cand = b
        return cand
    return link, CAND, split
