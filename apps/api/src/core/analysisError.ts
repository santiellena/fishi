import Anthropic from "@anthropic-ai/sdk";

const messages = {
  LLM_TIMEOUT: "Claude no respondió dentro del tiempo límite. No hay evaluación de riesgo disponible.",
  ANALYSIS_TIMEOUT: "El análisis superó su tiempo límite. No hay evaluación de riesgo disponible.",
  LLM_CONNECTION: "No se pudo conectar con Anthropic. Revisá la conectividad del backend.",
  LLM_AUTH: "Anthropic rechazó la autenticación. Revisá la clave configurada en el backend.",
  LLM_PERMISSION: "Anthropic rechazó el acceso. Revisá los permisos de la cuenta y del modelo.",
  LLM_MODEL: "Anthropic no encontró el recurso solicitado. Revisá ANTHROPIC_MODEL en el backend.",
  LLM_RATE_LIMIT: "Anthropic aplicó un límite de solicitudes. Esperá antes de reintentar.",
  LLM_REQUEST: "Anthropic rechazó la solicitud. Revisá la configuración y la cuenta del proveedor.",
  LLM_UNAVAILABLE: "Anthropic no está disponible en este momento. Intentá más tarde.",
  INVALID_RESPONSE: "Claude devolvió una respuesta que no cumple el formato del reporte.",
  INVALID_EVIDENCE: "El reporte de Claude contiene una cita que no existe en el correo recibido.",
  ANALYSIS_FAILED: "No se pudo completar el análisis. No hay evaluación de riesgo disponible.",
} as const;

export type AnalysisErrorCode = keyof typeof messages;

export class AnalysisError extends Error {
  constructor(readonly code: AnalysisErrorCode) {
    super(messages[code]);
    this.name = "AnalysisError";
  }
}

/** Only fixed messages and numeric status codes cross the logging/API boundary. */
export function describeAnalysisError(error: unknown) {
  let code: AnalysisErrorCode = "ANALYSIS_FAILED";
  let httpStatus: number | undefined;
  if (error instanceof AnalysisError) code = error.code;
  else if (error instanceof Anthropic.APIConnectionTimeoutError) code = "LLM_TIMEOUT";
  else if (error instanceof Anthropic.APIConnectionError) code = "LLM_CONNECTION";
  else if (error instanceof Anthropic.APIError) {
    httpStatus = error.status;
    if (httpStatus === 401) code = "LLM_AUTH";
    else if (httpStatus === 403) code = "LLM_PERMISSION";
    else if (httpStatus === 404) code = "LLM_MODEL";
    else if (httpStatus === 429) code = "LLM_RATE_LIMIT";
    else if (httpStatus !== undefined && httpStatus >= 500) code = "LLM_UNAVAILABLE";
    else code = "LLM_REQUEST";
  }
  return { code, message: messages[code], ...(httpStatus !== undefined ? { httpStatus } : {}) };
}
