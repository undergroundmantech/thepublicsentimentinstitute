import type { Metadata } from "next";
import Average from "../Average";
export const metadata: Metadata = {
  title: "Generic congressional ballot polling average",
  description: "The 2026 generic ballot, averaged daily from every public poll, with LOWESS trend lines.",
  alternates: { canonical: "/polls/generic-ballot" },
};
export default function Page() { return <Average id="generic-ballot" />; }
