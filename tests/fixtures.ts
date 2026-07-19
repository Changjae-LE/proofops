import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { IncidentDocument } from "../src/types/incident";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Loads the actual bundled demo incident used by the UI's "Load Demo Incident" button. */
export function loadSampleIncident(): IncidentDocument {
  const filePath = path.resolve(__dirname, "../public/samples/imds-role-use-incident.json");
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as IncidentDocument;
}

export function cloneIncident(incident: IncidentDocument): IncidentDocument {
  return JSON.parse(JSON.stringify(incident)) as IncidentDocument;
}
