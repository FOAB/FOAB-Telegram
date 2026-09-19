CREATE TABLE "telegram_user_preferences" (
	"installation_id" uuid NOT NULL,
	"telegram_user_id" bigint NOT NULL,
	"private_locale" varchar(16) DEFAULT 'en-US' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_user_preferences_installation_user_pk" PRIMARY KEY("installation_id","telegram_user_id"),
	CONSTRAINT "telegram_user_preferences_locale_check" CHECK ("telegram_user_preferences"."private_locale" IN ('en-US', 'pt-BR', 'es-ES'))
);
--> statement-breakpoint
ALTER TABLE "telegram_user_preferences" ADD CONSTRAINT "telegram_user_preferences_installation_id_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "telegram_user_preferences_installation_idx" ON "telegram_user_preferences" USING btree ("installation_id");