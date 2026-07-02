"use client";

import React from "react";
import { OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion";

export interface WordSegment {
  word: string;
  start: number; // in seconds
  end: number;   // in seconds
}

export interface StyleConfig {
  fontFamily: string;
  fontSize: number;
  captionColor: string;
  highlightColor: string;
  textPosition: "bottom" | "center" | "top";
  backgroundStyle: "box" | "bar" | "none";
  emphasisAnimation: "bounce" | "pop" | "none";
  layoutType?: "crop" | "fit_black" | "fit_white" | "blur_background";
  layoutTitleText?: string;
  isMirrored?: boolean;
  playbackSpeed?: number;
}

export type ClipCompositionProps = {
  videoUrl: string;
  startFrame: number;
  endFrame: number;
  transcriptSegments: WordSegment[];
  styleConfig: StyleConfig;
};

export const ClipComposition: React.FC<ClipCompositionProps> = ({
  videoUrl,
  startFrame,
  endFrame,
  transcriptSegments = [],
  styleConfig,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const speed = styleConfig.playbackSpeed || 1.0;
  const isMirrored = styleConfig.isMirrored || false;

  // Generate a low-resolution background video URL to optimize performance
  const backgroundVideoUrl = React.useMemo(() => {
    if (videoUrl.includes("/video/upload/")) {
      return videoUrl.replace("/video/upload/", "/video/upload/w_180,c_scale/");
    }
    return videoUrl;
  }, [videoUrl]);

  // Current playback time in seconds relative to the start of the clip, scaled by speed
  const currentTimeWithinClip = (frame / fps) * speed;

  // Absolute time in the original video
  const startTime = startFrame / fps;
  const endTime = endFrame / fps;
  const absoluteCurrentTime = startTime + currentTimeWithinClip;

  // Filter words that belong to this clip's duration (with small buffer)
  const clipWords = transcriptSegments.filter(
    (w) => w.start >= startTime - 0.2 && w.start <= endTime + 0.2
  );

  // Group words into bursts of 3-4 words for standard social captions
  const BURST_SIZE = 3;
  const captionGroups: Array<{ start: number; end: number; words: WordSegment[] }> = [];

  for (let i = 0; i < clipWords.length; i += BURST_SIZE) {
    const wordsChunk = clipWords.slice(i, i + BURST_SIZE);
    if (wordsChunk.length > 0) {
      captionGroups.push({
        start: wordsChunk[0].start,
        end: wordsChunk[wordsChunk.length - 1].end,
        words: wordsChunk,
      });
    }
  }

  // Adjust end times to prevent rapid caption disappearing in small gaps
  for (let i = 0; i < captionGroups.length; i++) {
    const nextGroup = captionGroups[i + 1];
    if (nextGroup) {
      if (nextGroup.start - captionGroups[i].end < 1.5) {
        captionGroups[i].end = nextGroup.start;
      }
    }
  }

  // Find the active group for the current absolute timestamp
  const activeGroup = captionGroups.find(
    (g) => absoluteCurrentTime >= g.start && absoluteCurrentTime <= g.end
  );

  // Determine which word is currently active
  let activeWordIdx = -1;
  if (activeGroup) {
    activeWordIdx = activeGroup.words.findIndex(
      (w) => absoluteCurrentTime >= w.start && absoluteCurrentTime <= w.end
    );

    // Fallback: highlight the closest word in the active group
    if (activeWordIdx === -1) {
      let minDiff = Infinity;
      for (let j = 0; j < activeGroup.words.length; j++) {
        const diff = Math.min(
          Math.abs(absoluteCurrentTime - activeGroup.words[j].start),
          Math.abs(absoluteCurrentTime - activeGroup.words[j].end)
        );
        if (diff < minDiff) {
          minDiff = diff;
          activeWordIdx = j;
        }
      }
    }
  }

  // Caption Placement Positioning
  const flexPosition =
    styleConfig.textPosition === "top"
      ? "flex-start"
      : styleConfig.textPosition === "center"
      ? "center"
      : "flex-end";

  // Google Font Import link
  const fontFamilyName = styleConfig.fontFamily || "Inter";
  const fontUrl = `https://fonts.googleapis.com/css2?family=${fontFamilyName.replace(
    /\s+/g,
    "+"
  )}:wght@400;700;800;900&display=swap`;

  const layout = styleConfig.layoutType || "crop";
  const titleText = styleConfig.layoutTitleText || "";

  const renderVideoLayout = () => {
    if (layout === "blur_background") {
      return (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          {/* Blurred Background Video */}
          <OffthreadVideo
            src={backgroundVideoUrl}
            startFrom={startFrame}
            endAt={endFrame}
            muted
            playbackRate={speed}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "blur(10px) brightness(0.6)",
              transform: isMirrored ? "scale(1.2) scaleX(-1)" : "scale(1.2)",
              position: "absolute",
              inset: 0,
            }}
          />
          {/* Sharp Centered Video in Foreground */}
          <OffthreadVideo
            src={videoUrl}
            startFrom={startFrame}
            endAt={endFrame}
            playbackRate={speed}
            style={{
              width: "108%",
              left: "-4%",
              height: "auto",
              position: "absolute",
              top: "50%",
              transform: isMirrored ? "translateY(-50%) scaleX(-1)" : "translateY(-50%)",
              boxShadow: "0 10px 45px rgba(0, 0, 0, 0.65)",
              zIndex: 5,
            }}
          />
        </div>
      );
    }

    if (layout === "fit_white" || layout === "fit_black") {
      const isWhite = layout === "fit_white";
      return (
        <div style={{ position: "absolute", inset: 0, backgroundColor: isWhite ? "#ffffff" : "#000000" }}>
          <OffthreadVideo
            src={videoUrl}
            startFrom={startFrame}
            endAt={endFrame}
            playbackRate={speed}
            style={{
              width: "108%",
              left: "-4%",
              height: "auto",
              position: "absolute",
              top: "50%",
              transform: isMirrored ? "translateY(-50%) scaleX(-1)" : "translateY(-50%)",
            }}
          />
        </div>
      );
    }

    // Default Full Crop (crop)
    return (
      <OffthreadVideo
        src={videoUrl}
        startFrom={startFrame}
        endAt={endFrame}
        playbackRate={speed}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: isMirrored ? "scaleX(-1)" : "none",
        }}
      />
    );
  };

  return (
    <div style={{ flex: 1, backgroundColor: "#000", position: "relative", width: "100%", height: "100%" }}>
      {/* Dynamic Font Injection */}
      <link href={fontUrl} rel="stylesheet" />

      {/* Render selected video layout preset */}
      {renderVideoLayout()}

      {/* Title / Hook Text Overlay (for non-crop layouts) */}
      {layout !== "crop" && titleText && (
        <div
          style={{
            position: "absolute",
            top: "180px",
            left: "20px",
            right: "20px",
            textAlign: "center",
            color: layout === "fit_white" ? "#000000" : "#ffffff",
            fontFamily: `'${fontFamilyName}', sans-serif`,
            fontSize: `${Math.max(36, Math.round(styleConfig.fontSize * 0.95))}px`,
            fontWeight: 900,
            lineHeight: 1.3,
            zIndex: 20,
            textShadow: layout === "fit_white" ? "none" : "0px 2px 8px rgba(0, 0, 0, 0.8)",
          }}
        >
          {titleText}
        </div>
      )}

      {/* Caption Overlay Container */}
      {activeGroup && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: flexPosition,
            padding:
              flexPosition === "center"
                ? "20px"
                : flexPosition === "flex-start"
                ? "240px 20px 120px 20px" // Top Overlay pushed down
                : "120px 20px 380px 20px", // Bottom Overlay pushed up (Shorts safe-zone)
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          <div
            style={{
              textAlign: "center",
              fontFamily: `'${fontFamilyName}', sans-serif`,
              fontSize: `${styleConfig.fontSize || 20}px`,
              fontWeight: 800,
              lineHeight: 1.3,
              // Background Styles
              ...(styleConfig.backgroundStyle === "box"
                ? {
                    backgroundColor: "rgba(0, 0, 0, 0.7)",
                    borderRadius: "12px",
                    padding: "10px 18px",
                    backdropFilter: "blur(4px)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    display: "inline-block",
                    maxWidth: "90%",
                  }
                : styleConfig.backgroundStyle === "bar"
                ? {
                    backgroundColor: "rgba(0, 0, 0, 0.75)",
                    width: "100%",
                    padding: "16px 20px",
                    display: "block",
                  }
                : {}),
            }}
          >
            {activeGroup.words.map((w, idx) => {
              const isActive = idx === activeWordIdx;
              
              // Emphasis Animations frame calculations
              let transform = "scale(1)";
              if (isActive) {
                if (styleConfig.emphasisAnimation === "pop") {
                  transform = "scale(1.2)";
                } else if (styleConfig.emphasisAnimation === "bounce") {
                  const duration = w.end - w.start;
                  const progress = Math.max(0, Math.min(1, (absoluteCurrentTime - w.start) / (duration || 0.1)));
                  const bounceY = Math.sin(progress * Math.PI) * 10; // Bounce up to 10px
                  transform = `translateY(-${bounceY}px) scale(1.05)`;
                }
              }

              return (
                <span
                  key={idx}
                  style={{
                    display: "inline-block",
                    margin: "0 6px",
                    color: isActive ? styleConfig.highlightColor : styleConfig.captionColor,
                    transform,
                    transition: "transform 0.08s ease, color 0.08s ease",
                    textShadow: "0px 2px 4px rgba(0, 0, 0, 0.8)",
                  }}
                >
                  {w.word}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
