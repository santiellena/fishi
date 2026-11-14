import { it, expect } from "vitest";
import { latestRunByEmail, statusOf, sequential, buildInbox, countByStatus } from "./lib";
import type { ProcessingResult } from "./types";
it("separa extensión de fixtures y nunca convierte FAILED en bajo riesgo", () => {
 const base = { runId: "1", source: "FIXTURE", emailId: "email-001", status: "FAILED", report: null, staticSignals: [], emailPreview: { from: "a", subject: "b" }, createdAt: "now" } as ProcessingResult;
 const latest = latestRunByEmail([base, { ...base, source: "EXTENSION", runId: "2" }]);
 expect(latest.get("email-001")?.runId).toBe("1"); expect(statusOf("email-001", latest)).toBe("FAILED"); expect(statusOf("email-002", latest)).toBe("PENDING");
});
it("analiza lotes secuencialmente", async () => {
 let active = 0; const order: string[] = [];
 await sequential(["a", "b"], async id => { expect(active++).toBe(0); await Promise.resolve(); order.push(id); active--; });
 expect(order).toEqual(["a", "b"]);
});

it("cuenta Gmail con su estado real y conserva los fixtures sin alterarlos", () => {
 const fixtures = [{ id: "email-001", from: "a@prueba.example", subject: "Ejemplo" }];
 const base: ProcessingResult = { runId: "external", source: "EXTENSION", status: "ANALYZED", report: null, staticSignals: [], emailPreview: { from: "b@prueba.example", subject: "Gmail" }, createdAt: "now" };
 const runs: ProcessingResult[] = [base, { ...base, runId: "failed", status: "FAILED" }, { ...base, runId: "processing", status: "PROCESSING" }];
 const { entries, latest } = buildInbox(fixtures, runs);
 expect(entries).toHaveLength(4); expect(fixtures).toHaveLength(1);
 expect(countByStatus(entries.map(e => e.id), latest)).toEqual({ ANALYZED: 1, FAILED: 1, PROCESSING: 1, PENDING: 1 });
 expect(latest.get("email-001")).toBeUndefined();
 expect(latest.get("gmail:external")?.source).toBe("EXTENSION");
});
