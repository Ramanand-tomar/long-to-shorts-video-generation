"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Player } from "@remotion/player";
import { ClipComposition, StyleConfig, WordSegment } from "@/components/remotion/ClipComposition";
import { saveClipStyle, startRender, getRenderStatus } from "@/actions/render";
import {
  ChevronLeft,
  Save,
  Video,
  Download,
  Loader2,
  AlertCircle,
  Sliders,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";

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
  hookText: string | null;
  captionText: string | null;
  hashtags: unknown | null;
  reason: string | null;
}

interface VideoDetail {
  id: string;
  title: string;
  videoUrl: string;
}

interface ClipEditorClientProps {
  clip: Clip;
  video: VideoDetail;
  transcriptSegments: WordSegment[];
}

const DEFAULT_STYLE_CONFIG: StyleConfig = {
  fontFamily: "Inter",
  fontSize: 24,
  captionColor: "#ffffff",
  highlightColor: "#fbbf24",
  textPosition: "bottom",
  backgroundStyle: "box",
  emphasisAnimation: "pop",
};

const FONT_FAMILIES = ["Inter", "Montserrat", "Poppins", "Oswald", "Roboto"];
const TEXT_COLORS = ["#ffffff", "#fbbf24", "#34d399", "#818cf8", "#f87171"];
const HIGHLIGHT_COLORS = ["#fbbf24", "#7c3aed", "#34d399", "#f87171", "#38bdf8"];

export default function ClipEditorClient({
  clip,
  video,
  transcriptSegments,
}: ClipEditorClientProps) {
  const router = useRouter();

  // Load existing style or use defaults
  const [styleConfig, setStyleConfig] = useState<StyleConfig>(() => {
    if (clip.subtitleStyle) {
      return clip.subtitleStyle as StyleConfig;
    }
    return DEFAULT_STYLE_CONFIG;
  });

  // Action states
  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Polling states for rendering status
  const [renderStatus, setRenderStatus] = useState<string>(clip.renderStatus);
  const [clipUrl, setClipUrl] = useState<string | null>(clip.clipUrl);

  const fps = 30;
  const startFrame = Math.round(clip.startTime * fps);
  const endFrame = Math.round(clip.endTime * fps);
  const durationInFrames = Math.max(30, endFrame - startFrame);

  // Auto-clear success messages
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Polling loop for active renders
  useEffect(() => {
    if (renderStatus !== "queued" && renderStatus !== "rendering") return;

    const checkStatus = async () => {
      try {
        const result = await getRenderStatus(clip.id);
        if (result.error) {
          setError(result.error);
        } else if (result.success && result.status) {
          setRenderStatus(result.status);
          if (result.clipUrl) {
            setClipUrl(result.clipUrl);
          }
          if (result.status === "completed" || result.status === "failed") {
            router.refresh();
          }
        }
      } catch (err) {
        console.error("Error polling render status:", err);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [renderStatus, clip.id, router]);

  // Save style configuration server-side
  const handleSaveStyle = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await saveClipStyle(clip.id, styleConfig);
      if (result.error) {
        setError(`Failed to save style: ${result.error}`);
      } else {
        setSuccess("Caption styles saved successfully!");
        // If the clip was completed previously, saving a new style resets renderStatus to not_started
        if (renderStatus === "completed") {
          setRenderStatus("not_started");
          setClipUrl(null);
        }
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  // Trigger Remotion Lambda render
  const handleStartRender = async () => {
    setRendering(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await startRender(clip.id);
      if (result.error) {
        if (result.error === "render_limit_exceeded") {
          setError("Render quota exceeded (Free plan gets 5 renders/day). Please upgrade your account!");
        } else {
          setError(`Failed to start rendering: ${result.error}`);
        }
      } else {
        setRenderStatus("queued");
        setSuccess("Render job successfully queued in background!");
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred while starting rendering.");
    } finally {
      setRendering(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  const seoScore = clip.seoScore ?? 80;

  return (
    <div className="p-6 sm:p-10 space-y-8 max-w-6xl mx-auto">
      {/* Back button */}
      <div>
        <Link
          href={`/dashboard/videos/${video.id}`}
          className="inline-flex items-center gap-2 text-zinc-500 hover:text-white text-sm font-semibold transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Video Clips
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight truncate max-w-xl">
            Edit Clip &mdash; &ldquo;{clip.title}&rdquo;
          </h1>
          <p className="text-zinc-500 text-xs sm:text-sm mt-1">
            Configure caption subtitles, adjust font sizes, and render to MP4.
          </p>
        </div>

        {/* SEO Score Badge */}
        <div className="flex items-center gap-3">
          <span className="text-zinc-500 text-xs font-semibold">SEO Virality Score</span>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              seoScore >= 80
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                : seoScore >= 60
                ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                : "bg-rose-500/10 border border-rose-500/20 text-rose-400"
            }`}
          >
            {seoScore}% Strength
          </span>
        </div>
      </div>

      {/* Notification banners */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-start gap-3">
          <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>{success}</p>
        </div>
      )}

      {/* Core Working Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column - Preview Canvas */}
        <div className="lg:col-span-2 flex flex-col items-center space-y-6">
          
          {/* Player viewport: vertical mobile-style screen wrapper */}
          <div className="w-[270px] aspect-[9/16] rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden relative max-h-[480px]">
            <Player
              component={ClipComposition}
              durationInFrames={durationInFrames}
              fps={fps}
              compositionWidth={1080}
              compositionHeight={1920}
              style={{
                width: "100%",
                height: "100%",
              }}
              controls
              loop
              inputProps={{
                videoUrl: video.videoUrl,
                startFrame,
                endFrame,
                transcriptSegments,
                styleConfig,
              }}
            />
          </div>

          {/* Timeline slider indicator */}
          <div className="w-full max-w-[320px] bg-zinc-900/10 border border-zinc-900 rounded-xl p-4 space-y-3">
            <div className="flex justify-between text-xs font-bold text-zinc-500">
              <span>Timeline Position</span>
              <span>
                {formatDuration(clip.startTime)} - {formatDuration(clip.endTime)}
              </span>
            </div>
            <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden relative">
              {/* Represent position indicator visually */}
              <div className="h-full bg-violet-600 rounded-full w-[45%]" />
            </div>
            <div className="flex justify-between text-[10px] text-zinc-500 font-semibold">
              <span>Trimmed: {Math.round(clip.endTime - clip.startTime)}s</span>
              <span>Total Video: {formatDuration(clip.endTime)}</span>
            </div>
          </div>

          {/* Render status tracking block */}
          <div className="w-full max-w-[320px] bg-zinc-900/15 border border-zinc-900 rounded-xl p-4 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-zinc-400">RENDER PROGRESS</span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">
                {renderStatus}
              </span>
            </div>

            {renderStatus === "queued" ? (
              <div className="space-y-2">
                <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 w-1/4 animate-pulse rounded-full" />
                </div>
                <p className="text-[11px] text-zinc-500">Queued... waiting for cloud worker allocation.</p>
              </div>
            ) : renderStatus === "rendering" ? (
              <div className="space-y-2">
                <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 w-2/3 animate-pulse rounded-full" />
                </div>
                <p className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin text-violet-400" />
                  Rendering MP4 frames...
                </p>
              </div>
            ) : renderStatus === "completed" && clipUrl ? (
              <div className="space-y-2">
                <div className="w-full h-1.5 bg-emerald-500/20 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-full rounded-full" />
                </div>
                <p className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                  ✓ MP4 Render Ready!
                </p>
              </div>
            ) : renderStatus === "failed" ? (
              <div className="space-y-2">
                <div className="w-full h-1.5 bg-rose-500/20 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500 w-full rounded-full" />
                </div>
                <p className="text-[11px] text-rose-400 font-medium">
                  Render failed. Please double check settings and retry.
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-zinc-500">Render has not been started yet.</p>
            )}
          </div>

        </div>

        {/* Right Column - Caption Style Editor */}
        <div className="bg-zinc-900/10 border border-zinc-900 rounded-2xl p-6 space-y-6 flex flex-col justify-between">
          
          <div className="space-y-6">
            <div>
              <h3 className="text-white font-bold text-base tracking-tight flex items-center gap-2">
                <Sliders className="w-4.5 h-4.5 text-violet-400" />
                Caption Style Editor
              </h3>
              <p className="text-zinc-500 text-xs mt-1">Design subtitle fonts, colors, borders, and animations.</p>
            </div>

            <hr className="border-zinc-900/60" />

            {/* Font Family control */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase block">
                Font Family
              </label>
              <select
                value={styleConfig.fontFamily}
                onChange={(e) => setStyleConfig({ ...styleConfig, fontFamily: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-900 text-zinc-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
              >
                {FONT_FAMILIES.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            </div>

            {/* Font Size control */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[11px] font-bold text-zinc-500 tracking-wider uppercase">
                <span>Font Size</span>
                <span className="text-violet-400">{styleConfig.fontSize}px</span>
              </div>
              <input
                type="range"
                min="14"
                max="40"
                value={styleConfig.fontSize}
                onChange={(e) => setStyleConfig({ ...styleConfig, fontSize: parseInt(e.target.value) })}
                className="w-full accent-violet-600 cursor-pointer"
              />
            </div>

            {/* Text Caption Color swatches */}
            <div className="space-y-2.5">
              <label className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase block">
                Caption Text Color
              </label>
              <div className="flex items-center gap-2">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setStyleConfig({ ...styleConfig, captionColor: c })}
                    style={{ backgroundColor: c }}
                    className={`w-7 h-7 rounded-lg border-2 transition-all ${
                      styleConfig.captionColor.toLowerCase() === c.toLowerCase()
                        ? "border-violet-500 scale-110 shadow-lg shadow-violet-500/25"
                        : "border-transparent hover:scale-105"
                    }`}
                  />
                ))}
                <input
                  type="text"
                  value={styleConfig.captionColor}
                  onChange={(e) => setStyleConfig({ ...styleConfig, captionColor: e.target.value })}
                  placeholder="#Hex"
                  className="w-20 bg-zinc-950 border border-zinc-900 text-center text-xs font-semibold text-zinc-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            {/* Active Highlight Color swatches */}
            <div className="space-y-2.5">
              <label className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase block">
                Highlight Word Color
              </label>
              <div className="flex items-center gap-2">
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setStyleConfig({ ...styleConfig, highlightColor: c })}
                    style={{ backgroundColor: c }}
                    className={`w-7 h-7 rounded-lg border-2 transition-all ${
                      styleConfig.highlightColor.toLowerCase() === c.toLowerCase()
                        ? "border-violet-500 scale-110 shadow-lg shadow-violet-500/25"
                        : "border-transparent hover:scale-105"
                    }`}
                  />
                ))}
                <input
                  type="text"
                  value={styleConfig.highlightColor}
                  onChange={(e) => setStyleConfig({ ...styleConfig, highlightColor: e.target.value })}
                  placeholder="#Hex"
                  className="w-20 bg-zinc-950 border border-zinc-900 text-center text-xs font-semibold text-zinc-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            {/* Alignment Layout Position */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase block">
                Text Position
              </label>
              <select
                value={styleConfig.textPosition}
                onChange={(e) => setStyleConfig({ ...styleConfig, textPosition: e.target.value as "top" | "center" | "bottom" })}
                className="w-full bg-zinc-950 border border-zinc-900 text-zinc-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
              >
                <option value="bottom">Bottom Overlay</option>
                <option value="center">Center Centered</option>
                <option value="top">Top Overlay</option>
              </select>
            </div>

            {/* Background Backdrop configuration */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase block">
                Backdrop Container Style
              </label>
              <select
                value={styleConfig.backgroundStyle}
                onChange={(e) => setStyleConfig({ ...styleConfig, backgroundStyle: e.target.value as "box" | "bar" | "none" })}
                className="w-full bg-zinc-950 border border-zinc-900 text-zinc-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
              >
                <option value="box">Semi-transparent Box</option>
                <option value="bar">Full horizontal Bar</option>
                <option value="none">No Background</option>
              </select>
            </div>

            {/* Active Word Emphasis Animation */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase block">
                Highlight Word Animation
              </label>
              <select
                value={styleConfig.emphasisAnimation}
                onChange={(e) => setStyleConfig({ ...styleConfig, emphasisAnimation: e.target.value as "bounce" | "pop" | "none" })}
                className="w-full bg-zinc-950 border border-zinc-900 text-zinc-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
              >
                <option value="pop">Scale Pop-up</option>
                <option value="bounce">Word Bounce Wave</option>
                <option value="none">Standard Flat Highlight</option>
              </select>
            </div>

          </div>

          {/* Action triggers foot panel */}
          <div className="space-y-3 pt-6 border-t border-zinc-900/60 mt-6">
            <button
              onClick={handleSaveStyle}
              disabled={saving}
              className="w-full py-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white font-bold text-sm border border-zinc-850 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                  Saving Configuration...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 text-zinc-400" />
                  Save Style
                </>
              )}
            </button>

            {renderStatus === "completed" && clipUrl ? (
              <a
                href={clipUrl}
                download={`vidshort-clip-${clip.id}.mp4`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 transition-all text-center"
              >
                <Download className="w-4 h-4 fill-white/20" />
                Download MP4
              </a>
            ) : (
              <button
                onClick={handleStartRender}
                disabled={rendering || renderStatus === "queued" || renderStatus === "rendering"}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-violet-500/15 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {rendering || renderStatus === "queued" || renderStatus === "rendering" ? (
                  <>
                    <Loader2 className="w-4.5 h-4.5 animate-spin" />
                    Rendering Clip...
                  </>
                ) : (
                  <>
                    <Video className="w-4.5 h-4.5" />
                    Render Clip
                  </>
                )}
              </button>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
