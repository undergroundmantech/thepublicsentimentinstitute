import { getModel } from "@/app/lib/forecastData";
import { OG_SIZE, OG_TYPE, ogCard, pctOg, dayOg, C } from "@/app/lib/og";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "On Point Politics 2026 midterm forecast";

export default function Image() {
  const { chambers: ch, meta } = getModel();
  return ogCard({
    eyebrow: `2026 forecast · ${dayOg(meta.updated)}`,
    title: "Who wins the 2026 midterms",
    sub: `House: Democrats ${pctOg(ch.house.demControl)}, Republicans ${pctOg(ch.house.gopControl)} to win control`,
    left: { label: "Senate · Democrats", value: pctOg(ch.senate.demControl), color: C.dem },
    right: { label: "Republicans", value: pctOg(ch.senate.gopControl), color: C.gop },
    split: ch.senate.demControl,
    foot: `${meta.sims.toLocaleString()} simulations · ${meta.daysOut} days to go`,
  });
}
