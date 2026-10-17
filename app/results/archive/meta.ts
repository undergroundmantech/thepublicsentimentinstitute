import type { Metadata } from "next";
import { STATE_NAME } from "@/app/lib/opp";
import { seo } from "@/app/lib/seo";
import { formatElectionDate, getRacesByDate } from "../_data/raceRegistry";

const NAMES = Object.values(STATE_NAME).sort((a, b) => b.length - a.length);

/** States on the ballot that night, in the order their races are listed. */
export function nightStates(date: string): string[] {
  const out: string[] = [];
  for (const r of getRacesByDate(date)) {
    const s = NAMES.find((n) => r.label.startsWith(n));
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

const list = (a: string[]) => (a.length <= 1 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);

/** Title, description and canonical for one election night board. */
export function nightMeta(date: string, path = `/results/archive/${date}`): Metadata {
  const heading = formatElectionDate(date);
  const n = getRacesByDate(date).length;
  const st = nightStates(date);
  const where = st.length ? `${st.length > 4 ? `${st.slice(0, 4).join(", ")} and more` : list(st)} ` : "";
  return seo({
    title: `${heading} election results${st.length ? `: ${st.slice(0, 3).join(", ")}${st.length > 3 ? " and more" : ""}` : ""}`,
    description: `${where}election results from ${heading}: all ${n} races On Point Politics tracked that night, with county by county returns and final vote totals.`,
    path,
  });
}
