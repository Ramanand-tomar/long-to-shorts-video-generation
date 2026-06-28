import { NextRequest, NextResponse } from "next/server";

const COBALT_ENDPOINTS = [
  'https://cobalt.api.ryuk.cx',
  'https://api.c1.syntalix.de',
  'https://cobalt.syntalix.de',
  'https://cobalt.swm.me',
];

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

    let resolvedUrl = null;
    let lastError: Error | null = null;

    for (const endpoint of COBALT_ENDPOINTS) {
      try {
        console.log(`Server attempting resolution via: ${endpoint}`);
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: youtubeUrl,
            videoQuality: '720',
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.url) {
            resolvedUrl = data.url;
            break;
          }
        } else {
          const text = await res.text();
          console.warn(`Server Cobalt call returned status ${res.status}: ${text}`);
        }
      } catch (err) {
        lastError = err as Error;
        console.warn(`Server Cobalt call failed for ${endpoint}:`, lastError.message);
      }
    }

    if (resolvedUrl) {
      return NextResponse.json({ success: true, url: resolvedUrl });
    }

    return NextResponse.json(
      { 
        error: "resolution_failed", 
        message: lastError ? lastError.message : "Failed to resolve YouTube video." 
      },
      { status: 500 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json(
      { error: "server_error", message: errorMessage },
      { status: 500 }
    );
  }
}
