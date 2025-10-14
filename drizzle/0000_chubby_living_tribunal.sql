CREATE TYPE "public"."cta_type" AS ENUM('learn_more', 'sign_up', 'buy_now', 'read_article', 'watch_video', 'download', 'join_community', 'poll_question', 'other');--> statement-breakpoint
CREATE TYPE "public"."link_ownership_type" AS ENUM('own_content', 'third_party_content');--> statement-breakpoint
CREATE TYPE "public"."link_type" AS ENUM('self_help', 'tech_tutorial', 'news_article', 'product_review', 'thought_leadership', 'entertainment', 'other');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('twitter', 'instagram', 'facebook', 'linkedin');--> statement-breakpoint
CREATE TYPE "public"."target_audience" AS ENUM('developers', 'marketers', 'entrepreneurs', 'students', 'parents', 'general_public', 'creatives', 'finance_professionals', 'other');--> statement-breakpoint
CREATE TYPE "public"."tone" AS ENUM('witty', 'professional', 'inspirational', 'casual', 'direct', 'empathetic');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT current_timestamp
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT current_timestamp,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT current_timestamp,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT current_timestamp
);
--> statement-breakpoint
CREATE TABLE "training_posts" (
	"id" varchar PRIMARY KEY NOT NULL,
	"post_content" text NOT NULL,
	"platforms" "platform" NOT NULL,
	"content_type" "link_type" NOT NULL,
	"original_url" text NOT NULL,
	"content_summary" text NOT NULL,
	"call_to_action_type" "cta_type",
	"sales_pitch_strength" integer DEFAULT 100 NOT NULL,
	"tone_profile" jsonb NOT NULL,
	"embedding" vector(1536),
	"content_summary_embedding" vector(1536),
	"link_ownership_type" "link_ownership_type" NOT NULL,
	"target_audience" "target_audience",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT current_timestamp,
	CONSTRAINT "training_posts_original_url_unique" UNIQUE("original_url")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;