"""Print the competitive-state procedures table used in docs/VAI_V1_RESEARCH_AUDIT.md §5.2."""
import collections
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def short(s, n):
    s = s.replace("|", "/")
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


def main():
    co = json.loads((ROOT / "data/vai/count_order_2026.json").read_text())
    rg = json.loads((ROOT / "data/vai/evidence_register_2026.json").read_text())
    ix = json.loads((ROOT / "public/results/2026/index.json").read_text())
    jur = {j["jurisdiction"]["state"]: j for j in co["jurisdictions"]}
    ev = collections.defaultdict(list)
    for e in rg["entries"]:
        if e.get("state"):
            ev[e["state"]].append(e)
    comp = collections.Counter(
        r["st"] for r in ix["races"]
        if r["k"] in ("sen", "gov", "house") and r.get("pR") is not None and 0.1 <= r["pR"] <= 0.9
    )
    print("| State | Competitive races | Ledger first release (prior) | Ledger speed | Civilian mail receipt (NCSL T11) | Processing may begin (NCSL T16) | Intel primary anchors | Open ledger caveat |")
    print("|---|---|---|---|---|---|---|---|")
    for st, n in sorted(comp.items(), key=lambda x: (-x[1], x[0])):
        j, es = jur[st], ev[st]
        rc = [e for e in es if e["id"] == f"{st}-receipt-deadline"]
        pw = [e for e in es if e["id"] == f"{st}-processing-window"]
        anchors = sum(1 for e in es if e["id"].startswith("intel:"))
        print(
            f"| {st} | {n} | {j['firstRelease']['category']}: {j['firstRelease']['label']} | {j['countSpeed']['label']} | "
            f"{short(rc[0]['evidence'][0]['quote'], 100) if rc else '—'} | {short(pw[0]['evidence'][0]['quote'], 110) if pw else '—'} | "
            f"{anchors or '—'} | {short(j['confidence']['ledgerCaveat'] or '—', 90)} |"
        )


if __name__ == "__main__":
    main()
