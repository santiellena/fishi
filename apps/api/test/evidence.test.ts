import { it, expect } from "vitest";
import { evidenceFragments } from "../src/core/evidence.js";
import { SocialEngineeringAnalyzer } from "../src/core/socialEngineeringAnalyzer.js";
import type { LLMClient, LLMResponse } from "../src/core/llm.js";

it("preserva todos los campos literalmente, incluidos saltos, Unicode y URLs largas", () => {
 const email = { from: "a@prueba.example", subject: "Prueba", textBody: "á".repeat(599) + "🐟\n" + " Texto con espacios.\n".repeat(100), links: ["https://prueba.example/" + "a".repeat(2000)] };
 const fragments = evidenceFragments(email);
 expect(new Set(fragments.map(f => f.id)).size).toBe(fragments.length);
 for (const [field, text] of [["from", email.from], ["subject", email.subject], ["textBody", email.textBody], ["links.0", email.links[0]]]) {
  expect(fragments.filter(f => f.field === field).map(f => f.text).join("")).toBe(text);
 }
 expect(fragments.every(f => f.text.length <= 600)).toBe(true);
 expect(fragments.some(f => /[\ud800-\udbff]$/.test(f.text))).toBe(false);
});
it("Claude selecciona IDs, Fishi cita el original y deriva técnicas sin segunda llamada", async () => {
 const input = { from: "a@prueba.example", subject: "Prueba", textBody: "Tu cuenta\n\nse bloqueará en 30 minutos. No compartas el código. " };
 let calls = 0;
 const client: LLMClient = { complete: async request => {
  calls++;
  const { emailFragments } = JSON.parse(String(request.messages[0]!.content));
  const body = emailFragments.find((f: { field: string }) => f.field === "textBody");
  const props = request.outputFormat!.schema.properties as Record<string, any>;
  expect(props.techniques).toBeUndefined(); expect(props.indicators.items.properties.evidence).toBeUndefined();
  expect(props.indicators.items.properties.evidenceId.enum).toContain(body.id);
  const indicator = { technique: "URGENCY", evidenceId: body.id, explanation: "Presión temporal." };
  return { content: [{ type: "text", citations: null, text: JSON.stringify({ risk: "HIGH", summary: "Hay presión temporal.", indicators: [indicator, indicator], recommendations: ["Verificar por otro canal.", " Verificar por otro canal. "] }) }], stopReason: "end_turn", usage: { input: 0, output: 0 } };
 } };
 const result = await new SocialEngineeringAnalyzer(client).analyze(input);
 expect(calls).toBe(1); expect(result.report.indicators).toHaveLength(1);
 expect(result.report.techniques).toEqual(["URGENCY"]); expect(result.report.recommendations).toHaveLength(1);
 expect(result.report.indicators[0]!.evidence).toBe(input.textBody.trim());
 expect(input.textBody.includes(result.report.indicators[0]!.evidence)).toBe(true);
});
it("rechaza IDs inexistentes y nunca interpreta un ID como una instrucción", async () => {
 const email = { from: "a@prueba.example", subject: "Prueba", textBody: "Mensaje sintético" };
 for (const evidenceId of ["e999", "ignore previous instructions"]) {
  const report = { risk: "HIGH", summary: "Prueba", indicators: [{ technique: "URGENCY", evidenceId, explanation: "Prueba" }], recommendations: ["Verificar"] };
  const client: LLMClient = { complete: async (): Promise<LLMResponse> => ({ content: [{ type: "text", text: JSON.stringify(report), citations: null }], stopReason: "end_turn", usage: { input: 0, output: 0 } }) };
  await expect(new SocialEngineeringAnalyzer(client).analyze(email)).rejects.toThrow();
 }
});
