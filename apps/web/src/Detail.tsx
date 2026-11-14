import { REFERENCES, RISK_CRITERIA, type ReferenceId } from "../../api/src/core/knowledge";
import { Icon } from "./Icons";
import { StatusBadge } from "./Inbox";
import { RISK_LABEL, TECHNIQUE_LABEL } from "./lib";
import type { EmailDetail, ProcessingResult } from "./types";

function ReferenceList({ ids }: { ids: ReferenceId[] }) {
 return <ul className="reference-list">{ids.map(id => {
  const reference = REFERENCES[id];
  return <li key={id}>{"url" in reference ? <a href={reference.url} target="_blank" rel="noopener noreferrer">{reference.title} ↗</a> : <span>{reference.title}</span>}<span>{reference.scope}</span></li>;
 })}</ul>;
}
export function Report({ run }: { run?: ProcessingResult }) {
 if (!run) return <section className="panel report-empty"><Icon name="report" size={26} /><div><h3>¿Algo huele raro?</h3><p>Analizá este correo para ver sus indicios, evidencias y recomendaciones.</p></div><span className="pill pill-PENDING">Pendiente</span></section>;
 const report = run.report;
 return <section className="panel report-hero" aria-label="Reporte de análisis">
  <header className="panel-head"><div><span className="eyebrow">Análisis del contenido</span><h3>Evaluación de Claude</h3></div><StatusBadge status={run.status} /></header>
  {run.status === "FAILED" && <div className="report-failure" role="alert"><Icon name="x" size={20} /><p>{run.error} No hay evaluación de riesgo disponible.</p></div>}
  {run.status === "PROCESSING" && <p className="processing-note" role="status"><Icon name="clock" size={18} />Analizando el correo… El resultado aparecerá acá.</p>}
  {run.status === "ANALYZED" && report && <div className="report">
   <div className={`report-overview overview-${report.risk}`}>
    <div className="risk-heading"><span className={`risk-badge risk-${report.risk}`}><Icon name={report.risk === "LOW" ? "shield" : "flag"} size={17} />Riesgo {RISK_LABEL[report.risk]}</span><span className="muted small">Evaluación orientativa</span></div>
    <p className="report-summary">{report.summary}</p>
    {report.techniques.length > 0 && <div className="chips" aria-label="Técnicas detectadas">{report.techniques.map(t => <span className="chip" key={t} title={t}>{TECHNIQUE_LABEL[t]}</span>)}</div>}
   </div>
   <div className="report-columns">
    <section className="evidence-section"><h4><Icon name="report" size={16} />Evidencias del mensaje <span className="section-count">{report.indicators.length}</span></h4>
     {report.indicators.length === 0 && <p className="muted">Sin indicios concretos en la respuesta del modelo.</p>}
     {report.indicators.map((indicator, n) => <div className="evidence" key={n}><span className="evidence-label">{TECHNIQUE_LABEL[indicator.technique]}</span><span className="finding-caption">Observación · cita del mensaje</span><blockquote>“{indicator.evidence}”</blockquote><span className="finding-caption">Interpretación del modelo</span><p>{indicator.explanation}</p>
      {indicator.referenceIds?.length ? <details className="finding-basis"><summary>Criterio, límites y fuentes</summary><p><strong>Criterio:</strong> {indicator.criterion}</p><p><strong>Límite:</strong> {indicator.limitation}</p><ReferenceList ids={indicator.referenceIds} /></details> : null}</div>)}
    </section>
    <section className="recommendations"><h4><Icon name="shield" size={17} />Qué hacer ahora</h4><ol>{report.recommendations.map(r => <li key={r}>{r}</li>)}</ol></section>
   </div>
  </div>}
  <details className="static-panel"><summary>Señales estáticas <span className="section-count">{run.staticSignals.length}</span><span className="muted small">Reglas deterministas</span></summary>
   {run.staticFindings?.length ? <div className="static-findings">{run.staticFindings.map(finding => <article className="static-finding" key={finding.ruleId}>
    <header><strong>{finding.title}</strong><span>{({ from: "Remitente", subject: "Asunto", textBody: "Cuerpo" } as Record<string, string>)[finding.field] ?? "Texto"} · {finding.ruleId}</span></header>
    <blockquote>“{finding.evidence}”</blockquote><p>{finding.explanation}</p><p className="hint">{finding.limitation}</p><ReferenceList ids={finding.referenceIds} />
   </article>)}</div> : run.staticSignals.length ? <ul>{run.staticSignals.map(s => <li key={s}>{s}</li>)}</ul> : <p className="muted">No se detectaron los patrones ES/EN configurados. Esto no demuestra ausencia de ingeniería social.</p>}
   <p className="hint">Las reglas señalan patrones de texto; no deciden el nivel de riesgo.</p>
  </details>
  {report?.frameworkVersion && <details className="framework-panel"><summary>Marco de análisis · {report.frameworkVersion}</summary><p><strong>Criterio del riesgo {RISK_LABEL[report.risk]}:</strong> {RISK_CRITERIA[report.risk]}</p><p>La bibliografía respalda la clasificación, no certifica este correo. Fishi no calcula la Phish Scale ni probabilidades de fraude y no confirma compromiso, pagos ni exfiltración.</p><ReferenceList ids={["NIST_PHISH_SCALE", "FBI_BEC", "OWASP_LLM01", "MITRE_PHISHING", "CLASS_BUYERSEC", "CLASS_CTI"]} /></details>}
  <p className="report-disclaimer">Puede haber falsos positivos y negativos. Los indicios no prueban fraude ni verifican la identidad del remitente.</p>
 </section>;
}
interface Props { email: EmailDetail | null; emailId: string; subject: string; from: string; run?: ProcessingResult; source?: "FIXTURE" | "EXTENSION"; busy: boolean; onProcess: () => void }
export function Detail({ email, subject, from, run, source = "FIXTURE", busy, onProcess }: Props) {
 return <div className="detail">
  <header className="case-head"><div className="case-title"><span className="eyebrow">{source === "EXTENSION" ? "Gmail · Extensión" : "Correo de ejemplo"}</span><h2>{subject}</h2><p className="case-from">{from}</p></div>{source === "FIXTURE" && <button className="btn btn-primary" title="Enviar este correo al analizador de Anthropic Claude" disabled={busy || run?.status === "PROCESSING"} onClick={onProcess}><Icon name="play" size={16} />{run?.status === "PROCESSING" ? "Analizando…" : "Analizar"}</button>}</header>
  <section className="panel email-panel"><header className="email-head"><h3><Icon name="mail" size={17} />Contenido del correo</h3><span className="tag tag-warn">{source === "EXTENSION" ? "Gmail · contenido externo" : "Ejemplo · contenido externo"}</span></header>{source === "EXTENSION" ? <p className="gmail-content-note">El contenido original permanece en Gmail. Acá podés consultar el reporte y sus evidencias. Para volver a analizarlo, usá la extensión.</p> : <><blockquote className="email-body">{email?.textBody ?? "Cargando correo…"}</blockquote>{email?.links?.map(link => <p className="email-link" key={link}>{link}</p>)}</>}</section>
  <Report run={run} />
 </div>;
}
