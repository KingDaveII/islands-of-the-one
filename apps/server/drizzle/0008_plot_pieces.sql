CREATE TABLE "plot_pieces" (
	"kindled_id" uuid NOT NULL,
	"plot_id" text NOT NULL,
	"piece_id" text NOT NULL,
	"col" integer NOT NULL,
	"row" integer NOT NULL,
	"rotation" integer DEFAULT 0 NOT NULL,
	"built_at" timestamp with time zone NOT NULL,
	CONSTRAINT "plot_pieces_kindled_id_plot_id_piece_id_pk" PRIMARY KEY("kindled_id","plot_id","piece_id")
);
--> statement-breakpoint
ALTER TABLE "plot_pieces" ADD CONSTRAINT "plot_pieces_kindled_id_kindled_id_fk" FOREIGN KEY ("kindled_id") REFERENCES "public"."kindled"("id") ON DELETE cascade ON UPDATE no action;