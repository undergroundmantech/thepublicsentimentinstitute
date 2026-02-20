"use client";

import { useSearchParams } from "next/navigation";

export default function ReviewClient() {
  const searchParams = useSearchParams();

  const amount = searchParams.get("amount") ?? "";
  const name = searchParams.get("name") ?? "";

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Review Donation</h1>
      <div className="mt-4 space-y-2">
        <div>Amount: {amount}</div>
        <div>Name: {name}</div>
      </div>
    </div>
  );
}