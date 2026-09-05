import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const defaultPath = fileURLToPath(new URL("./execution-conservation.policy.json", import.meta.url));
const expectedAllowed = ["webhook", "manual", "form_submission", "execute_subworkflow", "targeted_due_work_schedule"];
const expectedDenied = ["continuous_polling", "interval_polling", "high_frequency_cron", "broad_channel_monitoring", "indefinite_wait"];

function same(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

export function validateExecutionConservation(policy) {
  const errors = [];
  const add = (code, message) => errors.push({ code, message });
  if (policy?.schema_version !== "1.0.0" || policy?.policy_id !== "INT-N8N-EXEC-001") add("IDENTITY", "Execution policy identity changed.");
  if (policy?.mode !== "event_driven_persist_and_exit") add("MODE", "Persist-and-exit mode is mandatory.");
  if (policy?.project?.id !== "o8RQQQgne2c6jXr5" || policy?.project?.name !== "INTRST Films" || policy?.project?.shared_instance !== true) add("PROJECT", "Shared-instance project scope changed.");
  if (!same(policy?.trigger_policy?.allowed_by_default, expectedAllowed) || !same(policy?.trigger_policy?.deny_by_default, expectedDenied) || policy?.trigger_policy?.polling_prohibited_by_default !== true) add("TRIGGERS", "Trigger allow/deny policy changed.");
  if (policy?.lifecycle?.idle_execution_allowed !== false || policy?.lifecycle?.long_lived_wait_allowed !== false || !same(policy?.lifecycle?.resume_fields, ["terminal_or_resume_state", "next_action_at", "idempotency_key"])) add("LIFECYCLE", "Persist-and-exit lifecycle was weakened.");
  if (policy?.budgets?.default_provider_calls_per_execution !== 1 || policy?.budgets?.maximum_provider_calls_per_execution !== 3 || policy?.budgets?.provider_call_requires_cache_miss !== true || policy?.budgets?.budget_exhaustion_action !== "persist_block_and_exit") add("BUDGET", "Provider-call budget was weakened.");
  if (policy?.retry?.maximum_transient_retries !== 3 || policy?.retry?.retry_inside_idle_loop !== false || policy?.retry?.deferred_retry !== "persist_next_action_at_and_exit") add("RETRY", "Retry conservation policy changed.");
  if (policy?.reconciliation?.minimum_interval_minutes < 30 || policy?.reconciliation?.query_scope !== "project_scoped_due_records_only" || policy?.reconciliation?.broad_polling_allowed !== false) add("RECONCILIATION", "Reconciliation scope or cadence was weakened.");
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const policy = JSON.parse(await readFile(process.argv[2] ?? defaultPath, "utf8"));
  const errors = validateExecutionConservation(policy);
  if (errors.length) { console.error(JSON.stringify(errors, null, 2)); process.exitCode = 1; }
  else console.log("n8n execution conservation policy valid");
}
