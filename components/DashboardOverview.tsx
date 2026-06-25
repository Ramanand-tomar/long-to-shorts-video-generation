"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  UploadCloud, 
  Film, 
  Scissors, 
  Calendar, 
  Clock, 
  ChevronRight, 
  Plus, 
  Activity 
} from "lucide-react";
import UploadModal from "./UploadModal";

interface LogEntry {
  id: string;
  action: string;
  quantity: number;
  timestamp: Date;
}

interface DashboardOverviewProps {
  userPlan: string;
  stats: {
    totalVideos: number;
    clipsGenerated: number;
    pendingRenders: number;
    scheduledPosts: number;
  };
  recentLogs: LogEntry[];
}

export default function DashboardOverview({ userPlan, stats, recentLogs }: DashboardOverviewProps) {
  const [uploadOpen, setUploadOpen] = useState(false);

  // Format activity action names to readable strings
  const formatAction = (action: string) => {
    switch (action) {
      case "video_upload":
        return "Uploaded a video";
      case "clip_generation":
        return "Generated short clips";
      case "social_publish":
        return "Published clip to social media";
      case "render":
        return "Rendered a short video clip";
      default:
        return action.replace(/_/g, " ");
    }
  };

  return (
    <div className="p-6 sm:p-10 space-y-10">
      
      {/* Welcome banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Overview</h1>
          <p className="text-zinc-400 text-sm mt-1">Monitor your workspace usage metrics and recent activity.</p>
        </div>
        
        <button
          onClick={() => setUploadOpen(true)}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm transition-all shadow-lg shadow-violet-500/20"
        >
          <UploadCloud className="w-4 h-4" />
          Quick Upload
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card 1: Videos */}
        <div className="bg-zinc-900/20 border border-zinc-900 p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-4">
              <Film className="w-5 h-5" />
            </div>
            <p className="text-zinc-500 text-xs font-bold tracking-wider uppercase">Videos Uploaded</p>
            <h3 className="text-3xl font-extrabold text-white mt-1">{stats.totalVideos}</h3>
          </div>
          <p className="text-zinc-600 text-xs mt-4">Long-form raw files</p>
        </div>

        {/* Card 2: Clips */}
        <div className="bg-zinc-900/20 border border-zinc-900 p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center text-fuchsia-400 mb-4">
              <Scissors className="w-5 h-5" />
            </div>
            <p className="text-zinc-500 text-xs font-bold tracking-wider uppercase">Clips Generated</p>
            <h3 className="text-3xl font-extrabold text-white mt-1">{stats.clipsGenerated}</h3>
          </div>
          <p className="text-zinc-600 text-xs mt-4">Selected AI moments</p>
        </div>

        {/* Card 3: Renders */}
        <div className="bg-zinc-900/20 border border-zinc-900 p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
              <Clock className="w-5 h-5" />
            </div>
            <p className="text-zinc-500 text-xs font-bold tracking-wider uppercase">Pending Renders</p>
            <h3 className="text-3xl font-extrabold text-white mt-1">{stats.pendingRenders}</h3>
          </div>
          <p className="text-zinc-600 text-xs mt-4">In queue or rendering</p>
        </div>

        {/* Card 4: Scheduled */}
        <div className="bg-zinc-900/20 border border-zinc-900 p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
              <Calendar className="w-5 h-5" />
            </div>
            <p className="text-zinc-500 text-xs font-bold tracking-wider uppercase">Scheduled Posts</p>
            <h3 className="text-3xl font-extrabold text-white mt-1">{stats.scheduledPosts}</h3>
          </div>
          <p className="text-zinc-600 text-xs mt-4">Pending publishing</p>
        </div>

      </div>

      {/* Main Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Recent Activity Log */}
        <div className="lg:col-span-2 bg-zinc-900/10 border border-zinc-900 rounded-3xl p-6 sm:p-8">
          <div className="flex items-center gap-2.5 mb-6">
            <Activity className="w-5 h-5 text-violet-400" />
            <h3 className="text-lg font-bold text-white tracking-tight">Recent Activity</h3>
          </div>

          {recentLogs.length === 0 ? (
            <div className="h-48 border border-dashed border-zinc-900 rounded-2xl flex flex-col items-center justify-center text-center p-6 bg-zinc-950/20">
              <p className="text-zinc-400 text-sm font-semibold mb-1">No activity logged yet</p>
              <p className="text-zinc-600 text-xs">Activities like uploading videos and rendering clips will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-900/60">
              {recentLogs.map((log) => (
                <div key={log.id} className="py-4 flex justify-between items-center first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-bold text-zinc-200">{formatAction(log.action)}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 font-semibold">
                    +{log.quantity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions Panel */}
        <div className="bg-zinc-900/10 border border-zinc-900 rounded-3xl p-6 sm:p-8 space-y-6">
          <h3 className="text-lg font-bold text-white tracking-tight">Quick Shortcuts</h3>
          
          <div className="flex flex-col gap-3">
            <Link 
              href="/dashboard/videos"
              className="flex items-center justify-between p-4 rounded-2xl bg-zinc-950/40 border border-zinc-900 hover:border-zinc-800 hover:bg-zinc-900/20 transition-all group"
            >
              <div>
                <p className="text-sm font-bold text-white">View Videos</p>
                <p className="text-zinc-500 text-xs mt-0.5">Manage and watch uploaded files</p>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors" />
            </Link>

            <div
              onClick={() => setUploadOpen(true)}
              className="flex items-center justify-between p-4 rounded-2xl bg-zinc-950/40 border border-zinc-900 hover:border-zinc-800 hover:bg-zinc-900/20 transition-all group cursor-pointer"
            >
              <div>
                <p className="text-sm font-bold text-white">Upload New Video</p>
                <p className="text-zinc-500 text-xs mt-0.5">Scout viral clips from new media</p>
              </div>
              <Plus className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors" />
            </div>
          </div>

          {/* User limit status info box */}
          <div className="p-4 rounded-2xl bg-violet-950/10 border border-violet-850/20 text-violet-300/80">
            <p className="text-xs font-bold uppercase tracking-wider text-violet-400">Account Plan: {userPlan}</p>
            <p className="text-xs leading-relaxed mt-1">
              {userPlan === "free" 
                ? "You are using the Free tier (max 5 uploads per 24 hours). Upgrade to Pro for unlimited uploads, priority rendering queues, and social publishing features." 
                : "You are on the Pro plan with high upload quotas, priority queues, and advanced scheduling enabled."}
            </p>
          </div>
        </div>

      </div>

      {/* Render local UploadModal portal */}
      <UploadModal 
        isOpen={uploadOpen} 
        onClose={() => setUploadOpen(false)} 
        userPlan={userPlan} 
      />
    </div>
  );
}
