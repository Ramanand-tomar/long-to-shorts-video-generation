"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Check, X } from "lucide-react";

export default function PricingSection() {
  const { isSignedIn } = useAuth();
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annually">("monthly");

  const proPrice = billingPeriod === "annually" ? 23 : 29;

  return (
    <section id="pricing" className="py-24 bg-gradient-to-b from-[#0a0a0f] via-zinc-950/20 to-[#0a0a0f] border-t border-zinc-900 px-6 scroll-mt-20">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-violet-500 text-sm font-bold tracking-widest uppercase block mb-3">
            Pricing Plans
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Simple Creator-Friendly Pricing
          </h2>
          <p className="text-zinc-400 mt-4 text-sm sm:text-base">
            Choose the tier that fits your publishing frequency. Get started free, no credit card required.
          </p>

          {/* Toggle Switch */}
          <div className="inline-flex items-center gap-3 p-1 rounded-xl bg-zinc-900 border border-zinc-800/80 mt-8">
            <button
              onClick={() => setBillingPeriod("monthly")}
              type="button"
              className={`px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all cursor-pointer ${
                billingPeriod === "monthly" 
                  ? "bg-violet-600 text-white shadow" 
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod("annually")}
              type="button"
              className={`px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all flex items-center gap-1.5 cursor-pointer ${
                billingPeriod === "annually" 
                  ? "bg-violet-600 text-white shadow" 
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Annually
              <span className="px-1.5 py-0.5 rounded-full bg-violet-950 border border-violet-800 text-[10px] font-bold text-violet-300">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Free Tier */}
          <div className="bg-zinc-900/10 border border-zinc-900 rounded-3xl p-8 flex flex-col justify-between hover:border-zinc-800 transition-colors">
            <div>
              <h3 className="text-zinc-400 font-bold text-lg uppercase tracking-wider mb-2">Free Plan</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-5xl font-extrabold text-white">$0</span>
                <span className="text-zinc-500 text-sm">/ month</span>
              </div>
              <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                Perfect for hobbyists and creators starting their short-form journey.
              </p>
              <hr className="border-zinc-900 my-6" />
              <ul className="flex flex-col gap-4">
                <li className="flex items-center gap-3 text-zinc-300 text-sm">
                  <Check className="w-4 h-4 text-violet-400 flex-shrink-0" />
                  5 video uploads per day
                </li>
                <li className="flex items-center gap-3 text-zinc-300 text-sm">
                  <Check className="w-4 h-4 text-violet-400 flex-shrink-0" />
                  AI-powered clip detection
                </li>
                <li className="flex items-center gap-3 text-zinc-300 text-sm">
                  <Check className="w-4 h-4 text-violet-400 flex-shrink-0" />
                  Interactive clip preview editor
                </li>
                <li className="flex items-center gap-3 text-zinc-300 text-sm">
                  <Check className="w-4 h-4 text-violet-400 flex-shrink-0" />
                  Basic cloud rendering
                </li>
                <li className="flex items-center gap-3 text-zinc-600 text-sm line-through decoration-zinc-800 text-zinc-500">
                  <X className="w-4 h-4 text-zinc-700 flex-shrink-0" />
                  Priority render queue
                </li>
                <li className="flex items-center gap-3 text-zinc-600 text-sm line-through decoration-zinc-800 text-zinc-500">
                  <X className="w-4 h-4 text-zinc-700 flex-shrink-0" />
                  Auto-publishing scheduler
                </li>
              </ul>
            </div>
            <Link 
              href={isSignedIn ? "/dashboard" : "/sign-up"}
              className="w-full text-center py-4 rounded-xl border border-zinc-800 hover:border-zinc-700 text-zinc-300 font-bold transition-all mt-8"
            >
              Get Started
            </Link>
          </div>

          {/* Pro Tier */}
          <div className="bg-zinc-900/30 border-2 border-violet-600 rounded-3xl p-8 flex flex-col justify-between relative shadow-2xl shadow-violet-500/5">
            <div className="absolute top-0 right-8 -translate-y-1/2 px-3 py-1 rounded-full bg-violet-600 text-[10px] font-bold text-white uppercase tracking-wider">
              Most Popular
            </div>
            <div>
              <h3 className="text-violet-400 font-bold text-lg uppercase tracking-wider mb-2">Pro Plan</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-5xl font-extrabold text-white">${proPrice}</span>
                <span className="text-zinc-500 text-sm">/ month</span>
              </div>
              <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                For creators, businesses, and agencies serious about short-form growth.
              </p>
              <hr className="border-zinc-800 my-6" />
              <ul className="flex flex-col gap-4">
                <li className="flex items-center gap-3 text-zinc-300 text-sm">
                  <Check className="w-4 h-4 text-violet-400 flex-shrink-0" />
                  Unlimited video uploads
                </li>
                <li className="flex items-center gap-3 text-zinc-300 text-sm">
                  <Check className="w-4 h-4 text-violet-400 flex-shrink-0" />
                  Priority AI clip generation queue
                </li>
                <li className="flex items-center gap-3 text-zinc-300 text-sm">
                  <Check className="w-4 h-4 text-violet-400 flex-shrink-0" />
                  Unlimited rendering runs
                </li>
                <li className="flex items-center gap-3 text-zinc-300 text-sm">
                  <Check className="w-4 h-4 text-violet-400 flex-shrink-0" />
                  Connect up to 6 social accounts
                </li>
                <li className="flex items-center gap-3 text-zinc-300 text-sm">
                  <Check className="w-4 h-4 text-violet-400 flex-shrink-0" />
                  Priority cloud render speeds
                </li>
                <li className="flex items-center gap-3 text-zinc-300 text-sm">
                  <Check className="w-4 h-4 text-violet-400 flex-shrink-0" />
                  Advanced scheduling & auto-publish
                </li>
              </ul>
            </div>
            <Link 
              href={isSignedIn ? "/dashboard" : "/sign-up"}
              className="w-full text-center py-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold transition-all shadow-lg shadow-violet-500/25 mt-8"
            >
              Upgrade to Pro
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
