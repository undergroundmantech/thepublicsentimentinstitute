"use client";
// One civicAPI subscription for the whole /results/2026 page: the national dashboard and the race list read the same
// observation, so every category total comes from one read no matter which tab is open. Uses useLive unchanged
// (proxy cache, four types at a time from the proxy, test-return blanking).
import React, { createContext, useContext, useSyncExternalStore } from "react";

import type { XIndex } from "./live";
import { useIndex, useLive, useShownIndex, type LiveState } from "./useLive";

const ALL: ("fed" | "state" | "ballot" | "leg")[] = ["fed", "state", "ballot", "leg"];
type Shared = { ix: XIndex | null; live: LiveState };
const Ctx = createContext<Shared | null>(null);

const noop = () => () => {}, yes = () => true, no = () => false;
/** false while a component is attaching to the server's HTML (hydrating), true from then on: a part of the page that
 *  attaches after the races have loaded (inside a Suspense boundary) renders what the server sent first, and the races
 *  arrive as an ordinary update, instead of React throwing the part away and redrawing it (a flicker on arrival) */
export function useAttached(): boolean { return useSyncExternalStore(noop, yes, no); }

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const all = useIndex();
  const live = useLive(all, ALL);
  // every page under the provider sees the races that have data (shownIndex.ts)
  const ix = useShownIndex(all, live, ALL);
  return <Ctx.Provider value={{ ix, live }}>{children}</Ctx.Provider>;
}

/** The page's shared read, or null when rendered outside a LiveProvider. */
export const useSharedLive = () => useContext(Ctx);
