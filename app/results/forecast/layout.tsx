import type { Metadata } from "next";
import { seo } from "@/app/lib/seo";

// The page is a client board, so its metadata lives here.
export const metadata: Metadata = seo({ title: "Live results forecast", description: "A live projection of where a race will finish, recomputed from the reported vote as counties come in.", path: "/results/forecast" });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
