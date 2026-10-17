CREATE TABLE "platform_ai_spend" (
	"day" varchar(10) PRIMARY KEY NOT NULL,
	"spent_microunits" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
