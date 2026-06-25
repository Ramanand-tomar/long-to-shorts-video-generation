"use client";

import React, { useState, useEffect } from "react";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Sparkles, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  MessageSquare,
  AlertCircle,
  ExternalLink
} from "lucide-react";
import { getCompletedClips, getScheduledPosts, schedulePost, generateAICaption } from "@/actions/calendar";
import { getConnectedAccounts } from "@/actions/social";
import Link from "next/link";

const Instagram = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={`${className} fill-none stroke-current`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

const Facebook = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="current" viewBox="0 0 24 24">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const Linkedin = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={`${className} fill-none stroke-current`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

const Youtube = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="current" viewBox="0 0 24 24">
    <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.108C19.524 3.545 12 3.545 12 3.545s-7.525 0-9.388.51a3.003 3.003 0 0 0-2.11 2.108C0 8.029 0 12 0 12s0 3.971.502 5.837a3.003 3.003 0 0 0 2.11 2.108c1.863.51 9.388.51 9.388.51s7.525 0 9.388-.51a3.003 3.003 0 0 0 2.11-2.108c.502-1.866.502-5.837.502-5.837s0-3.971-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

interface CompletedClip {
  id: string;
  title: string;
  description: string | null;
  startTime: number;
  endTime: number;
  clipUrl: string | null;
  videoTitle: string;
  hookText: string | null;
}

interface SocialAccount {
  id: string;
  platform: string;
  profileName: string | null;
  profilePicture: string | null;
}

interface ScheduledPost {
  id: string;
  caption: string | null;
  scheduledFor: Date;
  status: string;
  errorMessage: string | null;
  clipTitle: string;
  clipUrl: string | null;
  platform: string;
  profileName: string | null;
}

const PLATFORM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  instagram: Instagram,
  youtube: Youtube,
  facebook: Facebook,
  linkedin: Linkedin,
  tiktok: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} fill="current" viewBox="0 0 24 24">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.02 1.63 4.18 1.12 1.25 2.7 1.94 4.35 2.15v3.77c-1.39-.06-2.77-.51-3.95-1.28-.42-.27-.8-.58-1.15-.92-.09 1.79-.1 3.58-.1 5.37 0 1.93-.41 3.87-1.33 5.53-1.07 1.93-2.92 3.4-5.08 3.99-2.21.61-4.63.35-6.66-.75-2.03-1.09-3.53-3.08-4.07-5.36-.59-2.47-.13-5.18 1.26-7.27 1.4-2.13 3.8-3.48 6.37-3.66.19-.01.38-.02.57-.02v3.78c-1.15.06-2.3.56-3.09 1.41-.81.87-1.2 2.11-1.06 3.29.13 1.15.82 2.18 1.83 2.76 1 .59 2.23.63 3.26.11 1.05-.51 1.8-1.57 2-2.72.13-1.01.1-2.03.1-3.05V0z" />
    </svg>
  ),
  x: ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
    <svg className={className} fill="current" viewBox="0 0 24 24">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  youtube: "bg-red-500/20 text-red-400 border-red-500/30",
  tiktok: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  facebook: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  linkedin: "bg-sky-500/20 text-sky-400 border-sky-500/30",
  x: "bg-zinc-700/20 text-zinc-300 border-zinc-700/30",
};

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [clipsList, setClipsList] = useState<CompletedClip[]>([]);
  const [connections, setConnections] = useState<SocialAccount[]>([]);
  const [scheduledPostsList, setScheduledPostsList] = useState<ScheduledPost[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form States
  const [selectedClipId, setSelectedClipId] = useState("");
  const [selectedConnections, setSelectedConnections] = useState<string[]>([]);
  const [scheduledDateStr, setScheduledDateStr] = useState("");
  const [scheduledTimeStr, setScheduledTimeStr] = useState("");
  const [caption, setCaption] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [generatingCaption, setGeneratingCaption] = useState(false);
  const [submittingSchedule, setSubmittingSchedule] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [clipsData, connectionsData, postsData] = await Promise.all([
        getCompletedClips(),
        getConnectedAccounts(),
        getScheduledPosts(),
      ]);
      setClipsList(clipsData);
      setConnections(connectionsData as SocialAccount[]);
      setScheduledPostsList(postsData.map(p => ({
        ...p,
        scheduledFor: new Date(p.scheduledFor)
      })));
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to load scheduler data. Please reload page.");
    } finally {
      setLoading(false);
    }
  }

  // AI copywriting prompt submission
  async function handleAIGenerate() {
    if (!selectedClipId) {
      alert("Please select a clip first to give the AI context.");
      return;
    }
    const clip = clipsList.find(c => c.id === selectedClipId);
    if (!clip) return;

    setGeneratingCaption(true);
    try {
      const res = await generateAICaption(aiPrompt, clip.title, clip.hookText || undefined);
      if (res.success && res.caption) {
        let fullCaption = res.caption;
        if (res.hashtags && res.hashtags.length > 0) {
          fullCaption += "\n\n" + res.hashtags.map((tag: string) => `#${tag}`).join(" ");
        }
        setCaption(fullCaption);
      } else {
        alert("Gemini failed to generate caption: " + (res.error || "unknown"));
      }
    } catch (err) {
      console.error(err);
      alert("Error generating caption with Gemini.");
    } finally {
      setGeneratingCaption(false);
    }
  }

  async function handleScheduleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!selectedClipId) {
      setErrorMsg("Please select a clip.");
      return;
    }
    if (selectedConnections.length === 0) {
      setErrorMsg("Please select at least one social channel.");
      return;
    }
    if (!scheduledDateStr || !scheduledTimeStr) {
      setErrorMsg("Please select a future date and time.");
      return;
    }

    const scheduledDateTime = new Date(`${scheduledDateStr}T${scheduledTimeStr}`);
    if (scheduledDateTime.getTime() <= Date.now()) {
      setErrorMsg("Scheduled time must be in the future.");
      return;
    }

    setSubmittingSchedule(true);
    try {
      const res = await schedulePost({
        clipId: selectedClipId,
        connectionIds: selectedConnections,
        scheduledFor: scheduledDateTime.toISOString(),
        caption,
      });

      if (res.error === "plan_limit_exceeded") {
        setErrorMsg("Limit exceeded! Free tier accounts are capped at a maximum of 5 active scheduled posts in their queue. Please upgrade to Pro in Settings for unlimited scheduling.");
      } else if (res.error) {
        setErrorMsg(`Failed to schedule: ${res.error}`);
      } else {
        setSuccessMsg("Posts scheduled successfully!");
        setModalOpen(false);
        // Reset Form
        setSelectedClipId("");
        setSelectedConnections([]);
        setScheduledDateStr("");
        setScheduledTimeStr("");
        setCaption("");
        setAiPrompt("");
        // Reload
        await loadData();
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("An unexpected error occurred while scheduling.");
    } finally {
      setSubmittingSchedule(false);
    }
  }

  // Calendar Helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Calendar Grid generation
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarCells = [];

  // Padding cells for previous month
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null);
  }

  // Actual days
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(new Date(year, month, d));
  }

  return (
    <div className="py-8 px-6 sm:px-10 max-w-7xl mx-auto space-y-8 text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            Content Calendar
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Schedule and automate short video publishing across linked social profiles.
          </p>
        </div>
        <button
          onClick={() => {
            if (connections.length === 0) {
              alert("Please connect at least one Social Channel first.");
              return;
            }
            if (clipsList.length === 0) {
              alert("You don't have any rendered video clips. Go to clips list and trigger a cloud render first!");
              return;
            }
            setModalOpen(true);
          }}
          className="py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm transition-all shadow-md shadow-violet-500/10 flex items-center gap-2 cursor-pointer self-start sm:self-center"
        >
          <Plus className="w-4 h-4" />
          Schedule Post
        </button>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-300 flex items-start gap-3 text-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-rose-200">Error:</span> {errorMsg}
            {errorMsg.includes("Limit exceeded") && (
              <div className="mt-2">
                <Link 
                  href="/dashboard/settings" 
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-400 hover:text-violet-300 transition-colors"
                >
                  Upgrade Plan in Settings <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-300 flex items-start gap-3 text-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
          <p className="text-zinc-500 text-sm">Loading scheduler board...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* 1. Calendar Monthly Grid (Col Span 2) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between bg-zinc-950/40 border border-zinc-900 rounded-2xl p-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-violet-500" />
                <span>{monthNames[month]} {year}</span>
              </h2>
              <div className="flex items-center gap-2">
                <button 
                  onClick={prevMonth}
                  className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button 
                  onClick={nextMonth}
                  className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-zinc-950/40 border border-zinc-900 rounded-2xl p-4 overflow-hidden">
              <div className="grid grid-cols-7 gap-2 mb-2 text-center text-zinc-500 font-bold text-xs uppercase tracking-wider">
                <div>Sun</div>
                <div>Mon</div>
                <div>Tue</div>
                <div>Wed</div>
                <div>Thu</div>
                <div>Fri</div>
                <div>Sat</div>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {calendarCells.map((cell, idx) => {
                  if (cell === null) {
                    return <div key={`empty-${idx}`} className="aspect-square bg-zinc-950/10 rounded-lg border border-transparent" />;
                  }

                  const cellDate = cell.getDate();
                  const isToday = new Date().toDateString() === cell.toDateString();
                  
                  // Find posts on this day
                  const postsOnDay = scheduledPostsList.filter(post => 
                    post.scheduledFor.getFullYear() === cell.getFullYear() &&
                    post.scheduledFor.getMonth() === cell.getMonth() &&
                    post.scheduledFor.getDate() === cellDate
                  );

                  return (
                    <div 
                      key={`day-${cellDate}`} 
                      className={`aspect-square rounded-xl p-2 bg-zinc-900/30 border flex flex-col justify-between hover:bg-zinc-900/60 hover:border-zinc-800 transition-all ${
                        isToday ? "border-violet-500/50 bg-violet-950/5" : "border-zinc-900"
                      }`}
                    >
                      <span className={`text-xs font-bold ${isToday ? "text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded-md" : "text-zinc-400"} self-start`}>
                        {cellDate}
                      </span>

                      {/* Display small status dots/indicators */}
                      {postsOnDay.length > 0 && (
                        <div className="flex flex-wrap gap-1 max-w-full overflow-hidden mt-2">
                          {postsOnDay.slice(0, 3).map((post) => {
                            const Icon = PLATFORM_ICONS[post.platform] || MessageSquare;
                            const statusColor = 
                              post.status === "published" ? "bg-emerald-500 text-emerald-100" :
                              post.status === "failed" ? "bg-rose-500 text-rose-100" :
                              post.status === "publishing" ? "bg-blue-500 text-blue-100 animate-pulse" :
                              "bg-violet-600 text-violet-100";

                            return (
                              <div 
                                key={post.id}
                                className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] ${statusColor}`}
                                title={`${post.clipTitle} (${post.platform}) - ${post.status}`}
                              >
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                            );
                          })}
                          {postsOnDay.length > 3 && (
                            <span className="text-[9px] font-bold text-zinc-500 px-1">
                              +{postsOnDay.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 2. Sidebar Post Queue (Col Span 1) */}
          <div className="space-y-6">
            <div className="bg-zinc-950/40 border border-zinc-900 rounded-2xl p-6 space-y-6 flex flex-col h-[500px]">
              <div className="border-b border-zinc-900 pb-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-violet-500" />
                  Publishing Queue
                </h2>
                <p className="text-zinc-500 text-xs mt-1">Status of scheduled clip dispatches.</p>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {scheduledPostsList.length === 0 ? (
                  <div className="text-center py-10 text-zinc-600 text-sm">
                    No scheduled posts. Click &quot;Schedule Post&quot; above to fill your queue!
                  </div>
                ) : (
                  scheduledPostsList
                    .sort((a, b) => b.scheduledFor.getTime() - a.scheduledFor.getTime())
                    .map((post) => {
                      const Icon = PLATFORM_ICONS[post.platform] || MessageSquare;
                      return (
                        <div 
                          key={post.id}
                          className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-900 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${PLATFORM_COLORS[post.platform]}`}>
                              <Icon className="w-3 h-3" />
                              {post.platform}
                            </span>

                            {/* Status badge */}
                            {post.status === "scheduled" && (
                              <span className="text-[10px] font-semibold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/20">
                                Scheduled
                              </span>
                            )}
                            {post.status === "publishing" && (
                              <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 animate-pulse">
                                Publishing
                              </span>
                            )}
                            {post.status === "published" && (
                              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Published
                              </span>
                            )}
                            {post.status === "failed" && (
                              <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 flex items-center gap-1" title={post.errorMessage || ""}>
                                <XCircle className="w-3 h-3" />
                                Failed
                              </span>
                            )}
                          </div>

                          <div>
                            <h4 className="font-bold text-sm text-zinc-100 truncate">{post.clipTitle}</h4>
                            <p className="text-zinc-400 text-xs line-clamp-2 mt-1 italic">
                              &quot;{post.caption || "No caption"}&quot;
                            </p>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-zinc-500 border-t border-zinc-900/60 pt-2 mt-1">
                            <span>Set for:</span>
                            <span className="font-semibold text-zinc-400">
                              {post.scheduledFor.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>

                          {post.status === "failed" && post.errorMessage && (
                            <div className="p-2 rounded bg-rose-950/20 border border-rose-900/30 text-[10px] text-rose-400">
                              <span className="font-bold">Error:</span> {post.errorMessage}
                            </div>
                          )}
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* 3. Schedule Post Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-900 rounded-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Plus className="w-5 h-5 text-violet-500" />
                Schedule Social Post
              </h3>
              <button 
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-5">
              
              {/* Clip Picker */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  1. Choose Rendered Clip
                </label>
                <select
                  value={selectedClipId}
                  onChange={(e) => setSelectedClipId(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-violet-500 text-sm"
                >
                  <option value="">Select a completed video clip...</option>
                  {clipsList.map((clip) => (
                    <option key={clip.id} value={clip.id}>
                      {clip.title} (from: {clip.videoTitle})
                    </option>
                  ))}
                </select>
              </div>

              {/* Connected channels multi-select */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  2. Select Publishing Channels
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {connections.map((conn) => {
                    const Icon = PLATFORM_ICONS[conn.platform] || MessageSquare;
                    const isChecked = selectedConnections.includes(conn.id);
                    
                    return (
                      <button
                        type="button"
                        key={conn.id}
                        onClick={() => {
                          if (isChecked) {
                            setSelectedConnections(prev => prev.filter(id => id !== conn.id));
                          } else {
                            setSelectedConnections(prev => [...prev, conn.id]);
                          }
                        }}
                        className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                          isChecked
                            ? "bg-violet-600/10 border-violet-500 text-white"
                            : "bg-zinc-900/40 border-zinc-900 text-zinc-400 hover:border-zinc-800"
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                          isChecked ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400"
                        }`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold truncate leading-tight capitalize">
                            {conn.platform}
                          </p>
                          <p className="text-[10px] text-zinc-500 truncate leading-none mt-0.5">
                            {conn.profileName || "@channel"}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Gemini caption copywriting prompt */}
              <div className="p-4 rounded-xl border border-violet-900/20 bg-violet-950/5 space-y-3">
                <div className="flex items-center gap-2 text-violet-400">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    ✨ AI Copywriter (Gemini Pro)
                  </span>
                </div>
                <p className="text-zinc-500 text-[10px] leading-relaxed">
                  Enter copy prompts, keywords, or topics, and Gemini will generate a custom caption based on clip hook metrics.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Write a friendly motivation post highlighting this quote..."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-violet-500"
                  />
                  <button
                    type="button"
                    onClick={handleAIGenerate}
                    disabled={generatingCaption}
                    className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs disabled:opacity-50 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {generatingCaption ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3" />
                        Write
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Caption Text Box */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  3. Post Caption
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Enter caption with hashtags..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-violet-500 text-sm font-sans"
                />
              </div>

              {/* Date & Time Pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    4. Publish Date
                  </label>
                  <input
                    type="date"
                    value={scheduledDateStr}
                    onChange={(e) => setScheduledDateStr(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-violet-500 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    5. Publish Time
                  </label>
                  <input
                    type="time"
                    value={scheduledTimeStr}
                    onChange={(e) => setScheduledTimeStr(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-violet-500 text-sm"
                  />
                </div>
              </div>

              {/* Submit CTA */}
              <div className="border-t border-zinc-900 pt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="py-2.5 px-5 rounded-xl border border-zinc-800 hover:bg-zinc-900 text-zinc-400 font-bold text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSchedule}
                  className="py-2.5 px-6 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-violet-500/10"
                >
                  {submittingSchedule && <Loader2 className="w-4 h-4 animate-spin" />}
                  Schedule Post
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
