CREATE INDEX "idx_email_trackers_org_created" ON "email_trackers" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_email_trackers_activity" ON "email_trackers" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "idx_seq_members_org_created" ON "marketing_sequence_memberships" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_seq_members_org_seq" ON "marketing_sequence_memberships" USING btree ("org_id","sequence_id");--> statement-breakpoint
CREATE INDEX "idx_seq_members_record" ON "marketing_sequence_memberships" USING btree ("record_type","record_id");--> statement-breakpoint
CREATE INDEX "idx_seq_steps_org_created" ON "marketing_sequence_steps" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_seq_steps_org_seq" ON "marketing_sequence_steps" USING btree ("org_id","sequence_id");--> statement-breakpoint
CREATE INDEX "idx_tickets_org_created" ON "tickets" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_tickets_org_status" ON "tickets" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "idx_tickets_org_priority" ON "tickets" USING btree ("org_id","priority");--> statement-breakpoint
CREATE INDEX "idx_tickets_assigned" ON "tickets" USING btree ("assigned_to_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_outbox_org_created" ON "webhook_outbox" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_webhook_outbox_pending" ON "webhook_outbox" USING btree ("status") WHERE status = 'pending';