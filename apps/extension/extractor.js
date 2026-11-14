// Self-contained: Chrome serializes this function for execution in the active tab.
export function extractGmailMessage() {
 try {
 if (location.origin !== "https://mail.google.com") throw new Error("Abrí Gmail de prueba en la pestaña activa.");
 const visible = el => {
  for (let node = el; node instanceof Element; node = node.parentElement) {
   const style = getComputedStyle(node);
   if (node.hidden || node.getAttribute("aria-hidden") === "true" || style.display === "none" || style.visibility === "hidden") return false;
  }
  return el.getClientRects().length > 0;
 };
 const mains = [...document.querySelectorAll('[role="main"]')].filter(visible);
 if (mains.length !== 1) throw new Error(`No se identifica una vista única de Gmail (vistas visibles: ${mains.length}).`);
 const main = mains[0];
 const subjects = [...main.querySelectorAll('h2.hP')].filter(visible);
 // Multiple expanded messages are deliberately rejected, never concatenated.
 const bodies = [...main.querySelectorAll('.a3s.aiL')].filter(visible);
 if (subjects.length !== 1 || bodies.length !== 1) throw new Error(`Abrí exactamente un mensaje; la conversación está ausente o es ambigua (asuntos visibles: ${subjects.length}; cuerpos visibles: ${bodies.length}).`);
 const body = bodies[0]; const message = body.closest('.adn');
 if (!message || !visible(message)) throw new Error("No se identifica el contenedor del mensaje.");
 const senders = [...message.querySelectorAll('.gD[email]')].filter(visible);
 if (senders.length !== 1) throw new Error(`No se identifica un remitente único (remitentes visibles: ${senders.length}).`);
 // A generic blockquote can be layout or an ordinary quotation, not a prior email.
 // Reject only explicit quote markers; this remains a best-effort DOM heuristic.
 if ([...body.querySelectorAll('.gmail_quote, blockquote[type="cite"]')].some(visible)) throw new Error("El mensaje incluye una conversación citada; usá un mensaje de prueba independiente.");
 const from = senders[0].getAttribute('email')?.trim();
 const subject = subjects[0].innerText.trim(); const textBody = body.innerText.trim();
 const links = [...new Set([...body.querySelectorAll('a[href]')].filter(visible).map(a => a.getAttribute('href')).filter(href => /^https?:\/\//i.test(href ?? '')))];
 if (!from || !subject || !textBody || from.length > 500 || subject.length > 500 || textBody.length > 20000 || links.length > 30 || links.some(l => l.length > 2048)) throw new Error("Mensaje incompleto o excede los límites de Fishi. No se truncó el contenido.");
 return { ok: true, email: { from, subject, textBody, links } };
 } catch (error) {
  // InjectionResult does not reliably transport thrown errors to the popup.
  // Return a plain serializable value from the injected function instead.
  return { ok: false, error: error instanceof Error ? error.message : "No se pudo leer el mensaje de Gmail." };
 }
}
