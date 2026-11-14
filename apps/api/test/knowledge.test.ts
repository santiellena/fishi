import { it, expect, vi } from "vitest";
import { FRAMEWORK_VERSION, REFERENCES, RISK_CRITERIA, TECHNIQUE_DEFINITIONS } from "../src/core/knowledge.js";
import { TechniqueSchema } from "../src/core/types.js";
import { SocialEngineeringAnalyzer } from "../src/core/socialEngineeringAnalyzer.js";
import type { LLMClient, LLMResponse } from "../src/core/llm.js";

it("toda categoría tiene criterio, límite y fuentes existentes", () => {
 expect(Object.keys(TECHNIQUE_DEFINITIONS).sort()).toEqual([...TechniqueSchema.options].sort());
 for (const definition of Object.values(TECHNIQUE_DEFINITIONS)) {
  expect(definition.criterion).toBeTruthy(); expect(definition.limitation).toBeTruthy();
  expect(definition.referenceIds.length).toBeGreaterThan(0);
  expect(definition.referenceIds.every(id => id in REFERENCES)).toBe(true);
 }
 expect(REFERENCES.NIST_PHISH_SCALE.scope).toContain("dificultad humana");
 expect(RISK_CRITERIA.MEDIUM).toContain("ambiguo");
});
it("el marco guía al modelo y el backend agrega la procedencia sin pedir citas bibliográficas al LLM", async () => {
 const complete = vi.fn<LLMClient["complete"]>(async () => ({ content: [{ type: "text", citations: null, text: JSON.stringify({ risk: "HIGH", summary: "Solicita credenciales.", indicators: [{ technique: "CREDENTIAL_REQUEST", evidenceId: "e3", explanation: "Pide entregar la contraseña." }], recommendations: ["Verificar por un canal conocido."] }) }], stopReason: "end_turn", usage: { input: 1, output: 1 } }));
 const result = await new SocialEngineeringAnalyzer({ complete }).analyze({ from: "a@prueba.example", subject: "Verificación", textBody: "Enviá tu contraseña." });
 expect(complete).toHaveBeenCalledTimes(1);
 const request = complete.mock.calls[0]![0];
 expect(request.system).toContain(FRAMEWORK_VERSION);
 for (const definition of Object.values(TECHNIQUE_DEFINITIONS)) expect(request.system).toContain(definition.criterion);
 expect(request.system).toContain("No sumes palabras clave"); expect(request.system).toContain("no calcula esa escala");
 expect(request.tools).toBeUndefined();
 expect(result.report.frameworkVersion).toBe(FRAMEWORK_VERSION);
 expect(result.report.indicators[0]).toMatchObject({ evidence: "Enviá tu contraseña.", referenceIds: TECHNIQUE_DEFINITIONS.CREDENTIAL_REQUEST.referenceIds, criterion: TECHNIQUE_DEFINITIONS.CREDENTIAL_REQUEST.criterion, limitation: TECHNIQUE_DEFINITIONS.CREDENTIAL_REQUEST.limitation });
});
it("las reglas no fuerzan el riesgo del LLM", async () => {
 const response: LLMResponse = { content: [{ type: "text", citations: null, text: JSON.stringify({ risk: "LOW", summary: "Aviso legítimo en este ejemplo simulado.", indicators: [], recommendations: ["Verificar el horario en el canal habitual."] }) }], stopReason: "end_turn", usage: { input: 0, output: 0 } };
 const result = await new SocialEngineeringAnalyzer({ complete: async () => response }).analyze({ from: "a@prueba.example", subject: "Urgente", textBody: "La biblioteca cerrará temprano." });
 expect(result.staticFindings.some(f => f.ruleId === "URGENCY")).toBe(true);
 expect(result.report.risk).toBe("LOW"); expect(result.report.indicators).toEqual([]);
});
it("el modelo no puede inventar la versión ni las referencias del marco", async () => {
 const report = { risk: "LOW", summary: "Prueba", indicators: [], recommendations: ["Verificar"], frameworkVersion: "fake", referenceIds: ["fake"] };
 const response: LLMResponse = { content: [{ type: "text", citations: null, text: JSON.stringify(report) }], stopReason: "end_turn", usage: { input: 0, output: 0 } };
 await expect(new SocialEngineeringAnalyzer({ complete: async () => response }).analyze({ from: "a", subject: "Prueba", textBody: "Prueba" })).rejects.toMatchObject({ code: "INVALID_REPORT" });
});
