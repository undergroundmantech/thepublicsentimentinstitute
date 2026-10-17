import type { Metadata } from "next";
import Average from "../Average";
import { avgById, avgMeta } from "../seo";

export const metadata: Metadata = avgMeta(avgById("right-wrong-track")!, "Right track or wrong track polling average");
export default function Page() { return <Average id="right-wrong-track" />; }
