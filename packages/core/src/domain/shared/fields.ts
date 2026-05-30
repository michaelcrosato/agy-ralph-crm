import type {
  ConsentValidationInput,
  CSATFeedbackInput,
  SyncSimulationInput,
} from "../../types";

export const SUPPORTED_TEAM_ROLES = [
  "Account Manager",
  "Sales Engineer",
  "Customer Success Manager",
  "Executive Sponsor",
  "Other",
];

export function validateStageGuidanceKeyFields(
  record: Record<string, unknown>,
  keyFields: string[],
): {
  isClean: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];

  for (const field of keyFields) {
    let value: unknown;

    if (field.startsWith("custom.")) {
      const fieldKey = field.substring("custom.".length);
      value = (record.custom as Record<string, unknown> | null)?.[fieldKey];
    } else {
      value = record[field];
    }

    const isEmpty =
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "");

    if (isEmpty) {
      missingFields.push(field);
    }
  }

  return {
    isClean: missingFields.length === 0,
    missingFields,
  };
}

export function validateCommunicationConsent(
  input: ConsentValidationInput,
): boolean {
  const matchingRule = input.preferences.find(
    (p) => p.channel === input.channel,
  );
  if (!matchingRule) return false;
  return matchingRule.status === "opt_in";
}

export function syncExternalItems(input: SyncSimulationInput) {
  const syncedEmails: {
    externalId: string;
    subject: string;
    body: string;
    receivedAt: Date;
    targetType: "Lead" | "Contact";
    targetId: string;
  }[] = [];

  const syncedEvents: {
    externalId: string;
    title: string;
    description: string;
    eventDate: Date;
    targetType: "Lead" | "Contact";
    targetId: string;
  }[] = [];

  // Match and sync emails
  if (input.settings.syncEmails) {
    for (const email of input.externalEmails) {
      if (input.existingActivityExternalIds.includes(email.externalId))
        continue;

      // Check contacts first
      const contact = input.existingContacts.find(
        (c) =>
          c.email?.toLowerCase() === email.sender.toLowerCase() ||
          c.email?.toLowerCase() === email.recipient.toLowerCase(),
      );
      if (contact) {
        syncedEmails.push({
          externalId: email.externalId,
          subject: email.subject,
          body: email.body,
          receivedAt: email.receivedAt,
          targetType: "Contact",
          targetId: contact.id,
        });
        continue;
      }

      // Check leads next
      const lead = input.existingLeads.find(
        (l) =>
          l.email?.toLowerCase() === email.sender.toLowerCase() ||
          l.email?.toLowerCase() === email.recipient.toLowerCase(),
      );
      if (lead) {
        syncedEmails.push({
          externalId: email.externalId,
          subject: email.subject,
          body: email.body,
          receivedAt: email.receivedAt,
          targetType: "Lead",
          targetId: lead.id,
        });
      }
    }
  }

  // Match and sync calendar events
  if (input.settings.syncCalendar) {
    for (const event of input.externalCalendarEvents) {
      if (input.existingActivityExternalIds.includes(event.externalId))
        continue;

      let matched = false;
      for (const attendee of event.attendees) {
        const contact = input.existingContacts.find(
          (c) => c.email?.toLowerCase() === attendee.toLowerCase(),
        );
        if (contact) {
          syncedEvents.push({
            externalId: event.externalId,
            title: event.title,
            description: event.description,
            eventDate: event.eventDate,
            targetType: "Contact",
            targetId: contact.id,
          });
          matched = true;
          break; // Avoid linking the same event multiple times if there are multiple attendees
        }
      }

      if (matched) continue;

      for (const attendee of event.attendees) {
        const lead = input.existingLeads.find(
          (l) => l.email?.toLowerCase() === attendee.toLowerCase(),
        );
        if (lead) {
          syncedEvents.push({
            externalId: event.externalId,
            title: event.title,
            description: event.description,
            eventDate: event.eventDate,
            targetType: "Lead",
            targetId: lead.id,
          });
          break;
        }
      }
    }
  }

  return { syncedEmails, syncedEvents };
}

export function validateArticleStatus(status: string): boolean {
  return status === "Draft" || status === "Published";
}

export function incrementArticleViewCount(currentCount: number): number {
  if (currentCount < 0) return 0;
  return currentCount + 1;
}

export function validateCSATFeedbackInput(input: CSATFeedbackInput): {
  success: boolean;
  error?: string;
} {
  if (input.score === undefined || input.score === null) {
    return { success: false, error: "Score is required." };
  }
  if (!Number.isInteger(input.score) || input.score < 1 || input.score > 5) {
    return {
      success: false,
      error: "CSAT score must be an integer between 1 and 5.",
    };
  }
  return { success: true };
}

export function getFieldValue(
  fields: Record<string, unknown>,
  path: string,
): unknown {
  if (path in fields && fields[path] !== undefined && fields[path] !== null) {
    return fields[path];
  }
  if (path.includes(".")) {
    const parts = path.split(".");
    let current: unknown = fields;
    for (const part of parts) {
      if (
        current === null ||
        current === undefined ||
        typeof current !== "object"
      ) {
        current = undefined;
        break;
      }
      current = (current as Record<string, unknown>)[part];
    }
    if (current !== undefined && current !== null) {
      return current;
    }
  }
  if (
    fields.custom &&
    typeof fields.custom === "object" &&
    path in (fields.custom as Record<string, unknown>)
  ) {
    const val = (fields.custom as Record<string, unknown>)[path];
    if (val !== undefined && val !== null) {
      return val;
    }
  }
  return undefined;
}

export function validatePicklistDependencies(
  fields: Record<string, unknown>,
  dependencies: {
    parentField: string;
    dependentField: string;
    dependencyMap: Record<string, string[]>;
  }[],
): { success: boolean; error?: string } {
  for (const dep of dependencies) {
    const parentVal = getFieldValue(fields, dep.parentField);
    const dependentVal = getFieldValue(fields, dep.dependentField);

    // If controlling or dependent values are not set on the record mutation, skip validation
    if (
      parentVal === undefined ||
      parentVal === null ||
      dependentVal === undefined ||
      dependentVal === null
    ) {
      continue;
    }

    const parentValStr = String(parentVal);
    const dependentValStr = String(dependentVal);

    const allowedOptions = dep.dependencyMap[parentValStr];
    if (!allowedOptions?.includes(dependentValStr)) {
      return {
        success: false,
        error: `Value '${dependentValStr}' is not allowed for dependent field '${dep.dependentField}' when parent field '${dep.parentField}' is '${parentValStr}'. Allowed values are: ${allowedOptions ? allowedOptions.join(", ") : "none"}.`,
      };
    }
  }

  return { success: true };
}

export function validateHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}
