// The news desk's written stories, read at build time from public/news/stories.json.
import fs from "node:fs";
import path from "node:path";
import type { Cat, Lean } from "./sources";

export type Cov = { o: string; n?: string; t: string; u: string; d: string; op?: boolean };
export type Story = {
  id: string; cat: Cat; date: string; title: string; dek: string; summary: string[]; facts: string[];
  sides: { who: string; says: string }[]; framing: Partial<Record<Lean, string>>; related: { href: string; label: string }[]; keys: string[]; coverage: Cov[];
};
export type Desk = { updated: string; note: string; stories: Story[] };

let cache: Desk | null = null;
export function getDesk(): Desk {
  if (!cache) cache = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/news/stories.json"), "utf8")) as Desk;
  return cache;
}
