CREATE TABLE "analytics_event" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text,
	"kind" varchar(32) NOT NULL,
	"name" varchar(120),
	"path" varchar(512),
	"referrer_host" varchar(255),
	"visitor_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_balance" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"amount" integer NOT NULL,
	"kind" varchar(24) NOT NULL,
	"reason" varchar(255),
	"reference_id" varchar(128),
	"actor_user_id" text,
	"balance_after" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_push_token" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"token" varchar(255) NOT NULL,
	"platform" varchar(16) NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_event" ADD CONSTRAINT "analytics_event_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_balance" ADD CONSTRAINT "credit_balance_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transaction" ADD CONSTRAINT "credit_transaction_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transaction" ADD CONSTRAINT "credit_transaction_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_push_token" ADD CONSTRAINT "device_push_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_push_token" ADD CONSTRAINT "device_push_token_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_analytics_event_created" ON "analytics_event" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_analytics_event_workspace_created" ON "analytics_event" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_analytics_event_kind_created" ON "analytics_event" USING btree ("kind","created_at");--> statement-breakpoint
CREATE INDEX "idx_credit_transaction_workspace_created" ON "credit_transaction" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_credit_transaction_reference" ON "credit_transaction" USING btree ("reference_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_device_push_token_token" ON "device_push_token" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_device_push_token_user" ON "device_push_token" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_device_push_token_workspace" ON "device_push_token" USING btree ("workspace_id");