import { extractGmailMessage } from './extractor.js';
const $ = id => document.getElementById(id);
const api = 'http://127.0.0.1:3001';
let email = null;
const status = (text, tone = 'info') => { $('status').textContent = text; $('status').hidden = !text; $('status').dataset.tone = tone; };
const riskLabels = { LOW: 'bajo', MEDIUM: 'medio', HIGH: 'alto' };
const techniqueLabels = { PHISHING: 'Phishing', IMPERSONATION: 'Suplantación', PRETEXTING: 'Pretexto', URGENCY: 'Urgencia', AUTHORITY: 'Autoridad', CREDENTIAL_REQUEST: 'Solicitud de credenciales', BEC: 'Fraude empresarial', PROMPT_INJECTION: 'Inyección de instrucciones' };
const element = (tag, className, text) => {
 const node = document.createElement(tag); node.className = className;
 if (text !== undefined) node.textContent = text;
 return node;
};
function showReport(report) {
 const result = $('result'); result.replaceChildren();
 const top = element('div', 'result-top');
 top.append(element('span', 'result-eyebrow', 'Evaluación de Claude'), element('span', `risk-badge risk-${report.risk}`, `Riesgo ${riskLabels[report.risk]}`));
 const chips = element('div', 'techniques');
 for (const technique of report.techniques) chips.append(element('span', 'technique', techniqueLabels[technique] ?? technique));
 const summary = element('p', 'result-summary', report.summary);
 const explanation = element('details', 'explanation');
 explanation.append(element('summary', '', 'Leer explicación completa'), element('p', '', report.summary));
 const recommendation = element('section', 'next-action');
 recommendation.append(element('h3', '', 'Qué hacer ahora'), element('p', '', report.recommendations[0]));
 const link = element('a', 'button button-secondary report-link', 'Ver reporte completo en Fishi Web ↗');
 link.href = 'http://127.0.0.1:5173/#recent-analyses'; link.target = '_blank'; link.rel = 'noopener noreferrer';
 result.append(top, chips, summary, explanation, recommendation, link); result.hidden = false;
 $('intro').hidden = true; $('extract').textContent = 'Analizar otro correo'; $('extract').classList.replace('button-primary', 'button-secondary');
}
async function request(path, options = {}) {
 let res;
 try { res = await fetch(api + path, { ...options, signal: AbortSignal.timeout(10000) }); }
 catch (error) {
  if (error?.name === 'TimeoutError') throw new Error('La API local no respondió en 10 segundos. El análisis puede seguir activo; consultá Análisis recientes en Fishi Web antes de reintentar.');
  if (error instanceof TypeError) throw new Error('API local no disponible. Comprobá que Fishi API siga encendida.');
  throw error;
 }
 if (!res.ok) throw new Error(`La API rechazó la solicitud (${res.status}). Revisá los límites y el backend.`);
 return res.json();
}
$('extract').onclick = async () => {
 email = null; $('preview').hidden = true; $('result').hidden = true; $('intro').hidden = false; $('extract').disabled = true; status('Leyendo el mensaje abierto…');
 try {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || new URL(tab.url).origin !== 'https://mail.google.com') throw new Error('Abrí Gmail de prueba en la pestaña activa.');
  const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractGmailMessage });
  if (results.length !== 1 || !results[0]?.result) throw new Error('El extractor no devolvió una respuesta. Recargá la extensión y la pestaña de Gmail.');
  const extraction = results[0].result;
  if (extraction.ok === false) throw new Error(extraction.error || 'No se pudo leer el mensaje de Gmail.');
  if (extraction.ok !== true || !extraction.email) throw new Error('Respuesta del extractor incompatible. Recargá la extensión y Gmail.');
  email = extraction.email;
  $('email').textContent = `${email.from}\n${email.subject}\n\n${email.textBody}`;
  $('preview').hidden = false; status('Revisá la vista previa antes de confirmar.');
 } catch (e) { status(e.message || 'No se pudo leer Gmail.', 'error'); }
 finally { $('extract').disabled = false; }
};
$('cancel').onclick = () => { email = null; $('email').textContent = ''; $('preview').hidden = true; status('Envío cancelado.'); };
$('confirm').onclick = async () => {
 if (!email) return;
 $('confirm').disabled = true; $('extract').disabled = true; $('cancel').disabled = true;
 try {
  status('Analizando… Mantené este popup abierto.', 'processing');
  const { runId } = await request('/runs/adhoc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
  email = null; $('email').textContent = ''; $('preview').hidden = true;
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
   const run = await request('/runs/' + encodeURIComponent(runId));
   if (run.status === 'FAILED') throw new Error(run.error || 'FAILED · Sin evaluación de riesgo.');
   if (run.status === 'ANALYZED' && run.report) {
    showReport(run.report); status('Análisis completado', 'success'); return;
   }
   await new Promise(resolve => setTimeout(resolve, 800));
  }
  throw new Error('Tiempo de espera agotado. Consultá Análisis recientes en Fishi Web.');
 } catch (e) { email = null; $('preview').hidden = true; $('email').textContent = ''; status(e.message || 'API local no disponible. No hay evaluación de riesgo.', 'error'); }
 finally { $('confirm').disabled = false; $('extract').disabled = false; $('cancel').disabled = false; }
};
