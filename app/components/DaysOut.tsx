"use client";
import { useEffect, useState } from "react";
import { daysOut } from "@/app/lib/opp";

/** Days to Election Day, recomputed in the browser so a statically built page never goes stale. */
export default function DaysOut({ initial, suffix = " DAYS OUT" }: { initial: number; suffix?: string }) {
  const [n, setN] = useState(initial);
  useEffect(() => { setN(daysOut()); }, []);
  // after Election Day the countdown would read zero forever, so it says what the page is instead
  return n > 0 ? <>{n}{suffix}</> : <>final, frozen Nov 3</>;
}
