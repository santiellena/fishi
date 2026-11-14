import type { AnalysisErrorCode } from "./analysisError.js";
import { FRAMEWORK_VERSION, REFERENCE_IDS } from "./knowledge.js";
import { z } from "zod";
const text = (max: number) => z.string().trim().min(1).max(max);
export const EmailInputSchema = z.object({ from: text(500), subject: text(500), textBody: text(20000), links: z.array(text(2048)).max(30).optional() }).strict();
export type AnalysisEmailInput = z.infer<typeof EmailInputSchema>;
export const TechniqueSchema = z.enum(["PHISHING", "IMPERSONATION", "PRETEXTING", "URGENCY", "AUTHORITY", "CREDENTIAL_REQUEST", "BEC", "PROMPT_INJECTION"]);
const unique = (a: unknown[]) => new Set(a.map(x => JSON.stringify(x))).size === a.length;
export const ReportSchema = z.object({
 risk: z.enum(["LOW", "MEDIUM", "HIGH"]), summary: text(1000),
 techniques: z.array(TechniqueSchema).max(8).refine(unique),
 indicators: z.array(z.object({ technique: TechniqueSchema, evidence: text(1000), explanation: text(1000), criterion: text(1000).optional(), limitation: text(1000).optional(), referenceIds: z.array(z.enum(REFERENCE_IDS)).max(6).optional() }).strict()).max(5).refine(unique),
 recommendations: z.array(text(500)).min(1).max(4).refine(unique),
 frameworkVersion: z.literal(FRAMEWORK_VERSION).optional(),
}).strict().refine(r => r.risk === "LOW" || r.indicators.length > 0, { message: "Un riesgo elevado requiere evidencia", path: ["risk"] }).refine(r => r.indicators.every(i => r.techniques.includes(i.technique)) && r.techniques.every(t => r.indicators.some(i => i.technique === t)), { message: "Cada técnica necesita evidencia", path: ["techniques"] });
export type AnalysisReport = z.infer<typeof ReportSchema>;
export interface StaticFinding {
 ruleId: string; title: string; technique: z.infer<typeof TechniqueSchema>;
 field: string; evidence: string; explanation: string; limitation: string; referenceIds: (typeof REFERENCE_IDS)[number][];
}
export interface AnalysisRun {
 runId: string; source: "FIXTURE" | "EXTENSION"; emailId?: string;
 emailPreview: { from: string; subject: string }; createdAt: string;
 status: "PROCESSING" | "ANALYZED" | "FAILED";
 report: AnalysisReport | null; staticSignals: string[]; staticFindings?: StaticFinding[]; error?: string; errorCode?: AnalysisErrorCode;
}
