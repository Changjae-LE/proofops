import {
  IMDS_ROLE_USE_RULE_ID,
  RESPONSE_POLICY_DESCRIPTION,
  RESPONSE_POLICY_ID,
  RESPONSE_POLICY_LIMIT_MINUTES,
  type AnalysisFailure,
  type AnalysisResult,
  type AnalysisSuccess,
  type IncidentDocument,
  type IncidentEvent,
} from "../types/incident";

const IMDS_ENDPOINT = "169.254.169.254";

function fail(reason: string, eventsAnalyzed: number): AnalysisFailure {
  return { status: "NOT_DETECTED", reason, eventsAnalyzed };
}

function eventTimeMs(event: IncidentEvent): number | null {
  const ms = Date.parse(event.eventTime);
  return Number.isFinite(ms) ? ms : null;
}

function containsImdsEndpoint(event: IncidentEvent): boolean {
  const params = event.requestParameters;
  if (params && typeof params === "object") {
    const serialized = JSON.stringify(params);
    if (serialized.includes(IMDS_ENDPOINT)) {
      return true;
    }
  }
  return event.sourceIPAddress === IMDS_ENDPOINT;
}

function isImdsAccessEvent(event: IncidentEvent): boolean {
  return event.eventSource === "imds.internal" && containsImdsEndpoint(event);
}

function isCredentialRetrievalEvent(event: IncidentEvent): boolean {
  return (
    event.eventSource === "imds.internal" &&
    typeof event.roleArn === "string" &&
    event.roleArn.length > 0 &&
    (typeof event.accessKeyId === "string" || typeof event.sessionToken === "string")
  );
}

function roleNameFromArn(arn: string): string | null {
  const match = /role\/([^/]+)$/.exec(arn);
  return match ? (match[1] ?? null) : null;
}

function isRoleUseEvent(event: IncidentEvent, roleArn: string): boolean {
  if (event.eventSource === "imds.internal") {
    return false;
  }
  if (event.roleArn === roleArn) {
    return true;
  }
  const roleName = roleNameFromArn(roleArn);
  const principal = event.userIdentity?.arn ?? event.userIdentity?.principalArn;
  return typeof principal === "string" && roleName !== null && principal.includes(roleName);
}

/**
 * Deterministic detection rule AWS-IMDS-ROLE-USE-001.
 *
 * Confirms, in strict chronological order:
 *   1. An event accessing the EC2 instance metadata service (169.254.169.254).
 *   2. A later event on the same instance retrieving IAM role credentials from IMDS.
 *   3. A later AWS API event that uses the retrieved role.
 *
 * This function performs no AI inference: every branch is an explicit, testable
 * condition over the event fields. Incomplete or malformed incidents produce a
 * typed NOT_DETECTED result rather than throwing.
 */
export function analyzeIncident(incident: IncidentDocument): AnalysisResult {
  const events = incident.events;
  const eventsAnalyzed = events.length;

  if (eventsAnalyzed === 0) {
    return fail("Incident contains no events to analyze.", eventsAnalyzed);
  }

  const imdsEvent = events.find(isImdsAccessEvent);
  if (!imdsEvent) {
    return fail(
      "No event indicating access to the EC2 instance metadata service was found.",
      eventsAnalyzed
    );
  }
  const imdsTime = eventTimeMs(imdsEvent);
  if (imdsTime === null) {
    return fail(
      `IMDS access event "${imdsEvent.eventId}" has an invalid timestamp.`,
      eventsAnalyzed
    );
  }

  const credentialEvent = events.find(
    (event) =>
      isCredentialRetrievalEvent(event) &&
      event.instanceId === imdsEvent.instanceId &&
      (eventTimeMs(event) ?? -Infinity) > imdsTime
  );
  if (!credentialEvent) {
    return fail(
      "No later event indicating IAM role credential retrieval from IMDS on the same instance was found.",
      eventsAnalyzed
    );
  }
  const credentialTime = eventTimeMs(credentialEvent);
  if (credentialTime === null) {
    return fail(
      `Credential retrieval event "${credentialEvent.eventId}" has an invalid timestamp.`,
      eventsAnalyzed
    );
  }

  const roleArn = credentialEvent.roleArn;
  if (typeof roleArn !== "string" || roleArn.length === 0) {
    return fail("Credential retrieval event is missing a role ARN.", eventsAnalyzed);
  }

  const roleUseEvent = events.find(
    (event) => isRoleUseEvent(event, roleArn) && (eventTimeMs(event) ?? -Infinity) > credentialTime
  );
  if (!roleUseEvent) {
    return fail("No later AWS API event using the retrieved role was found.", eventsAnalyzed);
  }
  const roleUseTime = eventTimeMs(roleUseEvent);
  if (roleUseTime === null) {
    return fail(
      `Role use event "${roleUseEvent.eventId}" has an invalid timestamp.`,
      eventsAnalyzed
    );
  }

  if (!(imdsTime < credentialTime && credentialTime < roleUseTime)) {
    return fail("Matched events are not in strict chronological order.", eventsAnalyzed);
  }

  const detectedAtMs = Date.parse(incident.detection.detectedAt);
  const containedAtMs = Date.parse(incident.containment.containedAt);
  if (!Number.isFinite(detectedAtMs)) {
    return fail("Incident detection.detectedAt is not a valid timestamp.", eventsAnalyzed);
  }
  if (!Number.isFinite(containedAtMs)) {
    return fail("Incident containment.containedAt is not a valid timestamp.", eventsAnalyzed);
  }
  if (containedAtMs < detectedAtMs) {
    return fail("Containment timestamp occurs before the detection timestamp.", eventsAnalyzed);
  }

  const responseMinutes = (containedAtMs - detectedAtMs) / 60000;
  const satisfied = responseMinutes <= RESPONSE_POLICY_LIMIT_MINUTES;

  const success: AnalysisSuccess = {
    status: "DETECTED",
    ruleId: IMDS_ROLE_USE_RULE_ID,
    incidentId: incident.incidentId,
    incidentType: "EC2 IMDS Credential Access Followed by Role Use",
    severity: "HIGH",
    detectionConfidence: "HIGH",
    detectedAt: incident.detection.detectedAt,
    containedAt: incident.containment.containedAt,
    policy: {
      policyId: RESPONSE_POLICY_ID,
      description: RESPONSE_POLICY_DESCRIPTION,
      limitMinutes: RESPONSE_POLICY_LIMIT_MINUTES,
      responseMinutes,
      satisfied,
    },
    matchedEvents: {
      imdsAccessEventId: imdsEvent.eventId,
      credentialRetrievalEventId: credentialEvent.eventId,
      roleUseEventId: roleUseEvent.eventId,
    },
    eventsAnalyzed,
  };
  return success;
}
