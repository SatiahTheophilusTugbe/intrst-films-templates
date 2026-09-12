import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { assertHctiWorkflowParity, hctiWorkflowFingerprint } from "../workflow-parity.mjs";

const path = fileURLToPath(new URL("../../../n8n/workflows/INT-HCTI-editorial-render-bridge-dev.workflow.json", import.meta.url));
const workflow = JSON.parse(fs.readFileSync(path, "utf8"));
const managed = structuredClone(workflow);
managed.id = "runtime-managed";
managed.versionId = "runtime-version";
managed.createdAt = "2026-09-12T00:00:00Z";
managed.tags = managed.tags.map((name) => ({ id: "managed-tag-id", name }));
for (const node of managed.nodes) {
  for (const credential of Object.values(node.credentials ?? {})) credential.id = "managed-credential-id";
  node.parameters = Object.fromEntries(Object.entries(node.parameters).reverse());
}
assert.equal(assertHctiWorkflowParity(workflow, managed), hctiWorkflowFingerprint(workflow));

const behaviorChange = structuredClone(managed);
behaviorChange.nodes.find((node) => node.name === "HCTI Render — Single Attempt").parameters.options.timeout = 1;
assert.throws(() => assertHctiWorkflowParity(workflow, behaviorChange), (error) => error.code === "HCTI_WORKFLOW_PARITY_MISMATCH");

const connectionChange = structuredClone(managed);
connectionChange.connections["Build pre-transport evidence row"].main[0][0].node = "HCTI Render — Single Attempt";
assert.throws(() => assertHctiWorkflowParity(workflow, connectionChange), (error) => error.code === "HCTI_WORKFLOW_PARITY_MISMATCH");
console.log("HCTI workflow parity tests: 3 passed");
