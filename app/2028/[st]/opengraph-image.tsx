// The share card for a state's 2028 page: the likeliest matchup and each nominee's chance of carrying the state.
import { OG_SIZE, OG_TYPE, ogCard, pctOg, C } from "@/app/lib/og";
import { featured, stateCodes } from "../data28";
import { STATE_NAME, fmtMg } from "../lib";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "On Point Politics 2028 state forecast";
export function generateStaticParams() { return stateCodes().map((s) => ({ st: s.toLowerCase() })); }

export default async function Image({ params }: { params: Promise<{ st: string }> }) {
  const { st } = await params; const S = st.toUpperCase(); const name = STATE_NAME[S] ?? S;
  const p = featured(8)[0]; const v = p.st[S];
  if (!v) return ogCard({ eyebrow: "2028 forecast", title: `${name} in 2028` });
  const last = (n: string) => n.split(" ").pop() ?? n;
  return ogCard({
    eyebrow: "2028 presidential forecast",
    title: `Who wins ${name} in 2028`,
    sub: `${p.d} vs ${p.r} · ${fmtMg(v[0])}`,
    left: { label: `${last(p.d)} · Dem`, value: pctOg(v[1]), color: C.dem },
    right: { label: `${last(p.r)} · Rep`, value: pctOg(1 - v[1]), color: C.gop },
    split: v[1],
    foot: "Chance to carry the state, from 20,000 simulated elections",
  });
}
