CREATE TABLE "workspace_usage_cap" (
	"workspace_id" text NOT NULL,
	"key" varchar(100) NOT NULL,
	"cap" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_usage_cap_workspace_id_key_pk" PRIMARY KEY("workspace_id","key"),
	CONSTRAINT "workspace_usage_cap_nonnegative" CHECK ("cap" >= 0)
);
--> statement-breakpoint
ALTER TABLE "workspace_usage_cap" ADD CONSTRAINT "workspace_usage_cap_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;