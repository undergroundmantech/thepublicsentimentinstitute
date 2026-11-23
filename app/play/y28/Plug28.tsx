"use client";
// On Point inside the game: the channel, the Discord, the leaderboard, the reader poll, the real forecast and the
// pollster. Every link opens in a new tab, so a run in progress is never lost.
import { SOCIAL } from "@/app/lib/offers";
import { sfx } from "../px/sound";

const LINKS: { k: string; t: string; s: string; href: string }[] = [
  { k: "yt", t: "YouTube", s: "Watch the 2028 breakdowns", href: SOCIAL.youtubeSub },
  { k: "dc", t: "Discord", s: "Post your map, find rivals", href: SOCIAL.discord },
  { k: "lb", t: "Leaderboard", s: "This week's best runs", href: "/play/leaderboard" },
  { k: "cm", t: "Reader poll", s: "Call the real race", href: "/community" },
  { k: "fc", t: "Real forecast", s: "The model behind the game", href: "/2028" },
  { k: "op", t: "Hire a pollster", s: "On Point Polling", href: "/on-point-polling" },
];

export default function Plug28({ title = "Keep playing on On Point" }: { title?: string }) {
  return (
    <nav className="y28-plug" aria-label="More from On Point">
      <span className="px-k">{title}</span>
      <ul>{LINKS.map((l) => <li key={l.k}><a className={`y28-plug-${l.k}`} href={l.href} target="_blank" rel="noopener noreferrer" onClick={() => sfx("click")} data-ev="Game promo" data-ev-d={JSON.stringify({ to: l.k })}><b>{l.t}</b><small>{l.s}</small></a></li>)}</ul>
    </nav>
  );
}
