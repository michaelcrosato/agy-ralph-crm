# Specification: Marketing Sequence Recipient Time-Zone Smart Delivery Engine - Design

## 1. Timezone Utility Design
The scheduling algorithm is updated in `packages/core/src/index.ts`. We will extend `getNextValidSendingTime` with an optional `timezone?: string | null` parameter.

### 1.1 Timezone Component Helper
We will implement a helper `getPartsInTimezone` to retrieve local date parts in a system-independent manner using Node.js's standard `Intl.DateTimeFormat`:

```typescript
function getPartsInTimezone(date: Date, tz: string) {
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
      year: parseInt(map.year),
      month: parseInt(map.month),
      day: parseInt(map.day),
      hour: parseInt(map.hour),
      minute: parseInt(map.minute),
      weekday: map.weekday, // "Mon", "Tue", etc.
    };
  } catch (e) {
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
```

### 1.2 Upgraded `getNextValidSendingTime`
We will rewrite `getNextValidSendingTime` to calculate local times using the parsed timezone.
If a `timezone` is provided, we compute the local timezone offset relative to UTC, then run the sending window check (allowed days, and hours window start/end) using local time.

```typescript
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
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7
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
        // Construct the local target time
        const localAsUtc = new Date(Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, 0, 0));
        const offsetMs = localAsUtc.getTime() - target.getTime();
        
        // Add required minutes to reach startMinutes
        const minutesToStart = startMinutes - currentTimeMinutes;
        return new Date(target.getTime() + minutesToStart * 60 * 1000);
      }

      if (currentTimeMinutes >= startMinutes && currentTimeMinutes < endMinutes) {
        return target;
      }
    }

    // Move to next local day
    // We can shift target by 24 hours
    target = new Date(target.getTime() + 24 * 60 * 60 * 1000);
    // Align target to the start window or 00:00 of the next day
    const updatedLocal = getPartsInTimezone(target, tz);
    const startMinutes = windowStart ? parseTimeToMinutes(windowStart) : 0;
    
    // Construct target at local startMinutes
    const targetLocalAsUtc = new Date(Date.UTC(updatedLocal.year, updatedLocal.month - 1, updatedLocal.day, Math.floor(startMinutes / 60), startMinutes % 60, 0, 0));
    const currentLocalAsUtc = new Date(Date.UTC(updatedLocal.year, updatedLocal.month - 1, updatedLocal.day, updatedLocal.hour, updatedLocal.minute, 0, 0));
    const diffMs = targetLocalAsUtc.getTime() - currentLocalAsUtc.getTime();
    target = new Date(target.getTime() + diffMs);
    attempts++;
  }

  return currentTime;
}
```

---

## 2. Core Engine Integration
In `executePendingSequenceSteps`, before checking `getNextValidSendingTime` at line 4623:
1. Load the recipient record (`Lead` or `Contact`) based on the membership's `recordType` and `recordId`.
2. Retrieve the timezone from `custom.timezone` (e.g. `lead.custom.timezone`).
3. Pass this timezone into `getNextValidSendingTime`.

```typescript
      let recipientTimezone: string | null = null;
      if (membership.recordType === "lead") {
        const lead = await dbStore.leads.findOne(membership.recordId);
        if (lead && lead.custom && (lead.custom as any).timezone) {
          recipientTimezone = (lead.custom as any).timezone;
        }
      } else if (membership.recordType === "contact") {
        const contact = await dbStore.contacts.findOne(membership.recordId);
        if (contact && contact.custom && (contact.custom as any).timezone) {
          recipientTimezone = (contact.custom as any).timezone;
        }
      }

      if (sequence) {
        const validTime = getNextValidSendingTime(
          currentTime,
          sequence.sendingDays || null,
          sequence.sendingWindowStart || null,
          sequence.sendingWindowEnd || null,
          recipientTimezone,
        );
```

This ensures complete alignment!
