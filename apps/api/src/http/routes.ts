import express from "express";
import { z } from "zod";
import { EMAILS, findEmail } from "../company/emails.js";
import { EmailInputSchema, type AnalysisEmailInput } from "../core/types.js";
import { staticSignals, type SocialEngineeringAnalyzer } from "../core/socialEngineeringAnalyzer.js";
import { RunStore } from "../core/RunStore.js";
export function createApp(analyzer: Pick<SocialEngineeringAnalyzer, "analyze">, store = new RunStore()) {
 const app = express(); app.disable("x-powered-by");
 const webOrigins = new Set(["http://127.0.0.1:5173", "http://localhost:5173"]);
 app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store"); res.setHeader("X-Content-Type-Options", "nosniff");
  const origin = req.headers.origin;
  // Local unpacked extensions have changing IDs. This is origin filtering, not authentication.
  if (origin && !webOrigins.has(origin) && !/^chrome-extension:\/\/[a-p]{32}$/.test(origin)) return res.status(403).json({ error: "Origen no permitido" });
  if (origin) { res.setHeader("Access-Control-Allow-Origin", origin); res.setHeader("Vary", "Origin"); }
  if (req.method === "OPTIONS") { res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS"); res.setHeader("Access-Control-Allow-Headers", "Content-Type"); return res.sendStatus(204); }
  if (req.method === "POST" && !req.is("application/json")) return res.status(415).json({ error: "Se requiere JSON" });
  next();
 });
 app.use(express.json({ limit: "64kb", inflate: false }));
 let windowStart = Date.now(); let starts = 0;
 app.use("/runs", (req, res, next) => {
  if (req.method !== "POST") return next();
  if (Date.now() - windowStart >= 60000) { windowStart = Date.now(); starts = 0; }
  if (++starts > 12 || store.list().filter(r => r.status === "PROCESSING").length >= 2) return res.status(429).json({ error: "Límite de análisis; intentá más tarde" });
  next();
 });
 const start = (input: AnalysisEmailInput, source: "FIXTURE" | "EXTENSION", emailId?: string) => {
  const email = EmailInputSchema.parse(input);
  const run = store.create(email, source, emailId); run.staticSignals = staticSignals(email);
  void Promise.resolve().then(() => analyzer.analyze(email)).then(result => {
   run.report = result.report; run.staticSignals = result.staticSignals; run.status = "ANALYZED";
  }).catch(() => { run.status = "FAILED"; run.report = null; run.error = "No se pudo completar el análisis: servicio no disponible, tiempo agotado o respuesta inválida. Podés reintentar."; });
  return run.runId;
 };
 app.post("/runs", (req, res) => {
  const parsed = z.object({ emailId: z.string().regex(/^email-00[1-8]$/) }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "emailId inválido" });
  const email = findEmail(parsed.data.emailId);
  if (!email) return res.status(404).json({ error: "Correo inexistente" });
  const { from, subject, textBody, links } = email;
  res.status(202).json({ runId: start({ from, subject, textBody, links }, "FIXTURE", email.id) });
 });
 app.post("/runs/adhoc", (req, res) => {
  const parsed = z.object({ email: EmailInputSchema }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Correo inválido o excede los límites" });
  res.status(202).json({ runId: start(parsed.data.email, "EXTENSION") });
 });
 app.get("/emails", (_req, res) => res.json(EMAILS.map(({ id, from, subject }) => ({ id, from, subject }))));
 app.get("/emails/:id", (req, res) => {
  const email = findEmail(req.params.id);
  if (!email) return res.status(404).json({ error: "Correo inexistente" });
  const { id, from, subject, textBody, links } = email; res.json({ id, from, subject, textBody, links });
 });
 app.get("/runs", (_req, res) => res.json(store.list()));
 app.get("/runs/:id", (req, res) => { const run = store.get(req.params.id); return run ? res.json(run) : res.status(404).json({ error: "Análisis inexistente" }); });
 app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.status(400).json({ error: "JSON inválido o mayor que 64 KiB" }); });
 return app;
}
