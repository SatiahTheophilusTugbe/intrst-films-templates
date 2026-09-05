import assert from "node:assert/strict";
import { compareSemanticFingerprint, canonicalizeWorkflow, loadWorkflow, validateRuntimeWorkflow, validateWorkflow } from "../validate-aut-013-mock-workflow.mjs";

const workflow = loadWorkflow();
const names = workflow.nodes.map((node) => node.name);
const index = (name) => names.indexOf(name);

assert.equal(workflow.active, false);
assert.equal(workflow.nodes.filter((node) => node.type === "n8n-nodes-base.manualTrigger").length, 1);
assert.equal(workflow.nodes.filter((node) => node.type !== "n8n-nodes-base.manualTrigger" && node.type !== "n8n-nodes-base.code").length, 0);
assert.equal(workflow.nodes.some((node) => Object.prototype.hasOwnProperty.call(node, "credentials")), false);
assert.equal(workflow.meta.project_id, "o8RQQQgne2c6jXr5");
assert.equal(workflow.meta.mock_transport_only, true);
assert.equal(workflow.meta.provider_calls, 0);
assert.equal(workflow.meta.provider_credits_consumed, 0);
assert.equal(index("Manual Trigger"), 0);
assert.ok(index("Initialize workflow_runs start object") < index("Mock atomic claim"));
assert.ok(index("Mock atomic claim") < index("Exactly one MockTranscriptTransport invocation"));
assert.ok(index("Execution-budget gate") < index("Exactly one MockTranscriptTransport invocation"));
assert.ok(index("Validate and project provider_usage row") < index("Mock cache persistence result"));
assert.ok(index("Create terminal workflow_runs object") < index("Persist and exit"));
assert.equal(JSON.stringify(workflow).match(/https?:\/\//g), null);
assert.equal(JSON.stringify(workflow).match(/\bretry\b|setInterval|setTimeout|https?:\/\//i), null);
assert.equal(workflow.nodes.find((node) => node.name === "Mock atomic claim").parameters.jsCode.includes("claim_status:'CLAIMED'"), true);
assert.equal(workflow.nodes.find((node) => node.name === "Exactly one MockTranscriptTransport invocation").parameters.jsCode.includes("mock_transport_attempts:1"), true);
assert.equal(workflow.nodes.find((node) => node.name === "Mock durable usage result and normalize metadata").parameters.jsCode.includes("transcript_text_present:false"), true);
assert.equal(validateWorkflow(workflow), true);

const managedMetadataVariant = structuredClone(workflow);
managedMetadataVariant.id = "n8n-instance-id";
managedMetadataVariant.versionId = "n8n-version-id";
managedMetadataVariant.createdAt = "2026-01-01T00:00:00.000Z";
managedMetadataVariant.updatedAt = "2026-01-02T00:00:00.000Z";
managedMetadataVariant.triggerCount = 0;
managedMetadataVariant.meta = { aiBuilderAssisted: true, builderVariant: "mcp" };
managedMetadataVariant.tags = [{ id: "instance-tag-id", name: "project:intrst" }];
managedMetadataVariant.nodes.forEach((node) => { node.id = `instance-${node.name}`; node.position = [999, 999]; });
assert.equal(compareSemanticFingerprint(workflow, managedMetadataVariant).equal, true);
assert.equal(validateRuntimeWorkflow(managedMetadataVariant, workflow), true);

const expectInvalid = (mutate) => {
  const candidate = structuredClone(workflow);
  mutate(candidate);
  assert.throws(() => validateWorkflow(candidate));
};
expectInvalid((candidate) => { candidate.nodes = candidate.nodes.filter((node) => node.name !== "Manual Trigger"); });
expectInvalid((candidate) => { candidate.nodes[1].type = "n8n-nodes-base.webhook"; });
expectInvalid((candidate) => { candidate.nodes[1].type = "n8n-nodes-base.httpRequest"; });
expectInvalid((candidate) => { candidate.nodes[1].credentials = { api: { id: "secret", name: "secret" } }; });
const expectSemanticMismatch = (mutate) => {
  const candidate = structuredClone(workflow);
  mutate(candidate);
  assert.equal(compareSemanticFingerprint(workflow, candidate).equal, false);
  assert.throws(() => validateRuntimeWorkflow(candidate, workflow));
};
expectSemanticMismatch((candidate) => { candidate.nodes[1].parameters.jsCode += "\nreturn [{json:{changed:true}}];"; });
expectSemanticMismatch((candidate) => { candidate.connections["Mock atomic claim"].main[0][0].node = "Persist and exit"; });
expectInvalid((candidate) => { candidate.active = true; });
expectInvalid((candidate) => { candidate.tags = []; });
expectInvalid((candidate) => { candidate.nodes.at(-1).parameters.jsCode = "return [{json:{status:'wrong'}}];"; });
expectInvalid((candidate) => { candidate.nodes[1].parameters.jsCode += " provider_url:'https://example.invalid';"; });
expectInvalid((candidate) => { candidate.nodes[8].parameters.jsCode += " transport_mode:'live';"; });

assert.equal(canonicalizeWorkflow(workflow).mock_only_invariants.manual_trigger_present, true);
assert.equal(canonicalizeWorkflow(managedMetadataVariant).mock_only_invariants.other_triggers_absent, true);

console.log("AUT-013 mock workflow: 17 cases passed");
