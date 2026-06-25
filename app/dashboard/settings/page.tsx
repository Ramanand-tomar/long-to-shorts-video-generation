"use client";

import React, { useState, useEffect } from "react";
import { 
  Video, 
  Scissors, 
  Share2, 
  Sparkles, 
  Clock, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight,
  TrendingUp
} from "lucide-react";
import { getUserSettingsMetrics, updateUserPlan } from "@/actions/user";

interface Metric {
  current: number;
  limit: number;
  nextReset?: Date;
}

interface SettingsMetrics {
  plan: string;
  userId: string;
  isAdmin: boolean;
  isDev: boolean;
  uploads: Metric;
  renders: Metric;
  analyses: Metric;
  connections: Metric;
  scheduled: Metric;
}

export default function SettingsPage() {
  const [metrics, setMetrics] = useState<SettingsMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadMetrics();
  }, []);

  async function loadMetrics() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getUserSettingsMetrics();
      if (data) {
        setMetrics(data as unknown as SettingsMetrics);
      } else {
        setErrorMsg("Failed to retrieve settings metrics.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("An error occurred loading settings metrics.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePlanToggle(targetPlan: "free" | "pro") {
    if (!metrics) return;
    setUpdating(true);
    setMessage(null);
    setErrorMsg(null);

    try {
      const res = await updateUserPlan(metrics.userId, targetPlan);
      if (res.success) {
        setMessage(`Plan updated to ${targetPlan.toUpperCase()} successfully!`);
        // Refresh metrics
        await loadMetrics();
      } else {
        setErrorMsg(`Failed to update plan: ${res.error}`);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("An error occurred updating the plan.");
    } finally {
      setUpdating(false);
    }
  }

  function getPercentage(current: number, limit: number) {
    if (limit === 0) return 0;
    return Math.min(100, Math.round((current / limit) * 100));
  }

  function formatTimeRemaining(resetDate?: Date) {
    if (!resetDate) return "N/A";
    const d = new Date(resetDate);
    const diffMs = d.getTime() - Date.now();
    if (diffMs <= 0) return "Resets now";
    
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `Resets in ${diffHrs}h ${diffMins}m`;
  }

  return (
    <div className="py-8 px-6 sm:px-10 max-w-5xl mx-auto space-y-8 text-white">
      {/* Header */}
      <div className="border-b border-zinc-900 pb-6">
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
          Account Settings
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Manage your plan, check usage quotas, and view rate limit reset schedules.
        </p>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-300 flex items-start gap-3 text-sm animate-in fade-in duration-200">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {message && (
        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-300 flex items-start gap-3 text-sm animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400 mt-0.5" />
          <span>{message}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
          <p className="text-zinc-500 text-sm">Loading plan quotas...</p>
        </div>
      ) : metrics ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Left Column: Plan Card & Upgrade */}
          <div className="space-y-6 md:col-span-1">
            <div className="relative overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950/40 p-6 space-y-6">
              
              {/* Glowing Background */}
              <div className={`absolute -right-20 -top-20 w-40 h-40 rounded-full bg-violet-600 opacity-5 blur-3xl pointer-events-none`} />

              <div>
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Active Subscription
                </h3>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-4xl font-extrabold capitalize bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                    {metrics.plan}
                  </span>
                  <span className="text-zinc-500 text-xs font-semibold">Tier</span>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-zinc-900">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Plan Access Details
                </h4>
                <ul className="space-y-2 text-xs text-zinc-400">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-violet-500" />
                    <span>{metrics.plan === "free" ? `${metrics.uploads.limit} Video Uploads / day` : "Unlimited Video Uploads"}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-violet-500" />
                    <span>{metrics.plan === "free" ? `${metrics.analyses.limit} AI Analysis / day` : "Unlimited AI Analysis"}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-violet-500" />
                    <span>{metrics.plan === "free" ? `${metrics.renders.limit} Video Renders / day` : "Unlimited Video Renders"}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-violet-500" />
                    <span>{metrics.plan === "free" ? `${metrics.connections.limit} Social Account limit` : `Up to ${metrics.connections.limit} Social Channels`}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-violet-500" />
                    <span>{metrics.plan === "free" ? `${metrics.scheduled.limit} Active Scheduled Posts` : "Unlimited Scheduled Posts"}</span>
                  </li>
                </ul>
              </div>

              <div className="pt-4 border-t border-zinc-900">
                {metrics.isDev && metrics.isAdmin ? (
                  // Developer / Admin Testing Toggle Options
                  <div className="space-y-3">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider text-center">
                      Admin Test Actions
                    </p>
                    {metrics.plan === "free" ? (
                      <button
                        onClick={() => handlePlanToggle("pro")}
                        disabled={updating}
                        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Toggle Pro Tier (Test)"}
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePlanToggle("free")}
                        disabled={updating}
                        className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Toggle Free Tier (Test)"}
                      </button>
                    )}
                  </div>
                ) : (
                  // Production Billing Upgrade flow representation
                  metrics.plan === "free" ? (
                    <button
                      onClick={() => alert("Redirecting to Stripe checkout portal... (Billing integration details are currently under construction.)")}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white font-bold text-sm shadow-md shadow-violet-500/10 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      Upgrade to Pro
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <p className="text-zinc-500 text-center text-xs">
                      For plan changes or cancellations, please contact billing support.
                    </p>
                  )
                )}
              </div>

            </div>
          </div>

          {/* Right Column: Quotas & Limits Progress (Col Span 2) */}
          <div className="space-y-6 md:col-span-2">
            <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-6 space-y-6">
              
              <div className="border-b border-zinc-900 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-violet-500" />
                    Usage & Limits
                  </h3>
                  <p className="text-zinc-500 text-xs mt-0.5">Rolling usage tracking details.</p>
                </div>
              </div>

              <div className="space-y-6">
                
                {/* 1. Video Uploads */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold flex items-center gap-2 text-zinc-300">
                      <Video className="w-4 h-4 text-violet-400" />
                      Daily Video Uploads
                    </span>
                    <span className="font-semibold text-zinc-400">
                      {metrics.uploads.current} / {metrics.uploads.limit === 100 ? "Unlimited" : metrics.uploads.limit}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-900 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-full transition-all duration-500"
                      style={{ width: `${getPercentage(metrics.uploads.current, metrics.uploads.limit)}%` }}
                    />
                  </div>
                  {metrics.uploads.limit < 100 && (
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                      <Clock className="w-3.5 h-3.5 text-zinc-600" />
                      <span>{formatTimeRemaining(metrics.uploads.nextReset)}</span>
                    </div>
                  )}
                </div>

                {/* 2. AI Analyses */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold flex items-center gap-2 text-zinc-300">
                      <Sparkles className="w-4 h-4 text-violet-400" />
                      Daily AI Analysis Runs
                    </span>
                    <span className="font-semibold text-zinc-400">
                      {metrics.analyses.current} / {metrics.analyses.limit === 100 ? "Unlimited" : metrics.analyses.limit}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-900 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-full transition-all duration-500"
                      style={{ width: `${getPercentage(metrics.analyses.current, metrics.analyses.limit)}%` }}
                    />
                  </div>
                  {metrics.analyses.limit < 100 && (
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                      <Clock className="w-3.5 h-3.5 text-zinc-600" />
                      <span>{formatTimeRemaining(metrics.analyses.nextReset)}</span>
                    </div>
                  )}
                </div>

                {/* 3. Video Renders */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold flex items-center gap-2 text-zinc-300">
                      <Scissors className="w-4 h-4 text-violet-400" />
                      Daily Video Renders
                    </span>
                    <span className="font-semibold text-zinc-400">
                      {metrics.renders.current} / {metrics.renders.limit === 100 ? "Unlimited" : metrics.renders.limit}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-900 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-full transition-all duration-500"
                      style={{ width: `${getPercentage(metrics.renders.current, metrics.renders.limit)}%` }}
                    />
                  </div>
                  {metrics.renders.limit < 100 && (
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                      <Clock className="w-3.5 h-3.5 text-zinc-600" />
                      <span>{formatTimeRemaining(metrics.renders.nextReset)}</span>
                    </div>
                  )}
                </div>

                {/* 4. Social Channels */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold flex items-center gap-2 text-zinc-300">
                      <Share2 className="w-4 h-4 text-violet-400" />
                      Connected Social Channels
                    </span>
                    <span className="font-semibold text-zinc-400">
                      {metrics.connections.current} / {metrics.connections.limit}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-900 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-full transition-all duration-500"
                      style={{ width: `${getPercentage(metrics.connections.current, metrics.connections.limit)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-zinc-500">
                    Accounts can be configured on the Social Channels board.
                  </p>
                </div>

                {/* 5. Scheduled Post Queue */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold flex items-center gap-2 text-zinc-300">
                      <Clock className="w-4 h-4 text-violet-400" />
                      Active Post Queue Limit
                    </span>
                    <span className="font-semibold text-zinc-400">
                      {metrics.scheduled.current} / {metrics.scheduled.limit === 9999 ? "Unlimited" : metrics.scheduled.limit}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-900 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-full transition-all duration-500"
                      style={{ width: `${getPercentage(metrics.scheduled.current, metrics.scheduled.limit)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-zinc-500">
                    Number of pending posts waiting in the queue to be dispatched.
                  </p>
                </div>

              </div>

            </div>
          </div>

        </div>
      ) : (
        <div className="text-center py-20 text-zinc-500">
          No settings configurations retrieved.
        </div>
      )}
    </div>
  );
}
