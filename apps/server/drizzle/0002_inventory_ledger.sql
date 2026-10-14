CREATE TABLE "item_ledger" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "item_ledger_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"kindled_id" uuid NOT NULL,
	"item_id" text NOT NULL,
	"delta" bigint NOT NULL,
	"balance_after" bigint NOT NULL,
	"reason" text NOT NULL,
	"ref" text,
	"telling_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_ledger_delta_non_zero" CHECK ("item_ledger"."delta" <> 0),
	CONSTRAINT "item_ledger_balance_non_negative" CHECK ("item_ledger"."balance_after" >= 0)
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kindled_id" uuid NOT NULL,
	"item_id" text NOT NULL,
	"quantity" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "items_quantity_non_negative" CHECK ("items"."quantity" >= 0)
);
--> statement-breakpoint
ALTER TABLE "item_ledger" ADD CONSTRAINT "item_ledger_kindled_id_kindled_id_fk" FOREIGN KEY ("kindled_id") REFERENCES "public"."kindled"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_kindled_id_kindled_id_fk" FOREIGN KEY ("kindled_id") REFERENCES "public"."kindled"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "item_ledger_kindled_idx" ON "item_ledger" USING btree ("kindled_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "item_ledger_ref_unique" ON "item_ledger" USING btree ("ref","kindled_id","item_id") WHERE "item_ledger"."ref" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "items_kindled_item_unique" ON "items" USING btree ("kindled_id","item_id");