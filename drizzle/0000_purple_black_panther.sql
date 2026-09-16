CREATE TABLE "installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runtime_state" (
	"singleton_key" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"installation_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "runtime_state_singleton_key_check" CHECK ("runtime_state"."singleton_key" = 1)
);
--> statement-breakpoint
CREATE TABLE "telegram_groups" (
	"installation_id" uuid NOT NULL,
	"telegram_chat_id" bigint NOT NULL,
	"chat_type" text NOT NULL,
	"title" varchar(255) NOT NULL,
	"username" varchar(32),
	"locale" varchar(16) DEFAULT 'en-US' NOT NULL,
	"time_zone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"bot_status" text DEFAULT 'member' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_groups_installation_chat_pk" PRIMARY KEY("installation_id","telegram_chat_id"),
	CONSTRAINT "telegram_groups_chat_type_check" CHECK ("telegram_groups"."chat_type" IN ('group', 'supergroup')),
	CONSTRAINT "telegram_groups_bot_status_check" CHECK ("telegram_groups"."bot_status" IN ('creator', 'administrator', 'member', 'restricted', 'left', 'kicked'))
);
--> statement-breakpoint
ALTER TABLE "runtime_state" ADD CONSTRAINT "runtime_state_installation_id_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_groups" ADD CONSTRAINT "telegram_groups_installation_id_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "telegram_groups_installation_active_idx" ON "telegram_groups" USING btree ("installation_id","is_active","updated_at");