// @vitest-environment jsdom
import { beforeEach, it, expect, vi } from 'vitest';
import { extractGmailMessage } from './extractor.js';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const fixture = `<div role="main"><h2 class="hP">Asunto sintético</h2><div class="adn"><span class="gD" email="ana@test.example">Ana</span><div class="a3s aiL">Mensaje sintético <a href="https://test.example">portal</a><span hidden>oculto</span></div></div></div>`;
beforeEach(() => {
 vi.stubGlobal('location', { origin: 'https://mail.google.com' });
 document.body.innerHTML = fixture;
 vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}]);
 Object.defineProperty(HTMLElement.prototype, 'innerText', { configurable: true, get() {
  const copy = this.cloneNode(true); copy.querySelectorAll('[hidden], [aria-hidden="true"], [style*="display: none"]').forEach(n => n.remove()); return copy.textContent;
 } });
});
it('extrae solo el mensaje visible con enlaces como texto', () => {
 const result = extractGmailMessage(); expect(result.ok).toBe(true); const email = result.email; expect(email.from).toBe('ana@test.example'); expect(email.subject).toBe('Asunto sintético'); expect(email.textBody).not.toContain('oculto'); expect(email.links).toEqual(['https://test.example']);
});
it('rechaza inbox vacío, otra pestaña, múltiples mensajes y contenido citado', () => {
 for (const html of ['', fixture + fixture, fixture.replace('</div></div></div>', '<blockquote type="cite">Cita anterior</blockquote></div></div></div>')]) {
  document.body.innerHTML = html; expect(extractGmailMessage()).toMatchObject({ ok: false, error: expect.any(String) });
 }
 document.body.innerHTML = fixture; vi.stubGlobal('location', { origin: 'https://evil.example' }); expect(extractGmailMessage()).toMatchObject({ ok: false, error: expect.any(String) });
});
it('rechaza remitente ausente, campos grandes y cuerpos ocultos', () => {
 for (const html of [fixture.replace('email="ana@test.example"', ''), fixture.replace('Mensaje sintético', 'x'.repeat(20001)), fixture.replace('class="a3s aiL"', 'class="a3s aiL" hidden')]) {
  document.body.innerHTML = html; expect(extractGmailMessage()).toMatchObject({ ok: false, error: expect.any(String) });
 }
});
it('manifest mínimo, sin permisos globales ni scripts remotos', () => {
 const manifest = JSON.parse(readFileSync('manifest.json'));
 expect(manifest.manifest_version).toBe(3); expect(manifest.permissions).toEqual(['activeTab', 'scripting']); expect(manifest.host_permissions).toEqual(['http://127.0.0.1:3001/*']); expect(manifest.content_scripts).toBeUndefined();
});

it('conserva éxito y error al serializar la función como executeScript', () => {
 const execute = () => JSON.parse(JSON.stringify(runInNewContext(`(${extractGmailMessage.toString()})()`, { document, location, Element, getComputedStyle })));
 expect(execute()).toMatchObject({ ok: true, email: { subject: 'Asunto sintético' } });
 document.body.innerHTML = '';
 expect(execute()).toMatchObject({ ok: false, error: expect.stringContaining('vistas visibles: 0') });
});

it('acepta blockquote de formato sin confundirlo con otra conversación', () => {
 document.body.innerHTML = fixture.replace('Mensaje sintético', '<blockquote>Texto sintético con formato</blockquote>');
 const result = extractGmailMessage();
 expect(result.ok).toBe(true); expect(result.email.textBody).toContain('Texto sintético con formato');
});
it('rechaza citas marcadas y dos cuerpos expandidos dentro de la misma vista', () => {
 for (const extra of ['<div class="gmail_quote">Mensaje anterior</div>', '<blockquote type="cite">Mensaje anterior</blockquote>', '<div class="a3s aiL">Segundo mensaje</div>']) {
  document.body.innerHTML = fixture.replace('Mensaje sintético', extra + 'Mensaje sintético');
  expect(extractGmailMessage().ok).toBe(false);
 }
});
it('no rechaza una cita marcada que no está visible', () => {
 document.body.innerHTML = fixture.replace('Mensaje sintético', '<div class="gmail_quote" hidden>Cita oculta</div>Mensaje sintético');
 const result = extractGmailMessage();
 expect(result.ok).toBe(true); expect(result.email.textBody).not.toContain('Cita oculta');
});

it('acepta gmail_quote cuando envuelve todo el cuerpo de un único mensaje', () => {
 document.body.innerHTML = fixture.replace('class="a3s aiL">', 'class="a3s aiL"><div class="gmail_quote">').replace('</div></div></div>', '</div></div></div></div>');
 const result = extractGmailMessage();
 expect(result.ok).toBe(true); expect(result.email.from).toBe('ana@test.example');
 expect(result.email.textBody).toContain('Mensaje sintético'); expect(result.email.links).toEqual(['https://test.example']);
});
it('un envoltorio gmail_quote no oculta citas internas o varios cuerpos', () => {
 for (const inner of ['Texto actual<div class="gmail_quote">Respuesta anterior</div>', '<blockquote type="cite">Respuesta anterior</blockquote>', '<div class="a3s aiL">Otro mensaje</div>']) {
  document.body.innerHTML = fixture.replace('Mensaje sintético', `<div class="gmail_quote">${inner}</div>`);
  expect(extractGmailMessage().ok).toBe(false);
 }
});
