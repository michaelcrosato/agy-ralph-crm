import type {
  TicketAssignmentRuleEntryInput,
  TicketCommentInput,
  TicketEscalationResult,
  TicketEscalationRuleInput,
  TicketMacroApplyInput,
  TicketMacroApplyResult,
  TicketMacroValidationInput,
  TicketMilestoneInput,
  TicketRoutingMatchResult,
  TicketTagInput,
} from "../../types";

export function calculateMilestoneDueDate(
  createdAt: Date,
  limitMinutes: number,
): Date {
  return new Date(createdAt.getTime() + limitMinutes * 60 * 1000);
}

export function evaluateMilestoneCompletion(
  targetTime: Date,
  completedAt: Date,
): { isMet: boolean; status: "completed" | "breached" } {
  const isMet = completedAt.getTime() <= targetTime.getTime();
  return {
    isMet,
    status: isMet ? "completed" : "breached",
  };
}

export function validateTicketCommentInput(input: TicketCommentInput): {
  success: boolean;
  error?: string;
} {
  if (!input.body || input.body.trim() === "") {
    return { success: false, error: "Comment body cannot be empty." };
  }
  return { success: true };
}

export function validateTicketTagInput(input: TicketTagInput): {
  success: boolean;
  error?: string;
} {
  if (!input.name || input.name.trim() === "") {
    return { success: false, error: "Tag name cannot be empty." };
  }
  if (input.name.length > 50) {
    return { success: false, error: "Tag name cannot exceed 50 characters." };
  }
  const hexPattern = /^#[0-9A-Fa-f]{6}$/;
  if (!input.color || !hexPattern.test(input.color)) {
    return {
      success: false,
      error:
        "Tag color must be a valid 6-character hex color starting with '#'.",
    };
  }
  return { success: true };
}

export function evaluateTicketAssignment(
  ticket: Record<string, unknown>,
  entries: TicketAssignmentRuleEntryInput[],
): TicketRoutingMatchResult | null {
  const sortedEntries = [...entries].sort((a, b) => a.sortOrder - b.sortOrder);

  for (const entry of sortedEntries) {
    let match = true;
    for (const cond of entry.criteria) {
      let ticketValue: unknown;
      if (cond.field.startsWith("custom.")) {
        const customField = cond.field.substring("custom.".length);
        ticketValue = (ticket.custom as Record<string, unknown> | null)?.[
          customField
        ];
      } else {
        ticketValue = ticket[cond.field];
      }

      if (ticketValue === undefined || ticketValue === null) {
        match = false;
        break;
      }

      const tStr = String(ticketValue).toLowerCase();
      const cStr = String(cond.value).toLowerCase();

      if (cond.operator === "equals") {
        if (tStr !== cStr) {
          match = false;
          break;
        }
      } else if (cond.operator === "contains") {
        if (!tStr.includes(cStr)) {
          match = false;
          break;
        }
      } else if (cond.operator === "greater_than") {
        const tNum = Number.parseFloat(tStr);
        const cNum = Number.parseFloat(cStr);
        if (Number.isNaN(tNum) || Number.isNaN(cNum) || tNum <= cNum) {
          match = false;
          break;
        }
      } else if (cond.operator === "less_than") {
        const tNum = Number.parseFloat(tStr);
        const cNum = Number.parseFloat(cStr);
        if (Number.isNaN(tNum) || Number.isNaN(cNum) || tNum >= cNum) {
          match = false;
          break;
        }
      } else {
        match = false;
        break;
      }
    }

    if (match && entry.routingUserIds.length > 0) {
      if (entry.routingMethod === "direct") {
        return {
          matchedEntryId: entry.id,
          newAssignedToId: entry.routingUserIds[0],
          newLastAssignedIndex: -1,
        };
      }
      if (entry.routingMethod === "round_robin") {
        const nextIndex =
          (entry.lastAssignedIndex + 1) % entry.routingUserIds.length;
        return {
          matchedEntryId: entry.id,
          newAssignedToId: entry.routingUserIds[nextIndex],
          newLastAssignedIndex: nextIndex,
        };
      }
    }
  }

  return null;
}

export function evaluateTicketEscalation(
  _ticket: { priority?: string | null; assignedToId: string | null },
  milestones: TicketMilestoneInput[],
  rules: TicketEscalationRuleInput[],
  currentTime: Date = new Date(),
): TicketEscalationResult | null {
  const activeRules = rules.filter((r) => r.isActive === 1);

  for (const rule of activeRules) {
    for (const ms of milestones) {
      // 1. milestone_breached evaluation
      if (rule.triggerType === "milestone_breached") {
        const isBreached =
          ms.status === "breached" ||
          (ms.status === "pending" &&
            currentTime.getTime() > ms.targetTime.getTime());

        if (isBreached) {
          return {
            ruleId: rule.id,
            escalateToId: rule.escalateToId,
            newPriority: rule.newPriority,
            reason: `Milestone [${ms.milestoneType}] has breached its target time of ${ms.targetTime.toISOString()}`,
          };
        }
      }

      // 2. milestone_approaching evaluation
      if (rule.triggerType === "milestone_approaching") {
        if (ms.status === "pending" && !ms.completedAt) {
          const timeDiffMs = ms.targetTime.getTime() - currentTime.getTime();
          const thresholdMs = rule.timeThresholdMinutes * 60 * 1000;

          if (timeDiffMs > 0 && timeDiffMs <= thresholdMs) {
            return {
              ruleId: rule.id,
              escalateToId: rule.escalateToId,
              newPriority: rule.newPriority,
              reason: `Milestone [${ms.milestoneType}] is approaching breach (due in ${Math.round(timeDiffMs / 1000 / 60)} minutes)`,
            };
          }
        }
      }
    }
  }

  return null;
}

export function applyTicketMacro(
  input: TicketMacroApplyInput,
): TicketMacroApplyResult {
  const { ticket, macro } = input;

  if (ticket.orgId !== macro.orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }

  const updatedStatus = macro.updateStatus || ticket.status;
  const updatedPriority = macro.updatePriority || ticket.priority;

  return {
    updatedStatus,
    updatedPriority,
    commentBody: macro.cannedResponse,
    auditMessage: `Applied macro [${macro.name}]. Status transitioned from '${ticket.status}' to '${updatedStatus}', priority from '${ticket.priority}' to '${updatedPriority}'.`,
  };
}

export function validateTicketMacroInput(input: TicketMacroValidationInput): {
  success: boolean;
  error?: string;
} {
  if (!input.name || input.name.trim() === "") {
    return { success: false, error: "Macro name cannot be empty." };
  }
  if (input.name.length > 100) {
    return {
      success: false,
      error: "Macro name cannot exceed 100 characters.",
    };
  }
  if (!input.cannedResponse || input.cannedResponse.trim() === "") {
    return { success: false, error: "Canned response cannot be empty." };
  }
  return { success: true };
}
