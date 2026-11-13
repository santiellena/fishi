import type { ProcessingResult, UiStatus } from "./types";
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
