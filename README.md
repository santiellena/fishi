# Fishi

Análisis educativo de posibles indicios de ingeniería social en correos, con reglas deterministas y una llamada a Anthropic Claude por análisis. Dos entradas comparten el mismo motor: una bandeja web de ocho correos sintéticos y una extensión local para un mensaje abierto en Gmail de prueba.

Fishi ofrece evaluaciones orientativas y explicables, con posibles falsos positivos y negativos. No verifica remitentes, autenticidad, DNS, SPF/DKIM/DMARC, reputación ni adjuntos. No abre enlaces. **No es offline:** Claude procesa el texto en un servicio externo. Usar únicamente datos ficticios autorizados.

## Arranque local

Requiere Node.js compatible con las versiones de Vite/Vitest del lockfile (Node 22.12+; validado en Node 22) y npm con workspaces.

```sh
npm ci
cp .env.example apps/api/.env
```

Completar localmente `ANTHROPIC_API_KEY` y `ANTHROPIC_MODEL` en `apps/api/.env`; usar un modelo habilitado en la cuenta. La clave y el modelo quedan exclusivamente en backend. No compartir ni versionar `.env`.

En dos terminales desde la raíz:

```sh
npm run dev:api
npm run dev:web
```

Abrir `http://127.0.0.1:5173`. API en `127.0.0.1:3001`, nunca en todas las interfaces. La web usa el proxy `/api` de Vite. Mantener estos puertos para la extensión. El build web produce archivos estáticos, pero la demo utiliza Vite para disponer del proxy; no hay despliegue de producción incluido.

**Pulsar Analizar o un botón de lote genera solicitudes de pago.** Un lote procesa de a un mensaje. Las pruebas automatizadas usan mocks y no consumen créditos. Se realizó una llamada real autorizada con el fixture benigno `email-001`: terminó ANALYZED en aproximadamente 3,3 segundos, con riesgo LOW y reporte válido, sin reintentos. No se registró el uso de tokens en la corrida, por lo que no se informa un costo exacto.

```sh
npm test
npm run build
npm run build -w @fishi/extension
```

En entornos que bloquean puertos loopback, las pruebas HTTP necesitan permiso para abrir un puerto efímero local. No usan Internet ni Anthropic.

## Extensión Chrome/Brave

1. Ejecutar `npm run build` y mantener la API encendida.
2. Abrir `chrome://extensions` o `brave://extensions`, activar modo desarrollador y cargar **`apps/extension/dist`** como extensión desempaquetada.
3. En una cuenta Gmail de prueba, abrir un mensaje sintético independiente. Abrir Fishi y pulsar **Analizar este correo**.
4. Revisar remitente, asunto y cuerpo. Solo **Confirmar envío y analizar** transmite el contenido al backend local y a Claude. Cancelar descarta la vista previa.
5. Mantener el popup abierto hasta ver riesgo, técnicas, resumen y recomendación. En Fishi Web, desplegar su entrada **EXTENSION** en **Análisis recientes** para el reporte completo.

Permisos: solo `activeTab`, `scripting` y host `http://127.0.0.1:3001/*`. No usa Gmail API/OAuth, cookies, adjuntos, código remoto, acceso permanente a Gmail, observación de navegación ni análisis automático. Implementación basada en [activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab) y [chrome.scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting).

El extractor es conservador y depende del DOM de Gmail: requiere un único contenedor principal, asunto visible, cuerpo expandido y remitente observable. Rechaza varios cuerpos visibles, bloques `blockquote[type="cite"]` visibles y citas `.gmail_quote` que ocupan solo parte del texto del mensaje. Acepta `.gmail_quote` si envuelve todo el texto visible del cuerpo único, porque esa clase también puede aparecer sin una conversación anterior. Un `blockquote` genérico se conserva como parte del mensaje; los marcadores son una heurística, no una identificación infalible de conversaciones. No lee texto oculto; los enlaces se extraen únicamente del cuerpo visible. Puede rechazar mensajes válidos si Gmail cambia selectores o estructura. No promete cabeceras originales ni todos los links. Cerrar el popup detiene su polling, pero un análisis ya enviado continúa en backend y queda en el portal. No se persiste contenido en la extensión.

## Contratos y controles

- `GET /emails`: ocho resúmenes `id/from/subject`; `GET /emails/:id`: detalle `textBody`, sin label de referencia.
- `POST /runs`: `{ "emailId": "email-001" }`.
- `POST /runs/adhoc`: `{ "email": { "from": "a@prueba.example", "subject": "Prueba", "textBody": "Mensaje sintético", "links": [] } }`.
- Ambos POST devuelven `202 {"runId":"..."}`; `GET /runs/:id` permite polling, `GET /runs` consulta el historial.
- Corrida: `source` FIXTURE/EXTENSION; `emailId` solo para fixture; metadatos mínimos, `createdAt`, `status`, `report`, `staticSignals`, error seguro si corresponde. Estado operativo PROCESSING/ANALYZED/FAILED, separado del riesgo LOW/MEDIUM/HIGH. PENDING solo es un estado derivado de UI.

El backend normaliza con trim y valida con Zod; rechaza campos desconocidos y contenido excesivo, sin truncar. Límites: remitente/asunto 500 caracteres cada uno, cuerpo 20.000, 30 links de 2.048 caracteres y JSON total 64 KiB. Solo JSON sin compresión. Hasta 12 intentos de inicio por minuto (incluidos inválidos) y dos análisis activos simultáneos por proceso; devuelve 429 al exceder. Polling web con requests de hasta 10 s y espera por análisis de hasta 120 s; popup hasta 60 s. Claude tiene timeout de transporte de 40 s, analizador de 45 s y **cero reintentos automáticos**.

Las ocho señales cubren urgencia, bloqueo, credenciales/OTP, transferencias, autoridad aparente, secreto, datos personales e instrucciones a la IA. Son contexto, nunca un veredicto. El LLM recibe únicamente los campos normalizados, sin labels ni herramientas. La solicitud envía el esquema mediante `output_config.format` (JSON Schema de Anthropic), con campos y enumeraciones del contrato Zod; los límites y las reglas semánticas se validan nuevamente en backend. Un prompt de sistema trata todo el correo como datos no confiables. La salida se valida estrictamente: máximo cinco indicadores, técnicas con evidencia, sin duplicados, hasta cuatro recomendaciones; toda cita debe existir literalmente en un campo normalizado. **Una cita no verificable rechaza todo el reporte y termina FAILED.** JSON inválido, error de servicio o timeout también terminan FAILED, sin convertirlos en LOW. Truncamiento (`max_tokens`), rechazo del modelo, JSON inválido y esquema inválido tienen códigos distintos.

El RunStore conserva hasta 200 corridas (retira la completada más antigua al alcanzar el límite), únicamente en memoria. Los correos ad hoc no se agregan a fixtures ni se guarda su cuerpo completo: se conservan remitente/asunto y reporte, que puede contener citas. El reinicio borra todo el historial. No se registran cuerpos, secretos ni mensajes crudos del proveedor en logs. Los fallos registran runId, código de error, duración, estado HTTP cuando existe y, para validación, etapa y nombres permitidos de campos con códigos Zod, sin valores de la respuesta; la corrida expone errorCode y un mensaje fijo que distingue timeout de Claude, conexión, autenticación, permisos, modelo, límites o respuesta inválida. Los textos externos se renderizan escapados; los links no son clicables.

CORS permite los dos orígenes web locales y orígenes `chrome-extension://` con ID válido para admitir extensiones desempaquetadas con IDs variables. **Esto no autentica al cliente**: es una demo local sin login, no un servicio para publicar o compartir en red. No extender el bind ni el CORS para exponerla.

## Validación y demo

La interfaz presenta riesgo y técnicas en español, evidencias y recomendaciones separadas, señales estáticas desplegables e historial compacto por origen. El popup ofrece un resumen breve, explicación desplegable, recomendación y acceso a Análisis recientes en la web. Se revisó visualmente en Chrome headless (web en escritorio y móvil; popup de 410 × 600 con datos sintéticos y API simulada), sin iniciar análisis reales.

Pruebas con mocks: reportes benignos/maliciosos, señales, evidencia inventada, inyección como dato, JSON inválido, error y timeout; endpoints de ambos orígenes; aislamiento de fixtures; UI de lectura, análisis individual/lote, fallos e historial; extractor DOM y permisos; consentimiento/cancelación, API caída y fallo en popup.

**Se verificó una respuesta real de Claude a través de la API con el fixture sintético `email-001`** (corrida `d9cbaabd-de1c-4d68-a413-053edae513c8`, ANALYZED, LOW, sin indicadores ni señales estáticas, aproximadamente 3,3 segundos). Esto confirma el recorrido API → Claude → validación del reporte para ese caso. **La instalación y el recorrido completo en Chrome/Brave con Gmail no fueron verificados manualmente por Codex.** Ver [docs/demo.md](docs/demo.md) para el ensayo pendiente y sus negativas. Las pruebas DOM usan estructura artificial, no una captura de Gmail. No confundir estas pruebas con compatibilidad comprobada contra Gmail actual.

## Arquitectura y alcance

Fishi es un proyecto independiente organizado en npm workspaces: API Express con TypeScript y Zod, interfaz React/Vite y extensión Manifest V3. La API centraliza el cliente de Claude, el analizador y el historial en memoria; ambas interfaces consumen el mismo contrato. Vitest cubre los tres workspaces con mocks.

Los identificadores internos de los paquetes API y web siguen siendo `@inboxeye/api` y `@inboxeye/web`; los comandos de la raíz los encapsulan.

Fuera de alcance: agentes autónomos, herramientas ejecutadas por LLM, envío de correos, OAuth, scraping de bandeja, adjuntos, reputación externa, DB, login, publicación de extensión y hosting. No hay métricas de detección medidas ni garantía de seguridad.
