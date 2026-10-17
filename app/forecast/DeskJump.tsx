"use client";
import { useEffect } from "react";

/** A link that names an office lands on the race desk, not the top of the hub. It waits for the hub
 *  and the desk to finish drawing, so nothing above the desk moves it after the jump. */
export default function DeskJump() {
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => {
      const el = document.getElementById("desk");
      const ready = el && document.querySelector(".hub-meters") && document.querySelector(".fc-mapcard");
      if (ready || ++n > 80) {
        clearInterval(t);
        el?.scrollIntoView({ block: "start" });
        setTimeout(() => el?.scrollIntoView({ block: "start" }), 400);
      }
    }, 100);
    return () => clearInterval(t);
  }, []);
  return null;
}
