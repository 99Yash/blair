DROP INDEX "training_posts_filter_idx";--> statement-breakpoint
CREATE INDEX "training_posts_filter_idx" ON "training_posts" USING btree ("platforms","content_type","target_audience");--> statement-breakpoint
ALTER TABLE "training_posts" DROP COLUMN "call_to_action_type";--> statement-breakpoint
DROP TYPE "public"."cta_type";