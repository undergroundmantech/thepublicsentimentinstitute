import type { Metadata } from "next";
import Link from "@/app/components/Link";
import StayConnected, { Follow } from "@/app/components/StayConnected";
import { seo } from "@/app/lib/seo";

export const metadata: Metadata = seo({ title: "Free alerts: every new video, poll and forecast", description: "Get an email the moment On Point Politics posts a new video, releases a new poll or moves the forecast. Free, and you can leave any time.", path: "/alerts" });

const HOW = [
  ["New videos", "The minute a new On Point video goes up on YouTube, you get the link by email."],
  ["New polls", "Every On Point Polling release, the day it comes out, with the topline in the message."],
  ["The majority tracker", "When a senator moves in the leader race, or the count changes."],
  ["The 2028 forecast", "When the map or the nomination odds shift enough to matter."],
  ["Workshop dates", "First word when a new class or course opens, before it is announced anywhere else."],
];

export default function Page() {
  return (
    <div className="opp">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><span>Alerts</span></nav>
      <header className="ph">
        <div className="eye g">Free alerts</div>
        <h1>Never miss an On Point <em>video</em></h1>
        <p className="lede">Pick what you want to hear about, leave your email, and you will hear first. No spam: only what you picked, and every message has a one click way out.</p>
      </header>
      <StayConnected from="alerts" title="Sign up for alerts" note="Pick topics, then add your email." pick={["videos", "polls", "forecast"]} />
      <div className="grid2" style={{ maxWidth: 1000, margin: "0 auto" }}>
        {HOW.map(([t, s]) => <div key={t} className="card"><div className="card-b"><h3 style={{ fontSize: 16 }}>{t}</h3><p style={{ marginTop: 6, fontSize: 14 }}>{s}</p></div></div>)}
        <div className="card"><div className="card-b"><h3 style={{ fontSize: 16 }}>Follow everywhere else</h3><p style={{ margin: "6px 0 12px", fontSize: 14 }}>Clips on X, full breakdowns on YouTube, and the conversation in the Discord.</p><Follow compact /></div></div>
      </div>
      <p className="cm-mute" style={{ maxWidth: 1000, margin: "24px auto", fontSize: 12.5 }}>Your email is never sold or shared for marketing, and every message has a one click unsubscribe. See the <Link href="/privacy">privacy policy</Link> and <Link href="/terms">terms</Link>.</p>
    </div>
  );
}
