import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateRequest } from "../validate-project-scope.mjs";
import { validateWorkflowRunsExtension } from "../data-tables/validate-workflow-runs-extension.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const extension = JSON.parse(fs.readFileSync(path.join(here, "..", "data-tables", "inf-005.1.workflow-runs.extension.json"), "utf8"));
const scopePolicy = JSON.parse(fs.readFileSync(path.join(here, "..", "project-scope.json"), "utf8"));

function clone() {
  return structuredClone(extension);
}

function expectCode(candidate, code) {
  const errors = validateWorkflowRunsExtension(candidate);
  assert.ok(errors.some((error) => error.code === code), `Expected ${code}; received ${JSON.stringify(errors)}`);
}

assert.deepEqual(validateWorkflowRunsExtension(extension), []);

const wrongProject = clone();
wrongProject.project.id = "other";
expectCode(wrongProject, "PROJECT_SCOPE");

const renamedTable = clone();
renamedTable.table.name = "execution_log";
expectCode(renamedTable, "TABLE_NAME");

const changedExisting = clone();
changedExisting.base_contract.existing_tables_modified = true;
expectCode(changedExisting, "BASELINE");

const rowInsertion = clone();
rowInsertion.deployment.insert_rows = true;
expectCode(rowInsertion, "MUTATION_SCOPE");

const production = clone();
production.deployment.environment = "production";
expectCode(production, "ENVIRONMENT");

const unsupportedType = clone();
unsupportedType.table.columns[0].type = "json";
expectCode(unsupportedType, "COLUMN_TYPE");

const supportedWrongType = clone();
supportedWrongType.table.columns.find((column) => column.name === "attempt").type = "string";
expectCode(supportedWrongType, "COLUMN_SCHEMA");

const removedColumn = clone();
removedColumn.table.columns = removedColumn.table.columns.filter((column) => column.name !== "error_class");
expectCode(removedColumn, "COLUMN_SCHEMA");

const extraColumn = clone();
extraColumn.table.columns.push({ name: "raw_secret", type: "string", required: false });
expectCode(extraColumn, "COLUMN_SCHEMA");

const weakenedRequired = clone();
weakenedRequired.table.columns.find((column) => column.name === "run_id").required = false;
expectCode(weakenedRequired, "REQUIRED_SCHEMA");

const hiddenInvariant = clone();
hiddenInvariant.runtime_invariants = [];
expectCode(hiddenInvariant, "RUNTIME_INVARIANTS");

const alteredInvariant = clone();
alteredInvariant.runtime_invariants[9] = "secrets are discouraged";
expectCode(alteredInvariant, "RUNTIME_INVARIANTS");

const wrongExpectedState = clone();
wrongExpectedState.deployment.expected_current_state = "unknown";
expectCode(wrongExpectedState, "EXPECTED_STATE");

const changedIdempotencyKey = clone();
changedIdempotencyKey.deployment.idempotency_key = "some-key";
expectCode(changedIdempotencyKey, "IDEMPOTENCY");

const changedRollback = clone();
changedRollback.deployment.rollback_method = "delete_table";
expectCode(changedRollback, "ROLLBACK");

const scopeResult = validateRequest({
  scope: "project",
  scoped_lookup: true,
  project_id: extension.project.id,
  project_name: extension.project.name,
  operation: "create",
  phase: "preflight",
  expected_current_version: "absent",
  rollback_method: extension.deployment.rollback_method,
  idempotency_key: extension.deployment.idempotency_key,
  target: {
    type: "data_table",
    project_id: extension.project.id,
    name: extension.table.name,
    environment: extension.deployment.environment
  },
  authorizations: { n8n_mutation: true }
}, scopePolicy);
assert.equal(scopeResult.allowed, true, JSON.stringify(scopeResult.errors));

console.log("workflow-runs-extension: 17 cases passed");
