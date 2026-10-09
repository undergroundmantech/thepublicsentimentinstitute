import type { Metadata } from "next";
import Average from "../../Average";
export const metadata: Metadata = { title: "JD Vance favorability polling average", alternates: { canonical: "/polls/approval/vance" } };
export default function Page() { return <Average id="vance-favorability" />; }
