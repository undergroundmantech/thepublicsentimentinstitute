// Everything On Point runs besides the forecast, in two shapes: a rail of stacked widgets beside a map, and a full band
// of every channel. Young readers find the game, the videos and the Discord; campaigns and donors find the pollster.
import Link from "./Link";
import { LOCALS, SOCIAL, TIERS } from "@/app/lib/offers";
import "./promohub.css";

const YT = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.7 15.1V8.9l5.8 3.1-5.8 3.1z" /></svg>;
const DC = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18.2 18.2 0 0 0-5.5 0L8.6 3a19.6 19.6 0 0 0-4.9 1.4C.6 9 0 13.6.3 18.1a19.8 19.8 0 0 0 6 3l1.3-2.1c-.7-.3-1.4-.6-2-1l.5-.4a14 14 0 0 0 11.8 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.7 19.7 0 0 0 6-3c.4-5.2-.7-9.7-3.4-13.7zM8.5 15.4c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4zm7 0c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4z" /></svg>;
const XI = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.8 2h3.4l-7.4 8.5L22.5 22h-6.8l-5.3-7-6.1 7H.9l7.9-9L.5 2h7l4.8 6.4L17.8 2zm-1.2 18h1.9L6.5 3.9H4.5L16.6 20z" /></svg>;
const SS = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h18v2.6H3zm0 5h18v2.6H3zm0 5h18V22l-9-5-9 5z" /></svg>;
const GAME = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 6h10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.3 2.1L14 14h-4l-1.7 2.6A3.5 3.5 0 0 1 2 14.5V11a5 5 0 0 1 5-5zm1 3v2H6v2h2v2h2v-2h2v-2h-2V9zm8.5 1a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zm-2 2.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z" /></svg>;
const POLL = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10h3v10zm6.5 0V4h3v16zM17 20v-7h3v7z" /></svg>;

type Item = { k: string; eye: string; t: string; s: string; cta: string; href: string; ext?: boolean; icon: React.ReactNode };
const ITEMS: Item[] = [
  { k: "game", eye: "Free game", t: "Campaign 2028", s: "Run for president on this forecast. Win the primaries, then fight county by county to 270.", cta: "Play now", href: "/play", icon: GAME },
  { k: "yt", eye: "YouTube", t: "Watch On Point", s: "Forecast breakdowns, election nights live and every new poll, explained on camera.", cta: "Subscribe", href: SOCIAL.youtubeSub, ext: true, icon: YT },
  { k: "dc", eye: "Discord", t: "Join the Discord", s: "Live threads on election nights, a channel for every state and the desk in the room.", cta: "Join free", href: SOCIAL.discord, ext: true, icon: DC },
  { k: "cm", eye: "Community", t: "Make the call yourself", s: "Vote in the weekly reader poll and guess our next national poll for the leaderboard.", cta: "Vote now", href: "/community", icon: POLL },
  { k: "lb", eye: "Leaderboard", t: "This week's top players", s: "The best Campaign 2028 runs and the sharpest poll calls, reset every Monday.", cta: "See the board", href: "/play/leaderboard", icon: GAME },
  { k: "mm", eye: "Map maker", t: "Make your own 2028 map", s: "Rate every state, then share your map on X with one click.", cta: "Make a map", href: "/2028/map-maker", icon: POLL },
  { k: "x", eye: "X", t: "Follow @onpointpolitics", s: "Every new poll and forecast shift the minute it lands.", cta: "Follow", href: SOCIAL.x, ext: true, icon: XI },
  { k: "ss", eye: "Substack", t: "Read the newsletter", s: "The long reads: what moved the model and why, every week.", cta: "Read free", href: SOCIAL.substack, ext: true, icon: SS },
  { k: "wr", eye: `Members · ${TIERS[0].price} ${TIERS[0].per}`, t: "The Weighting Room", s: "Full crosstabs the day a poll drops, model notes, a monthly live Q and A and the replay library.", cta: "Become a member", href: LOCALS, ext: true, icon: POLL },
  { k: "ws", eye: "Workshops", t: "Learn how polls work", s: "Live classes on weighting, likely voters and building a county forecast of your own.", cta: "See the classes", href: "/workshops", icon: POLL },
];
const HIRE: Item = { k: "hire", eye: "On Point Polling", t: "Commission a poll", s: "Our final 2026 national poll landed within a point of the count. Custom polls, county forecasts and strategy for campaigns, PACs and causes.", cta: "Work with us", href: "/on-point-polling", icon: POLL };

function Card({ x, size }: { x: Item; size: "s" | "l" }) {
  const inner = <>
    <span className="ph-i" aria-hidden="true">{x.icon}</span>
    <span className="ph-t"><em>{x.eye}</em><b>{x.t}</b>{size === "l" || x.k === "hire" || x.k === "game" ? <span>{x.s}</span> : null}</span>
    <span className="ph-go">{x.cta}</span>
  </>;
  const cls = `ph-card ph-${x.k} ph-${size}`;
  return x.ext ? <a className={cls} href={x.href} target="_blank" rel="noopener noreferrer" data-ev="Promo" data-ev-d={JSON.stringify({ to: x.k })}>{inner}</a>
    : <Link className={cls} href={x.href} data-ev="Promo" data-ev-d={JSON.stringify({ to: x.k })}>{inner}</Link>;
}

/** The stacked widgets for the right rail beside a map. */
export function PromoRail({ keys = ["game", "yt", "dc", "cm"] }: { keys?: string[] }) {
  return (
    <aside className="ph-rail" aria-label="More from On Point">
      {keys.map((k) => ITEMS.find((x) => x.k === k)).filter(Boolean).map((x) => <Card key={x!.k} x={x!} size="s" />)}
      <Card x={HIRE} size="s" />
    </aside>
  );
}

/** The full band: every channel, plus the pollster for the people who hire one. */
export default function PromoHub({ title = "More than a forecast", note = "Play it, watch it, argue about it, or hire the team behind it." }: { title?: string; note?: string }) {
  return (
    <section className="opp ph-band" aria-labelledby="ph-h">
      <div className="ph-head"><span className="eye g">The On Point network</span><h2 id="ph-h">{title}</h2><p>{note}</p></div>
      <div className="ph-grid">
        <Card x={HIRE} size="l" />
        {ITEMS.map((x) => <Card key={x.k} x={x} size="l" />)}
      </div>
    </section>
  );
}
