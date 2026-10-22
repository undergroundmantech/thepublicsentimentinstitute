import type { Metadata } from "next";
import { getEndorsements } from "../data";
import { Pointy } from "@/app/components/home/Mascot";
import MediaWatch from "./MediaWatch";
import "./media.css";

export const metadata: Metadata = {
  title: "Media watch",
  description: "Which podcasters, hosts, streamers and political reporters are putting attention on which 2026 races, from Joe Rogan and Tucker Carlson to Mark Halperin, Nate Silver and Larry Sabato.",
};

export default function Page() {
  const e = getEndorsements();
  const items = e.media.reduce((a, m) => a + m.items.length, 0);
  return (
    <>
      <header className="wd-hero">
        <div>
          <div className="eye gold">Watchdog · Media watch</div>
          <h1>Who has the <em>microphone.</em></h1>
          <p className="lede">{e.media.length} podcasters, hosts, streamers, reporters and handicappers, and the {items} times since June they put a 2026 race in front of their audience: interviews, attacks, endorsements, ratings changes and calls.</p>
        </div>
        <Pointy className="mw-pty keep" pose="think" prop="megaphone" size={116} look={-1} flip detective say={<>A big show can move a race before any ad does.</>} />
      </header>
      <MediaWatch people={e.media} />
      <p className="wd-src">Each item comes from the episode page, the video page or a news report about it, linked on the item. Lean is the person&apos;s usual side, not a label on any one segment.</p>
    </>
  );
}
