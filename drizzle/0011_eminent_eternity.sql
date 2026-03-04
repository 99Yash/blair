ALTER TABLE "generate_posts" DROP CONSTRAINT "generate_posts_user_id_original_url_unique";--> statement-breakpoint
ALTER TABLE "generate_posts" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "generate_posts" ADD COLUMN "parent_id" varchar;--> statement-breakpoint
ALTER TABLE "generate_posts" ADD COLUMN "quality_score" numeric(4, 2);