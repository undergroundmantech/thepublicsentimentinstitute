import { AGGREGATES, buildAggregate } from "@/app/_polling/lib/aggregates";
import { buildBoard, type BoardGroup } from "@/app/_polling/lib/boardData";
import PollBoard from "./PollBoard";

/** Every polls index page is the whiteboard, opened on one tab; built once at build time. */
export default function PollIndex({ initial = "senate", title, lede, sub = false }: { initial?: BoardGroup; title: React.ReactNode; lede: string; groups?: string[]; crumb?: string; sub?: boolean }) {
  const built = Object.fromEntries(AGGREGATES.map((d) => [d.id, buildAggregate(d)]));
  const latest = AGGREGATES.reduce((m, d) => d.polls.reduce((mm, p) => (p.endDate > mm ? p.endDate : mm), m), "");
  const cut = latest ? new Date(new Date(latest + "T00:00:00").getTime() - 7 * 864e5).toISOString().slice(0, 10) : "";
  const board = buildBoard(AGGREGATES, built, cut);
  return <PollBoard board={board} initial={initial} title={title} lede={lede} sub={sub} />;
}
