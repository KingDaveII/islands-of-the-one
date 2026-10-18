CREATE TABLE "holding_activity" (
	"kindled_id" uuid PRIMARY KEY NOT NULL,
	"station_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"credited_cycles" integer DEFAULT 0 NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_xp" (
	"kindled_id" uuid NOT NULL,
	"skill" text NOT NULL,
	"xp" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "skill_xp_kindled_id_skill_pk" PRIMARY KEY("kindled_id","skill")
);
--> statement-breakpoint
ALTER TABLE "holding_activity" ADD CONSTRAINT "holding_activity_kindled_id_kindled_id_fk" FOREIGN KEY ("kindled_id") REFERENCES "public"."kindled"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_xp" ADD CONSTRAINT "skill_xp_kindled_id_kindled_id_fk" FOREIGN KEY ("kindled_id") REFERENCES "public"."kindled"("id") ON DELETE cascade ON UPDATE no action;