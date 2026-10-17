import type { Metadata } from "next";
import Average from "../../Average";
import { avgById, avgMeta } from "../../seo";

export const metadata: Metadata = avgMeta(avgById("2024-national")!, "2024 presidential polling average, national");
export default function Page() { return <Average id="2024-national" />; }
