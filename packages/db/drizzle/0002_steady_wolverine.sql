CREATE TABLE "commerce_order" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"customer_email" varchar(320) NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"total_cents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'usd' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commerce_order_item" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"product_id" text,
	"product_name" varchar(200) NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commerce_product" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"image_url" text,
	"price_cents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'usd' NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"inventory" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"type" varchar(64) NOT NULL,
	"slug" varchar(200) NOT NULL,
	"title" varchar(255) NOT NULL,
	"excerpt" text,
	"body" text DEFAULT '' NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"locale" varchar(35),
	"created_by" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "commerce_order" ADD CONSTRAINT "commerce_order_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_order_item" ADD CONSTRAINT "commerce_order_item_order_id_commerce_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."commerce_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_order_item" ADD CONSTRAINT "commerce_order_item_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_order_item" ADD CONSTRAINT "commerce_order_item_product_id_commerce_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."commerce_product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_product" ADD CONSTRAINT "commerce_product_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_entry" ADD CONSTRAINT "content_entry_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_entry" ADD CONSTRAINT "content_entry_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_commerce_order_workspace_created" ON "commerce_order" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_commerce_order_workspace_status" ON "commerce_order" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "idx_commerce_order_item_order" ON "commerce_order_item" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_commerce_order_item_workspace" ON "commerce_order_item" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_commerce_product_workspace_slug" ON "commerce_product" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "idx_commerce_product_workspace_status" ON "commerce_product" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_content_entry_workspace_type_slug" ON "content_entry" USING btree ("workspace_id","type","slug");--> statement-breakpoint
CREATE INDEX "idx_content_entry_workspace_status" ON "content_entry" USING btree ("workspace_id","status","published_at");