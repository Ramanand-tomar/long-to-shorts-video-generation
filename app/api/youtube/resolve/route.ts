import { NextRequest, NextResponse } from "next/server";
import ytdl from "@distube/ytdl-core";

const COBALT_ENDPOINTS = [
  'https://cobalt.api.ryuk.cx',
  'https://api.c1.syntalix.de',
  'https://cobalt.syntalix.de',
  'https://cobalt.swm.me',
  'https://cobalt.unseen.is',
  'https://cobalt.qrl.nz',
];

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { youtubeUrl } = body;

    if (!youtubeUrl) {
      return NextResponse.json(
        { error: "missing_url", message: "youtubeUrl is required" },
        { status: 400 }
      );
    }

    // --- STEP 1: Attempt native resolution with YTDL-Core (if YOUTUBE_COOKIE is set) ---
    if (process.env.YOUTUBE_COOKIE) {
      try {
        console.log("Attempting resolution via @distube/ytdl-core with cookie credentials...");
        let cookies;
        if (process.env.YOUTUBE_COOKIE.trim().startsWith("[")) {
          cookies = JSON.parse(process.env.YOUTUBE_COOKIE);
        } else {
          cookies = process.env.YOUTUBE_COOKIE.split(";").map(c => {
            const [name, ...val] = c.split("=");
            if (!name) return null;
            return {
              name: name.trim(),
              value: val.join("=").trim(),
              domain: ".youtube.com",
              path: "/"
            };
          }).filter(Boolean);
        }
        
        const agent = ytdl.createAgent(cookies);
        const info = await ytdl.getInfo(youtubeUrl, { agent });
        const format = ytdl.chooseFormat(info.formats, {
          quality: "highest",
          filter: (f) => f.container === "mp4" && f.hasVideo && f.hasAudio,
        });

        if (format && format.url) {
          console.log(`Resolution successful via local ytdl-core agent!`);
          return NextResponse.json({ success: true, url: format.url });
        }
      } catch (ytdlErr) {
        const ytdlErrMsg = ytdlErr instanceof Error ? ytdlErr.message : String(ytdlErr);
        console.warn("Local ytdl-core resolution failed:", ytdlErrMsg);
      }
    }

    // --- STEP 2: Fallback to Parallel Cobalt instances ---
    console.log(`Server attempting parallel resolution via Cobalt for: ${youtubeUrl}`);
    const promises = COBALT_ENDPOINTS.map(async (endpoint) => {
      try {
        const res = await fetchWithTimeout(
          endpoint,
          {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: youtubeUrl,
              videoQuality: '720',
            }),
          },
          8000 // 8s timeout
        );

        if (res.ok) {
          const data = await res.json();
          if (data && data.url) {
            console.log(`Successfully resolved stream URL from endpoint: ${endpoint}`);
            return data.url;
          }
        }
        throw new Error(`Endpoint returned status ${res.status}`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`Parallel probe failed for ${endpoint}:`, errMsg);
        throw err;
      }
    });

    try {
      const resolvedUrl = await Promise.any(promises);
      return NextResponse.json({ success: true, url: resolvedUrl });
    } catch (anyErr) {
      console.error("All parallel Cobalt resolution promises failed:", anyErr);
      return NextResponse.json(
        { 
          error: "resolution_failed", 
          message: "All resolution methods failed. In production, configure YOUTUBE_COOKIE in Vercel to bypass bot restrictions." 
        },
        { status: 500 }
      );
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json(
      { error: "server_error", message: errorMessage },
      { status: 500 }
    );
  }
}
