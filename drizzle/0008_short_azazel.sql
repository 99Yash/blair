CREATE INDEX "tone_profile_gin" ON "training_posts" USING gin ("tone_profile");--> statement-breakpoint
CREATE INDEX "training_posts_filter_idx" ON "training_posts" USING btree ("platforms","content_type","target_audience","call_to_action_type");--> statement-breakpoint
ALTER TABLE "training_posts" ADD CONSTRAINT "training_posts_user_id_original_url_unique" UNIQUE("user_id","original_url");