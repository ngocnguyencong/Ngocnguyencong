CREATE TABLE "connected_account" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"provider" varchar(32) NOT NULL,
	"external_account_id" varchar(255) NOT NULL,
	"label" varchar(255),
	"scopes" text[],
	"access_token_expires_at" timestamp with time zone,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"last_refreshed_at" timestamp with time zone,
	"failure_reason" varchar(500),
	"token_algorithm" varchar(32),
	"token_version" integer,
	"token_iv" text,
	"token_auth_tag" text,
	"token_ciphertext" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connected_account" ADD CONSTRAINT "connected_account_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_connected_account_workspace_provider_external" ON "connected_account" USING btree ("workspace_id","provider","external_account_id");--> statement-breakpoint
CREATE INDEX "idx_connected_account_workspace" ON "connected_account" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_connected_account_workspace_status" ON "connected_account" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "idx_connected_account_expiry" ON "connected_account" USING btree ("access_token_expires_at");