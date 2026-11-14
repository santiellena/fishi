# Marco de análisis Fishi-SE-1.0

Fishi realiza una evaluación educativa del contenido disponible. Este marco operativo es propio del proyecto: usa referencias técnicas y material de cátedra para definir categorías y límites. No constituye una certificación NIST, un detector validado estadísticamente ni una pericia de autenticidad.

## Fundamentos y procedencia

| Fuente leída | Aplicación en Fishi | Límite |
| --- | --- | --- |
| [NIST TN 2276, Phish Scale User Guide, Dawkins y Jacobs, 2023](https://doi.org/10.6028/NIST.TN.2276), §2.1 y apéndice B | Vocabulario de señales observables y distinción entre mensaje y contexto del destinatario | La escala estudia dificultad humana de detección. Fishi no calcula su puntuación, premise alignment ni probabilidad de fraude. |
| [FBI, Business Email Compromise](https://www.fbi.gov/how-we-can-help-you/common-frauds-and-scams/business-email-compromise), ejemplos y Protect Yourself | Pagos/cambios bancarios como solicitudes que requieren verificación independiente | Un cambio bancario puede ser legítimo; no acredita compromiso de la cuenta. |
| [OWASP LLM01:2025, Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/), tipos y mitigaciones | Instrucciones externas como datos no confiables, salida acotada, pruebas adversariales y ausencia de herramientas | Detectar una orden al modelo no implica que haya tenido éxito. No se garantiza inmunidad. |
| [MITRE ATT&CK T1566.002, Spearphishing Link](https://attack.mitre.org/techniques/T1566/002/) | Lenguaje común para explicar el vector con enlace | Referencia conceptual; no se asigna automáticamente esa técnica ATT&CK a cada enlace ni se afirma descarga/malware. |
| Material de cátedra: laboratorio BuyerSec y trabajo del equipo Empresa | Checklist y confirmación por un canal conocido; distinguir solicitudes de advertencias preventivas | Sus dominios y ejemplos no se convierten en listas de confianza para correos reales. |
| Material de cátedra: Cibercrimen II y reporte CTI | Observación frente a hipótesis, impacto potencial frente a observado, límites y trazabilidad | Un correo aislado no permite confirmar acceso, pagos, malware, exfiltración ni atribución. |

Fuentes externas consultadas el 13/11/2026. El catálogo y su versión están en `apps/api/src/core/knowledge.ts`. La aplicación no consulta estas páginas durante un análisis. Los textos del prompt son una síntesis curada; no una descarga de documentos ni un sistema RAG.

Material local consultado en `../clases/`:

- `Laboratorio de Ingeniería Social_ Simulación de ataques y estrategias de defensa en BuyerSec.docx`.
- `13-10_laboratorio - Empresa.docx`: comunicados, prevención y procedimiento de verificación.
- `6T. Cibercrimen II.pdf`: calidad de indicadores, TTP y estructura del reporte, diapositivas 11–19.
- `01_Escenario_Ficticio_CTI.docx` y `02_Reporte_CTI.docx`: vínculos E1–E6, hipótesis y límites del caso ficticio.
- `TP-IngSocial-Clase3-GrupoYPF.pdf`: contexto, pretexto y confianza aparente; no se realizaron acciones OSINT ni simulaciones de ataque.

Los originales, datos personales del equipo y listas de contactos no se copian al repositorio ni se envían a Claude. Se usa únicamente la síntesis metodológica.

## Estructura de un hallazgo

1. **Observación:** fragmento literal del mensaje y origen. Las reglas identifican el campo; Claude elige un `evidenceId` y Fishi recupera el texto original.
2. **Interpretación:** explicación de por qué ese fragmento podría representar una técnica. Sigue siendo una hipótesis del modelo.
3. **Criterio:** definición de la categoría, fijada en código y compartida con el prompt.
4. **Límite:** explicaciones alternativas y aquello que no puede comprobarse con este input.
5. **Referencias:** IDs seleccionados por el backend desde el catálogo; Claude no inventa títulos, URLs ni versiones.
6. **Acción:** recomendación prudente para reducir exposición o verificar la solicitud.

Los enlaces bibliográficos de la web proceden del catálogo fijo. Las URLs del correo permanecen como texto no clicable. Una referencia teórica respalda la definición de una categoría; **no es evidencia de que el correo sea fraudulento**.

## Taxonomía

| Categoría | Criterio operativo | Control contra sobreinterpretación |
| --- | --- | --- |
| PHISHING | Comunicación que intenta inducir una acción sensible mediante identidad o pretexto engañosos | No basta la existencia de una URL. |
| IMPERSONATION | Identidad aparente de una persona/entidad de confianza usada para sostener una solicitud | No se verifica el remitente real. |
| PRETEXTING | Historia o trámite que justifica una petición sensible o inusual | Los trámites legítimos pueden parecerse. |
| URGENCY | Presión temporal o consecuencias para acelerar una acción | Un plazo no prueba manipulación. |
| AUTHORITY | Cargo o área invocados para favorecer obediencia | La autoridad declarada puede ser legítima. |
| CREDENTIAL_REQUEST | Petición de introducir o entregar contraseña, OTP o código | Una advertencia de no compartirlos no es una petición. |
| BEC | Pagos/cambios bancarios con identidad comercial o jerárquica aparente | No se confirma fraude ni transferencia. |
| PROMPT_INJECTION | Orden externa para alterar el comportamiento del analizador IA | Es una amenaza al modelo, diferente del engaño dirigido a personas. |

Estas categorías mezclan vector, pretexto y mecanismos de influencia con fines educativos; no son ocho técnicas equivalentes de MITRE ATT&CK. Fishi no se atribuye una implementación completa de ATT&CK ni de una escala psicológica de persuasión.

## Rúbrica cualitativa propia

- **LOW:** no se identificó una inducción concreta a una acción sensible ni manipulación del modelo. No equivale a correo auténtico o seguro.
- **MEDIUM:** petición sensible/inusual o ambigua que necesita contexto y verificación independiente. El cambio bancario aislado es un caso de referencia.
- **HIGH:** indicios explícitos de credenciales, pagos bajo presión/aislamiento o manipulación del analizador. Necesita evidencia y sigue sin probar un fraude consumado.
- **FAILED:** error técnico o reporte inválido. No recibe una evaluación de riesgo.

Las reglas no suman puntos ni fuerzan el riesgo del LLM. No hay porcentajes de certeza. La rúbrica se incluye en el system prompt; los tests con mocks comprueban el contrato y la transmisión de ese contexto, no que un modelo real siempre lo interprete correctamente.

## Reglas deterministas

`staticRules.ts` mantiene ocho reglas, con IDs estables: URGENCY, ACCOUNT_THREAT, CREDENTIAL_REQUEST, FINANCIAL_REQUEST, AUTHORITY_CLAIM, SECRECY, PERSONAL_DATA_REQUEST y PROMPT_INJECTION.

- Cubren expresiones seleccionadas de español e inglés; no todos los idiomas o variantes.
- Comparan sin distinguir mayúsculas, acentos y espacios repetidos, conservando offsets para mostrar evidencia del original.
- Evalúan asunto, cuerpo y remitente por separado para no formar solicitudes inexistentes entre campos.
- Exigen acción + dato para credenciales/datos personales y suprimen negaciones simples cercanas. No constituyen un parser semántico: ironía, citas y negaciones complejas pueden fallar.
- La confidencialidad y la mención de cargos siguen siendo señales contextuales, no conclusiones.
- Devuelven como máximo un hallazgo por regla, evitando contar repeticiones como mayor riesgo.
- No clasifican URLs por reputación, no consultan DNS ni presuponen el dominio oficial de una organización.

`staticSignals` conserva los títulos para compatibilidad; `staticFindings` incorpora regla, campo, cita, explicación, límite y referencias. Ambos orígenes usan las mismas reglas. Las señales se calculan antes de llamar al modelo y siguen disponibles si este falla. No se pasan como un veredicto al LLM, que evalúa el contenido con el marco curado.

## Regresiones y límites medidos

Antes del cambio, un texto sintético en inglés con bloqueo, pérdida de fotos y actualización de pago producía cero señales. Una advertencia de nunca compartir contraseña producía una señal de solicitud. Después del cambio, esos ejemplos producen tres señales y ninguna señal de credenciales, respectivamente.

Los dos fixtures benignos siguen sin señales y los seis restantes conservan las categorías previstas en los tests. Esto es una comprobación de regresión sobre un corpus pequeño y diseñado, **no una medición de precisión, recall ni calidad general del LLM**. No se hicieron llamadas reales a Claude en este incremento.
