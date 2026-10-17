// /llms-full.txt: the same guide with every race, chamber, ballot measure and polling average listed.
import { llmsText } from "@/app/lib/llms";

export const dynamic = "force-static";

export function GET() {
  return new Response(llmsText(true), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
