// The weekly "what moved" entries, written by sw/whatmoved.py after each forecast rebuild.
import fs from "node:fs";
import path from "node:path";

export interface WmState { st: string; name: string; ev: number; old: number; new: number; rOld: string; rNew: string }
export interface WmEntry { slug: string; date: string; title: string; summary: string; matchup: [string, string]; nat: [number, number]; pD: [number, number]; evD: [number, number];
  states: WmState[]; nom: Record<"D" | "R", { name: string; old: number; new: number }[]>; why: string[]; built?: string }
let C: WmEntry[] | null = null;
export const entries = (): WmEntry[] => (C ??= (() => { try { return (JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/forecast/2028/whatmoved.json"), "utf8")).entries as WmEntry[]); } catch { return []; } })());
export const entry = (slug: string) => entries().find((e) => e.slug === slug) ?? null;
export const mg = (m: number) => `${m <= 0 ? "D" : "R"} +${Math.abs(m).toFixed(1)}`;
export const day = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
