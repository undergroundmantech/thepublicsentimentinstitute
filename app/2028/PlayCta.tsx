// A way into Campaign 2028 from the forecast pages: the same data, played instead of read.
import Toon from "@/app/majority-tracker/Toon";

export default function PlayCta({ title, note, href = "/play", as, side }: { title: string; note: string; href?: string; as?: string; side?: "D" | "R" }) {
  return (
    <a className="h28-play" href={as ? `/play?as=${encodeURIComponent(as)}` : href} data-ev="Play promo" data-ev-d={JSON.stringify({ as: as ?? null })}>
      <span className="art" aria-hidden="true">{as && side ? <Toon name={as} side={side} size={64} uid="pc" /> : <i>🗳️</i>}</span>
      <span className="t"><em>Campaign 2028 · free game</em><b>{title}</b><span>{note}</span></span>
      <span className="go">Play now</span>
    </a>
  );
}
