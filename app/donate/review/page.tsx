"use client";

import { useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

/**
 * MAIN PAGE ENTRY
 * This wraps the client logic in Suspense to handle useSearchParams()
 */
export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-white uppercase tracking-widest text-xs">Loading…</div>}>
      <DonateReviewClient />
    </Suspense>
  );
}

/**
 * CLIENT COMPONENT LOGIC
 */
function DonateReviewClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const amount = sp.get("amount") ?? "10.00";
  const name = sp.get("name") ?? "";
  const email = sp.get("email") ?? "";

  const [showPayment, setShowPayment] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const options = useMemo(
    () => ({
      clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "",
      currency: "USD",
      intent: "capture",
    }),
    []
  );

  const confirmMessage = `You are about to contribute to the Florida 2026 Sentiment Study.\n\nSummary:\nAmount: $${amount}${
    name ? `\nDonor: ${name}` : ""
  }${email ? `\nContact: ${email}` : ""}`;

  return (
    <main className="min-h-screen flex flex-col items-center pt-20 pb-24 px-4 bg-transparent text-white">
      <div className="w-full max-w-xl space-y-10">
        
        {/* Navigation */}
        <button 
          onClick={() => router.push('/donate')}
          className="group flex items-center gap-3 text-white/40 hover:text-blue-400 transition-all"
        >
          <span className="text-xl group-hover:-translate-x-1 transition-transform">←</span>
          <span className="uppercase tracking-[0.3em] text-[10px] font-black">Edit Allocation</span>
        </button>

        {/* Header Section */}
        <header className="space-y-2">
          <div className="inline-block px-3 py-1 bg-white/5 border border-white/10 rounded-full mb-2">
            <span className="uppercase tracking-[0.2em] text-[9px] font-black text-blue-400">Step 02: Verification</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-none italic uppercase">
            Review <br/>
            <span className="text-white/30 not-italic">Contribution</span>
          </h1>
        </header>

        {/* Summary Card */}
        <section className="bg-[#161b26]/60 border border-white/10 p-8 rounded-[2.5rem] backdrop-blur-xl shadow-2xl space-y-8">
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-white/5 pb-6">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 italic">Funding Amount</span>
              <span className="text-4xl font-mono font-black italic text-white">${amount}</span>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20">Designated For</p>
                <p className="font-bold text-white/80 uppercase tracking-tight">Florida 2026 Public Sentiment Survey</p>
              </div>
            </div>
          </div>

          {/* Action Area */}
          {!showPayment ? (
            <div className="flex flex-col gap-4 pt-4">
              <button
                onClick={() => setConfirmOpen(true)}
                className="w-full py-6 bg-white text-black text-sm font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-blue-400 hover:text-white transition-all shadow-xl shadow-white/5"
              >
                Continue to Secure Payment
              </button>
              <button
                onClick={() => router.back()}
                className="w-full py-3 text-[10px] font-black uppercase tracking-[0.4em] text-white/20 hover:text-white transition-colors"
              >
                Return to previous step
              </button>
            </div>
          ) : (
            <div className="pt-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="text-center mb-6">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 mb-2">Secure Gateway Active</p>
              </div>

              {/* Transaction Error Message Block */}
              {status && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl animate-pulse">
                  <p className="text-red-400 text-[10px] font-black uppercase tracking-[0.2em] text-center leading-relaxed">
                    {status}
                  </p>
                </div>
              )}

              <PayPalScriptProvider options={options}>
                <PayPalButtons
                  style={{ layout: "vertical", shape: "rect", color: "white" }}
                  createOrder={async () => {
                    setStatus(null);
                    const res = await fetch("/api/paypal/create-order", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ amount }),
                    });
                    const data = await res.json();
                    return data.id;
                  }}
                  onApprove={async (data) => {
                    router.push(`/donate/thanks?amount=${encodeURIComponent(amount)}`);
                  }}
                  onError={(err) => {
                    console.error("PayPal Error:", err);
                    setStatus("Transaction was not completed. Wait a few minutes and try again.");
                  }}
                  onCancel={() => {
                    setStatus("Transaction was not completed. Wait a few minutes and try again.");
                  }}
                />
              </PayPalScriptProvider>
            </div>
          )}
        </section>

        {/* Footer Methodology Note */}
        <p className="text-center text-[9px] font-black uppercase tracking-[0.4em] text-white/10 max-w-xs mx-auto">
          Transaction secured via SSL & encrypted PayPal end-to-end protocols.
        </p>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Finalize Allocation"
        message={confirmMessage}
        confirmText="Confirm & Pay"
        cancelText="Review Again"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          setShowPayment(true);
        }}
      />
    </main>
  );
}

/**
 * MODAL COMPONENT
 */
function ConfirmModal({
  open,
  title,
  message,
  confirmText = "Yes, continue",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md bg-[#161b26] border border-white/10 rounded-[2rem] p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-black uppercase tracking-tight mb-4 text-white italic">
          {title ?? "Confirm Entry"}
        </h2>
        <div className="text-white/60 mb-8 whitespace-pre-wrap leading-relaxed font-medium">
          {message}
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={onConfirm}
            className="w-full py-4 bg-white text-black rounded-xl font-black uppercase tracking-widest text-xs hover:bg-gray-200 transition-all shadow-lg"
          >
            {confirmText}
          </button>
          <button 
            onClick={onCancel} 
            className="w-full py-4 rounded-xl font-black uppercase tracking-widest text-[10px] text-white/30 hover:text-white transition-colors"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}