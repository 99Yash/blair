CREATE TABLE "generate_posts" (
	"id" varchar PRIMARY KEY NOT NULL,
	"post_content" text NOT NULL,
	"platforms" "platform" NOT NULL,
	"content_type" "link_type" NOT NULL,
	"original_url" text NOT NULL,
	"content_summary" text NOT NULL,
	"target_audience" "target_audience" DEFAULT 'general_public',
	"link_ownership_type" "link_ownership_type" DEFAULT 'own_content',
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT current_timestamp
);
--> statement-breakpoint
ALTER TABLE "generate_posts" ADD CONSTRAINT "generate_posts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;