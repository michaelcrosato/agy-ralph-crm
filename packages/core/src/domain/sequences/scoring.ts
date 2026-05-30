export async function processSequenceMembershipScoreTriggers(
  // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic reference
  db: any,
  orgId: string,
  membershipId: string,
): Promise<{ triggeredCount: number; executedActions: string[] }> {
  const membership =
    await db.marketingSequenceMemberships.findOne(membershipId);
  if (membership?.status !== "active") {
    return { triggeredCount: 0, executedActions: [] };
  }

  const triggers = await db.marketingSequenceScoreTriggers.findForSequence(
    membership.sequenceId,
  );
  const currentScore = membership.engagementScore ?? 0;

  const executedActions: string[] = [];
  let triggeredCount = 0;

  for (const trigger of triggers) {
    if (currentScore >= trigger.scoreThreshold) {
      triggeredCount++;
      const actionType = trigger.actionType;

      if (actionType === "change_lead_status") {
        if (membership.recordType === "lead") {
          const lead = await db.leads.findOne(membership.recordId);
          const targetStatus = trigger.actionConfig.status || "Qualified";
          if (lead && lead.status !== targetStatus) {
            await db.leads.update(membership.recordId, {
              status: targetStatus,
            });
            executedActions.push(`change_lead_status:${targetStatus}`);
          }
        }
      } else if (actionType === "auto_exit") {
        if (membership.status === "active") {
          await db.marketingSequenceMemberships.update(membershipId, {
            status: "completed",
          });
          executedActions.push("auto_exit");
        }
      } else if (actionType === "notify_owner") {
        let ownerId = "system";
        let targetType: "Lead" | "Contact" = "Lead";
        if (membership.recordType === "lead") {
          const lead = await db.leads.findOne(membership.recordId);
          if (lead) ownerId = lead.ownerId;
          targetType = "Lead";
        } else {
          const contact = await db.contacts.findOne(membership.recordId);
          if (contact) ownerId = contact.ownerId;
          targetType = "Contact";
        }

        const subject =
          trigger.actionConfig.subject || "[High Engagement] Follow up needed";
        const body =
          trigger.actionConfig.body ||
          `Recipient has reached score ${currentScore}.`;

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 1);

        const task = await db.activities.insert({
          orgId,
          creatorId: "system",
          type: "task",
          subject,
          body,
          dueDate,
        });

        await db.activityLinks.insert({
          orgId,
          activityId: task.id,
          targetType,
          targetId: membership.recordId,
        });

        executedActions.push(`notify_owner:${ownerId}`);
      }
    }
  }

  return { triggeredCount, executedActions };
}
