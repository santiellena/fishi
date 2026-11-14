import { TECHNIQUE_DEFINITIONS } from "../../api/src/core/knowledge";
import type { AnalysisReport, EmailSummary, InboxEmail, ProcessingResult, UiStatus } from "./types";
export const STATUS_LABEL: Record<UiStatus, string> = { PENDING: "Pendiente", PROCESSING: "Analizando", ANALYZED: "Analizado", FAILED: "Falló" };
export function latestRunByEmail(runs: ProcessingResult[]) {
 const map = new Map<string, ProcessingResult>();
 for (const run of runs) if (run.source === "FIXTURE" && run.emailId) map.set(run.emailId, run);
 return map;
}
export const statusOf = (id: string, latest: Map<string, ProcessingResult>): UiStatus => latest.get(id)?.status ?? "PENDING";
export function countByStatus(ids: string[], latest: Map<string, ProcessingResult>) {
 const counts: Record<UiStatus, number> = { PENDING: 0, PROCESSING: 0, ANALYZED: 0, FAILED: 0 };
 for (const id of ids) counts[statusOf(id, latest)]++; return counts;
}
export async function sequential(ids: string[], analyze: (id: string) => Promise<void>) {
 for (const id of ids) await analyze(id);
}

export const RISK_LABEL = { LOW: "bajo", MEDIUM: "medio", HIGH: "alto" } as const;
export const TECHNIQUE_LABEL = Object.fromEntries(Object.entries(TECHNIQUE_DEFINITIONS).map(([technique, definition]) => [technique, definition.label])) as Record<AnalysisReport["techniques"][number], string>;
export function runTime(createdAt: string) {
 const date = new Date(createdAt);
 return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

/** Gmail rows reference existing runs; never insert them into the fixture dataset. */
export function buildInbox(fixtures: EmailSummary[], runs: ProcessingResult[]) {
 const latest = latestRunByEmail(runs);
 const gmail: InboxEmail[] = [];
 for (const run of [...runs].reverse()) {
  if (run.source !== "EXTENSION") continue;
  const id = `gmail:${run.runId}`;
  gmail.push({ id, from: run.emailPreview.from, subject: run.emailPreview.subject, source: "EXTENSION" });
  latest.set(id, run);
 }
 const entries: InboxEmail[] = [...gmail, ...fixtures.map(email => ({ ...email, source: "FIXTURE" as const }))];
 return { entries, latest };
}
