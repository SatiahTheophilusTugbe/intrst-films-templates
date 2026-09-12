import crypto from "node:crypto";

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
}

export function canonicalizeHctiWorkflow(workflow) {
  return sortValue({
    name: workflow.name,
    active: workflow.active,
    settings: workflow.settings ?? {},
    tags: (workflow.tags ?? []).map((tag) => typeof tag === "string" ? tag : tag.name).sort(),
    nodes: (workflow.nodes ?? []).map((node) => ({
      name: node.name,
      type: node.type,
      typeVersion: node.typeVersion,
      position: node.position,
      parameters: node.parameters ?? {},
      disabled: Boolean(node.disabled),
      retryOnFail: Boolean(node.retryOnFail),
      onError: node.onError ?? null,
      credentials: Object.fromEntries(Object.entries(node.credentials ?? {}).map(([type, credential]) => [type, { name: credential.name }])),
    })).sort((a, b) => a.name.localeCompare(b.name)),
    connections: workflow.connections ?? {},
  });
}

export function hctiWorkflowFingerprint(workflow) {
  const canonical = JSON.stringify(canonicalizeHctiWorkflow(workflow));
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

export function assertHctiWorkflowParity(repositoryWorkflow, runtimeWorkflow) {
  const expected = hctiWorkflowFingerprint(repositoryWorkflow);
  const actual = hctiWorkflowFingerprint(runtimeWorkflow);
  if (expected !== actual) {
    const error = new Error("The deployed HCTI workflow differs semantically from the repository artifact.");
    error.code = "HCTI_WORKFLOW_PARITY_MISMATCH";
    error.details = { expected, actual };
    throw error;
  }
  return expected;
}
