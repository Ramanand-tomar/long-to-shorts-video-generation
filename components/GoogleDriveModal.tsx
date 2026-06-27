"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { submitGoogleDriveVideo } from "@/actions/gdrive";
import { Link2, X, AlertCircle, Loader2, Play } from "lucide-react";

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function GoogleDriveModal({ isOpen, onClose, onSuccess }: GoogleDriveModalProps) {
  const router = useRouter();
  const [driveUrl, setDriveUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driveUrl.trim()) return;

    setSubmitting(true);
    setError(null);

    const result = await submitGoogleDriveVideo(driveUrl.trim());

    if (result.error) {
      setError(result.message || `An error occurred: ${result.error}`);
      setSubmitting(false);
    } else {
      setSubmitting(false);
      if (onSuccess) onSuccess();
      onClose();
      router.push(`/dashboard/videos/${result.videoId}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#12121a] border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden">
        
        {/* Glow decoration */}
        <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-violet-600/10 rounded-full blur-[60px] pointer-events-none" />

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">🎬 Add Google Drive Video</h3>
            <p className="text-zinc-400 text-xs mt-1">Paste a public Drive share link to launch the automated pipeline.</p>
          </div>
          <button 
            disabled={submitting}
            onClick={onClose} 
            className="p-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pipeline steps indicator */}
        <div className="flex justify-between items-center bg-zinc-950/40 border border-zinc-800/60 rounded-2xl p-4 mb-6">
          <div className="flex flex-col items-center flex-1">
            <div className="w-7 h-7 rounded-full bg-violet-600/15 border border-violet-500/30 text-violet-400 text-xs font-bold flex items-center justify-center mb-1.5">1</div>
            <span className="text-[10px] text-zinc-400 font-medium">Analyze</span>
          </div>
          <div className="h-[1px] bg-zinc-800 flex-1 mx-1" />
          <div className="flex flex-col items-center flex-1">
            <div className="w-7 h-7 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 text-xs font-bold flex items-center justify-center mb-1.5">2</div>
            <span className="text-[10px] text-zinc-500 font-medium">Render</span>
          </div>
          <div className="h-[1px] bg-zinc-800 flex-1 mx-1" />
          <div className="flex flex-col items-center flex-1">
            <div className="w-7 h-7 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 text-xs font-bold flex items-center justify-center mb-1.5">3</div>
            <span className="text-[10px] text-zinc-500 font-medium">Publish</span>
          </div>
          <div className="h-[1px] bg-zinc-800 flex-1 mx-1" />
          <div className="flex flex-col items-center flex-1">
            <div className="w-7 h-7 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 text-xs font-bold flex items-center justify-center mb-1.5">4</div>
            <span className="text-[10px] text-zinc-500 font-medium">Email</span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Input field */}
          <div>
            <label className="block text-zinc-300 font-bold text-xs uppercase tracking-wider mb-2">Google Drive URL</label>
            <div className="relative">
              <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-violet-400" />
              <input
                type="url"
                required
                disabled={submitting}
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/FILE_ID/view?usp=sharing"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3.5 pl-12 pr-4 text-white text-sm outline-none focus:border-violet-500 transition-colors placeholder-zinc-600 disabled:opacity-50"
                data-element-id="drive-url-input"
              />
            </div>
          </div>

          {/* Sharing Help Info */}
          <div className="p-4 rounded-2xl bg-violet-600/5 border border-violet-500/10 text-violet-300/80 text-xs leading-relaxed">
            Please make sure that the sharing setting of your Google Drive video is configured to <strong>&ldquo;Anyone with the link can view&rdquo;</strong> so the background pipeline can download and process it.
          </div>

          {/* Auto settings list */}
          <div>
            <label className="block text-zinc-300 font-bold text-xs uppercase tracking-wider mb-3">Pipeline Settings (Defaults)</label>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-zinc-950 border border-zinc-900 rounded-xl">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Clips Generated</p>
                <p className="text-zinc-200 text-xs font-bold mt-1">4–5 Clips</p>
              </div>
              <div className="p-3 bg-zinc-950 border border-zinc-900 rounded-xl">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Publishing Gap</p>
                <p className="text-zinc-200 text-xs font-bold mt-1">1 Hour</p>
              </div>
              <div className="p-3 bg-zinc-950 border border-zinc-900 rounded-xl">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Editing Style</p>
                <p className="text-zinc-200 text-xs font-bold mt-1">Default</p>
              </div>
              <div className="p-3 bg-zinc-950 border border-zinc-900 rounded-xl">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">S3 Cleanup</p>
                <p className="text-zinc-200 text-xs font-bold mt-1">Auto-Delete</p>
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !driveUrl.trim()}
            className="w-full py-4 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm tracking-wide transition-all shadow-lg shadow-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            data-element-id="start-pipeline-btn"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Validating & Ingesting Video...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                🚀 Start Auto-Pipeline
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
