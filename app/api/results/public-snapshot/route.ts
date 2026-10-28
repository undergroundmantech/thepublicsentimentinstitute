// The canonical public results snapshot. Off unless ONPOINT_PUBLIC_SNAPSHOT=1 (404 otherwise).
import { resolveStore } from "@/app/lib/intelligence/captureStore";
import { servePublicSnapshot } from "@/app/lib/intelligence/publicSnapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = () => servePublicSnapshot(process.env, () => resolveStore(process.env).store);
