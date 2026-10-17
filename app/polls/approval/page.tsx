import type { Metadata } from "next";
import Average from "../Average";
import { avgById, avgMeta } from "../seo";

export const metadata: Metadata = avgMeta(avgById("trump-approval")!, "Trump approval rating polling average");
export default function Page() { return <Average id="trump-approval" />; }
