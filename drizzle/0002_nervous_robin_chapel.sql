CREATE TABLE "telegram_update_inbox" (
	"installation_id" uuid NOT NULL,
	"telegram_update_id" bigint NOT NULL,
	"update_kind" text NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_until" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"last_error_type" varchar(128),
	CONSTRAINT "telegram_update_inbox_installation_update_pk" PRIMARY KEY("installation_id","telegram_update_id"),
	CONSTRAINT "telegram_update_inbox_kind_check" CHECK ("telegram_update_inbox"."update_kind" IN ('message', 'my_chat_member')),
	CONSTRAINT "telegram_update_inbox_status_check" CHECK ("telegram_update_inbox"."status" IN ('processing', 'processed', 'failed')),
	CONSTRAINT "telegram_update_inbox_attempt_count_check" CHECK ("telegram_update_inbox"."attempt_count" > 0)
);
--> statement-breakpoint
ALTER TABLE "telegram_update_inbox" ADD CONSTRAINT "telegram_update_inbox_installation_id_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "telegram_update_inbox_claim_idx" ON "telegram_update_inbox" USING btree ("installation_id","status","lease_until");