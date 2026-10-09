import type { Metadata } from "next";
import Average from "../Average";
export const metadata: Metadata = {
  title: "Trump approval polling average",
  description: "Donald Trump's job approval, averaged daily from every public poll. Citable JSON at /api/polls/trump-approval.",
  alternates: { canonical: "/polls/approval" },
};
export default function Page() { return <Average id="trump-approval" />; }
