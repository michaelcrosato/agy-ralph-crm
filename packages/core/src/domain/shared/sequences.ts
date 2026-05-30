import type {
  CoreSequenceExclusion,
  CoreSequenceStep,
  CoreSequenceSuppression,
} from "../../types";
import { parseTimeToMinutes } from "../csv";

export function getPartsInTimezone(date: Date, tz: string) {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
    });
    const parts = formatter.formatToParts(date);
    const map: Record<string, string> = {};
    for (const p of parts) {
      map[p.type] = p.value;
    }
    return {
      year: Number.parseInt(map.year, 10),
      month: Number.parseInt(map.month, 10),
      day: Number.parseInt(map.day, 10),
      hour: Number.parseInt(map.hour, 10),
      minute: Number.parseInt(map.minute, 10),
      weekday: map.weekday, // "Mon", "Tue", etc.
    };
  } catch (_e) {
    // Fallback to UTC
    const utcDate = new Date(date.getTime());
    const weekdayMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return {
      year: utcDate.getUTCFullYear(),
      month: utcDate.getUTCMonth() + 1,
      day: utcDate.getUTCDate(),
      hour: utcDate.getUTCHours(),
      minute: utcDate.getUTCMinutes(),
      weekday: weekdayMap[utcDate.getUTCDay()],
    };
  }
}

export function getNextValidSendingTime(
  currentTime: Date,
  sendingDays: number[] | null,
  windowStart: string | null,
  windowEnd: string | null,
  timezone?: string | null,
): Date {
  const tz = timezone || "UTC";
  let target = new Date(currentTime.getTime());

  const allowedDays =
    sendingDays && sendingDays.length > 0 ? new Set(sendingDays) : null;
  const weekdayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };

  let attempts = 0;
  while (attempts < 8) {
    const local = getPartsInTimezone(target, tz);
    const dayOfWeek = weekdayMap[local.weekday] || 1;
    const dayAllowed = !allowedDays || allowedDays.has(dayOfWeek);

    if (dayAllowed) {
      const currentTimeMinutes = local.hour * 60 + local.minute;
      const startMinutes = windowStart ? parseTimeToMinutes(windowStart) : 0;
      const endMinutes = windowEnd ? parseTimeToMinutes(windowEnd) : 24 * 60;

      if (currentTimeMinutes < startMinutes) {
        const minutesToStart = startMinutes - currentTimeMinutes;
        return new Date(target.getTime() + minutesToStart * 60 * 1000);
      }

      if (
        currentTimeMinutes >= startMinutes &&
        currentTimeMinutes < endMinutes
      ) {
        return target;
      }
    }

    const nextTarget = new Date(target.getTime() + 24 * 60 * 60 * 1000);
    const nextLocal = getPartsInTimezone(nextTarget, tz);
    const startMinutes = windowStart ? parseTimeToMinutes(windowStart) : 0;

    const nextLocalAsUtc = new Date(
      Date.UTC(
        nextLocal.year,
        nextLocal.month - 1,
        nextLocal.day,
        nextLocal.hour,
        nextLocal.minute,
        0,
        0,
      ),
    );
    const targetLocalAsUtc = new Date(
      Date.UTC(
        nextLocal.year,
        nextLocal.month - 1,
        nextLocal.day,
        Math.floor(startMinutes / 60),
        startMinutes % 60,
        0,
        0,
      ),
    );
    const diffMs = targetLocalAsUtc.getTime() - nextLocalAsUtc.getTime();

    target = new Date(nextTarget.getTime() + diffMs);
    attempts++;
  }

  return currentTime;
}

export function calculateNextStepExecutionTime(
  currentTime: Date,
  delayDays: number,
  waitCondition?: CoreSequenceStep["waitCondition"],
): Date {
  let target = new Date(
    currentTime.getTime() + delayDays * 24 * 60 * 60 * 1000,
  );

  if (waitCondition?.waitType !== "day_of_week") {
    return target;
  }

  const daysOfWeek = waitCondition.daysOfWeek || [];
  if (daysOfWeek.length === 0) {
    return target;
  }

  let _found = false;
  for (let i = 0; i < 7; i++) {
    const day = target.getDay();
    if (daysOfWeek.includes(day)) {
      _found = true;
      break;
    }
    target = new Date(target.getTime() + 24 * 60 * 60 * 1000);
  }

  if (waitCondition.timeOfDay) {
    const parts = waitCondition.timeOfDay.split(":");
    if (parts.length === 2) {
      const hours = Number.parseInt(parts[0], 10);
      const minutes = Number.parseInt(parts[1], 10);
      if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
        target.setHours(hours, minutes, 0, 0);
      }
    }
  }

  return target;
}

export async function isRecordSuppressedOrExcluded(params: {
  orgId: string;
  sequenceId: string;
  recordType: "lead" | "contact";
  recordId: string;
  email: string | null | undefined;
  dbStore: {
    marketingSequenceSuppressions: {
      findForOrg: (orgId: string) => Promise<CoreSequenceSuppression[]>;
    };
    marketingSequenceExclusions: {
      findForSequence: (sequenceId: string) => Promise<CoreSequenceExclusion[]>;
    };
    marketingSegmentMemberships?: {
      findForRecord: (
        recordType: string,
        recordId: string,
      ) => Promise<{ segmentId: string }[]>;
    };
  };
}): Promise<{ suppressed: boolean; reason: string | null }> {
  const emailVal = params.email?.trim().toLowerCase();
  const domainVal = emailVal ? emailVal.split("@")[1] : null;

  // 1. Check Global Suppressions
  const suppressions =
    await params.dbStore.marketingSequenceSuppressions.findForOrg(params.orgId);
  for (const s of suppressions) {
    if (s.recordType === params.recordType && s.recordId === params.recordId) {
      return {
        suppressed: true,
        reason: `Global suppression list match for ${params.recordType} ID ${params.recordId} (${s.reason})`,
      };
    }
    if (s.recordType === "email_domain" && s.pattern) {
      const patternLower = s.pattern.trim().toLowerCase();
      if (emailVal === patternLower || domainVal === patternLower) {
        return {
          suppressed: true,
          reason: `Global suppression list match for pattern ${s.pattern} (${s.reason})`,
        };
      }
    }
  }

  // 2. Check Sequence Exclusions
  const exclusions =
    await params.dbStore.marketingSequenceExclusions.findForSequence(
      params.sequenceId,
    );
  if (exclusions.length > 0) {
    let recordSegments: string[] = [];
    if (params.dbStore.marketingSegmentMemberships) {
      const memberships =
        await params.dbStore.marketingSegmentMemberships.findForRecord(
          params.recordType,
          params.recordId,
        );
      recordSegments = memberships.map((m) => m.segmentId);
    }

    for (const ex of exclusions) {
      if (
        ex.exclusionType === "email" &&
        emailVal === ex.exclusionValue.trim().toLowerCase()
      ) {
        return {
          suppressed: true,
          reason: `Sequence exclusion rule: specific email ${ex.exclusionValue}`,
        };
      }
      if (
        ex.exclusionType === "domain" &&
        domainVal === ex.exclusionValue.trim().toLowerCase()
      ) {
        return {
          suppressed: true,
          reason: `Sequence exclusion rule: email domain ${ex.exclusionValue}`,
        };
      }
      if (
        ex.exclusionType === "segment" &&
        recordSegments.includes(ex.exclusionValue)
      ) {
        return {
          suppressed: true,
          reason: `Sequence exclusion rule: member of excluded segment ${ex.exclusionValue}`,
        };
      }
    }
  }

  return { suppressed: false, reason: null };
}
