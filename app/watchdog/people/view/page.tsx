import type { Metadata } from "next";
import { Suspense } from "react";
import Viewer from "./Viewer";
import "../people.css";

export const metadata: Metadata = { title: "Watchdog file", description: "One person's file from the On Point Watchdog Database.", robots: { index: false, follow: true } };

export default function Page() {
  return <Suspense fallback={<div className="wd-empty">Opening the file</div>}><Viewer /></Suspense>;
}
