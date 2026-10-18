CREATE TABLE "writs" (
	"kindled_id" uuid PRIMARY KEY NOT NULL,
	"name" text,
	"letters" text,
	"certified" boolean DEFAULT false NOT NULL,
	"empty_at" timestamp with time zone NOT NULL,
	"lines" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "writs" ADD CONSTRAINT "writs_kindled_id_kindled_id_fk" FOREIGN KEY ("kindled_id") REFERENCES "public"."kindled"("id") ON DELETE cascade ON UPDATE no action;