import { C, OG_SIZE, OG_TYPE, ogCard } from "@/app/lib/og";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "On Point Polling Texas poll, October 2026";

export default function Image() {
  return ogCard({
    eyebrow: "On Point Polling · Oct 17 to 18",
    title: "Texas poll: U.S. Senate",
    sub: "Governor: Abbott 47.7, Hinojosa 45.2 · likely voters",
    left: { label: "Talarico · Dem", value: "48.8%", color: C.dem },
    right: { label: "Paxton · Rep", value: "43.0%", color: C.gop },
    split: 48.8 / (48.8 + 43.0),
    foot: "661 registered voters · margin of error ±5.5 among likely voters",
  });
}
