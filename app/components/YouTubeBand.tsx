// An inline YouTube invitation for the pages most readers land on. The link carries data-ev, so SiteEvents records the
// click without this needing to run in the browser.
import { YT_SUB } from "@/app/lib/youtube";
import YouTubeIcon from "./YouTubeIcon";
import "./youtube.css";

export default function YouTubeBand({ from, title, note }: { from: string; title: string; note: string }) {
  return (
    <a className="opp ytb" href={YT_SUB} target="_blank" rel="noopener" data-ev="YouTube subscribe" data-ev-d={JSON.stringify({ from })}>
      <YouTubeIcon size={44} />
      <span className="ytb-t"><span className="eye">On Point on YouTube</span><b>{title}</b><small>{note}</small></span>
      <span className="btn g ytb-b">Subscribe</span>
    </a>
  );
}
