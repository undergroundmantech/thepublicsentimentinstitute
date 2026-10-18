// The swingometer's inputs as one static JSON file, rebuilt from the forecast files at every deploy.
import { getSwingData } from "../data";

export const dynamic = "force-static";

export function GET() {
  return new Response(JSON.stringify(getSwingData()), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=600" } });
}
