import type { Metadata } from "next";
import Link from "@/app/components/Link";
import ReaderPoll from "@/app/components/ReaderPoll";
import PredictPoll from "@/app/components/PredictPoll";
import StayConnected, { Follow } from "@/app/components/StayConnected";
import { SOCIAL } from "@/app/lib/offers";
import { seo } from "@/app/lib/seo";
import "@/app/components/community.css";

export const metadata: Metadata = seo({ title: "The On Point community", description: "Vote in the weekly reader poll, call the next On Point poll, build your own 2028 map, and join the On Point Discord, YouTube and X.", path: "/community" });

const PLACES = [
  { t: "Build your 2028 map", s: "Start from the On Point forecast, click any state to rate it, and share your map on X.", href: "/2028/map-maker", cta: "Open the map maker" },
  { t: "What moved this week", s: "Every change to the forecast, explained in plain language, every week.", href: "/what-moved", cta: "Read what moved" },
  { t: "The Weighting Room", s: "Members get the raw crosstabs, model notes, a monthly live Q and A and the workshop replays.", href: "/on-point-polling/weighting-room", cta: "See membership", gold: true },
  { t: "Learn how polls work", s: "Live workshops on weighting, likely voters and building a county forecast, from the desk that called 2026.", href: "/workshops", cta: "See the workshops" },
];

export default function Page() {
  return (
    <div className="opp">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><span>Community</span></nav>
      <header className="ph">
        <div className="eye g">The On Point community</div>
        <h1>Make the call <em>yourself</em></h1>
        <p className="lede">Vote in this week&apos;s reader poll, call our next poll before it comes out, and build your own 2028 map. Then argue about it with everyone else in the Discord.</p>
        <div style={{ marginTop: 14 }}><Follow /></div>
      </header>
      <div className="cm-grid" style={{ maxWidth: 1100, margin: "0 auto", alignItems: "start" }}>
        <ReaderPoll />
        <PredictPoll />
      </div>
      <div className="cm-grid" style={{ maxWidth: 1100, margin: "24px auto" }}>
        {PLACES.map((p) => (
          <div key={p.t} className="cm-card" style={p.gold ? { borderColor: "rgba(231,179,65,.6)" } : undefined}>
            <h3 style={{ fontSize: 18 }}>{p.t}</h3><p className="cm-mute" style={{ fontSize: 14 }}>{p.s}</p>
            <Link className={`btn${p.gold ? " gold" : ""}`} href={p.href} style={{ justifySelf: "start" }}>{p.cta}</Link>
          </div>
        ))}
        <div className="cm-card"><h3 style={{ fontSize: 18 }}>The On Point Discord</h3><p className="cm-mute" style={{ fontSize: 14 }}>Live threads on election nights and poll releases, a channel for every state, and the desk in the room.</p><a className="oc-soc dc" href={SOCIAL.discord} target="_blank" rel="noopener noreferrer" style={{ justifySelf: "start" }}>Join the Discord</a></div>
      </div>
      <StayConnected from="community" />
    </div>
  );
}
