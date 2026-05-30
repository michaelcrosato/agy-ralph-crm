CREATE TABLE "custom_entity_records" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"type_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_entity_types" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"fields_json" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custom_entity_records" ADD CONSTRAINT "custom_entity_records_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_entity_records" ADD CONSTRAINT "custom_entity_records_type_id_custom_entity_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."custom_entity_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_entity_types" ADD CONSTRAINT "custom_entity_types_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_custom_entity_records_org_type" ON "custom_entity_records" USING btree ("org_id","type_id");--> statement-breakpoint
CREATE INDEX "idx_custom_entity_records_created" ON "custom_entity_records" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_custom_entity_types_org_name" ON "custom_entity_types" USING btree ("org_id","name");