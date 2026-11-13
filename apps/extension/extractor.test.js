// @vitest-environment jsdom
import { beforeEach, it, expect, vi } from 'vitest';
import { extractGmailMessage } from './extractor.js';
import { readFileSync } from 'node:fs';
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
 const email = extractGmailMessage(); expect(email.from).toBe('ana@test.example'); expect(email.subject).toBe('Asunto sintético'); expect(email.textBody).not.toContain('oculto'); expect(email.links).toEqual(['https://test.example']);
});
it('rechaza inbox vacío, otra pestaña, múltiples mensajes y contenido citado', () => {
 for (const html of ['', fixture + fixture, fixture.replace('</div></div></div>', '<blockquote>Cita anterior</blockquote></div></div></div>')]) {
  document.body.innerHTML = html; expect(() => extractGmailMessage()).toThrow();
 }
 document.body.innerHTML = fixture; vi.stubGlobal('location', { origin: 'https://evil.example' }); expect(() => extractGmailMessage()).toThrow();
});
it('rechaza remitente ausente, campos grandes y cuerpos ocultos', () => {
 for (const html of [fixture.replace('email="ana@test.example"', ''), fixture.replace('Mensaje sintético', 'x'.repeat(20001)), fixture.replace('class="a3s aiL"', 'class="a3s aiL" hidden')]) {
  document.body.innerHTML = html; expect(() => extractGmailMessage()).toThrow();
 }
});
it('manifest mínimo, sin permisos globales ni scripts remotos', () => {
 const manifest = JSON.parse(readFileSync('manifest.json'));
 expect(manifest.manifest_version).toBe(3); expect(manifest.permissions).toEqual(['activeTab', 'scripting']); expect(manifest.host_permissions).toEqual(['http://127.0.0.1:3001/*']); expect(manifest.content_scripts).toBeUndefined();
});
