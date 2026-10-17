// /llms.txt: a plain text guide to the site for AI assistants and answer engines, with the current
// headline numbers so a model can quote them and link the page they came from.
import { llmsText } from "@/app/lib/llms";

export const dynamic = "force-static";

export function GET() {
  return new Response(llmsText(false), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
