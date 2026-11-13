import { randomUUID } from "node:crypto";
import type { AnalysisRun, AnalysisEmailInput } from "./types.js";
export class RunStore {
 private runs = new Map<string, AnalysisRun>();
 create(email: AnalysisEmailInput, source: AnalysisRun["source"], emailId?: string): AnalysisRun {
  if (this.runs.size >= 200) {
   const completed = [...this.runs.values()].find(r => r.status !== "PROCESSING");
   if (completed) this.runs.delete(completed.runId);
  }
  const run: AnalysisRun = { runId: randomUUID(), source, ...(emailId ? { emailId } : {}), emailPreview: { from: email.from, subject: email.subject }, createdAt: new Date().toISOString(), status: "PROCESSING", report: null, staticSignals: [] };
  this.runs.set(run.runId, run); return run;
 }
 get(id: string) { return this.runs.get(id); }
 list() { return [...this.runs.values()]; }
}
