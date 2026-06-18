CREATE INDEX IF NOT EXISTS "api_keys_key_hash_idx" ON "api_keys" ("key_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_partner_id_idx" ON "organizations" ("partner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_subscriptions_org_id_idx" ON "webhook_subscriptions" ("org_id");