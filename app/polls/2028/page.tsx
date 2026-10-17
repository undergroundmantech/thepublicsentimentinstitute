import type { Metadata } from "next";
import Average from "../Average";
import { avgById, avgMeta } from "../seo";

export const metadata: Metadata = avgMeta(avgById("2028-vance-newsom")!, "2028 presidential polling average: Vance vs Newsom");
export default function Page() { return <Average id="2028-vance-newsom" />; }
