import type { Metadata } from "next";
import FloridaPrimary from "./FloridaPrimary";

export const metadata: Metadata = {
  title: "Florida GOP primary sandbox",
  description:
    "Interactive scenario engine for the 2026 Florida Republican gubernatorial primary. Set candidate performance by demographic group, model turnout, and watch all 67 counties recompute.",
};

export default function Page() {
  return <FloridaPrimary />;
}
