CREATE TABLE "away_cards" (
	"kindled_id" uuid PRIMARY KEY NOT NULL,
	"from_at" timestamp with time zone NOT NULL,
	"to_at" timestamp with time zone NOT NULL,
	"made" jsonb NOT NULL,
	"levels" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "away_cards" ADD CONSTRAINT "away_cards_kindled_id_kindled_id_fk" FOREIGN KEY ("kindled_id") REFERENCES "public"."kindled"("id") ON DELETE cascade ON UPDATE no action;