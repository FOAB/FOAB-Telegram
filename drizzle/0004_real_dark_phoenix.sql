ALTER TABLE "telegram_groups" ADD COLUMN "welcome_message" text;--> statement-breakpoint
ALTER TABLE "telegram_groups" ADD COLUMN "goodbye_message" text;--> statement-breakpoint
ALTER TABLE "telegram_groups" ADD COLUMN "rules_text" text;