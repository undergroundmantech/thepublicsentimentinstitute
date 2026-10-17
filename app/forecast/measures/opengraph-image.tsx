import { getMeasures } from "./data";
import { OG_SIZE, OG_TYPE, ogCard, pctOg, dayOg, C } from "@/app/lib/og";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "On Point Politics 2026 ballot measure forecast";

export default function Image() {
  const ms = getMeasures();
  const n = ms.measures.length;
  const pass = ms.measures.filter((m) => m.est.prob > 0.5).length;
  return ogCard({
    eyebrow: `2026 forecast · ${dayOg(ms.meta.updated)}`,
    title: "Every statewide ballot measure",
    sub: `${n} measures in ${ms.meta.states} states, forecast county by county`,
    left: { label: "Favored to pass", value: String(pass), color: C.yes },
    right: { label: "Favored to fail", value: String(n - pass), color: C.no },
    split: pass / n,
    foot: "November 3, 2026",
  });
}
