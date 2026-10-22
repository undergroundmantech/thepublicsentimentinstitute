"use client";
// The polls home: the whole page is the analyst's whiteboard. Pick a tab, tap a state or a race, and the
// race opens on its own average page, drawn on the same board.
import { useState } from "react";
import PollRoom from "@/app/_polling/lib/PollRoom";
import { BOARD_GROUPS, type Board, type BoardGroup } from "@/app/_polling/lib/boardData";

export default function PollBoard({ board, initial, title, lede }: { board: Board; initial: BoardGroup; title: React.ReactNode; lede: string }) {
  const [group, setGroup] = useState<BoardGroup>(initial);
  const groups = BOARD_GROUPS.map((g) => ({ id: g.id, label: g.label, count: board.items[g.id].length }));
  const office = group === "senate" ? "U.S. Senate" : group === "governor" ? "Governor" : group === "house" ? "U.S. House" : null;
  return (
    <div className="opp pa wbpage">
      <PollRoom groups={groups} group={group} onGroup={(g) => setGroup(g as BoardGroup)} items={board.items[group]} allItems={board.all}
        activeId="" mapRows={office ? board.maps[group as "senate" | "governor" | "house"] : []} office={office}
        onMapPick={group === "house" ? () => {} : undefined} notes={group !== "house"}
        listTitle={group === "house" ? "Every polled district" : group === "national" ? "National averages" : group === "archive" ? "Primaries and past races" : "Every race"}
        active={null} intro={<><h1>{title}</h1><p>{lede}</p></>} />
    </div>
  );
}
