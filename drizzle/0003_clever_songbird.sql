ALTER TABLE "clips" ALTER COLUMN "render_status" SET DEFAULT 'not_started';--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "seo_score" integer;--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "hook_text" text;--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "caption_text" text;--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "hashtags" jsonb;--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "scheduled_posts" ADD COLUMN "platform_response" jsonb;--> statement-breakpoint
UPDATE "clips" SET "render_status" = 'not_started' WHERE "render_status" = 'idle';