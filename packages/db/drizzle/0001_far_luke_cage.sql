-- account.issuer is required by Better Auth (see @better-auth/core get-tables).
-- Databases created before the baseline squash may already carry this column,
-- so every statement is idempotent and only NULL rows are backfilled.
-- Backfill mirrors Better Auth issuer conventions:
--   createLocalAccountIssuer  → 'local:<providerId>'      (credential accounts)
--   createOAuthAccountIssuer  → 'local:oauth:<providerId>' (built-in social providers)
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "issuer" text;--> statement-breakpoint
UPDATE "account" SET "issuer" = CASE
	WHEN "provider_id" = 'credential' THEN 'local:credential'
	ELSE 'local:oauth:' || "provider_id"
END
WHERE "issuer" IS NULL;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "idx_account_provider_account";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_account_issuer_account" ON "account" USING btree ("issuer","account_id");--> statement-breakpoint
