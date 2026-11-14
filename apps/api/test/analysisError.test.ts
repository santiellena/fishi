import Anthropic from "@anthropic-ai/sdk";
import { it, expect } from "vitest";
import { AnalysisError, describeAnalysisError } from "../src/core/analysisError.js";

it("distingue timeout de transporte, timeout del analizador y conexión", () => {
  expect(describeAnalysisError(new Anthropic.APIConnectionTimeoutError({ message: "secret" })).code).toBe("LLM_TIMEOUT");
  expect(describeAnalysisError(new Anthropic.APIConnectionError({ message: "secret" })).code).toBe("LLM_CONNECTION");
  expect(describeAnalysisError(new AnalysisError("ANALYSIS_TIMEOUT")).code).toBe("ANALYSIS_TIMEOUT");
});
it("clasifica HTTP sin filtrar mensaje, headers o respuesta del proveedor", () => {
  for (const [status, code] of [[401, "LLM_AUTH"], [403, "LLM_PERMISSION"], [404, "LLM_MODEL"], [429, "LLM_RATE_LIMIT"], [529, "LLM_UNAVAILABLE"], [400, "LLM_REQUEST"]] as const) {
    const error = new Anthropic.APIError(status, { message: "secret body" }, "secret", new Headers({ "private": "secret" }));
    const result = describeAnalysisError(error);
    expect(result.code).toBe(code); expect(result.httpStatus).toBe(status);
    expect(JSON.stringify(result)).not.toContain("secret");
  }
});
it("errores desconocidos y de validación exponen solo mensajes fijos", () => {
  for (const error of [Error("secret"), "secret", new AnalysisError("INVALID_RESPONSE"), new AnalysisError("INVALID_EVIDENCE")]) {
    expect(JSON.stringify(describeAnalysisError(error))).not.toContain("secret");
  }
});
