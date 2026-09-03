import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validatePolicy, validateRequest } from "../validate-project-scope.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const policy = JSON.parse(fs.readFileSync(path.join(here, "..", "project-scope.json"), "utf8"));

const base = {
  scope: "project",
  scoped_lookup: true,
  project_id: "o8RQQQgne2c6jXr5",
  project_name: "INTRST Films",
  operation: "read",
  phase: "preflight",
  target: {
    type: "workflow",
    id: "wf_verified_001",
    project_id: "o8RQQQgne2c6jXr5",
    name: "INT-AUT-001 — Scope Test — DEV",
    tags: ["project:intrst"],
    environment: "development",
    active: false
  },
  authorizations: {}
};

const cases = [
  { name: "allows verified project read", mutate: () => ({}), allowed: true },
  { name: "denies wrong request project", mutate: () => ({ project_id: "other" }), code: "PROJECT_MISMATCH" },
  { name: "denies wrong target ownership", mutate: () => ({ target: { ...base.target, project_id: "other" } }), code: "TARGET_OWNERSHIP" },
  { name: "denies unscoped lookup", mutate: () => ({ scoped_lookup: false }), code: "UNSCOPED_LOOKUP" },
  { name: "denies name-only existing target", mutate: () => ({ target: { ...base.target, id: undefined } }), code: "TARGET_ID_REQUIRED" },
  {
    name: "allows non-project global node metadata",
    replace: {
      scope: "global",
      global_capability: "node_type_metadata",
      contains_project_data: false,
      operation: "read",
      target: { type: "metadata" }
    },
    allowed: true
  },
  {
    name: "denies global project discovery",
    replace: {
      scope: "global",
      global_capability: "workflow_inventory",
      contains_project_data: true,
      operation: "read",
      target: { type: "workflow" }
    },
    code: "GLOBAL_SCOPE_DENIED"
  },
  {
    name: "denies mutation disguised as global metadata",
    replace: {
      scope: "global",
      global_capability: "node_type_metadata",
      contains_project_data: false,
      operation: "delete",
      target: { type: "metadata" }
    },
    code: "GLOBAL_MUTATION_DENIED"
  },
  {
    name: "denies project target disguised as global metadata",
    replace: {
      scope: "global",
      global_capability: "node_type_metadata",
      contains_project_data: false,
      operation: "read",
      target: { type: "workflow" }
    },
    code: "GLOBAL_TARGET_DENIED"
  },
  { name: "denies unknown operation", mutate: () => ({ operation: "teleport" }), code: "OPERATION_DENIED" },
  {
    name: "allows authorized inactive development create",
    mutate: () => ({
      operation: "create",
      expected_current_version: "absent",
      rollback_method: "archive created workflow after verifying returned project ownership",
      idempotency_key: "INT-AUT-001@1.0.0",
      target: { ...base.target, id: undefined },
      authorizations: { n8n_mutation: true }
    }),
    allowed: true
  },
  {
    name: "denies mutation without authorization",
    mutate: () => ({
      operation: "update",
      expected_current_version: "1",
      rollback_method: "restore version 1",
      idempotency_key: "wf_verified_001@1",
      authorizations: {}
    }),
    code: "MUTATION_NOT_AUTHORIZED"
  },
  {
    name: "denies workflow outside namespace",
    mutate: () => ({
      operation: "create",
      expected_current_version: "absent",
      rollback_method: "archive created workflow",
      idempotency_key: "bad@1",
      target: { ...base.target, id: undefined, name: "OTHER-001", active: false },
      authorizations: { n8n_mutation: true }
    }),
    code: "WORKFLOW_NAME_DENIED"
  },
  {
    name: "denies missing required tag",
    mutate: () => ({
      operation: "create",
      expected_current_version: "absent",
      rollback_method: "archive created workflow",
      idempotency_key: "INT-AUT-001@1",
      target: { ...base.target, id: undefined, tags: [], active: false },
      authorizations: { n8n_mutation: true }
    }),
    code: "WORKFLOW_TAG_DENIED"
  },
  {
    name: "denies active workflow creation",
    mutate: () => ({
      operation: "create",
      expected_current_version: "absent",
      rollback_method: "archive created workflow",
      idempotency_key: "INT-AUT-001@1",
      target: { ...base.target, id: undefined, active: true },
      authorizations: { n8n_mutation: true }
    }),
    code: "CREATE_ACTIVE_DENIED"
  },
  {
    name: "denies activation without separate authorization",
    mutate: () => ({
      operation: "activate",
      expected_current_version: "1",
      rollback_method: "deactivate and restore version 1",
      idempotency_key: "wf_verified_001:activate:1",
      authorizations: { n8n_mutation: true }
    }),
    code: "ACTIVATION_NOT_AUTHORIZED"
  },
  {
    name: "denies production promotion without authorization",
    mutate: () => ({
      operation: "update",
      expected_current_version: "1",
      rollback_method: "restore version 1",
      idempotency_key: "wf_verified_001@2",
      target: { ...base.target, environment: "production" },
      authorizations: { n8n_mutation: true }
    }),
    code: "PRODUCTION_NOT_AUTHORIZED"
  },
  {
    name: "denies cross-project move",
    mutate: () => ({
      operation: "move",
      expected_current_version: "1",
      rollback_method: "restore original folder",
      idempotency_key: "wf_verified_001:move:1",
      from_project_id: "o8RQQQgne2c6jXr5",
      to_project_id: "other",
      authorizations: { n8n_mutation: true }
    }),
    code: "CROSS_PROJECT_MOVE_DENIED"
  },
  {
    name: "denies incomplete postflight",
    mutate: () => ({ phase: "postflight", verified_after_mutation: false }),
    code: "POSTFLIGHT_REQUIRED"
  }
];

for (const testCase of cases) {
  const changes = testCase.mutate?.() ?? {};
  const request = testCase.replace ?? { ...base, ...changes, target: changes.target ?? base.target };
  const result = validateRequest(request, policy);
  if (testCase.allowed) {
    assert.equal(result.allowed, true, `${testCase.name}: ${JSON.stringify(result.errors)}`);
  } else {
    assert.equal(result.allowed, false, `${testCase.name}: expected denial`);
    assert.ok(result.errors.some((error) => error.code === testCase.code), `${testCase.name}: missing ${testCase.code}`);
  }
}

const expandedGlobalPolicy = structuredClone(policy);
expandedGlobalPolicy.n8n.allowed_global_capabilities.push("workflow_inventory");
assert.ok(validatePolicy(expandedGlobalPolicy).some((error) => error.code === "GLOBAL_ALLOWLIST"));

const expandedEnvironmentPolicy = structuredClone(policy);
expandedEnvironmentPolicy.n8n.workflow.allowed_environments.push("other-project-production");
assert.ok(validatePolicy(expandedEnvironmentPolicy).some((error) => error.code === "ENVIRONMENT_ALLOWLIST"));

console.log(`project-scope: ${cases.length + 2} cases passed`);
