"use client";
import { useEffect, useState } from "react";
import { daysOut } from "@/app/lib/opp";

/** Days to Election Day, recomputed in the browser so a statically built page never goes stale. */
export default function DaysOut({ initial, suffix = " DAYS OUT" }: { initial: number; suffix?: string }) {
  const [n, setN] = useState(initial);
  useEffect(() => { setN(daysOut()); }, []);
  return <>{n}{suffix}</>;
}
