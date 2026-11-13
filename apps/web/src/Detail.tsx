import { StatusBadge } from "./Inbox";
import type { EmailDetail, ProcessingResult } from "./types";
export function Report({ run }: { run?: ProcessingResult }) {
 if (!run) return <section className="panel"><p>Pendiente de análisis.</p></section>;
 const report = run.report;
 return <section className="panel report-hero" aria-label="Reporte de análisis">
  <header className="panel-head"><h3>Evaluación de Claude</h3><StatusBadge status={run.status} /></header>
  {run.status === "FAILED" && <p role="alert">{run.error} No hay evaluación de riesgo disponible.</p>}
  {run.status === "PROCESSING" && <p>Analizando el correo…</p>}
  {run.status === "ANALYZED" && report && <div className="report">
   <span className={`risk-badge risk-${report.risk}`}>Riesgo {report.risk}</span>
   <p className="report-summary">{report.summary}</p>
   <div className="chips">{report.techniques.map(t => <span className="chip" key={t}>{t}</span>)}</div>
   <h4>Evidencias y explicación</h4>
   {report.indicators.length === 0 && <p>Sin indicios concretos en la respuesta del modelo.</p>}
   {report.indicators.map((i, n) => <div className="evidence" key={n}><strong>{i.technique}</strong><blockquote>“{i.evidence}”</blockquote><p>{i.explanation}</p></div>)}
   <h4>Recomendaciones</h4><ul>{report.recommendations.map(r => <li key={r}>{r}</li>)}</ul>
  </div>}
  <h4>Señales estáticas · reglas deterministas</h4>
  {run.staticSignals.length ? <ul>{run.staticSignals.map(s => <li key={s}>{s}</li>)}</ul> : <p>No se detectaron los patrones configurados.</p>}
  <p className="hint">Evaluación orientativa: puede haber falsos positivos y falsos negativos. Las señales no prueban fraude ni verifican la identidad del remitente.</p>
 </section>;
}
interface Props { email: EmailDetail | null; emailId: string; subject: string; from: string; run?: ProcessingResult; busy: boolean; onProcess: () => void }
export function Detail({ email, subject, from, run, busy, onProcess }: Props) {
 return <div className="detail"><header className="case-title"><h2>{subject}</h2><p className="muted">{from}</p><button className="btn btn-primary" disabled={busy || run?.status === "PROCESSING"} onClick={onProcess}>Analizar</button></header>
  <section className="panel email-panel"><h3>Correo sintético · contenido no confiable</h3><blockquote className="email-body">{email?.textBody ?? "Cargando correo…"}</blockquote>{email?.links?.map(l => <p key={l}>{l}</p>)}</section>
  <Report run={run} /></div>;
}
