import type { ActivityLogEntry, EventRecord } from "../../types";

export async function cloneMarketingSequence(
  // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic reference
  dbStore: any,
  sequenceId: string,
  newName: string,
  orgId: string,
  // biome-ignore lint/suspicious/noExplicitAny: returned cloned object
): Promise<any> {
  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    throw new Error("Sequence not found");
  }
  if (sequence.orgId !== orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }

  const clonedSequence = await dbStore.marketingSequences.insert({
    orgId,
    name: newName,
    description: sequence.description,
    status: "draft",
    sendingWindowStart: sequence.sendingWindowStart || null,
    sendingWindowEnd: sequence.sendingWindowEnd || null,
    sendingDays: sequence.sendingDays || null,
    allowReenrollment: sequence.allowReenrollment || false,
    reenrollmentMinDays: sequence.reenrollmentMinDays || null,
    dailySendLimit: sequence.dailySendLimit || null,
    senderType: sequence.senderType || "system",
    senderUserId: sequence.senderUserId || null,
    folderId: sequence.folderId || null,
  });

  const steps =
    await dbStore.marketingSequenceSteps.findForSequence(sequenceId);
  steps.sort(
    (a: { stepNumber: number }, b: { stepNumber: number }) =>
      a.stepNumber - b.stepNumber,
  );

  for (const step of steps) {
    const clonedStep = await dbStore.marketingSequenceSteps.insert({
      orgId,
      sequenceId: clonedSequence.id,
      stepNumber: step.stepNumber,
      delayDays: step.delayDays,
      templateId: step.templateId,
      waitCondition: step.waitCondition || null,
      replyToStepNumber: step.replyToStepNumber || null,
    });

    if (dbStore.marketingSequenceStepBranches) {
      const branch = await dbStore.marketingSequenceStepBranches.findForStep(
        step.id,
      );
      if (branch) {
        await dbStore.marketingSequenceStepBranches.insert({
          orgId,
          stepId: clonedStep.id,
          branchType: branch.branchType,
          evaluationWindowDays: branch.evaluationWindowDays,
          trueNextStepNumber: branch.trueNextStepNumber,
          falseNextStepNumber: branch.falseNextStepNumber,
        });
      }
    }

    if (dbStore.marketingSequenceStepSplitTests) {
      const st = await dbStore.marketingSequenceStepSplitTests.findForStep(
        step.id,
      );
      if (st) {
        await dbStore.marketingSequenceStepSplitTests.insert({
          orgId,
          stepId: clonedStep.id,
          variantTemplateId: st.variantTemplateId,
          splitWeight: st.splitWeight,
          isActive: st.isActive,
          autoPromoteWinner: st.autoPromoteWinner,
          minSendsToEvaluate: st.minSendsToEvaluate,
          evaluationMetric: st.evaluationMetric,
        });
      }
    }

    if (dbStore.marketingSequenceLinkActions) {
      const linkActions =
        await dbStore.marketingSequenceLinkActions.findForStep(step.id);
      for (const la of linkActions) {
        await dbStore.marketingSequenceLinkActions.insert({
          orgId,
          stepId: clonedStep.id,
          targetUrl: la.targetUrl,
          actionType: la.actionType,
          actionConfig: la.actionConfig,
        });
      }
    }

    if (dbStore.marketingSequenceOpenActions) {
      const openActions =
        await dbStore.marketingSequenceOpenActions.findForStep(step.id);
      for (const oa of openActions) {
        await dbStore.marketingSequenceOpenActions.insert({
          orgId,
          stepId: clonedStep.id,
          actionType: oa.actionType,
          actionConfig: oa.actionConfig,
        });
      }
    }

    if (dbStore.marketingSequenceReplyActions) {
      const replyActions =
        await dbStore.marketingSequenceReplyActions.findForStep(step.id);
      for (const ra of replyActions) {
        await dbStore.marketingSequenceReplyActions.insert({
          orgId,
          stepId: clonedStep.id,
          actionType: ra.actionType,
          actionConfig: ra.actionConfig,
        });
      }
    }
  }

  if (dbStore.marketingSequenceExitTriggers) {
    const exitTriggers =
      await dbStore.marketingSequenceExitTriggers.findForSequence(sequenceId);
    for (const et of exitTriggers) {
      await dbStore.marketingSequenceExitTriggers.insert({
        orgId,
        sequenceId: clonedSequence.id,
        triggerType: et.triggerType,
        criteria: et.criteria,
        isActive: et.isActive,
      });
    }
  }

  if (dbStore.marketingSequenceTagMappings) {
    const mappings =
      await dbStore.marketingSequenceTagMappings.findForSequence(sequenceId);
    for (const m of mappings) {
      await dbStore.marketingSequenceTagMappings.insert({
        orgId,
        sequenceId: clonedSequence.id,
        tagId: m.tagId,
      });
    }
  }

  return clonedSequence;
}

export async function archiveMarketingSequence(
  // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic reference
  dbStore: any,
  sequenceId: string,
  orgId: string,
  // biome-ignore lint/suspicious/noExplicitAny: returned updated object
): Promise<any> {
  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    throw new Error("Sequence not found");
  }
  if (sequence.orgId !== orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }

  const updatedSequence = await dbStore.marketingSequences.update(sequenceId, {
    status: "archived",
  });

  if (dbStore.marketingSequenceMemberships?.findMany) {
    const memberships = await dbStore.marketingSequenceMemberships.findMany();
    const seqMemberships = memberships.filter(
      // biome-ignore lint/suspicious/noExplicitAny: membership dynamic typing
      (m: any) => m.sequenceId === sequenceId && m.orgId === orgId,
    );
    for (const m of seqMemberships) {
      if (m.status === "active" || m.status === "paused") {
        await dbStore.marketingSequenceMemberships.update(m.id, {
          status: "completed",
        });
      }
    }
  }

  return updatedSequence;
}

export async function purgeMarketingSequence(
  // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic reference
  dbStore: any,
  sequenceId: string,
  orgId: string,
): Promise<boolean> {
  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    throw new Error("Sequence not found");
  }
  if (sequence.orgId !== orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }
  if (sequence.status !== "archived") {
    throw new Error("Only archived sequences can be purged");
  }

  // 1. Delete all step-level children and the steps themselves
  if (dbStore.marketingSequenceSteps) {
    const steps =
      await dbStore.marketingSequenceSteps.findForSequence(sequenceId);
    for (const step of steps) {
      // Branches
      if (dbStore.marketingSequenceStepBranches) {
        const branch = await dbStore.marketingSequenceStepBranches.findForStep(
          step.id,
        );
        if (branch) {
          await dbStore.marketingSequenceStepBranches.delete(branch.id);
        }
      }
      // Split Tests
      if (dbStore.marketingSequenceStepSplitTests) {
        const st = await dbStore.marketingSequenceStepSplitTests.findForStep(
          step.id,
        );
        if (st) {
          await dbStore.marketingSequenceStepSplitTests.delete(st.id);
        }
      }
      // Open Actions
      if (dbStore.marketingSequenceOpenActions) {
        const openActions =
          await dbStore.marketingSequenceOpenActions.findForStep(step.id);
        for (const oa of openActions) {
          await dbStore.marketingSequenceOpenActions.delete(oa.id);
        }
      }
      // Reply Actions
      if (dbStore.marketingSequenceReplyActions) {
        const replyActions =
          await dbStore.marketingSequenceReplyActions.findForStep(step.id);
        for (const ra of replyActions) {
          await dbStore.marketingSequenceReplyActions.delete(ra.id);
        }
      }
      // Link Actions
      if (dbStore.marketingSequenceLinkActions) {
        const linkActions =
          await dbStore.marketingSequenceLinkActions.findForStep(step.id);
        for (const la of linkActions) {
          await dbStore.marketingSequenceLinkActions.delete(la.id);
        }
      }
      // Step itself
      await dbStore.marketingSequenceSteps.delete(step.id);
    }
  }

  // 2. Exit triggers
  if (dbStore.marketingSequenceExitTriggers) {
    const exitTriggers =
      await dbStore.marketingSequenceExitTriggers.findForSequence(sequenceId);
    for (const et of exitTriggers) {
      await dbStore.marketingSequenceExitTriggers.delete(et.id);
    }
  }

  // 3. Tag mappings
  if (dbStore.marketingSequenceTagMappings) {
    const mappings =
      await dbStore.marketingSequenceTagMappings.findForSequence(sequenceId);
    for (const m of mappings) {
      await dbStore.marketingSequenceTagMappings.delete(m.id);
    }
  }

  // 4. Memberships
  if (dbStore.marketingSequenceMemberships?.findMany) {
    const memberships = await dbStore.marketingSequenceMemberships.findMany();
    const seqMemberships = memberships.filter(
      // biome-ignore lint/suspicious/noExplicitAny: membership dynamic typing
      (m: any) => m.sequenceId === sequenceId && m.orgId === orgId,
    );
    for (const m of seqMemberships) {
      await dbStore.marketingSequenceMemberships.delete(m.id);
    }
  }

  // 5. Sequence itself
  await dbStore.marketingSequences.delete(sequenceId);

  return true;
}

export async function pauseMarketingSequence(
  // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic reference
  dbStore: any,
  sequenceId: string,
  orgId: string,
  // biome-ignore lint/suspicious/noExplicitAny: returned updated object
): Promise<any> {
  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    throw new Error("Sequence not found");
  }
  if (sequence.orgId !== orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }
  if (sequence.status !== "active") {
    throw new Error("Only active sequences can be paused");
  }

  const updatedSequence = await dbStore.marketingSequences.update(sequenceId, {
    status: "paused",
  });

  return updatedSequence;
}

export async function resumeMarketingSequence(
  // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic reference
  dbStore: any,
  sequenceId: string,
  orgId: string,
  // biome-ignore lint/suspicious/noExplicitAny: returned updated object
): Promise<any> {
  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    throw new Error("Sequence not found");
  }
  if (sequence.orgId !== orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }
  if (sequence.status !== "paused") {
    throw new Error("Only paused sequences can be resumed");
  }

  const updatedSequence = await dbStore.marketingSequences.update(sequenceId, {
    status: "active",
  });

  return updatedSequence;
}

export async function reorderMarketingSequenceSteps(
  // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic reference
  dbStore: any,
  sequenceId: string,
  stepId: string,
  newStepNumber: number,
  orgId: string,
  // biome-ignore lint/suspicious/noExplicitAny: returned updated steps
): Promise<any[]> {
  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    throw new Error("Sequence not found");
  }
  if (sequence.orgId !== orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }

  const steps =
    await dbStore.marketingSequenceSteps.findForSequence(sequenceId);
  const stepToMove = steps.find((s: { id: string }) => s.id === stepId);
  if (!stepToMove) {
    throw new Error("Step not found");
  }
  for (const s of steps) {
    if (s.orgId !== orgId) {
      throw new Error("RLS Isolation Violation: Tenant mismatch.");
    }
  }

  steps.sort(
    (a: { stepNumber: number }, b: { stepNumber: number }) =>
      a.stepNumber - b.stepNumber,
  );

  const N = steps.length;
  if (newStepNumber < 1 || newStepNumber > N) {
    throw new Error(`Invalid newStepNumber. Must be between 1 and ${N}`);
  }

  const oldNum = stepToMove.stepNumber;
  if (oldNum === newStepNumber) {
    return steps;
  }

  const oldNumToNewNum = new Map<number, number>();
  const idToNewNum = new Map<string, number>();

  for (const step of steps) {
    let newNum = step.stepNumber;
    if (step.id === stepId) {
      newNum = newStepNumber;
    } else if (oldNum > newStepNumber) {
      // Moving up/earlier
      if (step.stepNumber >= newStepNumber && step.stepNumber < oldNum) {
        newNum = step.stepNumber + 1;
      }
    } else if (oldNum < newStepNumber) {
      // Moving down/later
      if (step.stepNumber > oldNum && step.stepNumber <= newStepNumber) {
        newNum = step.stepNumber - 1;
      }
    }
    oldNumToNewNum.set(step.stepNumber, newNum);
    idToNewNum.set(step.id, newNum);
  }

  // Update step_number and reply_to_step_number
  for (const step of steps) {
    const updatedStepNumber = idToNewNum.get(step.id) || step.stepNumber;
    let updatedReplyTo = step.replyToStepNumber;
    if (step.replyToStepNumber) {
      updatedReplyTo =
        oldNumToNewNum.get(step.replyToStepNumber) || step.replyToStepNumber;
    }

    await dbStore.marketingSequenceSteps.update(step.id, {
      stepNumber: updatedStepNumber,
      replyToStepNumber: updatedReplyTo || null,
    });
  }

  // Update step branches if they exist
  if (dbStore.marketingSequenceStepBranches) {
    for (const step of steps) {
      const branch = await dbStore.marketingSequenceStepBranches.findForStep(
        step.id,
      );
      if (branch) {
        const updatedTrue =
          oldNumToNewNum.get(branch.trueNextStepNumber) ||
          branch.trueNextStepNumber;
        const updatedFalse =
          oldNumToNewNum.get(branch.falseNextStepNumber) ||
          branch.falseNextStepNumber;
        await dbStore.marketingSequenceStepBranches.update(branch.id, {
          trueNextStepNumber: updatedTrue,
          falseNextStepNumber: updatedFalse,
        });
      }
    }
  }

  const updatedSteps =
    await dbStore.marketingSequenceSteps.findForSequence(sequenceId);
  updatedSteps.sort(
    (a: { stepNumber: number }, b: { stepNumber: number }) =>
      a.stepNumber - b.stepNumber,
  );
  return updatedSteps;
}

export async function deleteMarketingSequenceStep(
  // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic reference
  dbStore: any,
  sequenceId: string,
  stepId: string,
  orgId: string,
  // biome-ignore lint/suspicious/noExplicitAny: returned updated steps
): Promise<any[]> {
  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    throw new Error("Sequence not found");
  }
  if (sequence.orgId !== orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }

  const steps =
    await dbStore.marketingSequenceSteps.findForSequence(sequenceId);
  const stepToDelete = steps.find((s: { id: string }) => s.id === stepId);
  if (!stepToDelete) {
    throw new Error("Step not found");
  }
  for (const s of steps) {
    if (s.orgId !== orgId) {
      throw new Error("RLS Isolation Violation: Tenant mismatch.");
    }
  }

  const deletedNum = stepToDelete.stepNumber;

  // 1. Delete step branches configuration if it exists
  if (dbStore.marketingSequenceStepBranches) {
    const branch =
      await dbStore.marketingSequenceStepBranches.findForStep(stepId);
    if (branch) {
      await dbStore.marketingSequenceStepBranches.delete(branch.id);
    }
  }

  // 2. Delete the step record
  await dbStore.marketingSequenceSteps.delete(stepId);

  // Remaining steps
  const remainingSteps = steps.filter((s: { id: string }) => s.id !== stepId);

  // 3. Shift remaining steps stepNumber and replyToStepNumber
  for (const step of remainingSteps) {
    let updatedStepNumber = step.stepNumber;
    if (step.stepNumber > deletedNum) {
      updatedStepNumber = step.stepNumber - 1;
    }

    let updatedReplyTo = step.replyToStepNumber;
    if (step.replyToStepNumber) {
      if (step.replyToStepNumber === deletedNum) {
        updatedReplyTo = null;
      } else if (step.replyToStepNumber > deletedNum) {
        updatedReplyTo = step.replyToStepNumber - 1;
      }
    }

    await dbStore.marketingSequenceSteps.update(step.id, {
      stepNumber: updatedStepNumber,
      replyToStepNumber: updatedReplyTo || null,
    });
  }

  // 4. Shift branch next step numbers on other steps
  if (dbStore.marketingSequenceStepBranches) {
    for (const step of remainingSteps) {
      const branch = await dbStore.marketingSequenceStepBranches.findForStep(
        step.id,
      );
      if (branch) {
        let updatedTrue = branch.trueNextStepNumber;
        if (branch.trueNextStepNumber) {
          if (branch.trueNextStepNumber === deletedNum) {
            updatedTrue = null;
          } else if (branch.trueNextStepNumber > deletedNum) {
            updatedTrue = branch.trueNextStepNumber - 1;
          }
        }

        let updatedFalse = branch.falseNextStepNumber;
        if (branch.falseNextStepNumber) {
          if (branch.falseNextStepNumber === deletedNum) {
            updatedFalse = null;
          } else if (branch.falseNextStepNumber > deletedNum) {
            updatedFalse = branch.falseNextStepNumber - 1;
          }
        }

        await dbStore.marketingSequenceStepBranches.update(branch.id, {
          trueNextStepNumber: updatedTrue,
          falseNextStepNumber: updatedFalse,
        });
      }
    }
  }

  const updatedSteps =
    await dbStore.marketingSequenceSteps.findForSequence(sequenceId);
  updatedSteps.sort(
    (a: { stepNumber: number }, b: { stepNumber: number }) =>
      a.stepNumber - b.stepNumber,
  );
  return updatedSteps;
}

export async function getMarketingSequenceMemberLogs(
  // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic reference
  dbStore: any,
  sequenceId: string,
  memberId: string,
  orgId: string,
): Promise<ActivityLogEntry[]> {
  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    throw new Error("Sequence not found");
  }
  if (sequence.orgId !== orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }

  const member = await dbStore.marketingSequenceMemberships.findOne(memberId);
  if (!member) {
    throw new Error("Membership not found");
  }
  if (member.orgId !== orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }
  if (member.sequenceId !== sequenceId) {
    throw new Error("Membership does not belong to this sequence");
  }

  const trackers = await dbStore.emailTrackers.findMany();
  const memberTrackers = trackers.filter(
    (t: { orgId: string; activityId: string; id: string }) =>
      t.orgId === orgId && t.activityId === memberId,
  );

  if (memberTrackers.length === 0) {
    return [];
  }

  const trackerIds = memberTrackers.map((t: { id: string }) => t.id);

  const [opens, clicks, replies, bounces, readTimes] = await Promise.all([
    dbStore.emailOpenEvents
      .findMany()
      .then((list: EventRecord[]) =>
        list.filter(
          (e) => e.orgId === orgId && trackerIds.includes(e.trackerId),
        ),
      ),
    dbStore.emailClickEvents
      .findMany()
      .then((list: EventRecord[]) =>
        list.filter(
          (e) => e.orgId === orgId && trackerIds.includes(e.trackerId),
        ),
      ),
    dbStore.emailReplyEvents
      .findMany()
      .then((list: EventRecord[]) =>
        list.filter(
          (e) => e.orgId === orgId && trackerIds.includes(e.trackerId),
        ),
      ),
    dbStore.emailBounceEvents
      .findMany()
      .then((list: EventRecord[]) =>
        list.filter(
          (e) => e.orgId === orgId && trackerIds.includes(e.trackerId),
        ),
      ),
    dbStore.emailReadTimeEvents
      .findMany()
      .then((list: EventRecord[]) =>
        list.filter(
          (e) => e.orgId === orgId && trackerIds.includes(e.trackerId),
        ),
      ),
  ]);

  const timeline: ActivityLogEntry[] = [];

  for (const tracker of memberTrackers) {
    timeline.push({
      id: tracker.id,
      type: "sent",
      timestamp: new Date(tracker.createdAt),
      details: {
        token: tracker.token,
        subject: tracker.subject || "",
      },
    });
  }

  for (const open of opens) {
    timeline.push({
      id: open.id,
      type: "open",
      timestamp: new Date(open.createdAt),
      details: {
        ipAddress: open.ipAddress,
        userAgent: open.userAgent,
        deviceType: open.deviceType,
      },
    });
  }

  for (const click of clicks) {
    timeline.push({
      id: click.id,
      type: "click",
      timestamp: new Date(click.createdAt),
      details: {
        clickedUrl: click.clickedUrl,
        ipAddress: click.ipAddress,
        userAgent: click.userAgent,
        utmSource: click.utmSource,
        utmMedium: click.utmMedium,
        utmCampaign: click.utmCampaign,
      },
    });
  }

  for (const reply of replies) {
    timeline.push({
      id: reply.id,
      type: "reply",
      timestamp: new Date(reply.createdAt),
      details: {
        replyBody: reply.replyBody,
        senderEmail: reply.senderEmail,
        sentiment: reply.sentiment,
      },
    });
  }

  for (const bounce of bounces) {
    timeline.push({
      id: bounce.id,
      type: bounce.eventType === "complaint" ? "complaint" : "bounce",
      timestamp: new Date(bounce.createdAt),
      details: {
        bounceType: bounce.bounceType,
        bounceReason: bounce.bounceReason,
      },
    });
  }

  for (const rt of readTimes) {
    timeline.push({
      id: rt.id,
      type: "read_time",
      timestamp: new Date(rt.createdAt),
      details: {
        durationMs: rt.durationMs,
        readClassification: rt.readClassification,
      },
    });
  }

  return timeline.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}
