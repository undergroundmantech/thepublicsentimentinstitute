/**
 * Registry labels are one flat string — "South Carolina US Senate Special
 * Republican Runoff". The archive board needs them split into the place that
 * voted and the office at stake, so it can group by state and print a card
 * title that is not just the label again.
 */

const STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
  "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
  "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
  "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina",
  "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island",
  "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
  "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
];

/** Labels that name a city or a district rather than a state. `keep` leaves the
 *  prefix in the card title, where dropping it would leave a bare "Mayor". */
const ALIASES: { prefix: string; place: string; keep: boolean }[] = [
  { prefix: "Los Angeles", place: "California", keep: true },
  { prefix: "DC", place: "Washington, D.C.", keep: false },
];

const PLACES = [
  ...ALIASES,
  ...STATES.map((s) => ({ prefix: s, place: s, keep: false })),
].sort((a, b) => b.prefix.length - a.prefix.length);

export function placeOf(label: string): { place: string; rest: string } {
  for (const { prefix, place, keep } of PLACES) {
    if (label === prefix || label.startsWith(`${prefix} `)) {
      return { place, rest: keep ? label : label.slice(prefix.length).trim() };
    }
  }
  return { place: "Other races", rest: label };
}

const KIND =
  /\s+(?:(Democratic|Republican|Nonpartisan|Open)\s+)?((?:Primary\s+)?(?:Runoff|Primary|Special|General))$/i;

const cap = (s: string) => `${s[0].toUpperCase()}${s.slice(1)}`;

/** "US Senate Republican Primary Runoff" → "U.S. Senate" · "Republican primary runoff" */
export function titleOf(rest: string): { title: string; sub: string } {
  const m = rest.match(KIND);
  const title = (m ? rest.slice(0, m.index) : rest).trim().replace(/^US\b/, "U.S.");
  if (!m) return { title, sub: "" };
  const kind = m[2].toLowerCase();
  return { title, sub: m[1] ? `${cap(m[1].toLowerCase())} ${kind}` : cap(kind) };
}
