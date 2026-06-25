ALTER TABLE "social_connections" ADD COLUMN "external_account_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_upload_reset" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "render_count_24h" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_render_reset" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "analysis_count_24h" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_analysis_reset" timestamp DEFAULT now();