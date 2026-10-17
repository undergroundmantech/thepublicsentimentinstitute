import type { Metadata } from "next";
import { nightMeta } from "../meta";

// The board is a client page, so its metadata lives here.
export const metadata: Metadata = nightMeta("2026-08-25");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
