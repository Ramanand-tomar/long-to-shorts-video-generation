import { NextRequest, NextResponse } from "next/server";
import ytdl from "@distube/ytdl-core";

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

    console.log(`Server attempting local resolution for: ${youtubeUrl}`);
    
    // Get video info
    const info = await ytdl.getInfo(youtubeUrl);
    
    // Choose format with both audio and video, prioritizing mp4
    const format = ytdl.chooseFormat(info.formats, {
      quality: "highest",
      filter: (f) => f.container === "mp4" && f.hasVideo && f.hasAudio,
    });

    if (format && format.url) {
      console.log(`Resolution successful! Found direct link: ${format.qualityLabel}`);
      return NextResponse.json({ success: true, url: format.url });
    }

    // Fallback: try any format that has both video and audio
    const fallbackFormat = ytdl.chooseFormat(info.formats, {
      quality: "highest",
      filter: "audioandvideo",
    });

    if (fallbackFormat && fallbackFormat.url) {
      console.log(`Resolution successful via fallback format!`);
      return NextResponse.json({ success: true, url: fallbackFormat.url });
    }

    return NextResponse.json(
      { 
        error: "no_format_found", 
        message: "Could not find a suitable video format with both video and audio." 
      },
      { status: 500 }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    console.error("Local resolution error:", error);
    return NextResponse.json(
      { error: "resolution_failed", message: errorMessage },
      { status: 500 }
    );
  }
}
