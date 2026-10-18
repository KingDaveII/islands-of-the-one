CREATE TABLE "basket_cycles" (
	"kindled_id" uuid NOT NULL,
	"station_id" text NOT NULL,
	"cycled_until" timestamp with time zone NOT NULL,
	"carry_permille" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "basket_cycles_kindled_id_station_id_pk" PRIMARY KEY("kindled_id","station_id")
);
--> statement-breakpoint
CREATE TABLE "known_words" (
	"kindled_id" uuid NOT NULL,
	"word_id" text NOT NULL,
	"learned_at" timestamp with time zone NOT NULL,
	CONSTRAINT "known_words_kindled_id_word_id_pk" PRIMARY KEY("kindled_id","word_id")
);
--> statement-breakpoint
CREATE TABLE "plots" (
	"kindled_id" uuid NOT NULL,
	"plot_id" text NOT NULL,
	"ground" text NOT NULL,
	"virtue" text,
	"named_at" timestamp with time zone NOT NULL,
	"virtue_set_at" timestamp with time zone,
	"virtue_paused_ms" bigint DEFAULT 0 NOT NULL,
	"sown_at" timestamp with time zone,
	CONSTRAINT "plots_kindled_id_plot_id_pk" PRIMARY KEY("kindled_id","plot_id")
);
--> statement-breakpoint
ALTER TABLE "kesh_gifts" ADD COLUMN "word_given_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kesh_gifts" ADD COLUMN "seeds_given_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "writs" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "basket_cycles" ADD CONSTRAINT "basket_cycles_kindled_id_kindled_id_fk" FOREIGN KEY ("kindled_id") REFERENCES "public"."kindled"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "known_words" ADD CONSTRAINT "known_words_kindled_id_kindled_id_fk" FOREIGN KEY ("kindled_id") REFERENCES "public"."kindled"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plots" ADD CONSTRAINT "plots_kindled_id_kindled_id_fk" FOREIGN KEY ("kindled_id") REFERENCES "public"."kindled"("id") ON DELETE cascade ON UPDATE no action;