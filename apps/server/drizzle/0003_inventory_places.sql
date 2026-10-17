CREATE TABLE "item_stacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kindled_id" uuid NOT NULL,
	"item_id" text NOT NULL,
	"place" text NOT NULL,
	"quantity" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_stacks_quantity_non_negative" CHECK ("item_stacks"."quantity" >= 0)
);
--> statement-breakpoint
DROP INDEX "item_ledger_ref_unique";--> statement-breakpoint
ALTER TABLE "item_ledger" ADD COLUMN "place" text;--> statement-breakpoint
ALTER TABLE "item_stacks" ADD CONSTRAINT "item_stacks_kindled_id_kindled_id_fk" FOREIGN KEY ("kindled_id") REFERENCES "public"."kindled"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "item_stacks_kindled_item_place_unique" ON "item_stacks" USING btree ("kindled_id","item_id","place");--> statement-breakpoint
CREATE UNIQUE INDEX "item_ledger_ref_place_unique" ON "item_ledger" USING btree ("ref","kindled_id","item_id","place") WHERE "item_ledger"."ref" is not null;--> statement-breakpoint
-- M2 Task 3a: Task 2's one balance per Kindled and item moves into places. Currency
-- (sealed-gin, the only currency item when this migration was written) goes to the
-- purse, everything else to the holding store. "items" is retired after this (no
-- code reads or writes it); a later contract migration drops it.
INSERT INTO "item_stacks" ("kindled_id", "item_id", "place", "quantity", "updated_at")
SELECT "kindled_id", "item_id", CASE WHEN "item_id" = 'sealed-gin' THEN 'purse' ELSE 'store' END, "quantity", "updated_at"
FROM "items";
