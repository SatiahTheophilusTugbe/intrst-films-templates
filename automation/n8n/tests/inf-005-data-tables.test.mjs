import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateDataTableContract } from "../data-tables/validate-inf-005.mjs";
import { validateRequest } from "../validate-project-scope.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const contractPath = path.join(here, "..", "data-tables", "inf-005.data-tables.json");
const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
const scopePolicy = JSON.parse(fs.readFileSync(path.join(here, "..", "project-scope.json"), "utf8"));

function clone() {
  return structuredClone(contract);
}

function expectCode(candidate, code) {
  const errors = validateDataTableContract(candidate);
  assert.ok(errors.some((error) => error.code === code), `Expected ${code}; received ${JSON.stringify(errors)}`);
}

assert.deepEqual(validateDataTableContract(contract), []);

const wrongProject = clone();
wrongProject.project.id = "another-project";
expectCode(wrongProject, "PROJECT_SCOPE");

const extraTable = clone();
extraTable.tables.push(structuredClone(extraTable.tables[0]));
extraTable.tables.at(-1).name = "unapproved_table";
expectCode(extraTable, "TABLE_ALLOWLIST");

const missingTable = clone();
missingTable.tables.pop();
expectCode(missingTable, "TABLE_ALLOWLIST");

const duplicateTable = clone();
duplicateTable.tables[1].name = duplicateTable.tables[0].name;
expectCode(duplicateTable, "DUPLICATE_TABLE");

const unsupportedType = clone();
unsupportedType.tables[0].columns[0].type = "json";
expectCode(unsupportedType, "COLUMN_TYPE");

const supportedWrongType = clone();
supportedWrongType.tables[0].columns.find((column) => column.name === "story_value_score").type = "string";
expectCode(supportedWrongType, "COLUMN_SCHEMA");

const renamedCanonicalColumn = clone();
renamedCanonicalColumn.tables[0].columns.find((column) => column.name === "candidate_reason").name = "reason";
expectCode(renamedCanonicalColumn, "COLUMN_SCHEMA");

const extraColumn = clone();
extraColumn.tables[0].columns.push({ name: "unapproved_field", type: "string", required: false });
expectCode(extraColumn, "COLUMN_SCHEMA");

const weakenedRequiredField = clone();
weakenedRequiredField.tables[0].columns.find((column) => column.name === "subject_id").required = false;
expectCode(weakenedRequiredField, "REQUIRED_SCHEMA");

const hiddenDependency = clone();
hiddenDependency.open_dependencies.pop();
expectCode(hiddenDependency, "OPEN_DEPENDENCIES");

const duplicateColumn = clone();
duplicateColumn.tables[0].columns.push(structuredClone(duplicateColumn.tables[0].columns[0]));
expectCode(duplicateColumn, "DUPLICATE_COLUMN");

const missingLogicalKey = clone();
missingLogicalKey.tables[0].columns = missingLogicalKey.tables[0].columns.filter((column) => column.name !== "subject_id");
expectCode(missingLogicalKey, "MISSING_KEY_COLUMN");

const missingControl = clone();
missingControl.tables[0].columns = missingControl.tables[0].columns.filter((column) => column.name !== "created_at");
expectCode(missingControl, "CONTROL_COLUMN");

const secretsEnabled = clone();
secretsEnabled.storage_policy.secrets_allowed = true;
expectCode(secretsEnabled, "SECRETS_POLICY");

const productionEnvironment = clone();
productionEnvironment.deployment.environment = "production";
expectCode(productionEnvironment, "ENVIRONMENT");

const deployedWithoutPostflight = clone();
deployedWithoutPostflight.deployment.status = "deployed";
expectCode(deployedWithoutPostflight, "DEPLOYMENT_STATE");

const missingRollback = clone();
missingRollback.deployment.rollback_method = "";
expectCode(missingRollback, "ROLLBACK");

for (const table of contract.tables) {
  const scopeResult = validateRequest({
    scope: "project",
    scoped_lookup: true,
    project_id: contract.project.id,
    project_name: contract.project.name,
    operation: "create",
    phase: "preflight",
    expected_current_version: "absent",
    rollback_method: contract.deployment.rollback_method,
    idempotency_key: `${contract.deployment.idempotency_key}:${table.name}`,
    target: {
      type: "data_table",
      project_id: contract.project.id,
      name: table.name,
      environment: contract.deployment.environment
    },
    authorizations: { n8n_mutation: true }
  }, scopePolicy);
  assert.equal(scopeResult.allowed, true, `${table.name}: ${JSON.stringify(scopeResult.errors)}`);
}

console.log("inf-005-data-tables: 26 cases passed");
