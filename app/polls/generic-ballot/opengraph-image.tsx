import { OG_SIZE, OG_TYPE } from "@/app/lib/og";
import { avgById } from "../seo";
import { avgCard } from "../[state]/[race]/opengraph-image";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "On Point Politics polling average";

export default function Image() {
  return avgCard(avgById("generic-ballot")!);
}
