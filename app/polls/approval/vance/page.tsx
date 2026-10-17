import type { Metadata } from "next";
import Average from "../../Average";
import { avgById, avgMeta } from "../../seo";

export const metadata: Metadata = avgMeta(avgById("vance-favorability")!, "JD Vance favorability polling average");
export default function Page() { return <Average id="vance-favorability" />; }
