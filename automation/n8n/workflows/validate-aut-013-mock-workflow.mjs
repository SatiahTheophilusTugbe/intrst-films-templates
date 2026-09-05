import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const WORKFLOW_PATH = path.join(here, "INT-AUT-013-media-intelligence-orchestrator-dev.workflow.json");
export const WORKFLOW_NAME = "INT-AUT-013 \u2014 Media Intelligence Orchestrator \u2014 DEV";
const PROJECT_ID = "o8RQQQgne2c6jXr5";
export const REQUIRED_TAG = "project:intrst";
const REQUIRED_SEQUENCE = [
  "Initialize workflow_runs start object", "Validate synthetic Dolly request", "Canonicalize synthetic YouTube video ID",
  "Derive media:v2 cache key", "Mock cache lookup", "Mock atomic claim", "Execution-budget gate",
  "Exactly one MockTranscriptTransport invocation", "Validate and project provider_usage row",
  "Mock durable usage result and normalize metadata", "Mock cache persistence result", "Create terminal workflow_runs object", "Persist and exit"
];
const FORBIDDEN_TYPES = new Set([
  "n8n-nodes-base.httpRequest", "n8n-nodes-base.webhook", "n8n-nodes-base.scheduleTrigger",
  "n8n-nodes-base.wait", "n8n-nodes-base.executeWorkflowTrigger"
]);
const FORBIDDEN_TEXT = /https?:\/\/|n8n-nodes-base\.(httpRequest|webhook|scheduleTrigger|wait|executeWorkflowTrigger)|\bretry\b|setInterval|setTimeout/i;

function fail(message) { throw new Error(`AUT-013 workflow invalid: ${message}`); }

function normalizeCode(value) {
  return String(value ?? "").replace(/\r\n/g, "\n").trim();
}

function stripManagedNodeFields(node) {
  const parameters = { ...(node.parameters ?? {}) };
  if (typeof parameters.jsCode === "string") parameters.jsCode = normalizeCode(parameters.jsCode);
  return {
    name: node.name,
    type: node.type,
    typeVersion: node.typeVersion,
    disabled: node.disabled === true,
    parameters,
  };
}

export function canonicalizeWorkflow(workflow) {
  const nodes = [...(workflow.nodes ?? [])]
    .map(stripManagedNodeFields)
    .sort((left, right) => left.name.localeCompare(right.name));
  const connections = {};
  for (const source of Object.keys(workflow.connections ?? {}).sort()) {
    connections[source] = workflow.connections[source];
  }
  return {
    workflow_name: workflow.name,
    active: workflow.active === true,
    settings: { executionOrder: workflow.settings?.executionOrder ?? null },
    tags: [...(workflow.tags ?? [])].map((tag) => tag?.name).filter(Boolean).sort(),
    nodes,
    connections,
    mock_only_invariants: {
      project_id: PROJECT_ID,
      environment: "development",
      mock_transport_only: true,
      provider_calls: 0,
      provider_credits_consumed: 0,
      credentials_absent: !workflow.nodes?.some((node) => Object.prototype.hasOwnProperty.call(node, "credentials")),
      forbidden_nodes_absent: !workflow.nodes?.some((node) => FORBIDDEN_TYPES.has(node.type)),
      provider_urls_absent: !FORBIDDEN_TEXT.test(JSON.stringify(workflow)),
      manual_trigger_present: workflow.nodes?.some((node) => node.type === "n8n-nodes-base.manualTrigger") === true,
      other_triggers_absent: workflow.nodes?.filter((node) => node.type !== "n8n-nodes-base.manualTrigger" && node.type !== "n8n-nodes-base.code").length === 0,
      terminal_output: { status: "persist_and_exit", external_writes: 0, provider_calls: 0, credits_consumed: 0 },
    },
  };
}

export function semanticFingerprint(workflow) {
  return JSON.stringify(canonicalizeWorkflow(workflow));
}

export function compareSemanticFingerprint(reference, deployed) {
  const expected = JSON.parse(semanticFingerprint(reference));
  const actual = JSON.parse(semanticFingerprint(deployed));
  return { equal: JSON.stringify(expected) === JSON.stringify(actual), expected, actual };
}

export function validateRuntimeWorkflow(workflow, reference = loadWorkflow()) {
  validateWorkflow(workflow, { runtime: true });
  const comparison = compareSemanticFingerprint(reference, workflow);
  if (!comparison.equal) fail("runtime workflow semantic fingerprint differs from the repository artifact");
  return true;
}

export function loadWorkflow() {
  const workflow = JSON.parse(fs.readFileSync(WORKFLOW_PATH, "utf8"));
  validateWorkflow(workflow);
  return workflow;
}

export function validateWorkflow(workflow, options = {}) {
  if (!workflow || typeof workflow !== "object") fail("root must be an object");
  if (workflow.name !== WORKFLOW_NAME) fail("workflow name is outside the INT-AUT-013 contract");
  if (workflow.active !== false) fail("workflow must be inactive");
  if (!options.runtime && (!workflow.meta || workflow.meta.project_id !== PROJECT_ID || workflow.meta.environment !== "development" || workflow.meta.mock_transport_only !== true || workflow.meta.provider_calls !== 0 || workflow.meta.provider_credits_consumed !== 0)) fail("development/mock/project declarations are invalid");
  if (!Array.isArray(workflow.tags) || !workflow.tags.some((tag) => tag?.name === REQUIRED_TAG)) fail("required project tag is missing");
  if (!Array.isArray(workflow.nodes) || workflow.nodes.length !== 14) fail("unexpected node count");
  const nodes = new Map(workflow.nodes.map((node) => [node.name, node]));
  if (nodes.size !== workflow.nodes.length || !nodes.has("Manual Trigger")) fail("node names must be unique and include Manual Trigger");
  if (workflow.nodes.filter((node) => node.type === "n8n-nodes-base.manualTrigger").length !== 1) fail("Manual Trigger must be the only trigger");
  if (workflow.nodes.some((node) => node.type !== "n8n-nodes-base.manualTrigger" && node.type !== "n8n-nodes-base.code")) fail("only Manual Trigger and Code nodes are allowed");
  if (workflow.nodes.some((node) => FORBIDDEN_TYPES.has(node.type))) fail("forbidden node type present");
  if (workflow.nodes.some((node) => Object.prototype.hasOwnProperty.call(node, "credentials"))) fail("credentials are prohibited");
  const serialized = JSON.stringify(workflow);
  if (FORBIDDEN_TEXT.test(serialized)) fail("forbidden URL, retry, polling, credential or secret text present");
  if (/transport_mode\s*:\s*['"]live|fetch\s*\(|credential_ref|TranscriptAPI|ScrapeCreators/i.test(serialized)) fail("live transport or credential/provider binding present");
  if (workflow.nodes[0].name !== "Manual Trigger") fail("Manual Trigger must be first");
  if (workflow.nodes.slice(1).map((node) => node.name).some((name, index) => name !== REQUIRED_SEQUENCE[index])) fail("execution sequence is not canonical");
  if (!workflow.connections["Manual Trigger"]?.main?.[0]?.[0]?.node || workflow.connections["Create terminal workflow_runs object"]?.main?.[0]?.[0]?.node !== "Persist and exit") fail("connections do not terminate at persist-and-exit");
  for (const name of REQUIRED_SEQUENCE.slice(0, -1)) if (!workflow.connections[name]?.main?.[0]?.[0]?.node) fail(`node ${name} does not have a forward connection`);
  if (!workflow.nodes.find((node) => node.name === "Mock atomic claim")?.parameters?.jsCode.includes("claim_status:'CLAIMED'") || !workflow.nodes.find((node) => node.name === "Exactly one MockTranscriptTransport invocation")?.parameters?.jsCode.includes("mock_transport_attempts:1")) fail("mock claim/transport are not structurally enforced");
  const terminalCode = workflow.nodes.find((node) => node.name === "Persist and exit")?.parameters?.jsCode ?? "";
  if (!["status:'persist_and_exit'", "external_writes:0", "provider_calls:0", "credits_consumed:0"].every((value) => terminalCode.includes(value))) fail("terminal output contract is invalid");
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadWorkflow();
  console.log("AUT-013 inactive mock workflow valid");
}
