import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/db/user";
import { disconnectYouTube } from "@/actions/youtube-auth";
import { 
  CheckCircle2, 
  AlertTriangle, 
  ArrowLeft, 
  Unlink, 
  ExternalLink,
  ShieldCheck
} from "lucide-react";

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.107C19.522 3.5 12 3.5 12 3.5s-7.522 0-9.388.556a3.003 3.003 0 0 0-2.11 2.107C0 8.029 0 12 0 12s0 3.971.502 5.837a3.003 3.003 0 0 0 2.11 2.107C4.478 20.5 12 20.5 12 20.5s7.522 0 9.388-.556a3.003 3.003 0 0 0 2.11-2.107C24 15.971 24 12 24 12s0-3.971-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

interface PageProps {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
}

export default async function YouTubeSettingsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const params = await searchParams;
  const isConnected = !!user.youtubeRefreshToken;

  async function handleDisconnect() {
    "use server";
    await disconnectYouTube();
  }

  return (
    <div className="p-6 sm:p-10 max-w-3xl mx-auto space-y-8">
      
      {/* Back navigation */}
      <div>
        <Link 
          href="/dashboard/settings" 
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white text-sm font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to settings
        </Link>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-3 text-white">
          <YouTubeIcon className="w-8 h-8 text-rose-500 fill-rose-500/10" />
          YouTube Publishing Setup
        </h1>
        <p className="text-zinc-400 text-sm mt-2">
          Link your channel directly to enable zero-click automated background uploads.
        </p>
      </div>

      {/* Status Alerts */}
      {params.success === "true" && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">OAuth Connection Successful!</p>
            <p className="text-emerald-500/80 text-xs mt-1">Your YouTube channel refresh token has been securely stored and encrypted.</p>
          </div>
        </div>
      )}

      {params.error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">OAuth Connection Failed</p>
            <p className="text-rose-400/80 text-xs mt-1">{params.error}</p>
          </div>
        </div>
      )}

      {/* Integration Card */}
      <div className="bg-[#12121a] border border-zinc-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl">
        <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-rose-500/5 rounded-full blur-[60px] pointer-events-none" />

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 pb-6 border-b border-zinc-900">
          <div>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Integration Status</span>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? "bg-emerald-500" : "bg-zinc-700"}`} />
              <h2 className="text-lg font-bold text-white">
                {isConnected ? "Direct Connection Active" : "No Direct Connection"}
              </h2>
            </div>
          </div>

          {!isConnected ? (
            <Link
              href="/api/auth/youtube/start"
              className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm tracking-wide transition-all shadow-lg shadow-violet-500/20 flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Connect YouTube Channel
            </Link>
          ) : (
            <form action={handleDisconnect}>
              <button
                type="submit"
                className="px-6 py-3 rounded-xl border border-zinc-800 hover:border-rose-500/20 text-zinc-400 hover:text-rose-400 bg-zinc-950/20 hover:bg-rose-500/5 font-bold text-sm tracking-wide transition-all flex items-center gap-2"
              >
                <Unlink className="w-4 h-4" />
                Disconnect Channel
              </button>
            </form>
          )}
        </div>

        {isConnected ? (
          <div className="pt-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Connected Channel Name</span>
                <p className="text-zinc-200 font-bold mt-1 text-base">{user.youtubeChannelName || "Unknown Channel"}</p>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">YouTube Channel ID</span>
                <p className="text-zinc-500 font-mono mt-1 text-xs">{user.youtubeChannelId || "Unknown ID"}</p>
              </div>
            </div>

            <div className="p-4 bg-zinc-950/40 border border-zinc-900 rounded-2xl flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
              <p className="text-zinc-400 text-xs leading-relaxed">
                The direct connection is active. Rendered clips in your daily pipeline will automatically publish directly to your channel and clean up S3 storage sequentially without needing manually verified post scheduling.
              </p>
            </div>
          </div>
        ) : (
          <div className="pt-6">
            <p className="text-zinc-400 text-sm leading-relaxed">
              Linking your channel grants the application permission to directly stream finished video files from your AWS S3 bucket to YouTube. No video files will be stored on your local disk or shared with third parties.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
