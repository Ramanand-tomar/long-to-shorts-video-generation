"use client";

import React from "react";
import Link from "next/link";
import { Scissors, Play, Clock, Calendar, Sparkles, Download, ExternalLink } from "lucide-react";

interface Clip {
  id: string;
  title: string;
  description: string | null;
  startTime: number;
  endTime: number;
  confidenceScore: number | null;
  clipUrl: string | null;
  renderStatus: string;
  seoScore: number | null;
  createdAt: Date;
  videoTitle: string;
}

interface ClipsListProps {
  clips: Clip[];
}

export default function ClipsList({ clips }: ClipsListProps) {
  // Helper to format duration in MM:SS
  const formatDuration = (start: number, end: number) => {
    const duration = Math.max(0, end - start);
    const mins = Math.floor(duration / 60);
    const secs = Math.floor(duration % 60);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <div className="p-6 sm:p-10 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">My Clips</h1>
        <p className="text-zinc-400 text-sm mt-1">Browse, download, and configure your generated short-form clips.</p>
      </div>

      {/* Grid Layout */}
      {clips.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-20 px-4 border border-dashed border-zinc-900 rounded-3xl bg-zinc-950/10">
          <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-6">
            <Scissors className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No clips generated yet</h3>
          <p className="text-zinc-500 text-sm max-w-sm mb-8 leading-relaxed">
            Go to your uploaded videos page, select a video, and run AI analysis to generate clips.
          </p>
          <Link
            href="/dashboard/videos"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm transition-all shadow-lg shadow-violet-500/20"
          >
            <Sparkles className="w-4.5 h-4.5" />
            Analyze a Video
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {clips.map((clip) => {
            return (
              <div
                key={clip.id}
                className="group bg-zinc-900/10 border border-zinc-900 rounded-2xl overflow-hidden hover:border-zinc-800 transition-all flex flex-col justify-between"
              >
                {/* Thumbnail / Header Area */}
                <div className="aspect-[16/9] w-full bg-zinc-950 relative overflow-hidden border-b border-zinc-900/80 flex items-center justify-center text-zinc-700">
                  <Scissors className="w-12 h-12 text-zinc-800 group-hover:scale-105 transition-transform duration-300" />
                  
                  {clip.clipUrl && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                      <a
                        href={clip.clipUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300"
                      >
                        <Play className="w-5 h-5 fill-black ml-0.5" />
                      </a>
                    </div>
                  )}

                  {/* Duration overlay badge */}
                  <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded bg-black/75 text-[11px] font-bold tracking-wide text-white flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDuration(clip.startTime, clip.endTime)}
                  </span>

                  {/* SEO Score badge */}
                  {clip.seoScore && (
                    <span className="absolute top-3 left-3 px-2.5 py-0.5 rounded-lg bg-violet-600/90 border border-violet-500/20 text-white text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      SEO: {clip.seoScore}
                    </span>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-white font-bold text-sm sm:text-base line-clamp-1 group-hover:text-violet-400 transition-colors" title={clip.title}>
                      {clip.title}
                    </h3>
                    <p className="text-zinc-500 text-xs line-clamp-2 leading-relaxed">
                      {clip.description || "No description provided."}
                    </p>
                    <div className="text-[11px] text-zinc-600 font-medium">
                      Source: <span className="text-zinc-500">{clip.videoTitle}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-900/60 pt-4 mt-2">
                    {/* Render Status Badge */}
                    {clip.renderStatus === "completed" ? (
                      <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                        Rendered
                      </span>
                    ) : clip.renderStatus === "rendering" ? (
                      <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-wider animate-pulse">
                        Rendering
                      </span>
                    ) : clip.renderStatus === "queued" ? (
                      <span className="px-2.5 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-wider">
                        Queued
                      </span>
                    ) : clip.renderStatus === "failed" ? (
                      <span className="px-2.5 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold uppercase tracking-wider">
                        Failed
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                        Not Rendered
                      </span>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {clip.clipUrl && (
                        <a
                          href={clip.clipUrl}
                          download
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-xl bg-zinc-900 border border-zinc-850 hover:border-zinc-700 text-zinc-400 hover:text-white transition-colors"
                          title="Download Clip"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}
                      
                      <Link
                        href={`/dashboard/clips/${clip.id}`}
                        className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white font-bold text-xs transition-colors flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3 h-3 text-violet-400" />
                        Edit & Export
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
