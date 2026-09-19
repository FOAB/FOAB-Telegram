ALTER TABLE "telegram_groups" ADD COLUMN "welcome_mode" text DEFAULT 'always' NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_groups" ADD COLUMN "delete_previous_welcome_message" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_groups" ADD COLUMN "welcome_sent_once" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_groups" ADD COLUMN "welcome_last_message_id" integer;--> statement-breakpoint
ALTER TABLE "telegram_groups" ADD COLUMN "goodbye_mode" text DEFAULT 'always' NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_groups" ADD COLUMN "delete_previous_goodbye_message" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_groups" ADD COLUMN "goodbye_sent_once" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_groups" ADD COLUMN "goodbye_last_message_id" integer;--> statement-breakpoint
ALTER TABLE "telegram_groups" ADD CONSTRAINT "telegram_groups_message_mode_check" CHECK ("telegram_groups"."welcome_mode" IN ('always', 'first') AND "telegram_groups"."goodbye_mode" IN ('always', 'first'));