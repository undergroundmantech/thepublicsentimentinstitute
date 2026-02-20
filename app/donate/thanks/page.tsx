"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function ThankYouPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const amount = sp.get("amount") || "0.00";
  
  // Optional: A small countdown to return home
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-transparent text-white">
      <div className="w-full max-w-2xl text-center space-y-8 animate-in fade-in zoom-in duration-700">
        
        {/* Success Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.2)]">
            <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        {/* Header */}
        <div className="space-y-2">
          <p className="uppercase tracking-[0.4em] text-[10px] font-black text-emerald-500">Transaction Confirmed</p>
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter italic uppercase">
            Contribution <br/>
            <span className="text-white/30 not-italic">Received</span>
          </h1>
        </div>

        {/* Summary Box */}
        <section className="bg-[#161b26]/60 border border-white/10 p-8 rounded-[2.5rem] backdrop-blur-xl shadow-2xl space-y-4">
          <p className="text-white/50 text-lg leading-relaxed">
            Your support of <span className="font-mono font-black text-white italic">${amount}</span> has been processed. 
            This moves the Florida 2026 Sentiment Study one step closer to field deployment via Pollfish.
          </p>
          <div className="pt-4 border-t border-white/5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">
              Project: FL-2026-VOTER-SURVEY
            </p>
          </div>
        </section>

        {/* Actions */}
        <div className="flex flex-col items-center gap-6">
          <button
            onClick={() => router.push("/")}
            className="px-10 py-4 bg-white text-black text-xs font-black uppercase tracking-[0.3em] rounded-xl hover:bg-blue-400 hover:text-white transition-all"
          >
            Return to Dashboard
          </button>
          
          <p className="text-[9px] font-black uppercase tracking-[0.4em] text-white/20">
            Auto-redirecting in {countdown}s
          </p>
        </div>
      </div>
    </main>
  );
}