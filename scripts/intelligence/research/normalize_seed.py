#!/usr/bin/env python3
"""Normalizes the 2026-10-25 research seed (an externally supplied ZIP) into a small committed dataset.

The ZIP is not committed (it is supplied by the analyst and is gitignored under chatGPTfiles/). What is committed is
the normalized dataset with the ZIP's checksum and the transformation, so the build is reproducible without the ZIP.

    python3 scripts/intelligence/research/normalize_seed.py [--zip PATH]

Transformation (SEED_NORMALIZE/1): read the one JSON member; keep title, as_of, scope, status, critical_limitations,
sources and, per state, only the fields listed in STATE_FIELDS; sort states by postal code; write with sorted keys and no
timestamp, so the output depends only on the input bytes. The seed's content is not corrected or extended: it is a
research seed, not verified data.
"""
import argparse, hashlib, json, os, sys, zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
DEFAULT_ZIP = os.path.join(ROOT, "chatGPTfiles", "OnPoint_15_State_Reporting_Research_Seed_2026-10-25.zip")
OUT = os.path.join(ROOT, "data", "intelligence", "seed", "priority15-seed-normalized.json")
MEMBER = "priority_15_state_research_seed.json"
STATE_FIELDS = ["state", "race_ids", "legal_scanning_category", "legal_scanning_evidence", "legal_scanning_status",
                "operational_watchpoints", "operational_watchpoints_evidence", "partisan_data_status", "next_verification"]
TOP_FIELDS = ["title", "as_of", "scope", "status", "critical_limitations", "sources"]
TRANSFORM_VERSION = "SEED_NORMALIZE/1"
SCHEMA_VERSION = "priority15-seed-normalized/1"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--zip", default=DEFAULT_ZIP)
    args = ap.parse_args()
    if not os.path.exists(args.zip):
        sys.exit(f"SEED NOT FOUND: {args.zip}. The seed ZIP is supplied by the analyst and is not in the repository. "
                 f"The committed {os.path.relpath(OUT, ROOT)} is the normalized form and is enough to run the build.")
    raw = open(args.zip, "rb").read()
    z = zipfile.ZipFile(args.zip)
    if MEMBER not in z.namelist():
        sys.exit(f"SEED INVALID: {MEMBER} is not in {args.zip}; members are {z.namelist()}")
    member = z.read(MEMBER)
    seed = json.loads(member)
    missing = [k for k in TOP_FIELDS + ["states"] if k not in seed]
    if missing:
        sys.exit(f"SEED INVALID: missing top-level keys {missing}")
    states = []
    for s in sorted(seed["states"], key=lambda x: x["state"]):
        gone = [f for f in STATE_FIELDS if f not in s]
        if gone:
            sys.exit(f"SEED INVALID: state {s.get('state')} is missing {gone}")
        states.append({f: s[f] for f in STATE_FIELDS})
    out = {"schemaVersion": SCHEMA_VERSION, "transformVersion": TRANSFORM_VERSION,
           "sourceArchive": {"name": os.path.basename(args.zip), "sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw),
                             "member": MEMBER, "memberSha256": hashlib.sha256(member).hexdigest(), "memberBytes": len(member)},
           "provenance": "Supplied by the analyst (ChatGPT-assisted research seed, 2026-10-25). Not independently verified; see critical_limitations.",
           **{k: seed[k] for k in TOP_FIELDS}, "states": states}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f, indent=1, sort_keys=True)
        f.write("\n")
    print(f"wrote {os.path.relpath(OUT, ROOT)}: {len(states)} states, archive sha256 {out['sourceArchive']['sha256'][:12]}")


if __name__ == "__main__":
    main()
