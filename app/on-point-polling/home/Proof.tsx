// The record in one line of four numbers, read from the accuracy files so every sales page quotes the same figures.
import Link from "@/app/components/Link";
import { getBench, getPolling } from "@/app/accuracy/bench";

export default function Proof() {
  const B = getBench(), S = getPolling().summary, g = B.generic;
  const rank = B.national.polls.findIndex((p) => p.us) + 1;
  const items = [
    { b: `D +${g.us.margin.toFixed(1)}`, s: `Our final 2026 national poll, against a D +${g.result.margin.toFixed(1)} count` },
    { b: `${rank} of ${B.national.polls.length}`, s: "Final national polls, ranked by distance from the count" },
    { b: `${S.senate.right} of ${S.senate.n}`, s: "Senate winners called in our final state polls" },
    { b: `${S.states} states`, s: "And the nation polled in 2026, every poll scored in public" },
  ];
  return (
    <section className="oph-proof" aria-label="Track record">
      <ul>{items.map((x) => <li key={x.s}><b>{x.b}</b><span>{x.s}</span></li>)}</ul>
      <Link href="/accuracy" className="oph-proof-l">The 2026 accuracy report</Link>
    </section>
  );
}
