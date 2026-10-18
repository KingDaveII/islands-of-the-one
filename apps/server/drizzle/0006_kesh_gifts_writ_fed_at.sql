CREATE TABLE "kesh_gifts" (
	"kindled_id" uuid PRIMARY KEY NOT NULL,
	"first_sliver_at" timestamp with time zone,
	"last_tide" integer
);
--> statement-breakpoint
ALTER TABLE "writs" ADD COLUMN "fed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kesh_gifts" ADD CONSTRAINT "kesh_gifts_kindled_id_kindled_id_fk" FOREIGN KEY ("kindled_id") REFERENCES "public"."kindled"("id") ON DELETE cascade ON UPDATE no action;