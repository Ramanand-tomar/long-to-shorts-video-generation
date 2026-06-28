import { NextRequest, NextResponse } from "next/server";

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

    console.log(`Server attempting parallel resolution via Cobalt for: ${youtubeUrl}`);
    
    // Create parallel promises for each endpoint
    const promises = COBALT_ENDPOINTS.map(async (endpoint) => {
      try {
        console.log(`Server probing endpoint in parallel: ${endpoint}`);
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
          8000 // 8 seconds timeout per request
        );

        if (res.ok) {
          const data = await res.json();
          if (data && data.url) {
            console.log(`Successfully resolved stream URL from parallel endpoint: ${endpoint}`);
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
      // Promise.any returns the first successfully resolved promise
      const resolvedUrl = await Promise.any(promises);
      return NextResponse.json({ success: true, url: resolvedUrl });
    } catch (anyErr) {
      console.error("All parallel Cobalt resolution promises failed:", anyErr);
      return NextResponse.json(
        { 
          error: "resolution_failed", 
          message: "All public resolution nodes failed. Please try again or check your URL." 
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
