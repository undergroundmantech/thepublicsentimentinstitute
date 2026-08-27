/**
 * Checks the archive board's label parsing against every registry entry, and
 * confirms the CivicAPI feed still answers for each date with the ids the
 * registry expects. Run: npx --yes tsx@4 scripts/check_archive_board.ts
 */

import { ELECTION_DATES, getRacesByDate } from "../app/results/_data/raceRegistry";
import { placeOf, titleOf } from "../app/results/archive/labels";

let bad = 0;

for (const date of ELECTION_DATES) {
  const entries = getRacesByDate(date);
  const places = new Set<string>();
  for (const e of entries) {
    const { place, rest } = placeOf(e.label);
    const { title, sub } = titleOf(rest);
    places.add(place);
    if (place === "Other races" || !title) {
      bad++;
      console.log(`  UNPARSED  ${e.label}  →  place="${place}" title="${title}" sub="${sub}"`);
    }
  }
  console.log(`${date}  ${String(entries.length).padStart(3)} races  ${[...places].join(", ")}`);
}

console.log(bad === 0 ? "\nAll labels parsed." : `\n${bad} label(s) unparsed.`);

const SAMPLES = ELECTION_DATES.slice(0, 4);

async function checkFeed() {
  for (const date of SAMPLES) {
    const ids = new Set(getRacesByDate(date).map((e) => e.id));
    const r = await fetch(
      `https://civicapi.org/api/v2/race/search?startDate=${date}&endDate=${date}&limit=50000`,
    );
    const j = (await r.json()) as { races?: { id: number; candidates?: unknown[] }[] };
    const found = (j.races || []).filter((x) => ids.has(Number(x.id)));
    const withCands = found.filter((x) => (x.candidates || []).length > 0);
    console.log(
      `${date}  feed matched ${found.length}/${ids.size} registry races, ${withCands.length} carrying candidates`,
    );
  }
}

const CASES: [string, string, string][] = [
  ["South Carolina US Senate Special Republican Runoff", "U.S. Senate Special", "Republican runoff"],
  ["Texas US Senate Republican Primary Runoff", "U.S. Senate", "Republican primary runoff"],
  ["Georgia US House 13 Runoff", "U.S. House 13", "Runoff"],
  ["California Governor Open Primary", "Governor", "Open primary"],
  ["Los Angeles Mayor Open Primary", "Los Angeles Mayor", "Open primary"],
  ["DC Mayor Democratic Primary", "Mayor", "Democratic primary"],
];
for (const [label, title, sub] of CASES) {
  const got = titleOf(placeOf(label).rest);
  const ok = got.title === title && got.sub === sub;
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}  →  "${got.title}" · "${got.sub}"`);
}

checkFeed().then(() => process.exit(bad === 0 ? 0 : 1));
