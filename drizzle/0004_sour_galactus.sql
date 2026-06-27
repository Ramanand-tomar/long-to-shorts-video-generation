CREATE TABLE "pipeline_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"total_clips" integer DEFAULT 0 NOT NULL,
	"published_clips" integer DEFAULT 0 NOT NULL,
	"completion_email_sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "youtube_title" text;--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "youtube_description" text;--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "youtube_tags" jsonb;--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "youtube_video_id" text;--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "youtube_published_at" timestamp;--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "s3_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "source_type" text DEFAULT 'upload' NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "gdrive_file_id" text;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;