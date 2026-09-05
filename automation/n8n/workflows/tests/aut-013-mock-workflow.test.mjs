import assert from "node:assert/strict";
import { loadWorkflow, validateWorkflow } from "../validate-aut-013-mock-workflow.mjs";

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
assert.equal(workflow.nodes.find((node) => node.name === "Mock atomic claim").parameters.jsCode.includes("atomic: true"), true);
assert.equal(workflow.nodes.find((node) => node.name === "Exactly one MockTranscriptTransport invocation").parameters.jsCode.includes("request_count: 1"), true);
assert.equal(workflow.nodes.find((node) => node.name === "Mock cache persistence result").parameters.jsCode.includes("raw_transcript_text: false"), true);
assert.equal(validateWorkflow(workflow), true);

console.log("AUT-013 mock workflow: 17 cases passed");
