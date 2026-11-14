import { it, expect } from "vitest";
import { RunStore } from "../src/core/RunStore.js";
const input = { from: "a@prueba.example", subject: "Prueba", textBody: "Cuerpo que no debe persistirse" };
it("crea corridas independientes de ambos orígenes y conserva solo metadatos", () => {
 const store = new RunStore();
 const fixture = store.create(input, "FIXTURE", "email-001"); const external = store.create(input, "EXTENSION");
 expect(fixture.runId).not.toBe(external.runId); expect(fixture.status).toBe("PROCESSING"); expect(fixture.report).toBeNull();
 expect(fixture.emailId).toBe("email-001"); expect(external.emailId).toBeUndefined();
 expect(JSON.stringify(store.list())).not.toContain(input.textBody); expect(store.get(external.runId)).toBe(external);
 expect(store.get("missing")).toBeUndefined();
});
it("retira la corrida completada más antigua y conserva las activas", () => {
 const store = new RunStore(); const active = store.create(input, "EXTENSION");
 const oldest = store.create(input, "FIXTURE", "email-001"); oldest.status = "FAILED";
 for (let i = 0; i < 198; i++) { const run = store.create(input, "EXTENSION"); run.status = "FAILED"; }
 store.create(input, "EXTENSION");
 expect(store.list()).toHaveLength(200); expect(store.get(oldest.runId)).toBeUndefined(); expect(store.get(active.runId)).toBe(active);
 expect(new RunStore().list()).toEqual([]);
});
