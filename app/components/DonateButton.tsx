"use client";

import { useMemo, useState } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

export default function DonateButton() {
  const [amount, setAmount] = useState("10.00");
  const [status, setStatus] = useState<string | null>(null);

  const options = useMemo(
    () => ({
      clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "",
      currency: "USD",
      intent: "capture",
    }),
    []
  );

  return (
    <div style={{ maxWidth: 420 }}>
      <label style={{ display: "block", marginBottom: 8 }}>
        Donation amount (USD)
      </label>

      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        inputMode="decimal"
        style={{ width: "100%", padding: 10, marginBottom: 12 }}
        placeholder="10.00"
      />

      <PayPalScriptProvider options={options}>
        <PayPalButtons
          style={{ layout: "vertical" }}
          createOrder={async () => {
            setStatus(null);
            const res = await fetch("/api/paypal/create-order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ amount }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data?.error ? JSON.stringify(data.error) : "Create order failed");
            return data.id; // PayPal order ID
          }}
          onApprove={async (data) => {
            const res = await fetch("/api/paypal/capture-order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: data.orderID }),
            });

            const capture = await res.json();
            if (!res.ok) throw new Error(capture?.error ? JSON.stringify(capture.error) : "Capture failed");

            setStatus("✅ Donation received. Thank you!");
          }}
          onError={(err) => {
            console.error(err);
            setStatus("❌ Payment error — please try again.");
          }}
          onCancel={() => setStatus("Payment cancelled.")}
        />
      </PayPalScriptProvider>

      {status && <p style={{ marginTop: 12 }}>{status}</p>}
    </div>
  );
}