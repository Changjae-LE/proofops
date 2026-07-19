// Core data model for a ProofOps incident evidence bundle.
//
// The shape is intentionally a simplified, realistic blend of an AWS CloudTrail-style
// event log and an internal instance metadata service (IMDS) access log, combined into
// a single chronological event list that a SOC analyst would assemble while investigating
// an EC2 credential theft incident.

export interface IncidentUserIdentity {
  type?: string;
  principalArn?: string;
  arn?: string;
  userName?: string;
  accessKeyId?: string;
}

export interface IncidentEvent {
  eventId: string;
  /** ISO 8601 timestamp, e.g. 2026-07-14T03:12:05Z */
  eventTime: string;
  eventName: string;
  eventSource: string;
  instanceId?: string;
  sourceIPAddress?: string;
  privateIpAddress?: string;
  userAgent?: string;
  awsAccountId?: string;
  roleArn?: string;
  accessKeyId?: string;
  sessionToken?: string;
  userName?: string;
  email?: string;
  userIdentity?: IncidentUserIdentity;
  requestParameters?: Record<string, unknown>;
  responseElements?: Record<string, unknown>;
  [extra: string]: unknown;
}

export interface IncidentDetection {
  detectedAt: string;
  detectedBy: string;
}

export interface IncidentContainment {
  containedAt: string;
  containedBy: string;
  action: string;
}

export interface IncidentDocument {
  incidentId: string;
  title: string;
  createdAt: string;
  source: string;
  awsAccountId?: string;
  detection: IncidentDetection;
  containment: IncidentContainment;
  events: IncidentEvent[];
}

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type DetectionConfidence = "LOW" | "MEDIUM" | "HIGH";

export const IMDS_ROLE_USE_RULE_ID = "AWS-IMDS-ROLE-USE-001" as const;
export const RESPONSE_POLICY_ID = "SEC-POLICY-CONTAINMENT-15MIN" as const;
export const RESPONSE_POLICY_LIMIT_MINUTES = 15 as const;
export const RESPONSE_POLICY_DESCRIPTION =
  "Security incidents must be contained within 15 minutes of detection." as const;

export interface MatchedEventRefs {
  imdsAccessEventId: string;
  credentialRetrievalEventId: string;
  roleUseEventId: string;
}

export interface PolicyEvaluation {
  policyId: typeof RESPONSE_POLICY_ID;
  description: typeof RESPONSE_POLICY_DESCRIPTION;
  limitMinutes: typeof RESPONSE_POLICY_LIMIT_MINUTES;
  responseMinutes: number;
  satisfied: boolean;
}

export interface AnalysisSuccess {
  status: "DETECTED";
  ruleId: typeof IMDS_ROLE_USE_RULE_ID;
  incidentId: string;
  incidentType: "EC2 IMDS Credential Access Followed by Role Use";
  severity: Severity;
  detectionConfidence: DetectionConfidence;
  detectedAt: string;
  containedAt: string;
  policy: PolicyEvaluation;
  matchedEvents: MatchedEventRefs;
  eventsAnalyzed: number;
}

export interface AnalysisFailure {
  status: "NOT_DETECTED";
  reason: string;
  eventsAnalyzed: number;
}

export type AnalysisResult = AnalysisSuccess | AnalysisFailure;

export function isAnalysisSuccess(result: AnalysisResult): result is AnalysisSuccess {
  return result.status === "DETECTED";
}
