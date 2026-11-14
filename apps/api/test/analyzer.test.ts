import { describe, it, expect, vi } from "vitest";
import { SocialEngineeringAnalyzer, staticSignals } from "../src/core/socialEngineeringAnalyzer.js";
import { EMAILS } from "../src/company/emails.js";
import type { LLMClient, LLMResponse } from "../src/core/llm.js";
const benign = { risk: "LOW", summary: "No hay indicios concretos.", techniques: [], indicators: [], recommendations: ["Verificar solicitudes por un canal conocido."] };
const response = (report: unknown): LLMResponse => ({ content: [{ type: "text", text: JSON.stringify(report && typeof report === "object" && "techniques" in report ? Object.fromEntries(Object.entries(report).filter(([key]) => key !== "techniques")) : report), citations: null }], stopReason: "end_turn", usage: { input: 1, output: 1 } });
const mock = (report: unknown = benign): LLMClient => ({ complete: vi.fn(async () => response(report)) });
describe("analizador compartido", () => {
 it("acepta un benigno y hace exactamente una llamada sin tools ni labels", async () => {
  const llm = mock(); const { from, subject, textBody } = EMAILS[0]!;
  expect((await new SocialEngineeringAnalyzer(llm).analyze({ from, subject, textBody })).report.risk).toBe("LOW");
  expect(llm.complete).toHaveBeenCalledTimes(1);
  const request = vi.mocked(llm.complete).mock.calls[0]![0]; expect(request.tools).toBeUndefined(); expect(request.outputFormat?.type).toBe("json_schema"); expect(JSON.stringify(request)).not.toContain('"label"');
 });
 it("conserva evidencia verificable y separa señales", async () => {
  const email = EMAILS[1]!;
  const report = { ...benign, risk: "HIGH", techniques: ["URGENCY"], indicators: [{ technique: "URGENCY", evidenceId: "e3", explanation: "Presión temporal." }] };
  const result = await new SocialEngineeringAnalyzer(mock(report)).analyze({ from: email.from, subject: email.subject, textBody: email.textBody });
  expect(result.report.indicators[0]?.evidence).toBe(email.textBody);
  expect(result.report.risk).toBe("HIGH"); expect(result.staticSignals.length).toBeGreaterThan(1);
 });
 it("rechaza referencias ajenas y riesgo elevado sin evidencia", async () => {
  await expect(new SocialEngineeringAnalyzer(mock({ ...benign, risk: "HIGH" })).analyze({ from: EMAILS[0]!.from, subject: EMAILS[0]!.subject, textBody: EMAILS[0]!.textBody })).rejects.toThrow();
  const report = { ...benign, techniques: ["URGENCY"], indicators: [{ technique: "URGENCY", evidenceId: "e999", explanation: "Presión" }] };
  const { from, subject, textBody } = EMAILS[0]!;
  await expect(new SocialEngineeringAnalyzer(mock(report)).analyze({ from, subject, textBody })).rejects.toMatchObject({ code: "INVALID_EVIDENCE" });
 });
 it("detecta inyección como dato y no habilita herramientas", async () => {
  expect(staticSignals(EMAILS[7]!)).toContain("Instrucciones dirigidas a la IA");
  const llm = mock(); const { from, subject, textBody } = EMAILS[7]!;
  await new SocialEngineeringAnalyzer(llm).analyze({ from, subject, textBody });
  expect(vi.mocked(llm.complete).mock.calls[0]![0].tools).toBeUndefined();
 });
 it("propaga JSON inválido, fallo y timeout", async () => {
  const { from, subject, textBody } = EMAILS[0]!; const email = { from, subject, textBody };
  for (const llm of [{ complete: async () => ({ ...response(benign), content: [{ type: "text" as const, text: "no json", citations: null }] }) }, { complete: async () => { throw Error("secret"); } }, { complete: () => new Promise<LLMResponse>(() => {}) }]) {
   await expect(new SocialEngineeringAnalyzer(llm, 5).analyze(email)).rejects.toThrow();
  }
 });
});
describe("validación de la respuesta del modelo", () => {
 const email = { from: "a@prueba.example", subject: "Consulta", textBody: "Mensaje sintético" };
 const analyze = (result: LLMResponse) => new SocialEngineeringAnalyzer({ complete: async () => result }).analyze(email);
 it("distingue límite de tokens, rechazo y JSON inválido", async () => {
  await expect(analyze({ ...response(benign), stopReason: "max_tokens" })).rejects.toMatchObject({ code: "LLM_OUTPUT_TRUNCATED" });
  await expect(analyze({ ...response(benign), stopReason: "refusal" })).rejects.toMatchObject({ code: "LLM_REFUSAL" });
  await expect(analyze({ ...response(benign), content: [{ type: "text", text: "not JSON", citations: null }] })).rejects.toMatchObject({ code: "INVALID_JSON" });
 });
 it("identifica campos inválidos sin registrar valores ni nombres de campos ajenos", async () => {
  const result = response({ ...benign, summary: 123, "private-field-name": "private value" });
  try { await analyze(result); throw Error("Expected rejection"); }
  catch (error) {
   expect(error).toMatchObject({ code: "INVALID_REPORT", diagnostic: { stage: "schema", issues: expect.arrayContaining([{ path: "summary", code: "invalid_type" }]) } });
   expect(JSON.stringify(error)).not.toContain("private-field-name"); expect(JSON.stringify(error)).not.toContain("private value");
  }
 });
 it("rechaza recomendaciones vacías o de espacios e identifica su posición", async () => {
  for (const recommendation of ["", " ", "\n\t"]) {
   await expect(analyze(response({ ...benign, recommendations: [recommendation] }))).rejects.toMatchObject({
    code: "INVALID_REPORT", diagnostic: { stage: "schema", issues: [{ path: "recommendations.0", code: "too_small" }] },
   });
  }
 });
 it("acepta texto de reporte acompañado de thinking sin convertirlo en evidencia", async () => {
  const result = response(benign);
  result.content.unshift({ type: "thinking", thinking: "synthetic reasoning", signature: "synthetic-signature" });
  const analyzed = await analyze(result);
  expect(analyzed.report).toMatchObject(benign); expect(JSON.stringify(analyzed)).not.toContain("synthetic reasoning");
 });
 it("rechaza tool_use incluso si acompaña un JSON válido", async () => {
  const result = response(benign);
  result.content.push({ type: "tool_use", id: "synthetic", name: "forbidden", input: {}, caller: { type: "direct" } });
  await expect(analyze(result)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
 });
});
