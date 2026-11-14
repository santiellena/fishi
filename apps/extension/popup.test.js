// @vitest-environment jsdom
import { afterEach, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
const input = { from: 'ana@test.example', subject: 'Prueba', textBody: '<img src=x onerror=alert(1)>', links: [] };
async function setup(fetchMock) {
 vi.resetModules(); document.documentElement.innerHTML = readFileSync('popup.html', 'utf8');
 vi.stubGlobal('chrome', { tabs: { query: vi.fn(async () => [{ id: 1, url: 'https://mail.google.com/mail/u/0/#inbox/test' }]) }, scripting: { executeScript: vi.fn(async () => [{ result: { ok: true, email: input } }]) } });
 vi.stubGlobal('fetch', fetchMock); await import('./popup.js');
}
afterEach(() => vi.unstubAllGlobals());
it('extracción y cancelación nunca transmiten; solo confirmación inicia análisis y polling', async () => {
 const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ runId: '1' }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'ANALYZED', report: { risk: 'LOW', techniques: [], summary: '<script>externo</script>', recommendations: ['Verificar'] } }) });
 await setup(fetchMock);
 await document.getElementById('extract').onclick(); expect(fetchMock).not.toHaveBeenCalled(); expect(document.getElementById('preview').hidden).toBe(false); expect(document.querySelector('img')).toBeNull();
 document.getElementById('cancel').onclick(); expect(fetchMock).not.toHaveBeenCalled();
 await document.getElementById('extract').onclick(); await document.getElementById('confirm').onclick();
 expect(fetchMock).toHaveBeenCalledTimes(2); expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:3001/runs/adhoc'); expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: input });
 expect(document.getElementById('result').textContent).toContain('Riesgo LOW'); expect(document.querySelector('#result script')).toBeNull();
});
it('API caída produce error visible sin riesgo', async () => {
 await setup(vi.fn().mockRejectedValue(new Error('API local no disponible')));
 await document.getElementById('extract').onclick(); await document.getElementById('confirm').onclick();
 expect(document.getElementById('status').textContent).toContain('API local no disponible'); expect(document.getElementById('result').hidden).toBe(true);
});
it('FAILED no se representa como LOW', async () => {
 await setup(vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ runId: '1' }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'FAILED', error: 'Respuesta inválida' }) }));
 await document.getElementById('extract').onclick(); await document.getElementById('confirm').onclick();
 expect(document.getElementById('status').textContent).toContain('Respuesta inválida'); expect(document.getElementById('result').hidden).toBe(true);
});

it('muestra el rechazo real del extractor sin enviar datos', async () => {
 const fetchMock = vi.fn(); await setup(fetchMock);
 chrome.scripting.executeScript.mockResolvedValue([{ result: { ok: false, error: 'El mensaje incluye una conversación citada; usá un mensaje de prueba independiente.' } }]);
 await document.getElementById('extract').onclick();
 expect(document.getElementById('status').textContent).toContain('conversación citada');
 expect(document.getElementById('preview').hidden).toBe(true); expect(fetchMock).not.toHaveBeenCalled();
});
it('maneja respuesta ausente o incompatible sin habilitar envío', async () => {
 const fetchMock = vi.fn(); await setup(fetchMock);
 for (const results of [[], [{ frameId: 0 }], [{ result: input }]]) {
  chrome.scripting.executeScript.mockResolvedValue(results);
  await document.getElementById('extract').onclick();
  expect(document.getElementById('status').textContent).toContain('Recargá');
  expect(document.getElementById('preview').hidden).toBe(true);
  await document.getElementById('confirm').onclick(); expect(fetchMock).not.toHaveBeenCalled();
 }
});
