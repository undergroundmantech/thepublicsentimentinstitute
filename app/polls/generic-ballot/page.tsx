import type { Metadata } from "next";
import Average from "../Average";
import { avgById, avgMeta } from "../seo";

export const metadata: Metadata = avgMeta(avgById("generic-ballot")!, "2026 generic congressional ballot polling average");
export default function Page() { return <Average id="generic-ballot" />; }
