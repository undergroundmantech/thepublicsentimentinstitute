import { SIZE, playCard } from "../og";
import { load } from "../data";
import { flipLine, last } from "../../share28";

export const size = SIZE;
export const contentType = "image/png";
export const alt = "A Campaign 2028 result";

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params; const x = load(code);
  if (!x) return playCard({ eyebrow: "Campaign 2028", title: "Run for president", sub: "Every state and county from the On Point 2028 forecast.", dWon: {} });
  const { r, dWon } = x; const dN = r.p === "D" ? r.me : r.op, rN = r.p === "D" ? r.op : r.me; const dEv = r.p === "D" ? r.ev : 538 - r.ev;
  return playCard({ eyebrow: r.day ? "Campaign 2028 · daily challenge" : "Campaign 2028", title: r.win ? `${last(r.me)} wins the White House` : `${last(r.op)} beats ${last(r.me)}`,
    sub: flipLine(r) ? `${flipLine(r)}. Can you beat it?` : "Can you beat it? Play the same race.", dWon, left: [last(dN), dEv], right: [last(rN), 538 - dEv] });
}
