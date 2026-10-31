This directory holds per-race JSON snapshot blobs written by the flight
recorder capture route (`app/api/flightrecorder/capture/route.ts`,
CHANGE-ORDER-04 §6). The blobs themselves (`<raceId>.json`) are gitignored —
they're runtime-generated append-only history, not source. This file exists
only so the directory itself is present in a fresh checkout.

The intelligence layer keeps its own evidence ledger (app/lib/intelligence/capture.ts,
app/api/intelligence/capture/route.ts) in data/intelligence-capture/, also gitignored. The two do not share files.
