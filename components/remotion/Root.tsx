import React from "react";
import { Composition, CalculateMetadataFunction } from "remotion";
import { ClipComposition, ClipCompositionProps } from "./ClipComposition";

const calculateMetadata: CalculateMetadataFunction<ClipCompositionProps> = ({ props }) => {
  const duration = props.endFrame - props.startFrame;
  return {
    durationInFrames: duration > 0 ? duration : 900,
  };
};

export const Root: React.FC = () => {
  return (
    <>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Composition<any, ClipCompositionProps>
        id="ClipComposition"
        component={ClipComposition}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          videoUrl: "",
          startFrame: 0,
          endFrame: 150,
          transcriptSegments: [],
          styleConfig: {
            fontFamily: "Inter",
            fontSize: 40,
            captionColor: "#ffffff",
            highlightColor: "#fbbf24",
            textPosition: "bottom" as const,
            backgroundStyle: "box" as const,
            emphasisAnimation: "pop" as const,
            layoutType: "fit_black" as const,
            layoutTitleText: "wait for end",
            isMirrored: true,
            playbackSpeed: 1.02,
          },
        }}
        calculateMetadata={calculateMetadata}
      />
    </>
  );
};
