# Ensayo de Fishi (3–5 minutos)

Estado: pruebas automatizadas con mocks realizadas. Una llamada real autorizada desde la API al fixture sintético `email-001` terminó ANALYZED en aproximadamente 3,3 segundos, con riesgo LOW, técnicas e indicadores vacíos, una recomendación y reporte validado. Corrida: `d9cbaabd-de1c-4d68-a413-053edae513c8`. Se inició una sola solicitud, sin reintentos; no se registró un costo exacto. El ensayo manual completo Gmail/Chrome/Brave por Codex sigue **pendiente**. El equipo debe completar este ensayo antes de afirmar compatibilidad con Gmail.

## Preparación

- Instalar dependencias, configurar backend y arrancar API/web según README.
- Construir y cargar `apps/extension/dist` en Chrome o Brave.
- Usar solo una cuenta de prueba y mensajes sintéticos independientes con dominios `.example`. Los ocho textos de `apps/api/src/company/emails.ts` sirven de referencia. No enviar campañas ni usar datos personales.
- Antes de analizar con Claude, obtener autorización explícita para el consumo. Limitar a 2–3 consultas elegidas; no ejecutar automáticamente los ocho fixtures ni un lote real completo.

## Recorrido propuesto

1. Mostrar la bandeja, explicar que el estado operativo no es el riesgo y que las reglas son señales contextuales.
2. Analizar `email-001` (benigno); inspeccionar el resultado real sin presumir LOW. Leer el resumen y explicar que riesgo bajo no certifica seguridad.
3. Analizar `email-002` (sospechoso) y señalar evidencia literal, recomendaciones y separación de reglas/Claude. Mostrar la selección para lote, sin ejecutarlo si supera el presupuesto autorizado.
4. Para la tercera consulta autorizada, abrir en Gmail un mensaje sintético independiente ambiguo de cambio bancario. Extraer desde popup, revisar vista previa y advertencia, confirmar y comprobar el resultado. No afirmar fraude probado por un cambio de cuenta.
5. Abrir Análisis recientes en la web; verificar origen EXTENSION, correspondencia de remitente/asunto y mismo reporte que en popup.
6. Explicar los límites del DOM, falsos positivos/negativos, prompt injection, uso de servicio externo y borrado del historial al reiniciar.

## Checklist manual pendiente

Registrar navegador/versión, fecha y resultado observado; no marcar pasos no ejecutados.

- [ ] Carga de la extensión desempaquetada sin errores de manifest/CSP.
- [ ] Inbox de Gmail sin correo abierto: error claro, ningún envío.
- [ ] Pestaña ajena a Gmail: rechazo.
- [ ] Dos mensajes expandidos, una cita parcial `.gmail_quote` o un `blockquote[type="cite"]` visible: rechazo por ambigüedad.
- [ ] Un único mensaje sintético envuelto completamente en `.gmail_quote`: se acepta y conserva texto y enlaces.
- [ ] Un mensaje sintético con `blockquote` de formato: se acepta sin confundirlo con una conversación anterior.
- [ ] Un mensaje sintético abierto: vista previa fiel, sin contenido oculto o de otros mensajes.
- [ ] Cancelación: no aparece ninguna corrida nueva.
- [ ] Confirmación: una sola corrida, PROCESSING y luego resultado real en popup.
- [ ] Misma corrida visible en portal con origen EXTENSION, sin agregarse a ocho fixtures.
- [ ] API caída: error de conexión, sin riesgo LOW.
- [ ] Error de LLM: FAILED, sin informe de seguridad; no repetir llamadas reales solo para provocar este fallo (ya probado con mocks).
- [ ] Popup cerrado durante un análisis: consultar la corrida en portal al volver.
- [ ] Reinicio de API borra el historial en memoria.

Las pruebas automatizadas HTTP realizan ambos flujos con Claude mockeado y las del popup verifican consentimiento antes de fetch. Esto no sustituye el ensayo del DOM real ni una evaluación de calidad de Claude.
