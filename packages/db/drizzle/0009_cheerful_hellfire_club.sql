CREATE TABLE "usage_counter" (
	"workspace_id" text NOT NULL,
	"key" varchar(100) NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_counter_workspace_id_key_period_start_pk" PRIMARY KEY("workspace_id","key","period_start")
);
--> statement-breakpoint
ALTER TABLE "usage_counter" ADD CONSTRAINT "usage_counter_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_usage_counter_workspace" ON "usage_counter" USING btree ("workspace_id");