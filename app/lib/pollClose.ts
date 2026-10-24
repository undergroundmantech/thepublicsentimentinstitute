// When the last polls close on November 3, 2026, in Eastern time, for each state, and where part of a state closes
// an hour earlier because it sits in an earlier time zone. North Dakota closes by county at different hours and is
// left out rather than given a single time.
export const POLL_CLOSE: Record<string, number> = {
  GA: 19, VT: 19, VA: 19, SC: 19, IN: 19, KY: 19, NC: 19.5, OH: 19.5, WV: 19.5,
  AL: 20, CT: 20, DE: 20, FL: 20, IL: 20, ME: 20, MD: 20, MA: 20, MS: 20, MO: 20, NH: 20, NJ: 20, OK: 20, PA: 20, RI: 20, TN: 20, DC: 20, AR: 20.5,
  TX: 21, AZ: 21, CO: 21, KS: 21, LA: 21, MI: 21, MN: 21, NM: 21, NY: 21, SD: 21, WI: 21, WY: 21, IA: 21,
  NE: 22, MT: 22, NV: 22, UT: 22, ID: 23, OR: 23, CA: 23, WA: 23, HI: 24, AK: 26,
};
const EARLY_PART: Record<string, string> = {
  FL: "most of the state closes an hour earlier, with the western Panhandle last", TX: "most of the state closes an hour earlier, with El Paso and Hudspeth counties last",
  KS: "most of the state closes an hour earlier, with four western counties last", MI: "most of the state closes an hour earlier, with four Upper Peninsula counties last",
  SD: "the eastern half closes an hour earlier", NE: "most of the state closes an hour earlier, with the Panhandle last",
  KY: "the eastern half closes an hour earlier", IN: "most of the state closes an hour earlier, with the northwest and southwest corners last",
  ID: "the southern part closes an hour earlier", OR: "Malheur County closes an hour earlier", AK: "most of the state closes an hour earlier, with the Aleutian Islands last",
};
const clock = (h: number) => {
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60), H = hh % 24, h12 = H % 12 === 0 ? 12 : H % 12;
  return `${h12}${mm ? `:${String(mm).padStart(2, "0")}` : ""} ${H >= 12 ? "p.m." : "a.m."} Eastern${hh >= 24 ? " on November 4" : ""}`;
};
/** "All polls in Texas close by 9 p.m. Eastern; most of the state closes an hour earlier, ..." or null. */
export function closeSentence(st: string, name: string): string | null {
  const h = POLL_CLOSE[st]; if (h == null) return null;
  return `All polls in ${name} close by ${clock(h)}${EARLY_PART[st] ? `; ${EARLY_PART[st]}` : ""}.`;
}
export const closeClock = (st: string) => (POLL_CLOSE[st] == null ? null : clock(POLL_CLOSE[st]));
