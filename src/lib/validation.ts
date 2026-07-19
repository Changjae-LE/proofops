import type { IncidentDocument, IncidentEvent } from "../types/incident";

export const MAX_INCIDENT_UPLOAD_BYTES = 1024 * 1024; // 1 MB

export type ValidationResult = { ok: true; data: IncidentDocument } | { ok: false; error: string };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateEvent(raw: unknown, index: number): IncidentEvent | string {
  if (!isPlainObject(raw)) {
    return `Event at index ${index} must be an object`;
  }
  if (!isNonEmptyString(raw.eventId)) {
    return `Event at index ${index} is missing a valid "eventId"`;
  }
  if (!isValidIsoTimestamp(raw.eventTime)) {
    return `Event "${String(raw.eventId)}" is missing a valid ISO 8601 "eventTime"`;
  }
  if (!isNonEmptyString(raw.eventName)) {
    return `Event "${String(raw.eventId)}" is missing a valid "eventName"`;
  }
  if (!isNonEmptyString(raw.eventSource)) {
    return `Event "${String(raw.eventId)}" is missing a valid "eventSource"`;
  }
  return raw as unknown as IncidentEvent;
}

/**
 * Validates that an arbitrary parsed JSON value conforms to the IncidentDocument shape.
 * Returns a typed, safe failure instead of throwing so callers (including the browser
 * upload flow) can always show a useful error message.
 */
export function validateIncidentDocument(raw: unknown): ValidationResult {
  if (!isPlainObject(raw)) {
    return { ok: false, error: "Incident file must contain a single JSON object." };
  }

  if (!isNonEmptyString(raw.incidentId)) {
    return { ok: false, error: 'Incident is missing a valid "incidentId" string.' };
  }
  if (!isNonEmptyString(raw.title)) {
    return { ok: false, error: 'Incident is missing a valid "title" string.' };
  }
  if (!isValidIsoTimestamp(raw.createdAt)) {
    return { ok: false, error: 'Incident is missing a valid ISO 8601 "createdAt" timestamp.' };
  }
  if (!isNonEmptyString(raw.source)) {
    return { ok: false, error: 'Incident is missing a valid "source" string.' };
  }

  const detection = raw.detection;
  if (!isPlainObject(detection) || !isValidIsoTimestamp(detection.detectedAt)) {
    return {
      ok: false,
      error: 'Incident is missing a valid "detection.detectedAt" timestamp.',
    };
  }
  if (!isNonEmptyString(detection.detectedBy)) {
    return { ok: false, error: 'Incident is missing a valid "detection.detectedBy" string.' };
  }

  const containment = raw.containment;
  if (!isPlainObject(containment) || !isValidIsoTimestamp(containment.containedAt)) {
    return {
      ok: false,
      error: 'Incident is missing a valid "containment.containedAt" timestamp.',
    };
  }
  if (!isNonEmptyString(containment.containedBy)) {
    return { ok: false, error: 'Incident is missing a valid "containment.containedBy" string.' };
  }
  if (!isNonEmptyString(containment.action)) {
    return { ok: false, error: 'Incident is missing a valid "containment.action" string.' };
  }

  if (!Array.isArray(raw.events) || raw.events.length === 0) {
    return { ok: false, error: 'Incident must include a non-empty "events" array.' };
  }

  const events: IncidentEvent[] = [];
  for (let i = 0; i < raw.events.length; i += 1) {
    const result = validateEvent(raw.events[i], i);
    if (typeof result === "string") {
      return { ok: false, error: result };
    }
    events.push(result);
  }

  return {
    ok: true,
    data: {
      incidentId: raw.incidentId,
      title: raw.title,
      createdAt: raw.createdAt,
      source: raw.source,
      awsAccountId: isNonEmptyString(raw.awsAccountId) ? raw.awsAccountId : undefined,
      detection: {
        detectedAt: detection.detectedAt,
        detectedBy: detection.detectedBy,
      },
      containment: {
        containedAt: containment.containedAt,
        containedBy: containment.containedBy,
        action: containment.action,
      },
      events,
    },
  };
}

/**
 * Parses raw uploaded text into an IncidentDocument, enforcing a maximum size to avoid
 * pathological browser-side JSON parsing of huge files.
 */
export function parseIncidentUpload(text: string): ValidationResult {
  const byteLength = new TextEncoder().encode(text).length;
  if (byteLength > MAX_INCIDENT_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `File is too large (${byteLength} bytes). Maximum allowed size is ${MAX_INCIDENT_UPLOAD_BYTES} bytes.`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown JSON parse error";
    return { ok: false, error: `File is not valid JSON: ${message}` };
  }

  return validateIncidentDocument(parsed);
}
