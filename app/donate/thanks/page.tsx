import { Suspense } from "react";
import ThanksClient from "./ThanksClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Loading…</div>}>
      <ThanksClient />
    </Suspense>
  );
}