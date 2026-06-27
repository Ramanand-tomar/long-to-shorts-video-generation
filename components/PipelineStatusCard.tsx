"use client";

import React, { useEffect, useState } from "react";
import { getPipelineStatus } from "@/actions/pipeline";
import { 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Mail, 
  ExternalLink,
  Video
} from "lucide-react";

interface ClipData {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  renderStatus: string;
  youtubeVideoId: string | null;
  youtubePublishedAt: Date | null;
  youtubeTitle: string | null;
}

interface PipelineRunData {
  id: string;
  status: string;
  errorMessage: string | null;
  totalClips: number;
  publishedClips: number;
  createdAt: Date;
  updatedAt: Date;
  videoTitle: string;
  videoSource: string;
}

interface PipelineStatusCardProps {
  pipelineRunId: string;
}

export default function PipelineStatusCard({ pipelineRunId }: PipelineStatusCardProps) {
  const [data, setData] = useState<{
    pipelineRun: PipelineRunData;
    clips: ClipData[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const result = await getPipelineStatus(pipelineRunId);
        if (result.error) {
          setError(result.error);
        } else if (result.success && result.pipelineRun && result.clips) {
          setData({
            pipelineRun: result.pipelineRun as unknown as PipelineRunData,
            clips: result.clips as unknown as ClipData[],
          });
          setError(null);
        }
      } catch (err) {
        console.error("Error fetching pipeline status:", err);
        setError("Failed to connect to status service.");
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [pipelineRunId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border border-zinc-900 rounded-3xl bg-zinc-950/20 text-center space-y-4">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        <p className="text-zinc-400 text-sm font-semibold">Loading pipeline tracker...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Failed to load pipeline run details</p>
          <p className="text-rose-450/80 text-xs mt-1">{error || "Pipeline record not found."}</p>
        </div>
      </div>
    );
  }

  const { pipelineRun, clips } = data;

  // Progress metrics
  const percentComplete = pipelineRun.totalClips > 0
    ? Math.round((pipelineRun.publishedClips / pipelineRun.totalClips) * 100)
    : 0;

  // Find the index of the first clip that hasn't been published to calculate estimated wait times
  const activeIndex = clips.findIndex(c => !c.youtubeVideoId);

  // Status Badge configurations
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Pending
          </span>
        );
      case "analyzing":
        return (
          <span className="px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing
          </span>
        );
      case "rendering":
        return (
          <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Rendering
          </span>
        );
      case "publishing":
        return (
          <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Publishing
          </span>
        );
      case "completed":
        return (
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Completed
          </span>
        );
      case "failed":
        return (
          <span className="px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Failed
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 text-xs font-bold uppercase tracking-wider">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-[#12121a] border border-zinc-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl space-y-8">
      
      {/* Background decorations */}
      <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-violet-600/5 rounded-full blur-[60px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-zinc-900">
        <div>
          <div className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
            <Video className="w-3.5 h-3.5 text-violet-400" />
            <span>Google Drive Automated Pipeline</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight mt-1">
            {pipelineRun.videoTitle}
          </h2>
        </div>
        {getStatusBadge(pipelineRun.status)}
      </div>

      {/* Error Message */}
      {pipelineRun.errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Pipeline Execution Error</p>
            <p className="text-rose-450/80 text-xs mt-1">{pipelineRun.errorMessage}</p>
          </div>
        </div>
      )}

      {/* Overall Progress */}
      {pipelineRun.status !== "failed" && (
        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs font-semibold">
            <span className="text-zinc-400">Publishing Cadence (1h Gap)</span>
            <span className="text-white">
              {pipelineRun.publishedClips} / {pipelineRun.totalClips} Clips Live
            </span>
          </div>
          
          <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-600 transition-all duration-500 rounded-full"
              style={{ width: `${percentComplete}%` }}
            />
          </div>
        </div>
      )}

      {/* Clips Sequence List */}
      <div className="space-y-4">
        <h3 className="text-xs text-zinc-300 font-bold uppercase tracking-wider">Sequential Clip Queue</h3>
        
        {clips.length === 0 ? (
          <div className="p-6 border border-dashed border-zinc-900 rounded-2xl text-center text-zinc-500 text-xs">
            Moments extraction pending... Clips list will appear once analysis completes.
          </div>
        ) : (
          <div className="space-y-3">
            {clips.map((clip, index) => {
              const isPublished = !!clip.youtubeVideoId;
              const isCurrentlyActive = !isPublished && index === activeIndex;
              const isWaiting = !isPublished && index > activeIndex;

              let statusDot = <span className="w-2.5 h-2.5 rounded-full bg-zinc-800" />;
              let statusLabel = <span className="text-zinc-500 text-[10px]">Waiting</span>;
              
              if (isPublished) {
                statusDot = <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />;
                statusLabel = <span className="text-emerald-400 text-[10px] font-bold">Published</span>;
              } else if (isCurrentlyActive) {
                statusDot = <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_#f59e0b]" />;
                statusLabel = (
                  <span className="text-amber-400 text-[10px] font-bold flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Processing
                  </span>
                );
              }

              // Est wait calculation
              let estWaitBadge = null;
              if (isWaiting && activeIndex !== -1) {
                const hoursWait = index - activeIndex;
                estWaitBadge = (
                  <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Est. ~{hoursWait}h wait
                  </span>
                );
              }

              return (
                <div 
                  key={clip.id} 
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
                    isCurrentlyActive 
                      ? "bg-violet-950/5 border-violet-500/20" 
                      : isPublished 
                        ? "bg-zinc-950/20 border-zinc-900/60" 
                        : "bg-zinc-950/10 border-zinc-950/60 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {statusDot}
                    <div>
                      <h4 className="text-zinc-200 font-bold text-sm line-clamp-1">
                        {clip.youtubeTitle || clip.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        {statusLabel}
                        <span className="text-[10px] text-zinc-600 font-semibold">
                          Duration: {Math.round(clip.endTime - clip.startTime)}s
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    {estWaitBadge}
                    {isPublished && (
                      <a 
                        href={`https://youtube.com/watch?v=${clip.youtubeVideoId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs border border-zinc-800 transition-colors flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3 text-violet-400" />
                        Watch
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Completion Notification Section */}
      {pipelineRun.status === "completed" && (
        <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-550/10 text-emerald-400/80 text-xs flex items-start gap-3">
          <Mail className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
          <div className="leading-relaxed">
            <p className="font-bold text-emerald-400">All clips published successfully!</p>
            <p className="mt-1">
              The daily video pipeline is complete. All rendered copies in the AWS S3 storage bucket have been cleaned up automatically, and a detailed completion summary email has been delivered to your mailbox.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
