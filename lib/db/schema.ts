import { pgTable, uuid, text, integer, timestamp, real, bigint, jsonb, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// 1. Users Table
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkUserId: text("clerk_user_id").unique().notNull(),
  email: text("email").unique().notNull(),
  name: text("name"),
  plan: text("plan").default("free").notNull(), // 'free' | 'pro'
  uploadCount24h: integer("upload_count_24h").default(0).notNull(),
  lastUploadAt: timestamp("last_upload_at"),
  lastUploadReset: timestamp("last_upload_reset").defaultNow(),
  renderCount24h: integer("render_count_24h").default(0).notNull(),
  lastRenderReset: timestamp("last_render_reset").defaultNow(),
  analysisCount24h: integer("analysis_count_24h").default(0).notNull(),
  lastAnalysisReset: timestamp("last_analysis_reset").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations for Users
export const usersRelations = relations(users, ({ many }) => ({
  videos: many(videos),
  socialConnections: many(socialConnections),
  scheduledPosts: many(scheduledPosts),
  usageLogs: many(usageLogs),
  pipelineRuns: many(pipelineRuns),
}));

// 2. Videos Table
export const videos = pgTable("videos", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  videoUrl: text("video_url").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: bigint("file_size", { mode: "number" }).notNull(),
  duration: real("duration"),
  format: text("format"),
  cloudinaryAssetId: text("cloudinary_asset_id"),
  transcript: jsonb("transcript"),
  sourceType: text("source_type").default("upload").notNull(), // 'upload', 'gdrive'
  gdriveFileId: text("gdrive_file_id"),
  status: text("status").default("pending").notNull(), // 'pending', 'transcribing', 'analyzing', 'completed', 'failed'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations for Videos
export const videosRelations = relations(videos, ({ one, many }) => ({
  user: one(users, {
    fields: [videos.userId],
    references: [users.id],
  }),
  analysisJobs: many(analysisJobs),
  clips: many(clips),
}));

// 3. Analysis Jobs Table
export const analysisJobs = pgTable("analysis_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  videoId: uuid("video_id").references(() => videos.id, { onDelete: "cascade" }).notNull(),
  status: text("status").default("pending").notNull(), // 'pending', 'processing', 'completed', 'failed'
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations for Analysis Jobs
export const analysisJobsRelations = relations(analysisJobs, ({ one }) => ({
  video: one(videos, {
    fields: [analysisJobs.videoId],
    references: [videos.id],
  }),
}));

// 4. Clips Table
export const clips = pgTable("clips", {
  id: uuid("id").defaultRandom().primaryKey(),
  videoId: uuid("video_id").references(() => videos.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  startTime: real("start_time").notNull(),
  endTime: real("end_time").notNull(),
  confidenceScore: real("confidence_score"),
  clipUrl: text("clip_url"),
  renderStatus: text("render_status").default("not_started").notNull(), // 'not_started', 'queued', 'rendering', 'completed', 'failed'
  subtitleStyle: jsonb("subtitle_style"),
  seoScore: integer("seo_score"),
  hookText: text("hook_text"),
  captionText: text("caption_text"),
  hashtags: jsonb("hashtags"),
  reason: text("reason"),
  youtubeTitle: text("youtube_title"),
  youtubeDescription: text("youtube_description"),
  youtubeTags: jsonb("youtube_tags"),
  youtubeVideoId: text("youtube_video_id"),
  youtubePublishedAt: timestamp("youtube_published_at"),
  s3Deleted: boolean("s3_deleted").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations for Clips
export const clipsRelations = relations(clips, ({ one, many }) => ({
  video: one(videos, {
    fields: [clips.videoId],
    references: [videos.id],
  }),
  scheduledPosts: many(scheduledPosts),
}));

// 5. Social Connections Table
export const socialConnections = pgTable("social_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  platform: text("platform").notNull(), // 'tiktok', 'instagram', 'youtube'
  platformUserId: text("platform_user_id").notNull(),
  externalAccountId: text("external_account_id"),
  profileName: text("profile_name"),
  profilePicture: text("profile_picture"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations for Social Connections
export const socialConnectionsRelations = relations(socialConnections, ({ one, many }) => ({
  user: one(users, {
    fields: [socialConnections.userId],
    references: [users.id],
  }),
  scheduledPosts: many(scheduledPosts),
}));

// 6. Scheduled Posts Table
export const scheduledPosts = pgTable("scheduled_posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  clipId: uuid("clip_id").references(() => clips.id, { onDelete: "cascade" }).notNull(),
  connectionId: uuid("connection_id").references(() => socialConnections.id, { onDelete: "cascade" }).notNull(),
  caption: text("caption"),
  scheduledFor: timestamp("scheduled_for").notNull(),
  status: text("status").default("scheduled").notNull(), // 'scheduled', 'publishing', 'published', 'failed'
  publishedPostId: text("published_post_id"),
  platformResponse: jsonb("platform_response"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations for Scheduled Posts
export const scheduledPostsRelations = relations(scheduledPosts, ({ one }) => ({
  user: one(users, {
    fields: [scheduledPosts.userId],
    references: [users.id],
  }),
  clip: one(clips, {
    fields: [scheduledPosts.clipId],
    references: [clips.id],
  }),
  connection: one(socialConnections, {
    fields: [scheduledPosts.connectionId],
    references: [socialConnections.id],
  }),
}));

// 7. Usage Logs Table
export const usageLogs = pgTable("usage_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  action: text("action").notNull(), // 'upload', 'render', 'social_publish'
  quantity: integer("quantity").default(1).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Relations for Usage Logs
export const usageLogsRelations = relations(usageLogs, ({ one }) => ({
  user: one(users, {
    fields: [usageLogs.userId],
    references: [users.id],
  }),
}));

// 8. Pipeline Runs Table
export const pipelineRuns = pgTable("pipeline_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  videoId: uuid("video_id").references(() => videos.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  status: text("status").default("pending").notNull(), // 'pending', 'analyzing', 'rendering', 'publishing', 'completed', 'failed'
  errorMessage: text("error_message"),
  totalClips: integer("total_clips").default(0).notNull(),
  publishedClips: integer("published_clips").default(0).notNull(),
  completionEmailSent: boolean("completion_email_sent").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations for Pipeline Runs
export const pipelineRunsRelations = relations(pipelineRuns, ({ one }) => ({
  video: one(videos, {
    fields: [pipelineRuns.videoId],
    references: [videos.id],
  }),
  user: one(users, {
    fields: [pipelineRuns.userId],
    references: [users.id],
  }),
}));
