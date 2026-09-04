const PROJECT = Object.freeze({ id: "o8RQQQgne2c6jXr5", name: "INTRST Films" });
const COLUMN_SIGNATURE = Object.freeze([
  "run_id:string", "root_run_id:string", "parent_run_id:string", "workflow_key:string", "workflow_name:string",
  "workflow_version:string", "module:string", "environment:string", "n8n_workflow_id:string", "n8n_execution_id:string",
  "subject_id:string", "story_object_id:string", "manifest_id:string", "output_id:string", "started_at:date",
  "completed_at:date", "status:string", "state_from:string", "state_to:string", "attempt:number", "provider:string",
  "model:string", "prompt_version:string", "template_id:string", "template_version:string", "input_ids_json:string",
  "output_ids_json:string", "source_ids_json:string", "claim_ids_json:string", "asset_ids_json:string",
  "human_review_required:boolean", "review_status:string", "approval_actor:string", "approval_at:date",
  "error_class:string", "error_message:string", "latency_ms:number", "estimated_cost:number", "idempotency_key:string",
  "created_at:date", "updated_at:date"
]);
const REQUIRED_COLUMNS = Object.freeze([
  "run_id", "root_run_id", "workflow_key", "workflow_name", "workflow_version", "module", "environment", "started_at",
  "status", "attempt", "input_ids_json", "output_ids_json", "source_ids_json", "claim_ids_json", "asset_ids_json",
  "human_review_required", "idempotency_key", "created_at", "updated_at"
]);
const SUPPORTED_TYPES = new Set(["string", "number", "boolean", "date"]);
const DEPLOYMENT = Object.freeze({
  environment: "development",
  expectedCurrentState: "workflow_runs_absent",
  idempotencyKey: "INF-005.1:o8RQQQgne2c6jXr5:workflow_runs:1.1.0",
  rollbackMethod: "archive_only_the_created_workflow_runs_table_after_project_scoped_id_verification"
});
const RUNTIME_INVARIANTS = Object.freeze([
  "run_id, root_run_id and parent_run_id use canonical INT-RUN identifiers",
  "root runs set root_run_id equal to run_id and parent_run_id empty",
  "child and retry runs retain the original root_run_id",
  "attempt is an integer greater than or equal to 1",
  "n8n workflow and execution IDs remain external references",
  "JSON string columns contain arrays of canonical or explicitly preserved legacy references",
  "completed_at is required for terminal states",
  "approval actor and timestamp are required when an approval is recorded",
  "error_class uses the normalized automation error taxonomy",
  "credentials, secret headers, tokens and raw provider payloads are prohibited"
]);

function add(errors, code, message) {
  errors.push({ code, message });
}

function sameArray(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

export function validateWorkflowRunsExtension(contract) {
  const errors = [];
  if (contract?.schema_version !== "1.0.0" || contract?.extension_id !== "INF-005.1" || contract?.extension_version !== "1.1.0") add(errors, "VERSION", "Unexpected workflow_runs extension identity.");
  if (contract?.status !== "planned") add(errors, "STATUS", "Version-controlled extension must remain planned until verified deployment is recorded separately.");
  if (contract?.base_contract?.id !== "INF-005" || contract?.base_contract?.version !== "1.0.0" || contract?.base_contract?.immutable_table_count !== 8 || contract?.base_contract?.existing_tables_modified !== false) add(errors, "BASELINE", "The deployed INF-005 baseline must remain immutable.");
  if (contract?.decision_source?.contract !== "INF-006") add(errors, "DECISION_SOURCE", "INF-006 must authorize the observability extension.");
  if (contract?.project?.id !== PROJECT.id || contract?.project?.name !== PROJECT.name) add(errors, "PROJECT_SCOPE", "Extension is outside the authorized INTRST Films project.");
  if (contract?.deployment?.environment !== DEPLOYMENT.environment) add(errors, "ENVIRONMENT", "Initial extension deployment must remain development-scoped.");
  if (contract?.deployment?.expected_current_state !== DEPLOYMENT.expectedCurrentState) add(errors, "EXPECTED_STATE", "Deployment must fail closed unless workflow_runs is absent.");
  if (contract?.deployment?.idempotency_key !== DEPLOYMENT.idempotencyKey) add(errors, "IDEMPOTENCY", "Unexpected deployment idempotency key.");
  if (contract?.deployment?.rollback_method !== DEPLOYMENT.rollbackMethod) add(errors, "ROLLBACK", "Unexpected deployment rollback method.");
  if (contract?.deployment?.insert_rows !== false || contract?.deployment?.modify_existing_tables !== false || contract?.deployment?.create_workflows !== false) add(errors, "MUTATION_SCOPE", "Extension may create only one empty table.");
  if (contract?.table?.name !== "workflow_runs") add(errors, "TABLE_NAME", "Only workflow_runs may be created.");

  const columns = Array.isArray(contract?.table?.columns) ? contract.table.columns : [];
  const signature = columns.map((column) => `${column?.name}:${column?.type}`);
  const required = columns.filter((column) => column?.required === true).map((column) => column.name);
  if (!sameArray(signature, COLUMN_SIGNATURE)) add(errors, "COLUMN_SCHEMA", "workflow_runs columns or types were modified.");
  if (!sameArray(required, REQUIRED_COLUMNS)) add(errors, "REQUIRED_SCHEMA", "workflow_runs required fields were modified.");
  if (new Set(columns.map((column) => column?.name)).size !== columns.length) add(errors, "DUPLICATE_COLUMN", "Column names must be unique.");
  for (const column of columns) if (!SUPPORTED_TYPES.has(column?.type)) add(errors, "COLUMN_TYPE", `Unsupported Data Table type: ${column?.type}.`);
  if (!contract?.table?.logical_key?.includes("run_id") || !contract?.table?.idempotency_key?.includes("idempotency_key")) add(errors, "KEYS", "Run and idempotency keys are required.");

  if (!sameArray(contract?.runtime_invariants, RUNTIME_INVARIANTS)) add(errors, "RUNTIME_INVARIANTS", "Runtime invariants were modified.");
  return errors;
}
