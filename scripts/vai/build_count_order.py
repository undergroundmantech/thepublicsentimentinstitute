#!/usr/bin/env python3
"""Build the VAI count-order dataset and evidence register from the user-supplied ledger and cached sources.

Inputs live outside the repository (research workspace: --research, else $VAI_RESEARCH_DIR, else ~/research/vai).
The committed outputs are self-contained; nothing else in the repository (tests included) needs this workspace.
Set SOURCE_DATE_EPOCH to pin builtAt, which is otherwise the only field that changes between identical runs:
  count_order/Count Order 2026.html     the 50-state ledger (data in its CATS/SPEED/NCSL/S script constants)
  sources/fetch_log.json + sources/*.txt cached copies of every cited URL, with status, sha256 and retrieval time
  intel/sequence_findings.json           anchor-verified findings copied read-only from feature/election-night-intelligence-v1

Outputs (committed, derived only; no source page text beyond short quotes):
  data/vai/count_order_2026.json
  data/vai/evidence_register_2026.json

Nothing here produces a model input. Ledger sequences are priors; partisan "shift" text is kept verbatim and flagged.
"""
import argparse, hashlib, json, os, re, subprocess, sys
from datetime import datetime, timezone

STATES = {"AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California", "CO": "Colorado", "CT": "Connecticut",
          "DE": "Delaware", "DC": "District of Columbia", "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois",
          "IN": "Indiana", "IA": "Iowa", "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
          "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri", "MT": "Montana", "NE": "Nebraska",
          "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York", "NC": "North Carolina",
          "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island",
          "SC": "South Carolina", "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont", "VA": "Virginia",
          "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming"}
# States whose polling places span two time zones; one ledger hour cannot describe every county's close.
SPLIT_TZ = {"AK", "FL", "ID", "IN", "KS", "KY", "MI", "NE", "ND", "OR", "SD", "TN", "TX"}
# Nov 3 2026 is after the Nov 1 DST change: Eastern = UTC-5.
ET_OFFSET_H = 5

SECONDARY = ("ncsl.org", "ballotpedia.org", "electionlab.mit.edu", "electioninnovation.org", "brennancenter.org", "bipartisanpolicy.org", "eac.gov")


def tier(url: str) -> str:
    host = re.sub(r"^https?://", "", url).split("/")[0].lower()
    if host.endswith("eac.gov"):
        return "FEDERAL_OFFICIAL"
    if host.endswith(".gov") or host.endswith(".us") or re.search(r"(legis|azleg|sos\.|elections\.|vote\.|courts?\.)", host):
        return "OFFICIAL"
    if any(host.endswith(s) for s in SECONDARY):
        return "SECONDARY_RESEARCH"
    return "MEDIA"


def ledger_from_html(path: str) -> dict:
    src = open(path, encoding="utf-8").read()
    start = src.index("const CATS=")
    s_at = src.index("const S=", start)
    i, depth, q = src.index("[", s_at), 0, None
    j = i
    while j < len(src):
        ch = src[j]
        if q:
            if ch == "\\":
                j += 1
            elif ch == q:
                q = None
        elif ch in "\"'`":
            q = ch
        elif ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                break
        j += 1
    js = src[start:j + 1] + ";process.stdout.write(JSON.stringify({CATS,SPEED,NCSL,S}))"
    out = subprocess.run(["node", "-e", js], capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def squash(t: str) -> str:
    return re.sub(r"\s+", " ", t)


def receipt_class(text: str) -> str:
    """Civilian mail receipt rule from the first sentence only; later sentences describe overseas ballots and cures."""
    t = re.split(r"(?<=[a-z0-9])\.(?= [A-Z])", re.sub(r"\b([ap])\.m\.", r"\1m", text))[0].lower()
    if re.search(r"no (postmark )?grace|postmarks? (is not enough|do not count|no longer count)|regardless of postmark|ended the [^.]*grace", t) and not re.search(r"in force|enjoined|injunction", t):
        return "ELECTION_DAY_OR_EARLIER"
    if re.search(r"within (\w+ )?(business )?days|day after the election|days? (after|following) (the )?election|fourth day|third day|fifth day|before (the )?(canvass|certification)|no fixed arrival|received within|count if received|nov(ember)? ([4-9]|[1-3]\d)\b|postmarked (by|on or before) election day|in force|enjoined", t):
        return "POSTMARK_GRACE"
    if re.search(r"close of polls|closing of the polls|on election day|election day|noon|day before|nov(ember)? [123]\b|must (arrive|reach)|arrive by|are due", t):
        return "ELECTION_DAY_OR_EARLIER"
    return "UNCLASSIFIED"


def table_rows(text: str, start_marker: str, names: list[str]) -> dict:
    """Split an NCSL state table (flattened text) into per-state rows, using the state names in order."""
    t = squash(text)
    body = t[t.index(start_marker):] if start_marker in t else t
    pos = []
    for n in names:
        m = re.search(r"(?<![A-Za-z])" + re.escape(n) + r" (?=[A-Z0-9§])", body)
        if m:
            pos.append((m.start(), n))
    pos.sort()
    rows = {}
    for k, (p, n) in enumerate(pos):
        end = pos[k + 1][0] if k + 1 < len(pos) else min(len(body), p + 900)
        rows[n] = body[p:end].strip()[:900]
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--research", default=os.environ.get("VAI_RESEARCH_DIR") or os.path.expanduser("~/research/vai"))
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "..", "data", "vai"))
    a = ap.parse_args()
    R = a.research
    html_path = os.path.join(R, "count_order", "Count Order 2026.html")
    if not os.path.exists(html_path):
        sys.exit(f"research workspace not found at {R} (expected count_order/Count Order 2026.html). "
                 "Pass --research or set VAI_RESEARCH_DIR. Rebuilding is optional: data/vai/*.json is committed and self-contained.")
    html_sha = hashlib.sha256(open(html_path, "rb").read()).hexdigest()
    L = ledger_from_html(html_path)
    fetch = json.load(open(os.path.join(R, "sources", "fetch_log.json")))
    by_url = {f["url"]: f for f in fetch}
    text = {}
    for f in fetch:
        p = f.get("text_file")
        if p and f.get("status") == 200 and os.path.exists(os.path.join(R, p)):
            text[f["url"]] = open(os.path.join(R, p), encoding="utf-8", errors="replace").read()
    intel = json.load(open(os.path.join(R, "intel", "sequence_findings.json")))
    epoch = os.environ.get("SOURCE_DATE_EPOCH")
    built = (datetime.fromtimestamp(int(epoch), timezone.utc) if epoch else datetime.now(timezone.utc)).strftime("%Y-%m-%dT%H:%M:%SZ")

    def cite(u: str) -> dict:
        f = by_url.get(u, {})
        return {"url": u, "tier": tier(u), "fetchStatus": f.get("status", "NOT_FETCHED"), "retrievedAt": f.get("retrieved_at"),
                "sha256": f.get("sha256"), "title": (f.get("title") or None)}

    def quote(u: str, pattern: str, width: int = 240):
        t = text.get(u)
        if not t:
            return None
        m = re.search(pattern, squash(t), re.I)
        return squash(m.group(0))[:width] if m else None

    # ---- count-order records --------------------------------------------------------------------------------------
    records = []
    for idx, e in enumerate(L["S"]):
        c = float(e["c"])
        hh, mm = int(c), int(round((c - int(c)) * 60))
        utc_h = hh + ET_OFFSET_H
        utc = f"2026-11-{3 + utc_h // 24:02d}T{utc_h % 24:02d}:{mm:02d}:00Z"
        records.append({
            "jurisdiction": {"level": "STATE", "state": e["a"], "name": e["n"]},
            "ledger": {"entryIndex": idx, "sourceSha256": html_sha},
            "firstRelease": {"category": e["cat"], "label": L["CATS"][e["cat"]]["label"], "categoryDescription": L["CATS"][e["cat"]]["desc"],
                              "ledgerText": e["first"], "evidenceKind": "ESTIMATED_2026_ORDER"},
            "countSpeed": {"code": e["sp"], "label": L["SPEED"][e["sp"]]},
            "pollClose": {"ledgerEasternHour": c, "ledgerEastern": f"{hh % 12 or 12}:{mm:02d} {'PM' if hh >= 12 else 'AM'} ET",
                          "utc": utc, "timezoneRule": "EST (UTC-5); DST ended 2026-11-01",
                          "splitTimezoneState": e["a"] in SPLIT_TZ,
                          "note": ("State spans two time zones; the ledger hour is one close time and does not describe every county. Resolve per county before use."
                                   if e["a"] in SPLIT_TZ else None),
                          "verification": "LEDGER_ONLY"},
            "ballotMethods": {"ledgerText": e["mode"]},
            "releaseSequence": [{"stage": k + 1, "ledgerText": s, "evidenceKind": "ESTIMATED_2026_ORDER", "status": "PRIOR_NOT_VERIFIED"} for k, s in enumerate(e["order"])],
            "lateCounting": {"ledgerText": e["late"], "receiptClassFromLedger": receipt_class(e["late"])},
            "historicalPattern": {"ledgerText": e["shift"], "evidenceKind": "HISTORICAL_OBSERVED_CLAIM", "status": "UNVERIFIED_NOT_A_MODEL_INPUT"},
            "changes2026": {"ledgerText": e["chg"], "evidenceKind": "2026_SPECIFIC_CLAIM"},
            "confidence": {"ledgerCaveat": e.get("conf") or None, "level": "LEDGER_CAVEATED" if e.get("conf") else "LEDGER_UNCAVEATED_UNVERIFIED"},
            "citations": [cite(u) for u in e["src"]],
            "countyExceptions": [],
            "partialReporting": {"statewideClassAppliesToAllCounties": None,
                                 "note": "Unknown. The ledger describes a statewide tendency; county exceptions must be recorded here, never assumed."},
            "dateVerified": None,
            "evidenceRegisterIds": [],
        })
    rec_by = {r["jurisdiction"]["state"]: r for r in records}
    records.append({
        "jurisdiction": {"level": "DISTRICT", "state": "DC", "name": "District of Columbia"},
        "ledger": None,
        "firstRelease": None, "countSpeed": None, "pollClose": {"ledgerEasternHour": None, "verification": "NOT_IN_LEDGER"},
        "ballotMethods": None, "releaseSequence": [], "lateCounting": None, "historicalPattern": None, "changes2026": None,
        "confidence": {"ledgerCaveat": "DC is not in the supplied 50-state ledger.", "level": "NOT_COVERED"},
        "citations": [], "countyExceptions": [], "partialReporting": None, "dateVerified": None, "evidenceRegisterIds": [],
        "coverageNote": "Include only if DC contests (delegate, mayor, council, initiatives) are in the covered universe. No DC race is in public/results/2026/index.json at the time of writing.",
    })
    rec_by["DC"] = records[-1]

    # ---- evidence register ------------------------------------------------------------------------------------------
    reg = []

    def add(entry: dict):
        reg.append(entry)
        st = entry.get("state")
        if st in rec_by:
            rec_by[st]["evidenceRegisterIds"].append(entry["id"])

    t11 = next((u for u in text if "table-11-receipt" in u), None)
    t16 = next((u for u in text if "table-16-when-absentee" in u), None)
    names = list(STATES.values())
    bounds = names + ["American Samoa", "Guam", "Northern Mariana Islands", "Puerto Rico", "U.S. Virgin Islands"]
    rows11 = table_rows(text[t11], "Alabama Ala.", bounds) if t11 else {}
    rows16 = table_rows(text[t16], "Processing Can Begin", bounds) if t16 else {}
    for ab, nm in STATES.items():
        r11 = rows11.get(nm)
        if r11:
            i = r11.lower().find("must be received")
            ncsl_txt = r11[i:i + 300] if i >= 0 else r11[:240]
            ncsl_cls = receipt_class(ncsl_txt)
            led = rec_by.get(ab, {}).get("lateCounting") or {}
            led_cls = led.get("receiptClassFromLedger")
            if led_cls is None:
                status = "VERIFIED_SECONDARY"
            elif "UNCLASSIFIED" in (ncsl_cls, led_cls):
                status = "NEEDS_MANUAL_REVIEW"
            else:
                status = "VERIFIED_SECONDARY" if ncsl_cls == led_cls else "CONFLICT"
            add({"id": f"{ab}-receipt-deadline", "state": ab, "claimType": "LEGAL_RECEIPT_DEADLINE",
                 "claim": "Civilian mail/absentee ballot receipt deadline (postmark grace or not).",
                 "ledgerText": led.get("ledgerText"), "ledgerClass": led_cls, "sourceClass": ncsl_cls, "status": status,
                 "evidence": [{"url": t11, "tier": tier(t11), "retrievedAt": by_url[t11]["retrieved_at"], "sha256": by_url[t11]["sha256"], "quote": ncsl_txt[:300]}],
                 "note": "NCSL Table 11 summarizes statute; it is secondary. Military/overseas rules differ and are not compared here."})
        r16 = rows16.get(nm)
        if r16:
            add({"id": f"{ab}-processing-window", "state": ab, "claimType": "LEGAL_PREPROCESSING_PERMITTED",
                 "claim": "When absentee/mail processing (and, where stated, counting) may begin under statute.",
                 "status": "VERIFIED_SECONDARY",
                 "evidence": [{"url": t16, "tier": tier(t16), "retrievedAt": by_url[t16]["retrieved_at"], "sha256": by_url[t16]["sha256"], "quote": r16[len(nm):][:420].strip()}],
                 "note": "Legal permission to process is not tabulation, and neither is public release. NCSL: local procedures may vary from statute."})

    # curated material claims, each checked against a named cached source
    curated = [
        ("US-watson-v-rnc", None, "LEGAL_RECEIPT_DEADLINE", "Watson v. RNC (decided 2026-06-29): federal law does not preempt state post-Election Day receipt of postmarked mail ballots.",
         "table-11-receipt", r"On June 29, 2026, the U\.S\. Supreme Court ruled in Watson v\. RNC[^.]*\.",
         "Confirm against the opinion on supremecourt.gov before treating grace-period states as settled."),
        ("US-usps-postmark", None, "LATE_ARRIVAL_RISK", "A 2025-26 USPS postmark-timing change means a postmark may not reflect the drop-off date; states urged early return.",
         "nbcchicago", r"postmark changes[^.]*\.[^.]*\.", "Media only. Affects late-arrival inventory in grace-period states; no quantitative effect is assumed."),
        ("OH-sb293-grace-ended", "OH", "LEGAL_RECEIPT_DEADLINE", "Ohio SB 293 (2025) moved most absentee receipt to close of polls; UOCAVA carve-out remains.",
         "table-11-receipt", r"Ohio SB 293 \(2025\)[^.]*\.[^.]*\.", None),
        ("KS-grace-injunction", "KS", "LEGAL_RECEIPT_DEADLINE", "Kansas: an injunction keeps the 3-day postmark grace period in force for the November 2026 general.",
         "table-11-receipt", r"Kansas issued a preliminary injunction[^.]*\.[^.]*\.[^.]*\.", "Litigation is live; re-check status on Nov 2."),
        ("KS-grace-injunction-media", "KS", "LEGAL_RECEIPT_DEADLINE", "Appeals court: Kansas mail ballots accepted for three days after the November election.",
         "hppr.org", r"Kansas mail-in ballots will be accepted for three days after November election", None),
        ("MS-receipt-contingent", "MS", "LEGAL_RECEIPT_DEADLINE", "Mississippi HB 908 (2026) moved receipt to the day before the election only if SCOTUS found preemption; Watson found none.",
         "table-11-receipt", r"Mississippi HB 908 \(2026\)[^.]*\.", "Ledger says 5 business days; consistent only because the HB 908 contingency did not trigger."),
        ("UT-hb300", "UT", "LEGAL_RECEIPT_DEADLINE", "Utah HB 300 (2025): ballots must be received by 8 p.m. on Election Day.",
         "table-11-receipt", r"Utah HB 300 \(2025\)[^.]*\.", None),
        ("CA-7day-ab16", "CA", "LEGAL_RECEIPT_DEADLINE", "California counts ballots postmarked by Election Day and received within 7 days; 2025 bills changed processing and cure timelines.",
         "california-gov-gavin-newsom", r"seven days after an election, as long as the ballot is postmarked by Election Day", None),
        ("MI-8day-preprocess", "MI", "LEGAL_PREPROCESSING_PERMITTED", "Michigan jurisdictions may preprocess/tabulate absentee ballots up to eight days before Election Day.",
         "table-16-when-absentee", r"[^.]{0,120}eight days before Election Day[^.]*\.", "Permission, not practice: smaller jurisdictions may start only the day before."),
        ("MI-8day-preprocess-media", "MI", "LEGAL_PREPROCESSING_PERMITTED", "Michigan preprocessing up to eight days does not mean results are complete on election night.",
         "clickondetroit", r"preprocess and tabulate absentee ballots up to eight days before Election Day[^.]*\.", None),
        ("NC-1930-receipt", "NC", "LEGAL_RECEIPT_DEADLINE", "North Carolina civilian mail ballots must be received by 7:30 p.m. on Election Day.",
         "table-11-receipt", r"North Carolina N\.C\. Gen\. Stat\. § 163-231 ✓ Must be received by 7:30 p\.m\. on Election Day\.", None),
        ("US-mit-reporting-pace", None, "HISTORICAL_OBSERVED_SEQUENCE", "Historical national reporting pace: one hour after all polls closed ~35% counted, ~50% an hour later (MIT Election Lab).",
         "election-return-reporting", r"one hour after polls closed in all the states[^.]*\.", "National aggregate; not a per-state or per-race prior."),
        ("PA-precanvass-7am", "PA", "LEGAL_PREPROCESSING_PERMITTED", "Pennsylvania pre-canvassing of mail ballots may not begin until 7 a.m. on Election Day.",
         "table-16-when-absentee", r"25 Pa\. Stat\. § 3146\.8 7 a\.m\. on Election Day\.", "NCSL summary of 25 P.S. § 3146.8; confirm (g)(1.1) text before production use."),
    ]
    for cid, st, ctype, claim, url_key, pat, note in curated:
        u = next((x for x in by_url if url_key in x), None)
        q = quote(u, pat) if u else None
        status = ("VERIFIED_SECONDARY" if tier(u) in ("SECONDARY_RESEARCH",) else "VERIFIED_PRIMARY" if tier(u) in ("OFFICIAL", "FEDERAL_OFFICIAL") else "VERIFIED_MEDIA_ONLY") if q else (
            "SOURCE_UNAVAILABLE" if not u or u not in text else "UNRESOLVED")
        add({"id": cid, "state": st, "claimType": ctype, "claim": claim, "status": status,
             "evidence": [{"url": u, "tier": tier(u) if u else None, "retrievedAt": by_url.get(u, {}).get("retrieved_at"), "sha256": by_url.get(u, {}).get("sha256"), "quote": q}] if u else [],
             "note": note})

    for f in intel["findings"]:
        add({"id": f"intel:{f['id']}", "state": f["state"], "claimType": {"RECEIPT_DEADLINE": "LEGAL_RECEIPT_DEADLINE", "PROCESSING_WINDOW": "LEGAL_PREPROCESSING_PERMITTED",
             "TABULATION_WINDOW": "LEGAL_TABULATION_PERMITTED", "RELEASE_RESTRICTION": "LEGAL_RELEASE_RESTRICTION", "REPORTING_REQUIREMENT": "LEGAL_RELEASE_TIMING",
             "CURE_OR_REVIEW_WINDOW": "CURE_CANVASS_WINDOW", "REPORTING_UNIT_NOTE": "REPORTING_UNIT"}.get(f["fact"], f["fact"]),
             "claim": f["summary"], "status": "VERIFIED_PRIMARY_ANCHOR", "evidence": [{"sourceId": f["sourceId"], "cite": f.get("cite"), "anchor": f.get("anchor")}],
             "note": "Imported read-only from feature/election-night-intelligence-v1@0559aad3 (sequence_findings.json, anchor-checked 2026-10-26). Not re-run here.",
             "limitations": f.get("limitations", [])})
    for e in L["S"]:
        if e.get("conf"):
            add({"id": f"{e['a']}-ledger-caveat", "state": e["a"], "claimType": "LEDGER_CAVEAT", "claim": e["conf"], "status": "UNRESOLVED",
                 "evidence": [], "note": "Explicit verification caveat carried from the ledger."})
    add({"id": "ALL-ledger-sequences", "state": None, "claimType": "ESTIMATED_2026_ORDER",
         "claim": "Each state's releaseSequence is the ledger author's expected 2026 order.", "status": "PRIOR_NOT_VERIFIED", "evidence": [],
         "note": "Used only as a scenario prior with uncertainty, never as a schedule or a partisan adjustment."})
    add({"id": "ALL-ledger-shifts", "state": None, "claimType": "HISTORICAL_OBSERVED_SEQUENCE",
         "claim": "Each state's historicalPattern (partisan lean of early vs late batches) as stated by the ledger.", "status": "UNVERIFIED_NOT_A_MODEL_INPUT", "evidence": [],
         "note": "Requires timestamped historical returns to verify; until then context text only."})

    for r in records:
        st = r["jurisdiction"]["state"]
        ok = [x for x in reg if x.get("state") == st and x["status"].startswith("VERIFIED")]
        r["dateVerified"] = max((ev.get("retrievedAt") or "" for x in ok for ev in x["evidence"]), default=None) or (
            "2026-10-26" if any(x["id"].startswith("intel:") for x in ok) else None)

    counts = {}
    for x in reg:
        counts[x["status"]] = counts.get(x["status"], 0) + 1
    meta = {"schema": "vai-count-order/1", "builtAt": built, "builder": "scripts/vai/build_count_order.py",
            "ledger": {"file": "Count Order 2026.html", "sha256": html_sha, "states": len(L["S"]), "caveats": sum(1 for e in L["S"] if e.get("conf")),
                       "ncslProcessingTable": L["NCSL"]},
            "categories": L["CATS"], "speedLabels": L["SPEED"],
            "rules": ["Ledger text is preserved verbatim in ledgerText fields.", "releaseSequence is a prior (ESTIMATED_2026_ORDER), not a schedule.",
                      "historicalPattern is not a model input.", "A statewide class does not describe every county; countyExceptions must be filled from evidence."]}
    os.makedirs(a.out, exist_ok=True)
    json.dump({**meta, "jurisdictions": records}, open(os.path.join(a.out, "count_order_2026.json"), "w"), indent=1, ensure_ascii=False)
    json.dump({"schema": "vai-evidence-register/1", "builtAt": built, "statusCounts": counts,
               "sourcesFetched": {"total": len(fetch), "ok": sum(1 for f in fetch if f.get("status") == 200)},
               "statusMeaning": {"VERIFIED_PRIMARY": "quote found in an official/legislative source", "VERIFIED_PRIMARY_ANCHOR": "intel-branch anchor check against an official source",
                                 "VERIFIED_SECONDARY": "quote found in NCSL/Ballotpedia/MIT/CEIR (summaries of law)", "VERIFIED_MEDIA_ONLY": "quote found only in news media",
                                 "CONFLICT": "ledger and source classify differently", "NEEDS_MANUAL_REVIEW": "automatic classification failed",
                                 "UNRESOLVED": "source cached but claim not found", "SOURCE_UNAVAILABLE": "source not retrievable",
                                 "PRIOR_NOT_VERIFIED": "expectation only", "UNVERIFIED_NOT_A_MODEL_INPUT": "context text only"},
               "entries": reg}, open(os.path.join(a.out, "evidence_register_2026.json"), "w"), indent=1, ensure_ascii=False)
    print(json.dumps(counts), file=sys.stderr)
    for x in reg:
        if x["status"] in ("CONFLICT", "NEEDS_MANUAL_REVIEW", "UNRESOLVED", "SOURCE_UNAVAILABLE"):
            print(x["status"], x["id"], "| ledger:", (x.get("ledgerText") or "")[:110], "| src:", ((x.get("evidence") or [{}])[0].get("quote") or "")[:140], file=sys.stderr)


if __name__ == "__main__":
    main()
