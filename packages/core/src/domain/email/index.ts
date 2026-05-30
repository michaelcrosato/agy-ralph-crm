import type {
  CoreSequenceMembership,
  EmailLogInput,
  EmailTemplateInput,
} from "../../types";
import { getFieldValue } from "../shared";

export function validateEmailLogInput(input: EmailLogInput): {
  success: boolean;
  error?: string;
} {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!input.from || !emailRegex.test(input.from)) {
    return { success: false, error: "Invalid 'from' email format." };
  }
  if (!Array.isArray(input.to) || input.to.length === 0) {
    return { success: false, error: "'to' must be a non-empty array." };
  }
  for (const email of input.to) {
    if (!email || !emailRegex.test(email)) {
      return { success: false, error: `Invalid 'to' email address: ${email}` };
    }
  }
  if (input.cc) {
    for (const email of input.cc) {
      if (!email || !emailRegex.test(email)) {
        return {
          success: false,
          error: `Invalid 'cc' email address: ${email}`,
        };
      }
    }
  }
  if (input.bcc) {
    for (const email of input.bcc) {
      if (!email || !emailRegex.test(email)) {
        return {
          success: false,
          error: `Invalid 'bcc' email address: ${email}`,
        };
      }
    }
  }
  if (!input.subject || input.subject.trim() === "") {
    return { success: false, error: "'subject' is required." };
  }
  if (!input.body || input.body.trim() === "") {
    return { success: false, error: "'body' is required." };
  }
  return { success: true };
}

export function personalizeEmailTemplate(
  template: EmailTemplateInput,
  context: {
    lead?: Record<string, unknown> | null;
    account?: Record<string, unknown> | null;
    contact?: Record<string, unknown> | null;
    opportunity?: Record<string, unknown> | null;
    globalVariables?: Record<string, string> | null;
  },
): { subject: string; body: string } {
  const resolvePathValue = (path: string): string => {
    const parts = path.split(".");
    if (parts.length < 2) return "";

    const objName = parts[0].toLowerCase();
    const fieldPath = parts.slice(1).join(".");

    if (objName === "global") {
      const val = context.globalVariables?.[fieldPath];
      if (val === undefined || val === null) return "";
      return String(val);
    }

    let record: Record<string, unknown> | undefined;
    if (objName === "lead") {
      record = (context.lead || undefined) as
        | Record<string, unknown>
        | undefined;
    } else if (objName === "account") {
      record = (context.account || undefined) as
        | Record<string, unknown>
        | undefined;
    } else if (objName === "contact") {
      record = (context.contact || undefined) as
        | Record<string, unknown>
        | undefined;
    } else if (objName === "opportunity") {
      record = (context.opportunity || undefined) as
        | Record<string, unknown>
        | undefined;
    }

    if (!record) return "";

    const val = getFieldValue(record, fieldPath);
    if (val === undefined || val === null) return "";
    return String(val);
  };

  const evalCondition = (path: string): boolean => {
    const val = resolvePathValue(path);
    return val !== "" && val !== "[N/A]" && val !== "false";
  };

  const processText = (text: string): string => {
    if (!text) return "";

    let processed = text;

    // 1. Resolve conditional blocks {% if path %}true{% else %}false{% endif %}
    const ifElseRegex =
      /\{%\s*if\s+([A-Za-z0-9._]+)\s*%\}([\s\S]*?)\{%\s*else\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g;
    processed = processed.replace(
      ifElseRegex,
      (_match, condPath, trueVal, falseVal) => {
        return evalCondition(condPath) ? trueVal : falseVal;
      },
    );

    const ifRegex =
      /\{%\s*if\s+([A-Za-z0-9._]+)\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g;
    processed = processed.replace(ifRegex, (_match, condPath, trueVal) => {
      return evalCondition(condPath) ? trueVal : "";
    });

    // 2. Resolve placeholders {{path.to.field | filter1 | filter2}}
    processed = processed.replace(
      /\{\{\s*([A-Za-z0-9._]+)(?:\s*\|\s*([^}]+))?\s*\}\}/g,
      (_match, pathStr: string, filtersStr: string | undefined) => {
        let resolved = resolvePathValue(pathStr);

        if (filtersStr) {
          const filters = filtersStr.split("|").map((f) => f.trim());
          for (const filter of filters) {
            if (filter.startsWith("default")) {
              const defaultMatch = filter.match(/default\((["'])(.*?)\1\)/);
              if (defaultMatch) {
                const fallback = defaultMatch[2];
                if (!resolved || resolved === "[N/A]") {
                  resolved = fallback;
                }
              }
            } else if (filter === "uppercase") {
              resolved = resolved.toUpperCase();
            } else if (filter === "lowercase") {
              resolved = resolved.toLowerCase();
            }
          }
        }

        return resolved;
      },
    );

    return processed;
  };

  return {
    subject: processText(template.subject),
    body: processText(template.body),
  };
}

export function compileEmailTemplate(
  template: EmailTemplateInput,
  context: {
    lead?: Record<string, unknown> | null;
    account?: Record<string, unknown> | null;
    contact?: Record<string, unknown> | null;
    opportunity?: Record<string, unknown> | null;
    globalVariables?: Record<string, string> | null;
  },
): { subject: string; body: string } {
  return personalizeEmailTemplate(template, context);
}

export async function handleEmailDeliveryEvent(
  dbStore: {
    marketingSequenceMemberships: {
      // biome-ignore lint/suspicious/noExplicitAny: memberships findMany structure
      findMany: () => Promise<any[]>;
      update: (
        id: string,
        updates: Partial<
          Omit<
            CoreSequenceMembership,
            "id" | "orgId" | "createdAt" | "updatedAt"
          >
        >,
      ) => Promise<unknown>;
    };
    marketingSequenceSuppressions: {
      insert: (item: {
        orgId: string;
        recordType: string;
        recordId: string | null;
        pattern: string;
        reason: string;
      }) => Promise<unknown>;
    };
    leads: {
      // biome-ignore lint/suspicious/noExplicitAny: leads findMany structure
      findMany: () => Promise<any[]>;
      // biome-ignore lint/suspicious/noExplicitAny: leads update structure
      update: (id: string, updates: any) => Promise<any>;
    };
    contacts: {
      // biome-ignore lint/suspicious/noExplicitAny: contacts findMany structure
      findMany: () => Promise<any[]>;
      // biome-ignore lint/suspicious/noExplicitAny: contacts update structure
      update: (id: string, updates: any) => Promise<any>;
    };
    auditLogs: {
      insert: (item: {
        orgId: string;
        recordId: string;
        recordType: string;
        action: string;
        userId: string;
        changes: Record<string, { before: unknown; after: unknown }>;
      }) => Promise<unknown>;
    };
    emailBounceEvents?: {
      insert: (item: {
        orgId: string;
        trackerId: string;
        eventType: string;
        bounceType: string;
        bounceReason: string | null;
      }) => Promise<unknown>;
    };
    emailTrackers?: {
      // biome-ignore lint/suspicious/noExplicitAny: trackers findMany structure
      findMany: () => Promise<any[]>;
      // biome-ignore lint/suspicious/noExplicitAny: trackers findOne structure
      findOne: (id: string) => Promise<any>;
      // biome-ignore lint/suspicious/noExplicitAny: trackers updatePublic structure
      updatePublic: (id: string, updates: any) => Promise<any>;
    };
    activityLinks?: {
      // biome-ignore lint/suspicious/noExplicitAny: activityLinks findMany structure
      findMany: () => Promise<any[]>;
    };
  },
  eventDetails: {
    orgId: string;
    email: string;
    event: "bounce" | "complaint";
    reason?: string;
    bounceType?: string;
    trackerId?: string;
  },
): Promise<{ suppressionsCreated: number; membershipsExited: number }> {
  const { orgId, email, event, reason } = eventDetails;

  // 1. Find matching leads and contacts
  const leads = await dbStore.leads.findMany();
  const matchedLeads = leads.filter(
    (l) =>
      l.orgId === orgId &&
      l.email &&
      l.email.toLowerCase() === email.toLowerCase(),
  );

  const contacts = await dbStore.contacts.findMany();
  const matchedContacts = contacts.filter(
    (c) =>
      c.orgId === orgId &&
      c.email &&
      c.email.toLowerCase() === email.toLowerCase(),
  );

  let suppressionsCreated = 0;

  // Insert suppression record for every matched lead
  for (const lead of matchedLeads) {
    await dbStore.marketingSequenceSuppressions.insert({
      orgId,
      recordType: "lead",
      recordId: lead.id,
      pattern: email.toLowerCase(),
      reason: event,
    });
    suppressionsCreated++;

    // Update Lead custom field
    const currentCustom = lead.custom || {};
    await dbStore.leads.update(lead.id, {
      custom: {
        ...currentCustom,
        email_status: event === "bounce" ? "bounced" : "complained",
        email_status_reason: reason || null,
      },
    });
  }

  // Insert suppression record for every matched contact
  for (const contact of matchedContacts) {
    await dbStore.marketingSequenceSuppressions.insert({
      orgId,
      recordType: "contact",
      recordId: contact.id,
      pattern: email.toLowerCase(),
      reason: event,
    });
    suppressionsCreated++;

    // Update Contact custom field
    const currentCustom = contact.custom || {};
    await dbStore.contacts.update(contact.id, {
      custom: {
        ...currentCustom,
        email_status: event === "bounce" ? "bounced" : "complained",
        email_status_reason: reason || null,
      },
    });
  }

  // If no lead or contact matched, still create a general suppression record
  if (matchedLeads.length === 0 && matchedContacts.length === 0) {
    await dbStore.marketingSequenceSuppressions.insert({
      orgId,
      recordType: "email_domain",
      recordId: null,
      pattern: email.toLowerCase(),
      reason: event,
    });
    suppressionsCreated++;
  }

  // Record granular bounce/complaint event
  // biome-ignore lint/suspicious/noExplicitAny: tracker log variable
  let trackerToLog: any = null;
  if (eventDetails.trackerId && dbStore.emailTrackers) {
    trackerToLog = await dbStore.emailTrackers.findOne(eventDetails.trackerId);
  } else if (dbStore.emailTrackers && dbStore.activityLinks) {
    const allTrackers = await dbStore.emailTrackers.findMany();
    const allLinks = await dbStore.activityLinks.findMany();
    // Sort trackers descending by date
    allTrackers.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const matchedIds = [
      ...matchedLeads.map((l) => l.id),
      ...matchedContacts.map((c) => c.id),
    ];
    for (const tracker of allTrackers) {
      if (tracker.orgId === orgId) {
        const link = allLinks.find(
          (l) =>
            l.activityId === tracker.activityId &&
            l.orgId === orgId &&
            matchedIds.includes(l.targetId),
        );
        if (link) {
          trackerToLog = tracker;
          break;
        }
      }
    }
  }

  if (trackerToLog && dbStore.emailBounceEvents) {
    const bounceType =
      eventDetails.bounceType ||
      (event === "complaint"
        ? "spam_complaint"
        : reason?.toLowerCase().includes("soft")
          ? "soft"
          : "hard");
    await dbStore.emailBounceEvents.insert({
      orgId,
      trackerId: trackerToLog.id,
      eventType: event,
      bounceType,
      bounceReason: reason || null,
    });

    if (dbStore.emailTrackers?.updatePublic) {
      await dbStore.emailTrackers.updatePublic(trackerToLog.id, {
        bounceCount: (trackerToLog.bounceCount || 0) + 1,
        lastBouncedAt: new Date(),
      });
    }
  }

  // 2. Find and update active/snoozed sequence memberships
  const memberships = await dbStore.marketingSequenceMemberships.findMany();
  const matchedRecordIds = new Set([
    ...matchedLeads.map((l) => l.id),
    ...matchedContacts.map((c) => c.id),
  ]);

  const membershipsToExit = memberships.filter(
    (m) =>
      m.orgId === orgId &&
      matchedRecordIds.has(m.recordId) &&
      (m.status === "active" || m.status === "snoozed"),
  );

  let membershipsExited = 0;
  for (const m of membershipsToExit) {
    const originalStatus = m.status;
    await dbStore.marketingSequenceMemberships.update(m.id, {
      status: "exited",
      nextExecutionAt: null as unknown as Date,
      snoozeUntil: null,
      snoozeReason: null,
    });

    membershipsExited++;

    // Write audit log
    await dbStore.auditLogs.insert({
      orgId,
      recordId: m.id,
      recordType: "marketing_sequence_memberships",
      action:
        event === "bounce"
          ? "membership_exit_bounce"
          : "membership_exit_complaint",
      userId: "00000000-0000-0000-0000-000000000000",
      changes: {
        status: { before: originalStatus, after: "exited" },
        nextExecutionAt: {
          before: m.nextExecutionAt
            ? m.nextExecutionAt instanceof Date
              ? m.nextExecutionAt.toISOString()
              : String(m.nextExecutionAt)
            : null,
          after: null,
        },
      },
    });
  }

  return { suppressionsCreated, membershipsExited };
}
