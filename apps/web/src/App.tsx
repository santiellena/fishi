import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchEmail, fetchEmails, fetchRun, fetchRuns, startRun } from "./api";
import { Detail, Report } from "./Detail";
import { BrandMark, Icon } from "./Icons";
import { Inbox } from "./Inbox";
import { countByStatus, latestRunByEmail, statusOf, sequential } from "./lib";
import type { EmailDetail, EmailSummary, ProcessingResult } from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MAX_WAIT_MS = 120_000;

export default function App() {
  const [emails, setEmails] = useState<EmailSummary[]>([]);
  const [runs, setRuns] = useState<ProcessingResult[]>([]);
  const [viewedId, setViewedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EmailDetail | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshRuns = useCallback(async () => {
    try {
      setRuns(await fetchRuns());
    } catch (e) {
      setError(e instanceof Error ? e.message : "error de red");
    }
  }, []);

  useEffect(() => {
    fetchEmails()
      .then((list) => {
        setEmails(list);
        setViewedId((cur) => cur ?? list[0]?.id ?? null);
      })
      .catch(() => setError("No se pudo cargar la bandeja. ¿Está levantada la API en el puerto 3001?"));
    void refreshRuns();
  }, [refreshRuns]);

  // También descubre nuevas corridas de la extensión; cada request tiene timeout.
  useEffect(() => {
    const t = setInterval(() => void refreshRuns(), 3000);
    return () => clearInterval(t);
  }, [refreshRuns]);

  useEffect(() => {
    if (!viewedId) return;
    let cancelled = false; // evita que una respuesta tardía pise el detalle de otro correo
    setDetail(null);
    fetchEmail(viewedId)
      .then((d) => !cancelled && setDetail(d))
      .catch(() => !cancelled && setError("No se pudo cargar el correo."));
    return () => {
      cancelled = true;
    };
  }, [viewedId]);

  const latest = useMemo(() => latestRunByEmail(runs), [runs]);
  const counts = useMemo(() => countByStatus(emails.map((e) => e.id), latest), [emails, latest]);

  const waitRun = useCallback(async (runId: string, label: string) => {
    const deadline = Date.now() + MAX_WAIT_MS;
    for (;;) {
      const run = await fetchRun(runId);
      if (run.status !== "PROCESSING") return;
      if (Date.now() > deadline) throw new Error(`La corrida de ${label} tardó demasiado.`);
      await sleep(800);
    }
  }, []);

  // Secuencial a propósito: de a un correo por vez, para controlar el consumo de la API.
  const process = useCallback(
    async (ids: string[]) => {
      setBusy(true);
      setError(null);
      try {
        await sequential(ids, async (id) => {
          const runId = await startRun(id);
          await refreshRuns();
          await waitRun(runId, id);
          await refreshRuns();
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "error al procesar");
      } finally {
        setBusy(false);
        void refreshRuns();
      }
    },
    [refreshRuns, waitRun],
  );

  const pendingIds = emails.filter((e) => statusOf(e.id, latest) === "PENDING").map((e) => e.id);
  const processSelected = () => void process(emails.filter((e) => checked.has(e.id)).map((e) => e.id));
  const toggle = (id: string) =>
    setChecked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const viewed = emails.find((e) => e.id === viewedId);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <BrandMark />
          <div>
            <h1>Fishi</h1>
            <p className="brand-sub">Análisis de ingeniería social en correos, con IA</p>
          </div>
        </div>
        <span className="sandbox-pill" title="Solo correos sintéticos autorizados">
          <Icon name="shield" size={14} />
          Entorno de pruebas con datos sintéticos
        </span>
      </header>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <p className="privacy">El contenido se envía al servicio local Fishi y a Anthropic Claude al pulsar Analizar, incluso en lote. Usar solo datos sintéticos autorizados. No muerdas el anzuelo: verificá por un canal independiente.</p>
      <main className="layout">
        <Inbox
          emails={emails}
          latest={latest}
          counts={counts}
          viewedId={viewedId}
          checked={checked}
          busy={busy}
          pendingCount={pendingIds.length}
          onView={setViewedId}
          onToggle={toggle}
          onToggleAll={(all) => setChecked(all ? new Set(emails.map((e) => e.id)) : new Set())}
          onProcessSelected={processSelected}
          onProcessPending={() => void process(pendingIds)}
        />
        <section className="main">
          {viewed ? (
            <Detail
              email={detail}
              emailId={viewed.id}
              subject={viewed.subject}
              from={viewed.from}
              run={latest.get(viewed.id)}
              busy={busy}
              onProcess={() => void process([viewed.id])}
            />
          ) : (
            <p className="muted">Elegí un correo de la bandeja.</p>
          )}
          <section className="recent panel"><header className="panel-head"><h2>Análisis recientes</h2><button className="btn" onClick={() => void refreshRuns()}>Actualizar</button></header>
            <p className="hint">Historial en memoria; se pierde al reiniciar la API.</p>
            {[...runs].reverse().map(run => <details key={run.runId}><summary>{run.source === "EXTENSION" ? "EXTENSION · Gmail de prueba" : "FIXTURE · Bandeja"} — {run.emailPreview.subject} · {run.status}</summary><p>{run.emailPreview.from}</p><Report run={run} /></details>)}
            {!runs.length && <p>Sin análisis todavía.</p>}
          </section>
        </section>
      </main>
    </div>
  );
}
