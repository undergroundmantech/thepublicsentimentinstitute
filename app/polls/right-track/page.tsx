import type { Metadata } from "next";
import Average from "../Average";
export const metadata: Metadata = { title: "Right track or wrong track polling average", alternates: { canonical: "/polls/right-track" } };
export default function Page() { return <Average id="right-wrong-track" />; }
