import { describe, it, expect, vi } from "vitest";
import { SocialEngineeringAnalyzer, staticSignals } from "../src/core/socialEngineeringAnalyzer.js";
import { EMAILS } from "../src/company/emails.js";
import type { LLMClient, LLMResponse } from "../src/core/llm.js";
import { createApp } from "../src/http/routes.js";
import { RunStore } from "../src/core/RunStore.js";
const benign = { risk: "LOW", summary: "No hay indicios concretos.", techniques: [], indicators: [], recommendations: ["Verificar solicitudes por un canal conocido."] };
const response = (report: unknown): LLMResponse => ({ content: [{ type: "text", text: JSON.stringify(report), citations: null }], stopReason: "end_turn", usage: { input: 1, output: 1 } });
const mock = (report: unknown = benign): LLMClient => ({ complete: vi.fn(async () => response(report)) });
describe("analizador compartido", () => {
 it("acepta un benigno y hace exactamente una llamada sin tools ni labels", async () => {
  const llm = mock(); const { from, subject, textBody } = EMAILS[0]!;
  expect((await new SocialEngineeringAnalyzer(llm).analyze({ from, subject, textBody })).report.risk).toBe("LOW");
  expect(llm.complete).toHaveBeenCalledTimes(1);
  const request = vi.mocked(llm.complete).mock.calls[0]![0]; expect(request.tools).toBeUndefined(); expect(JSON.stringify(request)).not.toContain('"label"');
 });
 it("conserva evidencia verificable y separa señales", async () => {
  const email = EMAILS[1]!;
  const report = { ...benign, risk: "HIGH", techniques: ["URGENCY"], indicators: [{ technique: "URGENCY", evidence: "30 minutos", explanation: "Presión temporal." }] };
  const result = await new SocialEngineeringAnalyzer(mock(report)).analyze({ from: email.from, subject: email.subject, textBody: email.textBody });
  expect(result.report.risk).toBe("HIGH"); expect(result.staticSignals.length).toBeGreaterThan(1);
 });
 it("rechaza citas inventadas y técnicas sin evidencia", async () => {
  await expect(new SocialEngineeringAnalyzer(mock({ ...benign, techniques: ["BEC"] })).analyze(EMAILS[0]!)).rejects.toThrow();
  const report = { ...benign, techniques: ["URGENCY"], indicators: [{ technique: "URGENCY", evidence: "inventado", explanation: "Presión" }] };
  const { from, subject, textBody } = EMAILS[0]!;
  await expect(new SocialEngineeringAnalyzer(mock(report)).analyze({ from, subject, textBody })).rejects.toThrow();
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
describe("API", () => {
 async function withApi(llm: LLMClient, check: (base: string, store: RunStore) => Promise<void>) {
  const store = new RunStore(); const server = createApp(new SocialEngineeringAnalyzer(llm, 10), store).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address() as { port: number };
  try { await check(`http://127.0.0.1:${address.port}`, store); } finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
 }
 const post = (base: string, path: string, body: unknown) => fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
 it("ambas entradas usan el mismo pipeline, sin modificar fixtures ni guardar cuerpo", async () => {
  const llm = mock(); await withApi(llm, async base => {
   const list = await (await fetch(base + "/emails")).json(); expect(list).toHaveLength(8); expect(JSON.stringify(list)).not.toContain("textBody");
   for (const [path, body, source] of [["/runs", { emailId: "email-001" }, "FIXTURE"], ["/runs/adhoc", { email: { from: "a@test.example", subject: "Hola", textBody: "Mensaje sintético" } }, "EXTENSION"]] as const) {
    const res = await post(base, path, body); expect(res.status).toBe(202); const { runId } = await res.json();
    await new Promise(r => setTimeout(r, 15)); const run = await (await fetch(base + "/runs/" + runId)).json();
    expect(run.status).toBe("ANALYZED"); expect(run.source).toBe(source); expect(run.textBody).toBeUndefined();
   }
   expect(EMAILS).toHaveLength(8); expect(llm.complete).toHaveBeenCalledTimes(2);
  });
 });
 it("valida tamaños, JSON, origen y esquema", async () => {
  await withApi(mock(), async base => {
   expect((await post(base, "/runs/adhoc", { email: { from: "a", subject: "b", textBody: "x".repeat(20001) } })).status).toBe(400);
   expect((await post(base, "/runs", { emailId: "email-001", mode: "PROTECTED" })).status).toBe(400);
   expect((await fetch(base + "/runs", { method: "POST", body: "text" })).status).toBe(415);
   expect((await fetch(base + "/runs", { headers: { Origin: "https://evil.example" } })).status).toBe(403);
   expect((await fetch(base + "/runs", { headers: { Origin: "chrome-extension://" + "a".repeat(32) } })).status).toBe(200);
   expect((await fetch(base + "/runs/missing")).status).toBe(404);
  });
 });
 it("limita concurrencia y frecuencia sin nuevas llamadas al modelo", async () => {
  const llm = { complete: vi.fn(() => new Promise<LLMResponse>(() => {})) };
  await withApi(llm, async base => {
   const body = { emailId: "email-001" };
   expect((await post(base, "/runs", body)).status).toBe(202);
   expect((await post(base, "/runs", body)).status).toBe(202);
   expect((await post(base, "/runs", body)).status).toBe(429);
   expect(llm.complete).toHaveBeenCalledTimes(2);
  });
  await withApi(mock(), async base => {
   for (let n = 0; n < 12; n++) expect((await post(base, "/runs", {})).status).toBe(400);
   expect((await post(base, "/runs", { emailId: "email-001" })).status).toBe(429);
  });
 });
 it("rechaza JSON roto, payload excesivo, links excesivos y esquemas ajenos", async () => {
  await withApi(mock(), async base => {
   for (const text of ["{", JSON.stringify({ email: { from: "a", subject: "b", textBody: "x".repeat(66000) } })]) {
    expect((await fetch(base + "/runs/adhoc", { method: "POST", headers: { "Content-Type": "application/json" }, body: text })).status).toBe(400);
   }
   const email = { from: "a", subject: "b", textBody: "Prueba", links: Array(31).fill("https://test.example") };
   expect((await post(base, "/runs/adhoc", { email })).status).toBe(400);
   expect((await post(base, "/runs/adhoc", { email: { ...email, links: [], secret: "no" } })).status).toBe(400);
  });
 });
 it("fallos y timeout terminan FAILED sin filtrar excepciones", async () => {
  for (const llm of [mock({}), { complete: async () => { throw Error("secret body"); } }, { complete: () => new Promise<LLMResponse>(() => {}) }]) await withApi(llm, async base => {
   const { runId } = await (await post(base, "/runs", { emailId: "email-001" })).json();
   await new Promise(r => setTimeout(r, 25)); const run = await (await fetch(base + "/runs/" + runId)).json();
   expect(run.status).toBe("FAILED"); expect(run.report).toBeNull(); expect(JSON.stringify(run)).not.toContain("secret body");
  });
 });
});
