// Evidence capture for the intelligence layer: records what civicAPI returned and when, for post-election replay.
// Publishes nothing and feeds no public number. All logic and the threat model are in captureHandler.ts.
//   GET   scheduled poll, authenticated with CRON_SECRET (Vercel Cron sends it)
//   POST  manual: ?mode=preflight, or ?force=1, authenticated with INTELLIGENCE_CAPTURE_SECRET
import { handleCapture } from "@/app/lib/intelligence/captureHandler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Kept above the runner's own 40 s budget so a slow provider ends the poll cleanly instead of killing the function.
export const maxDuration = 60;

export const GET = (req: Request) => handleCapture(req);
export const POST = (req: Request) => handleCapture(req);
