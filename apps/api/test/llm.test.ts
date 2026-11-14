import { afterEach, it, expect, vi } from "vitest";
import { AnthropicClient } from "../src/core/llm.js";
import { REPORT_OUTPUT_FORMAT } from "../src/core/socialEngineeringAnalyzer.js";

afterEach(() => vi.unstubAllGlobals());
it("envía el esquema como output_config.format en una sola solicitud sin herramientas", async () => {
  let wire: Record<string, any> = {};
  const transport = vi.fn<typeof fetch>(async (input, init) => {
    wire = JSON.parse(await new Request(input, init).text());
    return new Response(JSON.stringify({
      id: "msg_synthetic", type: "message", role: "assistant", model: "synthetic-model",
      content: [{ type: "text", text: "{}" }], stop_reason: "end_turn", stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 2 },
    }), { headers: { "content-type": "application/json" } });
  });
  vi.stubGlobal("fetch", transport);
  const client = new AnthropicClient("synthetic-model", "test-key-not-a-secret");
  await client.complete({ system: "Análisis sintético", messages: [{ role: "user", content: "Mensaje ficticio" }], maxTokens: 3000, outputFormat: REPORT_OUTPUT_FORMAT });
  expect(transport).toHaveBeenCalledTimes(1);
  expect(wire.output_config.format.type).toBe("json_schema");
  expect(wire.output_config.format.schema.required).toEqual(["risk", "summary", "techniques", "indicators", "recommendations"]);
  expect(wire.output_config.format.schema.additionalProperties).toBe(false);
  expect(wire.output_config.format.schema.properties.risk.enum).toEqual(["LOW", "MEDIUM", "HIGH"]);
  expect(wire.tools).toBeUndefined();
  expect(wire.output_config.format.parse).toBeUndefined();
});
