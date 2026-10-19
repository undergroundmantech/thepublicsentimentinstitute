import { C, OG_SIZE, OG_TYPE, ogCard } from "@/app/lib/og";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "On Point Polling Ohio poll, October 2026";

export default function Image() {
  return ogCard({
    eyebrow: "On Point Polling · Oct 16 to 17",
    title: "Ohio poll: U.S. Senate",
    sub: "Governor: Acton 47.9, Ramaswamy 43.1 · 635 likely voters",
    left: { label: "Brown · Dem", value: "46.6%", color: C.dem },
    right: { label: "Husted · Rep", value: "42.3%", color: C.gop },
    split: 46.6 / (46.6 + 42.3),
    foot: "Margin of error ±4.9 among likely voters",
  });
}
