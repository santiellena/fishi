import { it, expect } from "vitest";
import { latestRunByEmail, statusOf, sequential } from "./lib";
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
