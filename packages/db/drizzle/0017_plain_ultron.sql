CREATE TABLE "sd_alert" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" varchar(120) NOT NULL,
	"metric" varchar(32) NOT NULL,
	"condition" varchar(8) NOT NULL,
	"threshold" integer NOT NULL,
	"period" varchar(8) DEFAULT 'day' NOT NULL,
	"target" varchar(255),
	"active" boolean DEFAULT true NOT NULL,
	"last_fired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sd_alert_event" (
	"id" text PRIMARY KEY NOT NULL,
	"alert_id" text NOT NULL,
	"value" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sd_event" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"visitor_id" text NOT NULL,
	"session_id" text,
	"type" varchar(24) NOT NULL,
	"name" varchar(255),
	"path" varchar(1024),
	"hostname" varchar(255),
	"referrer" text,
	"utm_source" varchar(255),
	"utm_medium" varchar(255),
	"utm_campaign" varchar(255),
	"utm_term" varchar(255),
	"utm_content" varchar(255),
	"click_ids" text,
	"props" text,
	"channel" varchar(32),
	"source" varchar(255),
	"medium" varchar(255),
	"campaign" varchar(255),
	"country" varchar(8),
	"region" varchar(120),
	"city" varchar(120),
	"device" varchar(16),
	"browser" varchar(80),
	"os" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sd_funnel" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" varchar(120) NOT NULL,
	"steps" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sd_goal" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" varchar(120) NOT NULL,
	"type" varchar(16) NOT NULL,
	"value" varchar(512) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sd_integration" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"provider" varchar(32) NOT NULL,
	"status" varchar(24) DEFAULT 'connected' NOT NULL,
	"meta" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sd_keyword" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"query" varchar(255) NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"position" double precision DEFAULT 0 NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sd_mention" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"platform" varchar(32) NOT NULL,
	"author" varchar(120),
	"text" text NOT NULL,
	"url" varchar(1024),
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sd_payment" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"visitor_id" text,
	"email" varchar(255),
	"provider" varchar(32) NOT NULL,
	"external_id" varchar(255),
	"kind" varchar(24) DEFAULT 'payment' NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" varchar(8) DEFAULT 'usd' NOT NULL,
	"interval" varchar(16) DEFAULT 'once' NOT NULL,
	"mrr_cents" integer DEFAULT 0 NOT NULL,
	"product_name" varchar(255),
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"channel" varchar(32),
	"source" varchar(255),
	"medium" varchar(255),
	"campaign" varchar(255),
	"referrer" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sd_session" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"visitor_id" text NOT NULL,
	"session_key" varchar(96) NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"last_activity_at" timestamp with time zone NOT NULL,
	"entry_page" varchar(512),
	"referrer" text,
	"utm_source" varchar(255),
	"utm_medium" varchar(255),
	"utm_campaign" varchar(255),
	"utm_term" varchar(255),
	"utm_content" varchar(255),
	"click_id" varchar(255),
	"channel" varchar(32),
	"source" varchar(255),
	"medium" varchar(255),
	"campaign" varchar(255),
	"country" varchar(8),
	"region" varchar(120),
	"city" varchar(120),
	"device" varchar(16),
	"browser" varchar(80),
	"os" varchar(80),
	"pageviews" integer DEFAULT 0 NOT NULL,
	"is_bounce" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sd_site" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"domain" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"share_id" varchar(32) NOT NULL,
	"allowed_hostnames" text DEFAULT '' NOT NULL,
	"cookieless" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sd_site_key" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" varchar(120),
	"prefix" varchar(16) NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sd_visitor" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"visitor_key" varchar(64) NOT NULL,
	"user_id" varchar(128),
	"email" varchar(255),
	"name" varchar(255),
	"image" text,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"session_count" integer DEFAULT 1 NOT NULL,
	"pageview_count" integer DEFAULT 0 NOT NULL,
	"first_referrer" text,
	"first_utm_source" varchar(255),
	"first_utm_medium" varchar(255),
	"first_utm_campaign" varchar(255),
	"first_utm_term" varchar(255),
	"first_utm_content" varchar(255),
	"first_click_id" varchar(255),
	"entry_page" varchar(512),
	"last_referrer" text,
	"last_utm_source" varchar(255),
	"last_utm_medium" varchar(255),
	"last_utm_campaign" varchar(255),
	"last_click_id" varchar(255),
	"country" varchar(8),
	"region" varchar(120),
	"city" varchar(120),
	"device" varchar(16),
	"browser" varchar(80),
	"os" varchar(80),
	"language" varchar(40),
	"timezone" varchar(80),
	"is_customer" boolean DEFAULT false NOT NULL,
	"revenue_cents" integer DEFAULT 0 NOT NULL,
	"prediction_score" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sd_alert" ADD CONSTRAINT "sd_alert_site_id_sd_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sd_site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sd_alert_event" ADD CONSTRAINT "sd_alert_event_alert_id_sd_alert_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."sd_alert"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sd_event" ADD CONSTRAINT "sd_event_site_id_sd_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sd_site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sd_event" ADD CONSTRAINT "sd_event_visitor_id_sd_visitor_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."sd_visitor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sd_event" ADD CONSTRAINT "sd_event_session_id_sd_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sd_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sd_funnel" ADD CONSTRAINT "sd_funnel_site_id_sd_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sd_site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sd_goal" ADD CONSTRAINT "sd_goal_site_id_sd_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sd_site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sd_integration" ADD CONSTRAINT "sd_integration_site_id_sd_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sd_site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sd_keyword" ADD CONSTRAINT "sd_keyword_site_id_sd_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sd_site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sd_mention" ADD CONSTRAINT "sd_mention_site_id_sd_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sd_site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sd_payment" ADD CONSTRAINT "sd_payment_site_id_sd_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sd_site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sd_payment" ADD CONSTRAINT "sd_payment_visitor_id_sd_visitor_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."sd_visitor"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sd_session" ADD CONSTRAINT "sd_session_site_id_sd_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sd_site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sd_session" ADD CONSTRAINT "sd_session_visitor_id_sd_visitor_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."sd_visitor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sd_site" ADD CONSTRAINT "sd_site_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sd_site_key" ADD CONSTRAINT "sd_site_key_site_id_sd_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sd_site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sd_visitor" ADD CONSTRAINT "sd_visitor_site_id_sd_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sd_site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_sd_alert_site" ON "sd_alert" USING btree ("site_id","active");--> statement-breakpoint
CREATE INDEX "idx_sd_alert_event_alert" ON "sd_alert_event" USING btree ("alert_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_sd_event_created" ON "sd_event" USING btree ("site_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_sd_event_type_created" ON "sd_event" USING btree ("site_id","type","created_at");--> statement-breakpoint
CREATE INDEX "idx_sd_event_name_created" ON "sd_event" USING btree ("site_id","name","created_at");--> statement-breakpoint
CREATE INDEX "idx_sd_event_path_created" ON "sd_event" USING btree ("site_id","path","created_at");--> statement-breakpoint
CREATE INDEX "idx_sd_event_visitor" ON "sd_event" USING btree ("visitor_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_sd_funnel_site" ON "sd_funnel" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "idx_sd_goal_site" ON "sd_goal" USING btree ("site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sd_integration_site_provider" ON "sd_integration" USING btree ("site_id","provider");--> statement-breakpoint
CREATE INDEX "idx_sd_keyword_site_date" ON "sd_keyword" USING btree ("site_id","date");--> statement-breakpoint
CREATE INDEX "idx_sd_mention_site" ON "sd_mention" USING btree ("site_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sd_payment_external" ON "sd_payment" USING btree ("site_id","external_id");--> statement-breakpoint
CREATE INDEX "idx_sd_payment_occurred" ON "sd_payment" USING btree ("site_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_sd_payment_visitor" ON "sd_payment" USING btree ("visitor_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sd_session_key" ON "sd_session" USING btree ("site_id","session_key");--> statement-breakpoint
CREATE INDEX "idx_sd_session_started" ON "sd_session" USING btree ("site_id","started_at");--> statement-breakpoint
CREATE INDEX "idx_sd_session_visitor" ON "sd_session" USING btree ("visitor_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sd_site_share" ON "sd_site" USING btree ("share_id");--> statement-breakpoint
CREATE INDEX "idx_sd_site_workspace" ON "sd_site" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sd_site_key_hash" ON "sd_site_key" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "idx_sd_site_key_site" ON "sd_site_key" USING btree ("site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sd_visitor_key" ON "sd_visitor" USING btree ("site_id","visitor_key");--> statement-breakpoint
CREATE INDEX "idx_sd_visitor_last_seen" ON "sd_visitor" USING btree ("site_id","last_seen_at");--> statement-breakpoint
CREATE INDEX "idx_sd_visitor_email" ON "sd_visitor" USING btree ("site_id","email");--> statement-breakpoint
CREATE INDEX "idx_sd_visitor_user_id" ON "sd_visitor" USING btree ("site_id","user_id");