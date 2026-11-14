import { it, expect } from "vitest";
import { EmailInputSchema, ReportSchema } from "../src/core/types.js";
const input = { from: "a@prueba.example", subject: "Prueba", textBody: "Mensaje" };
const report = { risk: "LOW", summary: "Sin indicios concretos.", techniques: [], indicators: [], recommendations: ["Verificar por otro canal."] };
it("normaliza espacios sin truncar ni descartar campos desconocidos", () => {
 expect(EmailInputSchema.parse({ ...input, subject: " Prueba " }).subject).toBe("Prueba");
 expect(EmailInputSchema.safeParse({ ...input, unknown: true }).success).toBe(false);
});
it.each([
 { ...input, from: "a".repeat(501) }, { ...input, subject: "a".repeat(501) }, { ...input, textBody: "a".repeat(20001) },
 { ...input, subject: " " }, { ...input, links: Array(31).fill("https://prueba.example") }, { ...input, links: ["a".repeat(2049)] },
])("rechaza un input fuera del contrato", candidate => expect(EmailInputSchema.safeParse(candidate).success).toBe(false));
it("acepta límites exactos y enlaces como datos sin visitar ni certificar destinos", () => {
 expect(EmailInputSchema.safeParse({ from: "a".repeat(500), subject: "a".repeat(500), textBody: "a".repeat(20000), links: Array(30).fill("a".repeat(2048)) }).success).toBe(true);
});
it.each([
 { ...report, risk: "UNKNOWN" }, { ...report, risk: "HIGH" }, { ...report, recommendations: [] },
 { ...report, recommendations: [" "] }, { ...report, recommendations: Array(5).fill("Verificar") },
 { ...report, techniques: ["BEC"] }, { ...report, frameworkVersion: "fake" },
 { ...report, techniques: ["URGENCY"], indicators: [{ technique: "URGENCY", evidence: "Urgente", explanation: "Presión", referenceIds: ["inventada"] }] },
])("rechaza un reporte incoherente o con metadatos ajenos", candidate => expect(ReportSchema.safeParse(candidate).success).toBe(false));
