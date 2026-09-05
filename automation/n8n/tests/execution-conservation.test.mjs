import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { validateExecutionConservation } from "../validate-execution-conservation.mjs";

const policy = JSON.parse(await readFile(fileURLToPath(new URL("../execution-conservation.policy.json", import.meta.url)), "utf8"));
let passed = 0;
const test = (name, mutate, code) => {
  const copy = structuredClone(policy); mutate?.(copy);
  const errors = validateExecutionConservation(copy);
  if (code) assert.ok(errors.some((error) => error.code === code), name); else assert.deepEqual(errors, [], name);
  passed += 1;
};

test("canonical policy passes");
test("polling cannot be enabled", (v) => { v.trigger_policy.polling_prohibited_by_default=false; }, "TRIGGERS");
test("continuous polling cannot be removed from denylist", (v) => { v.trigger_policy.deny_by_default.shift(); }, "TRIGGERS");
test("indefinite waits cannot be enabled", (v) => { v.lifecycle.long_lived_wait_allowed=true; }, "LIFECYCLE");
test("idle executions cannot be enabled", (v) => { v.lifecycle.idle_execution_allowed=true; }, "LIFECYCLE");
test("provider budget cannot expand", (v) => { v.budgets.maximum_provider_calls_per_execution=100; }, "BUDGET");
test("cache miss cannot be bypassed", (v) => { v.budgets.provider_call_requires_cache_miss=false; }, "BUDGET");
test("retries cannot become unbounded", (v) => { v.retry.maximum_transient_retries=99; }, "RETRY");
test("retry cannot idle-loop", (v) => { v.retry.retry_inside_idle_loop=true; }, "RETRY");
test("reconciliation cannot become frequent", (v) => { v.reconciliation.minimum_interval_minutes=5; }, "RECONCILIATION");
test("reconciliation cannot broaden scope", (v) => { v.reconciliation.query_scope="all_records"; }, "RECONCILIATION");
test("project scope cannot change", (v) => { v.project.id="other"; }, "PROJECT");

console.log(`execution-conservation: ${passed} cases passed`);
