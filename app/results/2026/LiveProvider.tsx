"use client";
// One civicAPI subscription for the whole /results/2026 page: the national dashboard and the race list read the same
// observation, so every category total comes from one read no matter which tab is open. Uses useLive unchanged
// (proxy cache, one type at a time, test-return blanking).
import React, { createContext, useContext } from "react";
import type { XIndex } from "./live";
import { useIndex, useLive, type LiveState } from "./useLive";

const ALL: ("fed" | "state" | "ballot" | "leg")[] = ["fed", "state", "ballot", "leg"];
type Shared = { ix: XIndex | null; live: LiveState };
const Ctx = createContext<Shared | null>(null);

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const ix = useIndex();
  const live = useLive(ix, ALL);
  return <Ctx.Provider value={{ ix, live }}>{children}</Ctx.Provider>;
}

/** The page's shared read, or null when rendered outside a LiveProvider. */
export const useSharedLive = () => useContext(Ctx);
