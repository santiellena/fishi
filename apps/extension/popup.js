import { extractGmailMessage } from './extractor.js';
const $ = id => document.getElementById(id);
const api = 'http://127.0.0.1:3001';
let email = null;
const status = text => { $('status').textContent = text; };
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
 email = null; $('preview').hidden = true; $('result').hidden = true; $('extract').disabled = true;
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
 } catch (e) { status(e.message || 'No se pudo leer Gmail.'); }
 finally { $('extract').disabled = false; }
};
$('cancel').onclick = () => { email = null; $('email').textContent = ''; $('preview').hidden = true; status('Envío cancelado.'); };
$('confirm').onclick = async () => {
 if (!email) return;
 $('confirm').disabled = true; $('extract').disabled = true; $('cancel').disabled = true;
 try {
  status('PROCESSING · Analizando… Mantené este popup abierto.');
  const { runId } = await request('/runs/adhoc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
  email = null; $('email').textContent = ''; $('preview').hidden = true;
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
   const run = await request('/runs/' + encodeURIComponent(runId));
   if (run.status === 'FAILED') throw new Error(run.error || 'FAILED · Sin evaluación de riesgo.');
   if (run.status === 'ANALYZED' && run.report) {
    const report = run.report; const result = $('result'); result.replaceChildren();
    for (const text of [`Riesgo ${report.risk}`, report.techniques.join(' · ') || 'Sin técnicas detectadas', report.summary, report.recommendations[0]]) {
     const p = document.createElement('p'); p.textContent = text; result.append(p);
    }
    result.hidden = false; status('ANALYZED · Reporte completo en Análisis recientes de Fishi Web.'); return;
   }
   await new Promise(resolve => setTimeout(resolve, 800));
  }
  throw new Error('Tiempo de espera agotado. Consultá Análisis recientes en Fishi Web.');
 } catch (e) { email = null; $('preview').hidden = true; $('email').textContent = ''; status(e.message || 'API local no disponible. No hay evaluación de riesgo.'); }
 finally { $('confirm').disabled = false; $('extract').disabled = false; $('cancel').disabled = false; }
};
