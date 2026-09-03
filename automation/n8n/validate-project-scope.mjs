import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MUTATIONS = new Set([
  "create",
  "update",
  "execute",
  "test",
  "activate",
  "deactivate",
  "publish",
  "unpublish",
  "archive",
  "restore",
  "move",
  "delete"
]);
const ACTIVATION = new Set(["activate"]);
const PUBLISHING = new Set(["publish", "unpublish"]);
const DESTRUCTIVE = new Set(["archive", "delete"]);
const KNOWN_OPERATIONS = new Set(["read", ...MUTATIONS]);
const ALLOWED_ENVIRONMENTS = ["development", "staging", "production"];
const ALLOWED_GLOBAL_CAPABILITIES = ["node_type_metadata", "public_n8n_documentation"];
const EXISTING_TARGET = new Set([
  "read",
  "update",
  "execute",
  "test",
  "activate",
  "deactivate",
  "publish",
  "unpublish",
  "archive",
  "restore",
  "move",
  "delete"
]);

function add(errors, code, message) {
  errors.push({ code, message });
}

function sameArray(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

export function validatePolicy(policy) {
  const errors = [];
  if (policy?.schema_version !== "1.0.0") add(errors, "POLICY_VERSION", "Unsupported policy version.");
  if (policy?.policy_id !== "INT-N8N-SCOPE-001") add(errors, "POLICY_ID", "Unexpected policy ID.");
  if (policy?.mode !== "deny_by_default") add(errors, "POLICY_MODE", "Policy must deny by default.");
  if (policy?.repository?.full_name !== "SatiahTheophilusTugbe/intrst-films-templates") {
    add(errors, "REPOSITORY_SCOPE", "Repository allowlist mismatch.");
  }
  if (policy?.n8n?.project?.id !== "o8RQQQgne2c6jXr5" || policy?.n8n?.project?.name !== "INTRST Films") {
    add(errors, "PROJECT_ALLOWLIST", "n8n project allowlist mismatch.");
  }
  if (policy?.n8n?.workflow?.required_name_prefix !== "INT-") add(errors, "WORKFLOW_PREFIX", "Workflow prefix must be INT-.");
  if (!policy?.n8n?.workflow?.required_tags?.includes("project:intrst")) add(errors, "WORKFLOW_TAG", "Required workflow tag is missing.");
  if (policy?.n8n?.workflow?.new_workflows_active !== false) add(errors, "DEFAULT_ACTIVE", "New workflows must be inactive.");
  if (!sameArray(policy?.n8n?.workflow?.allowed_environments, ALLOWED_ENVIRONMENTS)) {
    add(errors, "ENVIRONMENT_ALLOWLIST", "Workflow environment allowlist was modified.");
  }
  if (!sameArray(policy?.n8n?.allowed_global_capabilities, ALLOWED_GLOBAL_CAPABILITIES)) {
    add(errors, "GLOBAL_ALLOWLIST", "Global capability allowlist was modified.");
  }
  return errors;
}

export function validateRequest(request, policy) {
  const errors = validatePolicy(policy);
  const project = policy?.n8n?.project;
  const workflowPolicy = policy?.n8n?.workflow;
  const operation = request?.operation;
  const target = request?.target ?? {};
  const auth = request?.authorizations ?? {};

  if (request?.scope === "global") {
    const permitted = policy?.n8n?.allowed_global_capabilities?.includes(request?.global_capability);
    if (!permitted || request?.contains_project_data !== false) {
      add(errors, "GLOBAL_SCOPE_DENIED", "Only allowlisted non-project metadata may use global scope.");
    }
    if (operation !== "read") add(errors, "GLOBAL_MUTATION_DENIED", "Global scope is read-only.");
    if (target.type !== "metadata") add(errors, "GLOBAL_TARGET_DENIED", "Global scope cannot target project artifacts.");
    return result(errors);
  }

  if (request?.scope !== "project") add(errors, "SCOPE_REQUIRED", "Project scope is required.");
  if (request?.scoped_lookup !== true) add(errors, "UNSCOPED_LOOKUP", "The target must come from a project-scoped lookup.");
  if (request?.project_id !== project?.id || request?.project_name !== project?.name) {
    add(errors, "PROJECT_MISMATCH", "The request is outside the INTRST Films project allowlist.");
  }
  if (!operation) add(errors, "OPERATION_REQUIRED", "An explicit operation is required.");
  else if (!KNOWN_OPERATIONS.has(operation)) add(errors, "OPERATION_DENIED", "Operation is not allowlisted.");
  if (!target.type) add(errors, "TARGET_TYPE_REQUIRED", "Target type is required.");
  if (target.project_id !== project?.id) add(errors, "TARGET_OWNERSHIP", "Immutable target ownership was not verified.");
  if (EXISTING_TARGET.has(operation) && !target.id) add(errors, "TARGET_ID_REQUIRED", "Existing targets require an immutable ID.");

  if (target.type === "workflow" && MUTATIONS.has(operation)) {
    if (!target.name?.startsWith(workflowPolicy?.required_name_prefix)) {
      add(errors, "WORKFLOW_NAME_DENIED", "Workflow name is outside the INT- namespace.");
    }
    const tags = new Set(target.tags ?? []);
    for (const requiredTag of workflowPolicy?.required_tags ?? []) {
      if (!tags.has(requiredTag)) add(errors, "WORKFLOW_TAG_DENIED", `Missing required workflow tag: ${requiredTag}.`);
    }
    if (!workflowPolicy?.allowed_environments?.includes(target.environment)) {
      add(errors, "ENVIRONMENT_DENIED", "Workflow environment is not allowlisted.");
    }
    if (operation === "create" && target.active !== false) {
      add(errors, "CREATE_ACTIVE_DENIED", "New workflows must be created inactive.");
    }
  }

  if (MUTATIONS.has(operation)) {
    if (auth.n8n_mutation !== true) add(errors, "MUTATION_NOT_AUTHORIZED", "Explicit n8n mutation authorization is required.");
    if (!request?.expected_current_version) add(errors, "VERSION_REQUIRED", "Expected current version is required.");
    if (!request?.rollback_method) add(errors, "ROLLBACK_REQUIRED", "A rollback method is required.");
    if (!request?.idempotency_key) add(errors, "IDEMPOTENCY_REQUIRED", "An idempotency key is required.");
  }
  if (ACTIVATION.has(operation) && auth.activation !== true) add(errors, "ACTIVATION_NOT_AUTHORIZED", "Explicit activation authorization is required.");
  if (PUBLISHING.has(operation) && auth.publishing !== true) add(errors, "PUBLISHING_NOT_AUTHORIZED", "Explicit publishing authorization is required.");
  if (DESTRUCTIVE.has(operation) && auth.destructive !== true) add(errors, "DESTRUCTIVE_NOT_AUTHORIZED", "Explicit destructive-operation authorization is required.");
  if (target.environment === "production" && auth.production_promotion !== true) {
    add(errors, "PRODUCTION_NOT_AUTHORIZED", "Explicit production-promotion authorization is required.");
  }
  if (operation === "move" && (request?.from_project_id !== project?.id || request?.to_project_id !== project?.id)) {
    add(errors, "CROSS_PROJECT_MOVE_DENIED", "Moving artifacts into or out of INTRST Films is prohibited.");
  }
  if (request?.phase === "postflight" && request?.verified_after_mutation !== true) {
    add(errors, "POSTFLIGHT_REQUIRED", "Post-mutation project ownership must be re-verified.");
  }

  return result(errors);
}

function result(errors) {
  return { allowed: errors.length === 0, errors };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const requestPath = process.argv[2];
  const defaultPolicyPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "project-scope.json");
  const policyPath = process.argv[3] ?? defaultPolicyPath;
  if (!requestPath) {
    console.error("Usage: node validate-project-scope.mjs <request.json> [policy.json]");
    process.exit(2);
  }
  const validation = validateRequest(readJson(requestPath), readJson(policyPath));
  process.stdout.write(`${JSON.stringify(validation, null, 2)}\n`);
  process.exit(validation.allowed ? 0 : 1);
}
