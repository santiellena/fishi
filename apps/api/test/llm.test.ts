import { afterEach, it, expect, vi } from "vitest";
import { AnthropicClient } from "../src/core/llm.js";
import { reportOutputFormat } from "../src/core/socialEngineeringAnalyzer.js";

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
  await client.complete({ system: "Análisis sintético", messages: [{ role: "user", content: "Mensaje ficticio" }], maxTokens: 3000, outputFormat: reportOutputFormat(["e1", "e2", "e3"]) });
  expect(transport).toHaveBeenCalledTimes(1);
  expect(wire.output_config.format.type).toBe("json_schema");
  expect(wire.output_config.format.schema.required).toEqual(["risk", "summary", "indicators", "recommendations"]);
  expect(wire.output_config.format.schema.additionalProperties).toBe(false);
  expect(wire.output_config.format.schema.properties.risk.enum).toEqual(["LOW", "MEDIUM", "HIGH"]);
  const properties = wire.output_config.format.schema.properties;
  for (const field of [properties.summary, properties.indicators.items.properties.explanation, properties.recommendations.items]) {
    expect(field.pattern).toBe("\\S");
    const pattern = new RegExp(field.pattern);
    for (const empty of ["", " ", "\n\t", "\u00a0"]) expect(pattern.test(empty)).toBe(false);
    expect(pattern.test("Verificá por otro canal.")).toBe(true);
  }
  expect(properties.indicators.items.properties.evidenceId.enum).toEqual(["e1", "e2", "e3"]);
  expect(properties.indicators.items.required).toEqual(["technique", "evidenceId", "explanation"]);
  expect(properties.recommendations.minItems).toBe(1);
  expect(wire.tools).toBeUndefined();
  expect(wire.output_config.format.parse).toBeUndefined();
});
