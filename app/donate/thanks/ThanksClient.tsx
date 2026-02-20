"use client";

import { useSearchParams } from "next/navigation";

export default function ThanksClient() {
  const sp = useSearchParams();

  // Example params — adjust to what you actually pass
  const amount = sp.get("amount") ?? "";
  const name = sp.get("name") ?? "";

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Thank you!</h1>
      <p className="mt-2">
        We appreciate your support{name ? `, ${name}` : ""}.
      </p>

      {amount ? (
        <div className="mt-4">
          Donation amount: <span className="font-medium">{amount}</span>
        </div>
      ) : null}
    </div>
  );
}