// @vitest-environment jsdom
import { afterEach, it, expect, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { Report } from './Detail';
import * as api from './api';
import type { ProcessingResult } from './types';
vi.mock('./api', () => ({ fetchEmails: vi.fn(), fetchEmail: vi.fn(), fetchRuns: vi.fn(), fetchRun: vi.fn(), startRun: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const run: ProcessingResult = { runId: '1', emailId: 'email-001', source: 'FIXTURE', createdAt: 'now', emailPreview: { from: 'a@test.example', subject: 'Hola' }, status: 'ANALYZED', staticSignals: [], report: { risk: 'LOW', summary: 'Sin indicios concretos.', techniques: [], indicators: [], recommendations: ['Verificar por un canal conocido.'] } };
it('bandeja, lectura, análisis individual e historial de extensión escapado', async () => {
 const email = { id: 'email-001', from: 'a@test.example', subject: 'Hola' };
 vi.mocked(api.fetchEmails).mockResolvedValue([email]); vi.mocked(api.fetchEmail).mockResolvedValue({ ...email, textBody: '<script>ataque</script>' });
 vi.mocked(api.fetchRuns).mockResolvedValue([{ ...run, source: 'EXTENSION', emailId: undefined, emailPreview: { from: 'a@test.example', subject: '<img src=x onerror=alert(1)>' } }]);
 vi.mocked(api.startRun).mockResolvedValue('1'); vi.mocked(api.fetchRun).mockResolvedValue(run);
 const { container } = render(<App />);
 await screen.findByText('<script>ataque</script>'); expect(container.querySelector('script')).toBeNull(); expect(container.querySelector('img')).toBeNull();
 expect(screen.getAllByText(/Gmail/).length).toBeGreaterThan(0);
 await userEvent.click(screen.getByRole('button', { name: /^Analizar$/ }));
 await waitFor(() => expect(api.startRun).toHaveBeenCalledWith('email-001')); expect(api.fetchRun).toHaveBeenCalledWith('1');
});
it('selección inicia un lote secuencial de fixtures', async () => {
 const emails = [1, 2].map(n => ({ id: `email-00${n}`, from: 'a@test.example', subject: `Caso ${n}` }));
 vi.mocked(api.fetchEmails).mockResolvedValue(emails); vi.mocked(api.fetchEmail).mockResolvedValue({ ...emails[0]!, textBody: 'Texto' }); vi.mocked(api.fetchRuns).mockResolvedValue([]);
 const order: string[] = [];
 vi.mocked(api.startRun).mockImplementation(async id => { order.push('start:' + id); return id; });
 vi.mocked(api.fetchRun).mockImplementation(async id => { order.push('end:' + id); return { ...run, runId: id }; });
 render(<App />); await screen.findByText('Caso 2'); await userEvent.click(screen.getByLabelText('Seleccionar todos'));
 await userEvent.click(screen.getByRole('button', { name: /Analizar seleccionados/ }));
 await waitFor(() => expect(order).toEqual(['start:email-001', 'end:email-001', 'start:email-002', 'end:email-002']));
});
it('un fallo no presenta riesgo bajo', () => {
 render(<Report run={{ ...run, status: 'FAILED', report: null, error: 'Respuesta inválida.' }} />);
 expect(screen.getByRole('alert').textContent).toContain('No hay evaluación de riesgo'); expect(screen.queryByText('Riesgo LOW')).toBeNull();
});
it('reporte traduce riesgo y técnicas, conserva evidencia escapada y permite consultar reglas', async () => {
 const high: ProcessingResult = { ...run, staticSignals: ['Presión temporal'], report: { risk: 'HIGH', summary: 'Indicios de presión.', techniques: ['URGENCY'], indicators: [{ technique: 'URGENCY', evidence: '<img src=x>', explanation: 'Exige actuar hoy.' }], recommendations: ['Confirmá por otro canal.'] } };
 const { container } = render(<Report run={high} />);
 expect(screen.getByText('Riesgo alto')).toBeTruthy(); expect(screen.getByText('“<img src=x>”')).toBeTruthy(); expect(container.querySelector('img')).toBeNull();
 expect(screen.getByRole('heading', { name: 'Qué hacer ahora' })).toBeTruthy();
 const summary = container.querySelector('.static-panel > summary') as HTMLElement;
 await userEvent.click(summary); expect(summary.parentElement?.hasAttribute('open')).toBe(true);
 expect(screen.getByText('Presión temporal')).toBeTruthy();
});
it('incorpora Gmail a la bandeja y al conteo sin reenviarlo al analizar seleccionados', async () => {
 const fixture = { id: 'email-001', from: 'a@prueba.example', subject: 'Correo de ejemplo' };
 const gmail: ProcessingResult = { ...run, runId: 'gmail-run', source: 'EXTENSION', emailId: undefined, emailPreview: { from: 'b@prueba.example', subject: 'Correo recibido desde Gmail' } };
 vi.mocked(api.fetchEmails).mockResolvedValue([fixture]);
 vi.mocked(api.fetchEmail).mockResolvedValue({ ...fixture, textBody: 'Texto del ejemplo.' });
 vi.mocked(api.fetchRuns).mockResolvedValue([gmail]);
 vi.mocked(api.startRun).mockResolvedValue('fixture-run'); vi.mocked(api.fetchRun).mockResolvedValue(run);
 render(<App />);
 await screen.findByRole('button', { name: /Correo recibido desde Gmail/ });
 expect(screen.getByText('2 correos')).toBeTruthy();
 expect(screen.getByRole('img', { name: 'Analizado: 1, Pendiente: 1' })).toBeTruthy();
 await userEvent.click(screen.getByRole('button', { name: /Correo recibido desde Gmail/ }));
 expect(await screen.findByText(/El contenido original permanece en Gmail/)).toBeTruthy();
 expect(screen.queryByRole('button', { name: /^Analizar$/ })).toBeNull();
 expect(api.fetchEmail).not.toHaveBeenCalledWith('gmail:gmail-run');
 await userEvent.click(screen.getByLabelText('Seleccionar todos'));
 await userEvent.click(screen.getByRole('button', { name: 'Analizar seleccionados (1)' }));
 await waitFor(() => expect(api.startRun).toHaveBeenCalledTimes(1));
 expect(api.startRun).toHaveBeenCalledWith('email-001');
 expect(screen.queryByText('Entorno de pruebas con datos sintéticos')).toBeNull();
 expect(screen.queryByText(/Demo con datos sintéticos/)).toBeNull();
});
it('muestra las evidencias estáticas y las fuentes fijas del marco sin ejecutar HTML', async () => {
 const grounded: ProcessingResult = { ...run, staticSignals: ['Presión temporal'], staticFindings: [{ ruleId: 'URGENCY', title: 'Presión temporal', technique: 'URGENCY', field: 'subject', evidence: '<img src=x> urgente', explanation: 'Presión temporal observable.', limitation: 'Puede ser un plazo legítimo.', referenceIds: ['NIST_PHISH_SCALE'] }], report: { ...run.report!, frameworkVersion: 'FISHI-SE-1.0' } };
 const { container } = render(<Report run={grounded} />);
 await userEvent.click(container.querySelector('.static-panel > summary') as HTMLElement);
 expect(screen.getByText('“<img src=x> urgente”')).toBeTruthy(); expect(container.querySelector('img')).toBeNull();
 await userEvent.click(screen.getByText('Marco de análisis · FISHI-SE-1.0'));
 const links = screen.getAllByRole('link', { name: /NIST TN 2276/ });
 expect(links.every(link => link.getAttribute('href') === 'https://doi.org/10.6028/NIST.TN.2276')).toBe(true);
 expect(screen.getByText(/no certifica este correo/)).toBeTruthy();
});
