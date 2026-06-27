import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { analyzeVideo } from "@/lib/inngest/functions/analyze-video";
import { renderClip } from "@/lib/inngest/functions/render-clip";
import { publishScheduledPosts, publishSinglePost, handlePublishFailure } from "@/lib/inngest/functions/publish-posts";
import { autoPipeline } from "@/lib/inngest/functions/auto-pipeline";

// Serve Route Handler for Inngest API integration
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    analyzeVideo,
    renderClip,
    publishScheduledPosts,
    publishSinglePost,
    handlePublishFailure,
    autoPipeline,
  ],
});
