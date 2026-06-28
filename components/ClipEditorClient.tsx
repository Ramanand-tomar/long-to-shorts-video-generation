"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Player } from "@remotion/player";
import { ClipComposition, StyleConfig, WordSegment } from "@/components/remotion/ClipComposition";
import { saveClipStyle, startRender, getRenderStatus } from "@/actions/render";
import { getConnectedAccounts } from "@/actions/social";
import { publishPostNow, generateAICaption } from "@/actions/calendar";
import {
  ChevronLeft,
  Save,
  Video,
  Download,
  Loader2,
  AlertCircle,
  Sliders,
  CheckCircle,
  Share2,
  Sparkles,
  Plus,
  XCircle,
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

interface SocialConnection {
  id: string;
  platform: string;
  profileName: string | null;
  profilePicture: string | null;
  createdAt: Date;
}

interface ClipEditorClientProps {
  clip: Clip;
  video: VideoDetail;
  transcriptSegments: WordSegment[];
}

const DEFAULT_STYLE_CONFIG: StyleConfig = {
  fontFamily: "Inter",
  fontSize: 80,
  captionColor: "#ffffff",
  highlightColor: "#fbbf24",
  textPosition: "bottom",
  backgroundStyle: "box",
  emphasisAnimation: "pop",
  layoutType: "fit_black",
  layoutTitleText: "wait for end",
  isMirrored: false,
  playbackSpeed: 1.02,
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

  // Publish / Direct Upload states
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [selectedConnections, setSelectedConnections] = useState<string[]>([]);
  const [publishCaption, setPublishCaption] = useState(clip.captionText || "");
  const [publishing, setPublishing] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generatingCaption, setGeneratingCaption] = useState(false);

  // Fetch connections on mount
  useEffect(() => {
    async function loadConnections() {
      try {
        const data = await getConnectedAccounts();
        if (Array.isArray(data)) {
          setConnections(data);
          // Pre-select any connected youtube channels
          const youtubeIds = data
            .filter((conn) => conn.platform.toLowerCase() === "youtube")
            .map((conn) => conn.id);
          setSelectedConnections(youtubeIds);
        }
      } catch (err) {
        console.error("Failed to load connected accounts:", err);
      }
    }
    loadConnections();
  }, []);

  const handlePublishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedConnections.length === 0) {
      setError("Please select at least one social media connection.");
      return;
    }
    setPublishing(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await publishPostNow({
        clipId: clip.id,
        connectionIds: selectedConnections,
        caption: publishCaption,
      });

      if (result.error) {
        setError(`Failed to publish clip: ${result.error}`);
      } else {
        setSuccess("Clip publication has been queued successfully!");
        setPublishModalOpen(false);
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred while publishing.");
    } finally {
      setPublishing(false);
    }
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setGeneratingCaption(true);
    setError(null);

    try {
      const result = await generateAICaption(
        aiPrompt,
        clip.title,
        clip.hookText || ""
      );

      if (result.error) {
        setError(`Failed to generate AI caption: ${result.error}`);
      } else if (result.caption) {
        const hashtagsText = Array.isArray(result.hashtags) && result.hashtags.length > 0
          ? "\n\n" + result.hashtags.map((h: string) => `#${h}`).join(" ")
          : "";
        setPublishCaption(`${result.caption}${hashtagsText}`);
        setSuccess("AI Caption generated!");
      }
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred while generating AI caption.");
    } finally {
      setGeneratingCaption(false);
    }
  };

  const fps = 30;
  const startFrame = Math.round(clip.startTime * fps);
  const endFrame = Math.round(clip.endTime * fps);
  const speed = styleConfig.playbackSpeed || 1.0;
  const durationInFrames = Math.max(30, Math.round((endFrame - startFrame) / speed));

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
          <div className="w-[320px] aspect-[9/16] rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden relative max-h-[570px]">
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
                max="90"
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

            <hr className="border-zinc-900/60" />

            {/* Video Framing / Layout Preset selection */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase block">
                Video Framing / Layout
              </label>
              <select
                value={styleConfig.layoutType || "crop"}
                onChange={(e) => setStyleConfig({ 
                  ...styleConfig, 
                  layoutType: e.target.value as "crop" | "fit_black" | "fit_white" | "blur_background" 
                })}
                className="w-full bg-zinc-950 border border-zinc-900 text-zinc-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
              >
                <option value="crop">Full cover crop (9:16)</option>
                <option value="fit_black">Cinematic Letterbox (Black background)</option>
                <option value="fit_white">Meme Canvas (White background)</option>
                <option value="blur_background">Blurred background padding</option>
              </select>
            </div>

            {/* Title / Hook Text Input (only for non-crop layouts) */}
            {(styleConfig.layoutType && styleConfig.layoutType !== "crop") ? (
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase block">
                  Top Title / Hook Text
                </label>
                <input
                  type="text"
                  value={styleConfig.layoutTitleText || ""}
                  onChange={(e) => setStyleConfig({ ...styleConfig, layoutTitleText: e.target.value })}
                  placeholder="Even ChatGPT is jealous of him..."
                  className="w-full bg-zinc-950 border border-zinc-900 text-zinc-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
            ) : null}

            <hr className="border-zinc-900/60" />

            {/* Video Playback Speed control */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase block">
                Playback Speed
              </label>
              <select
                value={styleConfig.playbackSpeed || 1.0}
                onChange={(e) => setStyleConfig({ ...styleConfig, playbackSpeed: parseFloat(e.target.value) })}
                className="w-full bg-zinc-950 border border-zinc-900 text-zinc-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
              >
                <option value="1.0">1.0x (Normal)</option>
                <option value="1.02">1.02x (Slight shift)</option>
                <option value="1.05">1.05x (Fast paced)</option>
                <option value="1.1">1.10x (Energy boost)</option>
              </select>
            </div>

            {/* Mirror/Flip Video toggle */}
            <div className="flex items-center justify-between p-1">
              <span className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase">
                Mirror/Flip Video
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={styleConfig.isMirrored || false}
                  onChange={(e) => setStyleConfig({ ...styleConfig, isMirrored: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600 peer-checked:after:bg-white"></div>
              </label>
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
              <div className="flex gap-3">
                <a
                  href={clipUrl}
                  download={`vidshort-clip-${clip.id}.mp4`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 transition-all text-center"
                >
                  <Download className="w-4 h-4 fill-white/20" />
                  Download
                </a>
                <button
                  onClick={() => setPublishModalOpen(true)}
                  className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 text-white font-bold text-sm shadow-lg shadow-violet-500/15 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  Publish Clip
                </button>
              </div>
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

      {/* Premium Publish Modal */}
      {publishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">Publish Clip</h3>
                  <p className="text-zinc-500 text-xs mt-0.5">Post this vertical short to your connected social channels</p>
                </div>
              </div>
              <button
                onClick={() => setPublishModalOpen(false)}
                className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Select Connection */}
              <div className="space-y-3">
                <label className="text-[11px] font-bold text-zinc-400 tracking-wider uppercase block">
                  Select Channel / Account
                </label>
                {connections.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 text-center">
                    <p className="text-sm text-zinc-500">No social media accounts connected.</p>
                    <Link
                      href="/dashboard/connections"
                      className="mt-3 inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Connect an account
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5">
                    {connections.map((conn) => {
                      const isSelected = selectedConnections.includes(conn.id);
                      return (
                        <button
                          key={conn.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedConnections(selectedConnections.filter((id) => id !== conn.id));
                            } else {
                              setSelectedConnections([...selectedConnections, conn.id]);
                            }
                          }}
                          className={`flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
                            isSelected
                              ? "bg-violet-500/10 border-violet-500/50 text-white"
                              : "bg-zinc-950 border-zinc-850 hover:bg-zinc-900 text-zinc-400"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {conn.profilePicture ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={conn.profilePicture}
                                alt={conn.profileName || "profile"}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-violet-600/20 flex items-center justify-center font-bold text-violet-400 text-sm">
                                {conn.platform.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-semibold text-white">
                                {conn.profileName || "Connected Account"}
                              </p>
                              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                                {conn.platform}
                              </span>
                            </div>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                              isSelected ? "border-violet-500 bg-violet-500 text-white" : "border-zinc-700"
                            }`}
                          >
                            {isSelected && <span className="text-[10px] font-bold">✓</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* AI Caption Assistance */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-855 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-300">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    <span>AI Caption Generator</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g. write a funny, engaging hook for this..."
                    className="flex-1 bg-zinc-900 border border-zinc-800 text-xs rounded-xl px-3 py-2 text-zinc-300 focus:outline-none focus:border-violet-500 placeholder-zinc-600"
                  />
                  <button
                    type="button"
                    onClick={handleAIGenerate}
                    disabled={generatingCaption || !aiPrompt.trim()}
                    className="px-4 py-2 bg-zinc-850 hover:bg-zinc-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                  >
                    {generatingCaption ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      "Generate"
                    )}
                  </button>
                </div>
              </div>

              {/* Caption Content */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-zinc-400 tracking-wider uppercase block">
                  Caption / Description
                </label>
                <textarea
                  value={publishCaption}
                  onChange={(e) => setPublishCaption(e.target.value)}
                  placeholder="Describe your short video here..."
                  rows={4}
                  className="w-full bg-zinc-950 border border-zinc-850 text-zinc-300 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 resize-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-zinc-850 bg-zinc-900/50 flex gap-3">
              <button
                type="button"
                onClick={() => setPublishModalOpen(false)}
                className="flex-1 py-3 bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-white font-bold text-sm rounded-xl border border-zinc-850 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePublishSubmit}
                disabled={publishing || selectedConnections.length === 0}
                className="flex-1 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-violet-500/10 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {publishing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    Publish Now
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
