"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

/**
 * LIVE TRACKING CONFIGURATION
 * Target: $1,650.00
 * Starting Offset: $200.00
 */
const TARGET_GOAL = 1650.00;

export default function DonatePage() {
  const router = useRouter();
  
  // State to track live donations starting from your $200 baseline
  const [currentFunding, setCurrentFunding] = useState(200.00); 
  const [amount, setAmount] = useState("10.00");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const isGoalReached = currentFunding >= TARGET_GOAL;
  const progressPercentage = Math.min((currentFunding / TARGET_GOAL) * 100, 100);

  /**
   * LIVE TRACKING FEATURE:
   * Polls the backend for new PayPal transactions to update the bar 
   * and trigger the Pollfish API when the gap ($1450) is closed.
   */
  useEffect(() => {
    const fetchLiveDonations = async () => {
      try {
        const response = await fetch("/api/donations/total"); // Your PayPal Webhook synced endpoint
        const data = await response.json();
        // data.total should include your initial $200 + new donations
        if (data.total) setCurrentFunding(data.total);
      } catch (error) {
        console.error("Live track failed:", error);
      }
    };

    const interval = setInterval(fetchLiveDonations, 10000); // Track every 10 seconds
    return () => clearInterval(interval);
  }, []);

  function goToReview() {
    if (isGoalReached) return;
    const value = Number(amount);
    
    // Feature: Ensure donation does not exceed the remaining cap
    const remainingNeeded = TARGET_GOAL - currentFunding;
    if (value > remainingNeeded) {
      return alert(`Only $${remainingNeeded.toFixed(2)} is left to reach the goal! Please adjust your amount.`);
    }

    if (!Number.isFinite(value) || value <= 0) return alert("Please enter a valid amount.");

    const params = new URLSearchParams({
      amount: value.toFixed(2),
      name,
      email,
    });

    router.push(`/donate/review?${params.toString()}`);
  }

  return (
    <main className="min-h-screen flex flex-col items-center pt-12 pb-24 px-4 bg-transparent text-white">
      <div className="w-full max-w-4xl space-y-12">
        
        {/* Header Section */}
        <header className="space-y-4 text-center">
          <div className="inline-block px-4 py-1.5 bg-white/5 border border-white/10 rounded-full">
            <span className="uppercase tracking-[0.2em] text-[10px] font-black text-blue-400">Live Funding Project</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-none italic">
            FLORIDA 2026<br/>
            <span className="text-white/30 not-italic">SENTIMENT STUDY</span>
          </h1>
        </header>

        {/* Live Progress Bar */}
        <section className="card bg-[#161b26]/60 border border-white/10 p-8 rounded-[2.5rem] backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="relative z-10 space-y-6">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Funding Progress</p>
                <h3 className="text-4xl font-mono font-black">${currentFunding.toLocaleString()} <span className="text-sm text-white/20">USD</span></h3>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Survey Launch Goal</p>
                <h3 className="text-2xl font-mono font-bold text-white/60">${TARGET_GOAL.toLocaleString()}</h3>
              </div>
            </div>

            <div className="w-full h-6 bg-white/5 rounded-full overflow-hidden border border-white/5 p-1">
              <div 
                className={`h-full transition-all duration-1000 ease-out rounded-full ${isGoalReached ? 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]' : 'bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.4)]'}`}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
              <span className={isGoalReached ? "text-emerald-400" : "text-blue-400"}>
                {isGoalReached ? "READY TO DEPLOY" : "COLLECTING COMMUNITY SUPPORT"}
              </span>
              <span className="text-white/20">{Math.floor(progressPercentage)}% COMPLETE</span>
            </div>
          </div>
        </section>

        {/* The Survey Transparency Section */}
        <section className="space-y-8">
          <div className="space-y-2 border-l-4 border-blue-600 pl-6">
            <h2 className="text-3xl font-black tracking-tight uppercase">The Survey Blueprint</h2>
            <p className="text-white/50 text-lg">We believe in total transparency. Here is exactly what we are asking 1,500 Florida voters the moment this reaches 100%.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SurveyPreviewCard 
              num="01" 
              title="The 2026 Governor's Race" 
              desc="Direct head-to-head matchups: Byron Donalds (R) vs. David Jolly (D) and James Fishback (R) vs. David Jolly (D). Primary matchups for both Republican and Democrat primaries."
            />
            <SurveyPreviewCard 
              num="02" 
              title="Executive Accountability" 
              desc="Performance ratings for President Trump and Governor DeSantis, including specific handling of the 'Epstein Files'."
            />
            <SurveyPreviewCard 
              num="03" 
              title="Issue Approvals" 
              desc="Voter approval on eliminating property taxes, banning investment firms from housing, and OnlyFans 'Sin Taxes'."
            />
            <SurveyPreviewCard 
              num="04" 
              title="Media & Influence" 
              desc="Tracking what platforms voters use to gather news, as well as approval ratings of candidates and political commentators."
            />
          </div>
        </section>

        {/* Action Section */}
        <section className="flex flex-col items-center space-y-8 pt-10 border-t border-white/5">
          {!isGoalReached ? (
            <div className="w-full max-w-xl space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-black tracking-tight">Fuel the Research</h2>
                <p className="text-white/40">The Pollfish IDE Panel ensures these 1,500 responses come from verified Florida voters.</p>
              </div>

              <div className="space-y-4">
                <div className="relative group">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 font-mono text-2xl group-focus-within:text-blue-400 transition-colors">$</span>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                    className="w-full bg-white/[0.03] border-2 border-white/10 rounded-3xl py-8 pl-14 pr-6 text-3xl font-mono focus:outline-none focus:border-blue-600 transition-all shadow-inner"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    placeholder="First & Last Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-white/[0.03] border-2 border-white/10 rounded-2xl p-5 focus:outline-none focus:border-white/30 transition-all"
                  />
                  <input
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-white/[0.03] border-2 border-white/10 rounded-2xl p-5 focus:outline-none focus:border-white/30 transition-all"
                  />
                </div>

                <button
                  onClick={goToReview}
                  className="w-full py-6 bg-blue-600 text-white text-sm font-black uppercase tracking-[0.3em] rounded-3xl hover:bg-blue-500 active:scale-[0.98] transition-all shadow-xl shadow-blue-900/20"
                >
                  Review Payment
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-4 py-10">
              <div className="text-5xl font-black text-emerald-500 uppercase italic">Goal Reached</div>
              <p className="text-white/60 text-xl max-w-md mx-auto leading-relaxed">
                The Florida 2026 Sentiment Study is now live in the field. Results will be published to the dashboard shortly.
              </p>
            </div>
          )}
        </section>

        {/* Methodology Footer */}
        <footer className="text-center pt-10 border-t border-white/5">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">
            Powered by the The Public Sentiment Institute & Pollfish.
          </p>
        </footer>
      </div>
    </main>
  );
}

function SurveyPreviewCard({ num, title, desc }: { num: string, title: string, desc: string }) {
  return (
    <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/[0.05] transition-colors">
      <div className="text-blue-500 font-mono text-xs mb-2 tracking-tighter">METRIC {num}</div>
      <h4 className="font-bold text-lg mb-2">{title}</h4>
      <p className="text-sm text-white/40 leading-relaxed">{desc}</p>
    </div>
  );
}