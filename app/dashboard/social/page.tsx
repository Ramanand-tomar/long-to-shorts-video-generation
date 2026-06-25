"use client";

import React, { useState, useEffect } from "react";
import { 
  Link2, 
  Unlink, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  ExternalLink
} from "lucide-react";
import { getConnectedAccounts, getOAuthConnectUrl, disconnectPlatform } from "@/actions/social";
import Link from "next/link";

const Instagram = () => (
  <svg className="w-5 h-5 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

const Facebook = () => (
  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const Linkedin = () => (
  <svg className="w-5 h-5 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

const Youtube = () => (
  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
    <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.108C19.524 3.545 12 3.545 12 3.545s-7.525 0-9.388.51a3.003 3.003 0 0 0-2.11 2.108C0 8.029 0 12 0 12s0 3.971.502 5.837a3.003 3.003 0 0 0 2.11 2.108c1.863.51 9.388.51 9.388.51s7.525 0 9.388-.51a3.003 3.003 0 0 0 2.11-2.108c.502-1.866.502-5.837.502-5.837s0-3.971-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

interface ConnectedAccount {
  id: string;
  platform: string;
  profileName: string | null;
  profilePicture: string | null;
  createdAt: Date;
}

const PLATFORMS = [
  {
    id: "instagram",
    name: "Instagram Reels",
    icon: Instagram,
    color: "from-pink-500 via-red-500 to-yellow-500",
    description: "Publish high-converting short clips directly to your Reels.",
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: () => (
      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.02 1.63 4.18 1.12 1.25 2.7 1.94 4.35 2.15v3.77c-1.39-.06-2.77-.51-3.95-1.28-.42-.27-.8-.58-1.15-.92-.09 1.79-.1 3.58-.1 5.37 0 1.93-.41 3.87-1.33 5.53-1.07 1.93-2.92 3.4-5.08 3.99-2.21.61-4.63.35-6.66-.75-2.03-1.09-3.53-3.08-4.07-5.36-.59-2.47-.13-5.18 1.26-7.27 1.4-2.13 3.8-3.48 6.37-3.66.19-.01.38-.02.57-.02v3.78c-1.15.06-2.3.56-3.09 1.41-.81.87-1.2 2.11-1.06 3.29.13 1.15.82 2.18 1.83 2.76 1 .59 2.23.63 3.26.11 1.05-.51 1.8-1.57 2-2.72.13-1.01.1-2.03.1-3.05V0z" />
      </svg>
    ),
    color: "from-cyan-400 to-red-500",
    description: "Reach millions by scheduling and auto-publishing TikToks.",
  },
  {
    id: "youtube",
    name: "YouTube Shorts",
    icon: Youtube,
    color: "from-red-600 to-rose-700",
    description: "Export optimized portrait video clips straight to Shorts.",
  },
  {
    id: "facebook",
    name: "Facebook Reels",
    icon: Facebook,
    color: "from-blue-600 to-indigo-700",
    description: "Engage Facebook communities with short video content.",
  },
  {
    id: "x",
    name: "X (Twitter)",
    icon: () => (
      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    color: "from-zinc-700 to-zinc-900",
    description: "Post visual updates and threads containing your video clips.",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: Linkedin,
    color: "from-blue-500 to-sky-600",
    description: "Establish thought leadership with video clips in your feed.",
  },
];

export default function SocialPage() {
  const [connections, setConnections] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    // Check URL parameters for callbacks
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      setSuccessMsg("Platform connected successfully!");
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get("error")) {
      const err = params.get("error");
      if (err === "exchange_failed") {
        setErrorMsg("Failed to verify authentication credentials. Please try again.");
      } else if (err === "missing_code") {
        setErrorMsg("Authentication process cancelled or failed.");
      } else {
        setErrorMsg("An unexpected error occurred during connection.");
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    loadConnections();
  }, []);

  async function loadConnections() {
    try {
      const data = await getConnectedAccounts();
      setConnections(data as ConnectedAccount[]);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to retrieve connected accounts.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect(provider: string) {
    setProcessingId(provider);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const result = await getOAuthConnectUrl(provider);
      if (result.error === "plan_limit_exceeded") {
        setErrorMsg("Limit exceeded! Free accounts are limited to 1 connected channel. Please upgrade to Pro for up to 6 connections.");
        setProcessingId(null);
        return;
      }
      if (result.error || !result.authUrl) {
        setErrorMsg(`Failed to initiate connection: ${result.error || "unknown error"}`);
        setProcessingId(null);
        return;
      }
      
      // Redirect user to oauth provider url
      window.location.href = result.authUrl;
    } catch (err) {
      console.error(err);
      setErrorMsg("An error occurred starting the connection.");
      setProcessingId(null);
    }
  }

  async function handleDisconnect(connectionId: string, platformId: string) {
    if (!confirm("Are you sure you want to disconnect this platform? Scheduled posts for this account will fail.")) {
      return;
    }

    setProcessingId(platformId);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const result = await disconnectPlatform(connectionId);
      if (result.error) {
        setErrorMsg(`Failed to disconnect account: ${result.error}`);
      } else {
        setSuccessMsg("Platform disconnected successfully.");
        await loadConnections();
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("An error occurred while disconnecting the platform.");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="py-8 px-6 sm:px-10 max-w-6xl mx-auto space-y-8 text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            Social Channels
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Connect your profiles to auto-publish clips generated by VidShort.
          </p>
        </div>
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
                  Go to Settings to Upgrade <ExternalLink className="w-3.5 h-3.5" />
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
          <p className="text-zinc-500 text-sm">Loading social configurations...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PLATFORMS.map((platform) => {
            const IconComponent = platform.icon;
            const connected = connections.find(c => c.platform === platform.id);
            const isProcessing = processingId === platform.id;

            return (
              <div 
                key={platform.id}
                className="relative overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950/40 backdrop-blur-md p-6 flex flex-col justify-between hover:border-zinc-800 transition-all group"
              >
                {/* Dynamic background glow on hover */}
                <div className={`absolute -right-20 -top-20 w-40 h-40 rounded-full bg-gradient-to-tr ${platform.color} opacity-0 group-hover:opacity-[0.03] blur-3xl transition-opacity duration-500 pointer-events-none`} />

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${platform.color} p-[1px] flex items-center justify-center shadow-md`}>
                      <div className="w-full h-full rounded-[11px] bg-zinc-950 flex items-center justify-center text-zinc-100">
                        <IconComponent />
                      </div>
                    </div>

                    {connected ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-900 text-zinc-500 border border-zinc-800">
                        Not Linked
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold tracking-tight text-white mb-1">
                    {platform.name}
                  </h3>
                  <p className="text-zinc-400 text-xs leading-relaxed mb-6">
                    {platform.description}
                  </p>
                </div>

                <div className="mt-auto pt-4 border-t border-zinc-900/60">
                  {connected ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-xs text-zinc-300 border border-zinc-700">
                          {connected.profileName?.[1]?.toUpperCase() || "C"}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-sm font-bold text-zinc-200 truncate">
                            {connected.profileName || "@channel"}
                          </p>
                          <p className="text-[10px] text-zinc-500">
                            Linked {new Date(connected.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDisconnect(connected.id, platform.id)}
                        disabled={isProcessing}
                        className="w-full py-2.5 px-4 rounded-xl border border-rose-500/20 hover:bg-rose-500/10 text-rose-400 disabled:opacity-50 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Unlink className="w-3.5 h-3.5" />
                        )}
                        Disconnect Profile
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleConnect(platform.id)}
                      disabled={isProcessing}
                      className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 disabled:opacity-50 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Link2 className="w-3.5 h-3.5" />
                      )}
                      Link Account
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
