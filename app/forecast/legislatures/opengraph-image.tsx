import { getStatehouse } from "./data";
import { OG_SIZE, OG_TYPE, ogCard, pctOg, dayOg, C } from "@/app/lib/og";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "On Point Politics 2026 state legislative forecast";

export default function Image() {
  const sl = getStatehouse();
  const favD = sl.chambers.filter((c) => c.demControl > c.gopControl).length;
  const n = sl.chambers.length;
  return ogCard({
    eyebrow: `2026 forecast · ${dayOg(sl.meta.updated)}`,
    title: "Every state legislature",
    sub: `${n} chambers and ${sl.meta.seatsUp.toLocaleString()} seats, forecast district by district`,
    left: { label: "Favored · Dem", value: String(favD), color: C.dem },
    right: { label: "Favored · Rep", value: String(n - favD), color: C.gop },
    split: favD / n,
    foot: "Chambers each party is favored to control",
  });
}
