// Custom events for Vercel Web Analytics, from route handlers. Only sends on Vercel, never throws,
// and carries the same flag values the pages emit, so server events filter by flag like page views.
import { track } from "@vercel/analytics/server";
import { evClean, type EvData } from "./ev";
import { FLAG_VALUES } from "./flagValues";

export async function evServer(name: string, data: EvData | undefined, request: Request): Promise<void> {
  if (!process.env.VERCEL) return;
  try {
    await track(name, evClean(data), { request, flags: [{ ...FLAG_VALUES }] });
  } catch { /* analytics never breaks a request */ }
}
