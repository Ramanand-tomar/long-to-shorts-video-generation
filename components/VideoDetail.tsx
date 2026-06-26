"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { startAnalysis, getAnalysisStatus } from "@/actions/analysis";
import { 
  Play, 
  Sparkles, 
  Clock, 
  HardDrive, 
  FileCode, 
  Calendar, 
  Scissors, 
  Check, 
  Loader2, 
  AlertCircle,
  PlayCircle,
  ChevronLeft,
  RefreshCw,
  Sliders,
  Download,
  Share2,
  Trash2
} from "lucide-react";
import Link from "next/link";
import { deleteClip } from "@/actions/render";

interface Video {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  videoUrl: string;
  fileName: string;
  fileSize: number;
  duration: number | null;
  format: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface AnalysisJob {
  id: string;
  videoId: string;
  status: string;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Clip {
  id: string;
  videoId: string;
  title: string;
  description: string | null;
  startTime: number;
  endTime: number;
  confidenceScore: number | null;
  clipUrl: string | null;
  renderStatus: string;
  subtitleStyle: unknown;
  createdAt: Date;
  updatedAt: Date;
  seoScore: number | null;
}

interface VideoDetailProps {
  video: Video;
  analysisJob: AnalysisJob | null;
  clips: Clip[];
}

// Helper to simplify and clean up API error messages
const formatErrorMessage = (msg: string) => {
  if (!msg) return "";
  
  if (msg.includes("Gemini API generateContent failed:")) {
    try {
      const jsonStart = msg.indexOf("{");
      if (jsonStart !== -1) {
        const jsonStr = msg.substring(jsonStart);
        const parsed = JSON.parse(jsonStr);
        if (parsed?.error?.message) {
          const cleanMessage = parsed.error.message;
          if (
            cleanMessage.includes("quota exceeded") || 
            cleanMessage.includes("RESOURCE_EXHAUSTED") || 
            parsed.error.status === "RESOURCE_EXHAUSTED"
          ) {
            return "Gemini API rate limit or daily quota exceeded. Please wait 30 seconds and try again.";
          }
          return cleanMessage;
        }
      }
    } catch {
      // ignore
    }
  }

  if (msg.includes("Deepgram transcription failed:")) {
    return "Deepgram transcription failed. Please check your API key or audio track.";
  }

  return msg;
};

export default function VideoDetail({ video, analysisJob, clips }: VideoDetailProps) {
  const router = useRouter();
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeClipUrl, setActiveClipUrl] = useState<string | null>(null);
  const [activeClipTitle, setActiveClipTitle] = useState<string | null>(null);
  const [deletingClipId, setDeletingClipId] = useState<string | null>(null);

  const handleDeleteClip = async (clipId: string) => {
    if (!confirm("Are you sure you want to delete this clip suggestion?")) {
      return;
    }
    
    setDeletingClipId(clipId);
    try {
      const result = await deleteClip(clipId);
      if (result.error) {
        setError(`Failed to delete clip: ${result.error}`);
      } else {
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred while deleting the clip.");
    } finally {
      setDeletingClipId(null);
    }
  };

  // Polling states
  const [currentJobId, setCurrentJobId] = useState<string | null>(analysisJob?.id || null);
  const [jobStatus, setJobStatus] = useState<string | null>(analysisJob?.status || null);
  const [jobError, setJobError] = useState<string | null>(analysisJob?.error || null);
  const [polling, setPolling] = useState<boolean>(
    analysisJob ? (analysisJob.status === "queued" || analysisJob.status === "processing") : false
  );

  // Sync state if the prop changes (e.g. after refresh)
  useEffect(() => {
    if (analysisJob) {
      setCurrentJobId(analysisJob.id);
      setJobStatus(analysisJob.status);
      setJobError(analysisJob.error);
      setPolling(analysisJob.status === "queued" || analysisJob.status === "processing");
    }
  }, [analysisJob]);

  // Polling loop
  useEffect(() => {
    if (!polling || !currentJobId) return;

    const checkStatus = async () => {
      try {
        const result = await getAnalysisStatus(currentJobId);
        if (result.error) {
          setError(result.error);
          setPolling(false);
        } else if (result.success && result.status) {
          setJobStatus(result.status);
          setJobError(result.error || null);
          
          if (result.status === "completed" || result.status === "failed") {
            setPolling(false);
            router.refresh(); // Triggers server-side update of clips list
          }
        }
      } catch (err) {
        console.error("Error polling analysis status:", err);
      }
    };

    // First check
    checkStatus();

    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [polling, currentJobId, router]);

  const handleStartAnalysis = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const result = await startAnalysis(video.id);
      if (result.error) {
        setError(`Failed to start analysis: ${result.error}`);
      } else if (result.success && result.jobId) {
        setCurrentJobId(result.jobId);
        setJobStatus("queued");
        setPolling(true);
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setAnalyzing(false);
    }
  };

  const formatSize = (bytes: number) => {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "00:00";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const pad = (num: number) => String(num).padStart(2, "0");

    if (hrs > 0) {
      return `${hrs}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  const handlePreviewClip = (clip: Clip) => {
    // HTML5 media fragments format: videoUrl#t=startTime,endTime
    const previewUrl = `${video.videoUrl}#t=${clip.startTime},${clip.endTime}`;
    setActiveClipUrl(previewUrl);
    setActiveClipTitle(clip.title);
  };

  // SEO Score colors based on rating
  const getSeoBadgeClass = (score: number) => {
    if (score >= 80) return "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400";
    if (score >= 60) return "bg-amber-500/10 border border-amber-500/20 text-amber-400";
    return "bg-rose-500/10 border border-rose-500/20 text-rose-400";
  };

  return (
    <div className="p-6 sm:p-10 space-y-8 max-w-6xl mx-auto">
      
      {/* Back link */}
      <div>
        <Link 
          href="/dashboard/videos" 
          className="inline-flex items-center gap-2 text-zinc-500 hover:text-white text-sm font-semibold transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Videos
        </Link>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight truncate max-w-xl" title={video.title}>
          {video.title}
        </h1>
        <p className="text-zinc-500 text-xs sm:text-sm mt-1">Uploaded on {new Date(video.createdAt).toLocaleString()}</p>
      </div>

      {/* Alert Error Box */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="font-semibold text-rose-300">{formatErrorMessage(error)}</p>
          </div>
          <button
            onClick={handleStartAnalysis}
            disabled={analyzing}
            className="flex-shrink-0 px-4 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-rose-950/20 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? "animate-spin" : ""}`} />
            Retry Analysis
          </button>
        </div>
      )}

      {/* Main Panel grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Video Player */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-zinc-900 bg-zinc-950 overflow-hidden aspect-[16/9] shadow-2xl relative">
            <video 
              key={activeClipUrl || video.videoUrl} // Force reload player when source fragment changes
              src={activeClipUrl || video.videoUrl} 
              className="w-full h-full object-contain"
              controls
              autoPlay={!!activeClipUrl}
            />
            {activeClipUrl && (
              <div className="absolute top-4 left-4 right-4 flex justify-between items-center gap-2 bg-[#0c0c12]/95 border border-zinc-800 p-2.5 rounded-xl shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2 min-w-0">
                  <PlayCircle className="w-4 h-4 text-violet-400 fill-violet-400/25 flex-shrink-0" />
                  <p className="text-xs text-zinc-300 font-bold truncate">Previewing: {activeClipTitle}</p>
                </div>
                <button 
                  onClick={() => {
                    setActiveClipUrl(null);
                    setActiveClipTitle(null);
                  }}
                  className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-850 text-[10px] font-bold text-zinc-400 hover:text-white transition-colors"
                >
                  Reset Player
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Metadata and Control Card */}
        <div className="space-y-6">
          
          {/* Metadata Card */}
          <div className="bg-zinc-900/10 border border-zinc-900 rounded-2xl p-6 space-y-4">
            <h3 className="text-white font-bold text-base tracking-tight">Video File Details</h3>
            <hr className="border-zinc-900/60" />
            
            <div className="grid grid-cols-2 gap-y-4 text-sm font-medium">
              <div className="flex items-center gap-2 text-zinc-500">
                <HardDrive className="w-4 h-4" />
                <span>Size</span>
              </div>
              <div className="text-zinc-300 text-right">{formatSize(video.fileSize)}</div>

              <div className="flex items-center gap-2 text-zinc-500">
                <Clock className="w-4 h-4" />
                <span>Duration</span>
              </div>
              <div className="text-zinc-300 text-right">{formatDuration(video.duration)}</div>

              <div className="flex items-center gap-2 text-zinc-500">
                <FileCode className="w-4 h-4" />
                <span>Format</span>
              </div>
              <div className="text-zinc-300 text-right uppercase">{video.format || "MP4"}</div>

              <div className="flex items-center gap-2 text-zinc-500">
                <Calendar className="w-4 h-4" />
                <span>Uploaded</span>
              </div>
              <div className="text-zinc-300 text-right">{new Date(video.createdAt).toLocaleDateString()}</div>
            </div>
          </div>

          {/* AI Analysis Card */}
          <div className="bg-zinc-900/10 border border-zinc-900 rounded-2xl p-6 space-y-6">
            <div>
              <h3 className="text-white font-bold text-base tracking-tight flex items-center gap-2">
                <Sparkles className="w-4.5 h-4.5 text-violet-400" />
                AI Moments Pick
              </h3>
              <p className="text-zinc-500 text-xs mt-1">Let Gemini detect viral moments and generate transcripts.</p>
            </div>

            <hr className="border-zinc-900/60" />

            {!jobStatus ? (
              <div className="space-y-4">
                <p className="text-zinc-400 text-xs leading-relaxed">
                  AI analysis has not been run on this video yet. Click below to analyze content, auto-generate captions, speaker frame offsets, and find clips.
                </p>
                <button
                  onClick={handleStartAnalysis}
                  disabled={analyzing}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 disabled:opacity-50 text-white font-bold text-sm transition-all shadow-lg shadow-violet-500/15 flex items-center justify-center gap-2"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-4.5 h-4.5 animate-spin" />
                      Initializing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4.5 h-4.5" />
                      Start AI Analysis
                    </>
                  )}
                </button>
              </div>
            ) : jobStatus === "queued" ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-900 flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-violet-400 animate-spin flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-white">Job Queued...</p>
                    <p className="text-zinc-500 text-xs mt-0.5">Waiting for background workers</p>
                  </div>
                </div>
                <p className="text-zinc-500 text-xs leading-relaxed">
                  The analysis is queued. Polling status in real-time...
                </p>
              </div>
            ) : jobStatus === "processing" ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-900 space-y-3">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-violet-400 animate-spin flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-white">Processing Video...</p>
                      <p className="text-zinc-500 text-xs mt-0.5">Transcribing & picking moments</p>
                    </div>
                  </div>
                  
                  {/* Decorative progress animation */}
                  <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                    <div className="h-full bg-violet-600 animate-pulse w-2/3 rounded-full" />
                  </div>
                </div>
                <p className="text-zinc-500 text-xs leading-relaxed">
                  Deepgram is transcribing and Gemini is picking moments. This usually takes 1-3 minutes.
                </p>
              </div>
            ) : jobStatus === "failed" ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/10 space-y-2">
                  <p className="text-sm font-bold text-rose-400 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    Analysis Failed
                  </p>
                  <p className="text-zinc-400 text-xs leading-relaxed break-words">
                    {jobError || "An unexpected error occurred during background tasks."}
                  </p>
                </div>
                
                <button
                  onClick={handleStartAnalysis}
                  disabled={analyzing}
                  className="w-full py-3 rounded-xl border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${analyzing ? "animate-spin" : ""}`} />
                  Retry Analysis
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Check className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Analysis Complete</p>
                  <p className="text-zinc-500 text-xs mt-0.5">{clips.length} clip suggestions generated</p>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

      {/* Suggested Clips Grid */}
      {jobStatus === "completed" && (
        <div className="space-y-6 pt-6 border-t border-zinc-900/60 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Scissors className="w-5 h-5 text-violet-400" />
              <h2 className="text-xl font-bold text-white tracking-tight">AI Suggested Clips</h2>
            </div>
            <span className="text-zinc-500 text-xs font-semibold">
              Select a clip to preview it directly in the player
            </span>
          </div>

          {clips.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 px-4 border border-dashed border-zinc-900 rounded-3xl bg-zinc-950/10">
              <p className="text-zinc-400 text-sm font-semibold mb-1">No clips generated</p>
              <p className="text-zinc-600 text-xs">The model did not find any highly engaging segments.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {clips.map((clip) => {
                const seoScore = clip.seoScore ?? (clip.confidenceScore ? Math.round(clip.confidenceScore * 100) : 80);
                return (
                  <div 
                    key={clip.id} 
                    className="bg-zinc-900/15 border border-zinc-900 rounded-2xl p-6 flex flex-col justify-between hover:border-zinc-800 hover:bg-zinc-900/20 transition-all group"
                  >
                    <div className="space-y-4">
                      {/* Clip meta chips */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${getSeoBadgeClass(seoScore)}`}>
                          SEO {seoScore}
                        </span>
                        
                        <span className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(clip.startTime)} - {formatDuration(clip.endTime)}
                        </span>
                      </div>

                      <h3 className="text-white font-bold text-sm sm:text-base line-clamp-1 group-hover:text-violet-400 transition-colors" title={clip.title}>
                        {clip.title}
                      </h3>
                      
                      {clip.description && (
                        <p className="text-zinc-400 text-xs leading-relaxed line-clamp-3 italic">
                          &ldquo;{clip.description}&rdquo;
                        </p>
                      )}
                    </div>

                    {/* Clip Actions */}
                    <div className="flex flex-col gap-4 border-t border-zinc-900/60 pt-5 mt-6">
                      
                      <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500">
                        <span>Status</span>
                        {clip.renderStatus === "completed" || clip.renderStatus === "rendered" ? (
                          <span className="text-emerald-400 uppercase tracking-wider">Rendered</span>
                        ) : clip.renderStatus === "rendering" || clip.renderStatus === "queued" ? (
                          <span className="text-indigo-400 uppercase tracking-wider">Rendering</span>
                        ) : (
                          <span className="text-violet-400 uppercase tracking-wider">Suggested</span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDeleteClip(clip.id)}
                          disabled={deletingClipId !== null}
                          className="px-3.5 py-2.5 rounded-xl bg-zinc-950/20 border border-zinc-900 hover:border-rose-500/30 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/5 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center"
                          title="Delete Clip suggestion"
                        >
                          {deletingClipId === clip.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          onClick={() => handlePreviewClip(clip)}
                          className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-750 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Play className="w-3 h-3 fill-white" />
                          Preview
                        </button>
                        
                        {(clip.renderStatus === "completed" || clip.renderStatus === "rendered") && clip.clipUrl ? (
                          <>
                            <a
                              href={clip.clipUrl}
                              download
                              target="_blank"
                              rel="noreferrer"
                              className="px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-colors flex items-center justify-center text-center"
                              title="Download Clip"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                            <button
                              className="px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-750 text-zinc-400 hover:text-white transition-colors flex items-center justify-center"
                              title="Schedule Post"
                              disabled
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <Link
                              href={`/dashboard/clips/${clip.id}`}
                              className="px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-colors flex items-center justify-center"
                              title="Edit Subtitle Style"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                            </Link>
                            <Link
                              href={`/dashboard/clips/${clip.id}`}
                              className="px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-colors flex items-center justify-center"
                              title="Render Clip"
                            >
                              <Scissors className="w-3.5 h-3.5" />
                            </Link>
                          </>
                        )}
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      
    </div>
  );
}
