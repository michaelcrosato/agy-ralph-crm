export async function processSequenceLinkClick(
  // biome-ignore lint/suspicious/noExplicitAny: dynamic store
  dbStore: any,
  orgId: string,
  activityId: string,
  clickedUrl: string,
  currentTime: Date = new Date(),
): Promise<number> {
  const links = (await dbStore.activityLinks.findMany()) as {
    activityId: string;
    orgId: string;
    targetType: "Lead" | "Contact" | "Opportunity" | "Account" | "Campaign";
    targetId: string;
  }[];
  const actLink = links.find(
    (l) =>
      l.activityId === activityId &&
      l.orgId === orgId &&
      (l.targetType.toLowerCase() === "lead" ||
        l.targetType.toLowerCase() === "contact"),
  );
  if (!actLink) return 0;

  const memberships =
    (await dbStore.marketingSequenceMemberships.findMany()) as {
      id: string;
      recordId: string;
      recordType: string;
      orgId: string;
      status: string;
      sequenceId: string;
    }[];
  const recordTypeLower = actLink.targetType.toLowerCase();
  const membership = memberships.find(
    (m) =>
      m.recordId === actLink.targetId &&
      m.recordType === recordTypeLower &&
      m.orgId === orgId &&
      (m.status === "active" || m.status === "completed"),
  );
  if (!membership) return 0;

  // Fetch all activities for this recipient, filter by email type, and sort by ID
  const allActs = (await dbStore.activities.findMany()) as {
    id: string;
    type: string;
    orgId: string;
  }[];
  const recipientActivityIds = new Set(
    links
      .filter(
        (l) =>
          l.targetId === actLink.targetId &&
          l.targetType.toLowerCase() === recordTypeLower &&
          l.orgId === orgId,
      )
      .map((l) => l.activityId),
  );

  const emailActs = allActs.filter(
    (act) =>
      act.type === "email" &&
      act.orgId === orgId &&
      recipientActivityIds.has(act.id),
  );
  emailActs.sort((a, b) => a.id.localeCompare(b.id));

  // Determine which step this is
  const clickedIdx = emailActs.findIndex((act) => act.id === activityId);
  if (clickedIdx === -1) return 0;
  const stepNumber = clickedIdx + 1;

  const steps = (await dbStore.marketingSequenceSteps.findForSequence(
    membership.sequenceId,
  )) as { id: string; stepNumber: number; orgId: string }[];
  const step = steps.find(
    (s) => s.stepNumber === stepNumber && s.orgId === orgId,
  );
  if (!step) return 0;

  const actions = (await dbStore.marketingSequenceLinkActions.findForStep(
    step.id,
  )) as {
    orgId: string;
    targetUrl: string;
    actionType: string;
    actionConfig: {
      field?: string;
      value?: string;
      subject?: string;
      body?: string | null;
      dueDateOffsetDays?: number;
    };
  }[];
  const matchingActions = actions.filter(
    (act) =>
      act.orgId === orgId &&
      (act.targetUrl === clickedUrl || act.targetUrl === "*"),
  );

  let executedCount = 0;
  for (const act of matchingActions) {
    if (act.actionType === "field_update") {
      const field = act.actionConfig?.field;
      const value = act.actionConfig?.value;
      if (field && value !== undefined) {
        if (recordTypeLower === "lead" && dbStore.leads) {
          const lead = await dbStore.leads.findOne(actLink.targetId);
          if (lead) {
            // biome-ignore lint/suspicious/noExplicitAny: casting safe
            const leadAny = lead as any;
            const beforeVal = field.startsWith("custom.")
              ? (leadAny.custom as Record<string, unknown>)?.[
                  field.substring(7)
                ]
              : leadAny[field];

            if (field.startsWith("custom.")) {
              const customField = field.substring(7);
              const newCustom = {
                ...(leadAny.custom || {}),
                [customField]: value,
              };
              await dbStore.leads.update(actLink.targetId, {
                custom: newCustom,
              });
            } else {
              await dbStore.leads.update(actLink.targetId, { [field]: value });
            }

            await dbStore.auditLogs.insert({
              orgId,
              recordId: actLink.targetId,
              recordType: "lead",
              action: "link_trigger_field_update",
              userId: "00000000-0000-0000-0000-000000000000",
              changes: {
                [field]: { before: beforeVal, after: value },
              },
            });
            executedCount++;
          }
        } else if (recordTypeLower === "contact" && dbStore.contacts) {
          const contact = await dbStore.contacts.findOne(actLink.targetId);
          if (contact) {
            // biome-ignore lint/suspicious/noExplicitAny: casting safe
            const contactAny = contact as any;
            const beforeVal = field.startsWith("custom.")
              ? (contactAny.custom as Record<string, unknown>)?.[
                  field.substring(7)
                ]
              : contactAny[field];

            if (field.startsWith("custom.")) {
              const customField = field.substring(7);
              const newCustom = {
                ...(contactAny.custom || {}),
                [customField]: value,
              };
              await dbStore.contacts.update(actLink.targetId, {
                custom: newCustom,
              });
            } else {
              await dbStore.contacts.update(actLink.targetId, {
                [field]: value,
              });
            }

            await dbStore.auditLogs.insert({
              orgId,
              recordId: actLink.targetId,
              recordType: "contact",
              action: "link_trigger_field_update",
              userId: "00000000-0000-0000-0000-000000000000",
              changes: {
                [field]: { before: beforeVal, after: value },
              },
            });
            executedCount++;
          }
        }
      }
    } else if (act.actionType === "create_task") {
      const subject = act.actionConfig?.subject || "Follow up";
      const body = act.actionConfig?.body || null;
      const offsetDays = act.actionConfig?.dueDateOffsetDays || 0;
      const dueDate = new Date(
        currentTime.getTime() + offsetDays * 24 * 60 * 60 * 1000,
      );

      const task = await dbStore.activities.insert({
        orgId,
        creatorId: "00000000-0000-0000-0000-000000000000",
        type: "task",
        subject,
        body,
        dueDate,
        createdAt: currentTime,
      });

      await dbStore.activityLinks.insert({
        orgId,
        activityId: task.id,
        targetType: actLink.targetType,
        targetId: actLink.targetId,
      });

      await dbStore.auditLogs.insert({
        orgId,
        recordId: membership.id,
        recordType: "marketing_sequence_memberships",
        action: "link_trigger_create_task",
        userId: "00000000-0000-0000-0000-000000000000",
        changes: {
          taskId: { before: null, after: task.id },
          subject: { before: null, after: subject },
        },
      });
      executedCount++;
    }
  }

  if (executedCount > 0) {
    await dbStore.auditLogs.insert({
      orgId,
      recordId: membership.id,
      recordType: "marketing_sequence_memberships",
      action: "link_trigger_executed",
      userId: "00000000-0000-0000-0000-000000000000",
      changes: {
        executedActionsCount: { before: 0, after: executedCount },
        clickedUrl: { before: null, after: clickedUrl },
      },
    });
  }

  return executedCount;
}

export async function processSequenceEmailOpen(
  // biome-ignore lint/suspicious/noExplicitAny: dynamic store
  dbStore: any,
  orgId: string,
  activityId: string,
  currentTime: Date = new Date(),
): Promise<number> {
  const links = (await dbStore.activityLinks.findMany()) as {
    activityId: string;
    orgId: string;
    targetType: "Lead" | "Contact" | "Opportunity" | "Account" | "Campaign";
    targetId: string;
  }[];
  const actLink = links.find(
    (l) =>
      l.activityId === activityId &&
      l.orgId === orgId &&
      (l.targetType.toLowerCase() === "lead" ||
        l.targetType.toLowerCase() === "contact"),
  );
  if (!actLink) return 0;

  const memberships =
    (await dbStore.marketingSequenceMemberships.findMany()) as {
      id: string;
      recordId: string;
      recordType: string;
      orgId: string;
      status: string;
      sequenceId: string;
    }[];
  const recordTypeLower = actLink.targetType.toLowerCase();
  const membership = memberships.find(
    (m) =>
      m.recordId === actLink.targetId &&
      m.recordType === recordTypeLower &&
      m.orgId === orgId &&
      (m.status === "active" || m.status === "completed"),
  );
  if (!membership) return 0;

  // Fetch all activities for this recipient, filter by email type, and sort by ID
  const allActs = (await dbStore.activities.findMany()) as {
    id: string;
    type: string;
    orgId: string;
  }[];
  const recipientActivityIds = new Set(
    links
      .filter(
        (l) =>
          l.targetId === actLink.targetId &&
          l.targetType.toLowerCase() === recordTypeLower &&
          l.orgId === orgId,
      )
      .map((l) => l.activityId),
  );

  const emailActs = allActs.filter(
    (act) =>
      act.type === "email" &&
      act.orgId === orgId &&
      recipientActivityIds.has(act.id),
  );
  emailActs.sort((a, b) => a.id.localeCompare(b.id));

  // Determine which step this is
  const clickedIdx = emailActs.findIndex((act) => act.id === activityId);
  if (clickedIdx === -1) return 0;
  const stepNumber = clickedIdx + 1;

  const steps = (await dbStore.marketingSequenceSteps.findForSequence(
    membership.sequenceId,
  )) as { id: string; stepNumber: number; orgId: string }[];
  const step = steps.find(
    (s) => s.stepNumber === stepNumber && s.orgId === orgId,
  );
  if (!step) return 0;

  const actions = (await dbStore.marketingSequenceOpenActions.findForStep(
    step.id,
  )) as {
    orgId: string;
    actionType: string;
    actionConfig: {
      field?: string;
      value?: string;
      subject?: string;
      body?: string | null;
      dueDateOffsetDays?: number;
    };
  }[];
  const matchingActions = actions.filter((act) => act.orgId === orgId);

  let executedCount = 0;
  for (const act of matchingActions) {
    if (act.actionType === "field_update") {
      const field = act.actionConfig?.field;
      const value = act.actionConfig?.value;
      if (field && value !== undefined) {
        if (recordTypeLower === "lead" && dbStore.leads) {
          const lead = await dbStore.leads.findOne(actLink.targetId);
          if (lead) {
            // biome-ignore lint/suspicious/noExplicitAny: casting safe
            const leadAny = lead as any;
            const beforeVal = field.startsWith("custom.")
              ? (leadAny.custom as Record<string, unknown>)?.[
                  field.substring(7)
                ]
              : leadAny[field];

            if (field.startsWith("custom.")) {
              const customField = field.substring(7);
              const newCustom = {
                ...(leadAny.custom || {}),
                [customField]: value,
              };
              await dbStore.leads.update(actLink.targetId, {
                custom: newCustom,
              });
            } else {
              await dbStore.leads.update(actLink.targetId, { [field]: value });
            }

            await dbStore.auditLogs.insert({
              orgId,
              recordId: actLink.targetId,
              recordType: "lead",
              action: "open_trigger_field_update",
              userId: "00000000-0000-0000-0000-000000000000",
              changes: {
                [field]: { before: beforeVal, after: value },
              },
            });
            executedCount++;
          }
        } else if (recordTypeLower === "contact" && dbStore.contacts) {
          const contact = await dbStore.contacts.findOne(actLink.targetId);
          if (contact) {
            // biome-ignore lint/suspicious/noExplicitAny: casting safe
            const contactAny = contact as any;
            const beforeVal = field.startsWith("custom.")
              ? (contactAny.custom as Record<string, unknown>)?.[
                  field.substring(7)
                ]
              : contactAny[field];

            if (field.startsWith("custom.")) {
              const customField = field.substring(7);
              const newCustom = {
                ...(contactAny.custom || {}),
                [customField]: value,
              };
              await dbStore.contacts.update(actLink.targetId, {
                custom: newCustom,
              });
            } else {
              await dbStore.contacts.update(actLink.targetId, {
                [field]: value,
              });
            }

            await dbStore.auditLogs.insert({
              orgId,
              recordId: actLink.targetId,
              recordType: "contact",
              action: "open_trigger_field_update",
              userId: "00000000-0000-0000-0000-000000000000",
              changes: {
                [field]: { before: beforeVal, after: value },
              },
            });
            executedCount++;
          }
        }
      }
    } else if (act.actionType === "create_task") {
      const subject = act.actionConfig?.subject || "Follow up";
      const body = act.actionConfig?.body || null;
      const offsetDays = act.actionConfig?.dueDateOffsetDays || 0;
      const dueDate = new Date(
        currentTime.getTime() + offsetDays * 24 * 60 * 60 * 1000,
      );

      const task = await dbStore.activities.insert({
        orgId,
        creatorId: "00000000-0000-0000-0000-000000000000",
        type: "task",
        subject,
        body,
        dueDate,
        createdAt: currentTime,
      });

      await dbStore.activityLinks.insert({
        orgId,
        activityId: task.id,
        targetType: actLink.targetType,
        targetId: actLink.targetId,
      });

      await dbStore.auditLogs.insert({
        orgId,
        recordId: membership.id,
        recordType: "marketing_sequence_memberships",
        action: "open_trigger_create_task",
        userId: "00000000-0000-0000-0000-000000000000",
        changes: {
          taskId: { before: null, after: task.id },
          subject: { before: null, after: subject },
        },
      });
      executedCount++;
    }
  }

  if (executedCount > 0) {
    await dbStore.auditLogs.insert({
      orgId,
      recordId: membership.id,
      recordType: "marketing_sequence_memberships",
      action: "open_trigger_executed",
      userId: "00000000-0000-0000-0000-000000000000",
      changes: {
        executedActionsCount: { before: 0, after: executedCount },
      },
    });
  }

  return executedCount;
}

export async function processSequenceEmailReply(
  // biome-ignore lint/suspicious/noExplicitAny: dynamic store
  dbStore: any,
  orgId: string,
  activityId: string,
  currentTime: Date = new Date(),
): Promise<number> {
  const links = (await dbStore.activityLinks.findMany()) as {
    activityId: string;
    orgId: string;
    targetType: "Lead" | "Contact" | "Opportunity" | "Account" | "Campaign";
    targetId: string;
  }[];
  const actLink = links.find(
    (l) =>
      l.activityId === activityId &&
      l.orgId === orgId &&
      (l.targetType.toLowerCase() === "lead" ||
        l.targetType.toLowerCase() === "contact"),
  );
  if (!actLink) return 0;

  const memberships =
    (await dbStore.marketingSequenceMemberships.findMany()) as {
      id: string;
      recordId: string;
      recordType: string;
      orgId: string;
      status: string;
      sequenceId: string;
    }[];
  const recordTypeLower = actLink.targetType.toLowerCase();
  const membership = memberships.find(
    (m) =>
      m.recordId === actLink.targetId &&
      m.recordType === recordTypeLower &&
      m.orgId === orgId &&
      (m.status === "active" || m.status === "completed"),
  );
  if (!membership) return 0;

  // Auto-complete the membership when they reply!
  const oldStatus = membership.status;
  if (oldStatus !== "completed") {
    await dbStore.marketingSequenceMemberships.update(membership.id, {
      status: "completed",
    });

    await dbStore.auditLogs.insert({
      orgId,
      recordId: membership.id,
      recordType: "marketing_sequence_memberships",
      action: "membership_auto_completed_on_reply",
      userId: "00000000-0000-0000-0000-000000000000",
      changes: {
        status: { before: oldStatus, after: "completed" },
      },
    });
  }

  // Fetch all activities for this recipient, filter by email type, and sort by ID
  const allActs = (await dbStore.activities.findMany()) as {
    id: string;
    type: string;
    orgId: string;
  }[];
  const recipientActivityIds = new Set(
    links
      .filter(
        (l) =>
          l.targetId === actLink.targetId &&
          l.targetType.toLowerCase() === recordTypeLower &&
          l.orgId === orgId,
      )
      .map((l) => l.activityId),
  );

  const emailActs = allActs.filter(
    (act) =>
      act.type === "email" &&
      act.orgId === orgId &&
      recipientActivityIds.has(act.id),
  );
  emailActs.sort((a, b) => a.id.localeCompare(b.id));

  // Determine which step this is
  const clickedIdx = emailActs.findIndex((act) => act.id === activityId);
  if (clickedIdx === -1) return 0;
  const stepNumber = clickedIdx + 1;

  const steps = (await dbStore.marketingSequenceSteps.findForSequence(
    membership.sequenceId,
  )) as { id: string; stepNumber: number; orgId: string }[];
  const step = steps.find(
    (s) => s.stepNumber === stepNumber && s.orgId === orgId,
  );
  if (!step) return 0;

  const actions = (await dbStore.marketingSequenceReplyActions.findForStep(
    step.id,
  )) as {
    orgId: string;
    actionType: string;
    actionConfig: {
      field?: string;
      value?: string;
      subject?: string;
      body?: string | null;
      dueDateOffsetDays?: number;
    };
  }[];
  const matchingActions = actions.filter((act) => act.orgId === orgId);

  let executedCount = 0;
  for (const act of matchingActions) {
    if (act.actionType === "field_update") {
      const field = act.actionConfig?.field;
      const value = act.actionConfig?.value;
      if (field && value !== undefined) {
        if (recordTypeLower === "lead" && dbStore.leads) {
          const lead = await dbStore.leads.findOne(actLink.targetId);
          if (lead) {
            // biome-ignore lint/suspicious/noExplicitAny: casting safe
            const leadAny = lead as any;
            const beforeVal = field.startsWith("custom.")
              ? (leadAny.custom as Record<string, unknown>)?.[
                  field.substring(7)
                ]
              : leadAny[field];

            if (field.startsWith("custom.")) {
              const customField = field.substring(7);
              const newCustom = {
                ...(leadAny.custom || {}),
                [customField]: value,
              };
              await dbStore.leads.update(actLink.targetId, {
                custom: newCustom,
              });
            } else {
              await dbStore.leads.update(actLink.targetId, { [field]: value });
            }

            await dbStore.auditLogs.insert({
              orgId,
              recordId: actLink.targetId,
              recordType: "lead",
              action: "reply_trigger_field_update",
              userId: "00000000-0000-0000-0000-000000000000",
              changes: {
                [field]: { before: beforeVal, after: value },
              },
            });
            executedCount++;
          }
        } else if (recordTypeLower === "contact" && dbStore.contacts) {
          const contact = await dbStore.contacts.findOne(actLink.targetId);
          if (contact) {
            // biome-ignore lint/suspicious/noExplicitAny: casting safe
            const contactAny = contact as any;
            const beforeVal = field.startsWith("custom.")
              ? (contactAny.custom as Record<string, unknown>)?.[
                  field.substring(7)
                ]
              : contactAny[field];

            if (field.startsWith("custom.")) {
              const customField = field.substring(7);
              const newCustom = {
                ...(contactAny.custom || {}),
                [customField]: value,
              };
              await dbStore.contacts.update(actLink.targetId, {
                custom: newCustom,
              });
            } else {
              await dbStore.contacts.update(actLink.targetId, {
                [field]: value,
              });
            }

            await dbStore.auditLogs.insert({
              orgId,
              recordId: actLink.targetId,
              recordType: "contact",
              action: "reply_trigger_field_update",
              userId: "00000000-0000-0000-0000-000000000000",
              changes: {
                [field]: { before: beforeVal, after: value },
              },
            });
            executedCount++;
          }
        }
      }
    } else if (act.actionType === "create_task") {
      const subject = act.actionConfig?.subject || "Follow up on Reply";
      const body = act.actionConfig?.body || null;
      const offsetDays = act.actionConfig?.dueDateOffsetDays || 0;
      const dueDate = new Date(
        currentTime.getTime() + offsetDays * 24 * 60 * 60 * 1000,
      );

      const task = await dbStore.activities.insert({
        orgId,
        creatorId: "00000000-0000-0000-0000-000000000000",
        type: "task",
        subject,
        body,
        dueDate,
        createdAt: currentTime,
      });

      await dbStore.activityLinks.insert({
        orgId,
        activityId: task.id,
        targetType: actLink.targetType,
        targetId: actLink.targetId,
      });

      await dbStore.auditLogs.insert({
        orgId,
        recordId: membership.id,
        recordType: "marketing_sequence_memberships",
        action: "reply_trigger_create_task",
        userId: "00000000-0000-0000-0000-000000000000",
        changes: {
          taskId: { before: null, after: task.id },
          subject: { before: null, after: subject },
        },
      });
      executedCount++;
    }
  }

  if (executedCount > 0) {
    await dbStore.auditLogs.insert({
      orgId,
      recordId: membership.id,
      recordType: "marketing_sequence_memberships",
      action: "reply_trigger_executed",
      userId: "00000000-0000-0000-0000-000000000000",
      changes: {
        executedActionsCount: { before: 0, after: executedCount },
      },
    });
  }

  return executedCount;
}
