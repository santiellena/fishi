# Fishi

Análisis educativo de posibles indicios de ingeniería social en correos, con reglas deterministas y una llamada a Anthropic Claude por análisis. Dos entradas comparten el mismo motor: una bandeja web con ocho correos de ejemplo y los análisis recibidos desde Gmail, y una extensión local para un mensaje abierto en Gmail de prueba.

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

`npm test` ejecuta solo pruebas unitarias y DOM con mocks, sin servidores ni llamadas de pago. `npm run test:unit` las ejecuta explícitamente en todos los workspaces. Las pruebas HTTP se conservaron separadas: `npm run test:integration` requiere puertos loopback y no se ejecutó en el último incremento. Ver [plan y alcance de pruebas](docs/testing.md).

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

Las ocho reglas ES/EN cubren urgencia, bloqueo/pérdida de datos, credenciales/OTP, transferencias, autoridad aparente, secreto, datos personales e instrucciones a la IA. Comparan texto normalizado, distinguen negaciones simples y recuperan citas literales por campo. Son contexto, nunca un veredicto: `staticSignals` conserva títulos y `staticFindings` agrega regla, campo, evidencia y explicación. El modelo recibe el mismo contenido normalizado como fragmentos ordenados `{ id, field, text }`, sin labels ni herramientas. Concatenar los textos de cada campo reconstruye exactamente el original: no se duplica ni se trunca el cuerpo. Cada fragmento tiene hasta 600 caracteres y se procura cortar por párrafo o frase.

La solicitud usa `output_config.format` (JSON Schema de Anthropic) con riesgo y técnicas enumerados, texto no vacío y `evidenceId` limitado a los IDs disponibles. Claude devuelve riesgo, resumen, indicadores con referencias y recomendaciones; **no vuelve a redactar las citas ni una lista redundante de técnicas**. Fishi recupera la evidencia del texto original, deriva técnicas de los indicadores y elimina indicadores duplicados por técnica/ID y recomendaciones idénticas después de trim. La API pública conserva `techniques` y `indicators[].evidence`, por lo que web y extensión usan el mismo contrato de siempre.

La salida final se valida con Zod: hasta cinco indicadores, riesgo elevado con evidencia y hasta cuatro recomendaciones. Se comprueba además que cada cita resuelta exista literalmente en la entrada. Un ID inexistente o una respuesta inválida termina FAILED, sin inventar evidencia ni convertir el error en LOW. Truncamiento, rechazo, JSON inválido, esquema inválido y referencia inválida tienen códigos distintos. No se hacen llamadas adicionales para reparar respuestas.

El RunStore conserva hasta 200 corridas (retira la completada más antigua al alcanzar el límite), únicamente en memoria. Los correos ad hoc no se agregan a fixtures ni se guarda su cuerpo completo: se conservan remitente/asunto y reporte, que puede contener citas. El reinicio borra todo el historial. No se registran cuerpos, secretos ni mensajes crudos del proveedor en logs. Los fallos registran runId, código de error, duración, estado HTTP cuando existe y, para validación, etapa y nombres permitidos de campos con códigos Zod, sin valores de la respuesta; la corrida expone errorCode y un mensaje fijo que distingue timeout de Claude, conexión, autenticación, permisos, modelo, límites o respuesta inválida. Los textos externos se renderizan escapados; los links no son clicables.

CORS permite los dos orígenes web locales y orígenes `chrome-extension://` con ID válido para admitir extensiones desempaquetadas con IDs variables. **Esto no autentica al cliente**: es una demo local sin login, no un servicio para publicar o compartir en red. No extender el bind ni el CORS para exponerla.

## Fundamento del análisis

El marco versionado **FISHI-SE-1.0** define las ocho categorías, contraejemplos, una rúbrica cualitativa de riesgo y las limitaciones observacionales. Combina material de cátedra (BuyerSec y Cibercrimen II/CTI) con NIST TN 2276, FBI/BEC, OWASP LLM01 y MITRE T1566.002. Se incluye en el prompt; el backend agrega a cada indicador criterio, límite y referencias desde un catálogo fijo. La web permite consultar esos fundamentos junto a cada hallazgo y al riesgo. No hay búsqueda externa durante el análisis, RAG, atribución de actores ni puntuación Phish Scale. Ver [marco y fuentes](docs/marco-analisis.md).

## Validación y demo

La bandeja reúne los ocho ejemplos y una entrada por cada corrida de Gmail, identificada por origen. Las entradas Gmail cuentan según su estado real (ANALYZED, PROCESSING o FAILED) y abren su reporte sin otra llamada a Claude. No se incorpora su cuerpo al dataset ni se habilita reanálisis desde la web: para repetirlo se usa la extensión. La selección y el lote incluyen solo los ejemplos. Las entradas recibidas desaparecen con el historial al reiniciar la API.

La web abre en **vista simple**: riesgo, resumen, recomendaciones y límites. El botón **+ Más detalles / − Menos detalles** controla el correo abierto y los reportes del historial, sin reenviar mensajes ni llamar a Claude. La vista técnica agrega técnicas, citas, reglas, criterios, fuentes, ID/estado de corrida y códigos de error. La preferencia se mantiene al cambiar de correo y vuelve a simple al recargar la página.

La interfaz presenta riesgo y técnicas en español, evidencias y recomendaciones separadas, señales estáticas con citas desplegables y criterios/fuentes por hallazgo e historial compacto por origen. El popup ofrece un resumen breve, explicación desplegable, recomendación y acceso a Análisis recientes en la web. Se revisó visualmente en Chrome headless (web en escritorio y móvil; popup de 410 × 600 con datos sintéticos y API simulada), sin iniciar análisis reales.

Pruebas unitarias con mocks: reportes benignos/maliciosos, reglas ES/EN y negaciones, fundamentos del prompt, límites de contratos, retención del store, señales, referencias de evidencia inválidas, reconstrucción literal con Unicode y saltos de línea, inyección como dato, JSON inválido, error y timeout; aislamiento de fixtures (los endpoints HTTP están en la suite de integración separada); UI de lectura, análisis individual/lote, fallos e historial; extractor DOM y permisos; consentimiento/cancelación, API caída y fallo en popup.

**Se verificó una respuesta real de Claude a través de la API con el fixture sintético `email-001`** (corrida `d9cbaabd-de1c-4d68-a413-053edae513c8`, ANALYZED, LOW, sin indicadores ni señales estáticas, aproximadamente 3,3 segundos). Esto confirmó el recorrido API → Claude → validación del reporte para ese caso, antes del cambio a selección de evidencias por IDs. El nuevo mecanismo se verificó con mocks; no se repitió una llamada real tras ese cambio. **La instalación y el recorrido completo en Chrome/Brave con Gmail no fueron verificados manualmente por Codex.** Ver [docs/demo.md](docs/demo.md) para el ensayo pendiente y sus negativas. Las pruebas DOM usan estructura artificial, no una captura de Gmail. No confundir estas pruebas con compatibilidad comprobada contra Gmail actual.

## Arquitectura y alcance

Fishi es un proyecto independiente organizado en npm workspaces: API Express con TypeScript y Zod, interfaz React/Vite y extensión Manifest V3. La API centraliza el cliente de Claude, el analizador y el historial en memoria; ambas interfaces consumen el mismo contrato. Vitest cubre los tres workspaces con mocks.

Los identificadores internos de los paquetes API y web siguen siendo `@inboxeye/api` y `@inboxeye/web`; los comandos de la raíz los encapsulan.

Fuera de alcance: agentes autónomos, herramientas ejecutadas por LLM, envío de correos, OAuth, scraping de bandeja, adjuntos, reputación externa, DB, login, publicación de extensión y hosting. No hay métricas de detección medidas ni garantía de seguridad.
