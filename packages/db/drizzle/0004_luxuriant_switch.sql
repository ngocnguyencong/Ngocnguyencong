CREATE TABLE "early_access_code" (
	"id" text PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"email" varchar(255),
	"waitlist_entry_id" text,
	"created_by_user_id" text,
	"redeemed_by_user_id" text,
	"redeemed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral" (
	"id" text PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"kind" varchar(16) NOT NULL,
	"referrer_entry_id" text,
	"referred_email" varchar(255),
	"referred_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"status" varchar(16) DEFAULT 'waiting' NOT NULL,
	"referral_code" varchar(32) NOT NULL,
	"referred_by_entry_id" text,
	"referral_count" integer DEFAULT 0 NOT NULL,
	"invited_at" timestamp with time zone,
	"joined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "early_access_code" ADD CONSTRAINT "early_access_code_waitlist_entry_id_waitlist_entry_id_fk" FOREIGN KEY ("waitlist_entry_id") REFERENCES "public"."waitlist_entry"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "early_access_code" ADD CONSTRAINT "early_access_code_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "early_access_code" ADD CONSTRAINT "early_access_code_redeemed_by_user_id_user_id_fk" FOREIGN KEY ("redeemed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_referrer_entry_id_waitlist_entry_id_fk" FOREIGN KEY ("referrer_entry_id") REFERENCES "public"."waitlist_entry"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_referred_user_id_user_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entry" ADD CONSTRAINT "waitlist_entry_referred_by_entry_id_waitlist_entry_id_fk" FOREIGN KEY ("referred_by_entry_id") REFERENCES "public"."waitlist_entry"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_early_access_code_code" ON "early_access_code" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_early_access_code_email" ON "early_access_code" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_early_access_code_waitlist_entry" ON "early_access_code" USING btree ("waitlist_entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_referral_kind_user" ON "referral" USING btree ("kind","referred_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_referral_kind_email" ON "referral" USING btree ("kind","referred_email");--> statement-breakpoint
CREATE INDEX "idx_referral_code_created" ON "referral" USING btree ("code","created_at");--> statement-breakpoint
CREATE INDEX "idx_referral_referrer_entry" ON "referral" USING btree ("referrer_entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_waitlist_entry_email" ON "waitlist_entry" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_waitlist_entry_referral_code" ON "waitlist_entry" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "idx_waitlist_entry_status_created" ON "waitlist_entry" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_waitlist_entry_referred_by" ON "waitlist_entry" USING btree ("referred_by_entry_id");