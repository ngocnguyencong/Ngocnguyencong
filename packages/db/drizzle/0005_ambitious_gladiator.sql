CREATE TABLE "workspace_domain" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"hostname" varchar(255) NOT NULL,
	"provider_hostname_id" text,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"ssl_status" varchar(64),
	"verification" jsonb,
	"last_checked_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_domain" ADD CONSTRAINT "workspace_domain_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_workspace_domain_hostname" ON "workspace_domain" USING btree ("hostname");--> statement-breakpoint
CREATE INDEX "idx_workspace_domain_workspace" ON "workspace_domain" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_workspace_domain_status" ON "workspace_domain" USING btree ("status");