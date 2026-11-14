# Pruebas de Fishi

`npm test` y `npm run test:unit` ejecutan pruebas unitarias de los tres workspaces, incluidas pruebas de componentes/DOM con mocks. No levantan servidores, no usan una cuenta Gmail ni consumen créditos de Anthropic.

Las pruebas HTTP existentes se conservaron en `apps/api/test/http.integration.test.ts` y se ejecutan únicamente mediante `npm run test:integration`. No se ejecutaron en el incremento de reglas y marco teórico, conforme al pedido de realizar solo unit testing. El build sí verifica su tipado.

| Área | Qué se verifica | Qué no demuestra |
| --- | --- | --- |
| Reglas | Ocho categorías ES/EN, negaciones, controles benignos, campos separados, citas literales con Unicode/espacios y resultados de los ocho fixtures | Detección completa de todos los idiomas, técnicas o formas de evasión |
| Marco de conocimiento | Todas las categorías tienen definición, límite y fuentes; el prompt recibe el marco; la bibliografía se agrega desde código | Acuerdo semántico de Claude real o validación académica de un score |
| Analizador | Una llamada mockeada, sin herramientas, schema de salida, resolución de evidenceId, duplicados, fallos, metadatos y separación entre señales y riesgo | Latencia/costo real ni exactitud del LLM |
| Contratos | Límites exactos, campos extra, entradas vacías, riesgo elevado sin evidencia, listas incoherentes y referencias inválidas | Seguridad de red o carga de servidor |
| RunStore | Orígenes, IDs independientes, ausencia del cuerpo completo, retiro de completadas y aislamiento de una instancia nueva | Persistencia durable o identidad única de un mensaje Gmail |
| Web | Lectura, selección, lote secuencial mockeado, Gmail en bandeja/contador, errores, evidencia escapada, señales y fuentes del marco | Compatibilidad visual completa de navegadores |
| Extensión | Extractor con DOM artificial, visibilidad/ambigüedad, confirmación antes de enviar, cancelación, polling mockeado, errores y renderizado como texto | Compatibilidad garantizada con cambios reales del DOM de Gmail |

Los cuerpos de pruebas son sintéticos. La simulación HTTP del SDK usa una clave ficticia y un `fetch` sustituido por un mock; no es una llamada real a Anthropic.

Para verificar compilación y empaquetado, ejecutar `npm run build`. Para ensayos manuales, consultar `docs/demo.md`; no confundirlos con pruebas unitarias.

## Resultado del incremento de reglas y fundamentos

Se ejecutaron `npm test` y `npm run test:unit`: **98 pruebas aprobadas** (72 API, 9 web y 17 extensión). `npm run build` completó API, web y extensión. Las pruebas HTTP separadas no se ejecutaron y no se iniciaron los servidores detenidos. No hubo llamadas reales a Claude ni una nueva validación manual de Gmail en este incremento.

## Vista simple y técnica

Las pruebas de UI comprueban la vista simple por defecto, el control global de detalle en bandeja e historial, el mantenimiento de riesgo/recomendaciones, el estado al cambiar de correo y la ausencia de solicitudes de reanálisis al alternar. Los errores siguen siendo errores en ambas vistas; los códigos quedan en la técnica. La suite actual suma **100 pruebas unitarias** tras agregar estos dos casos (72 API, 11 web y 17 extensión).
