import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchEmail, fetchEmails, fetchRun, fetchRuns, startRun } from "./api";
import { Detail, Report } from "./Detail";
import { BrandMark, Icon } from "./Icons";
import { Inbox, StatusBadge } from "./Inbox";
import { countByStatus, latestRunByEmail, statusOf, sequential, RISK_LABEL, runTime } from "./lib";
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
      <p className="privacy"><Icon name="shield" size={16} /><span><strong>Demo con datos sintéticos.</strong> Al analizar, el correo se envía al servicio local y a Anthropic Claude, también en lote.</span></p>
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
          <section className="recent" id="recent-analyses" aria-label="Análisis recientes">
            <header className="recent-head"><div><span className="eyebrow">Ambos orígenes · historial en memoria</span><h2>Análisis recientes <span className="section-count">{runs.length}</span></h2></div><button className="btn" onClick={() => void refreshRuns()}><Icon name="clock" size={14} />Actualizar</button></header>
            <p className="hint">Incluye la bandeja y la extensión. Se pierde al reiniciar la API.</p>
            <div className="recent-list">{[...runs].reverse().map(run => <details className="recent-item" id={`run-${run.runId}`} key={run.runId}>
              <summary><span className="recent-chevron" aria-hidden="true">›</span><span className="recent-copy"><span className="recent-meta"><span className={`source-badge source-${run.source}`}>{run.source === "EXTENSION" ? "EXTENSION · Gmail de prueba" : "FIXTURE · Bandeja"}</span><time dateTime={run.createdAt}>{runTime(run.createdAt)}</time></span><span className="recent-subject">{run.emailPreview.subject}</span><span className="recent-from">{run.emailPreview.from}</span></span><span className="recent-state">{run.status === "ANALYZED" && run.report ? <span className={`risk-badge risk-${run.report.risk}`}>Riesgo {RISK_LABEL[run.report.risk]}</span> : <StatusBadge status={run.status} />}</span></summary>
              <div className="recent-report"><Report run={run} /></div>
            </details>)}</div>
            {!runs.length && <div className="panel recent-empty"><Icon name="clock" size={22} /><p>Tus análisis aparecerán acá.<span>Podés iniciarlos desde la bandeja o la extensión de Gmail.</span></p></div>}
          </section>
        </section>
      </main>
    </div>
  );
}
