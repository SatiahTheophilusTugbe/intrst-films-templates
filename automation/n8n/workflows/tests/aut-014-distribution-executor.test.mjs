import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const workflow = JSON.parse(fs.readFileSync(path.join(here, "..", "INT-AUT-014-distribution-executor-dev.workflow.json"), "utf8"));
const serialized = JSON.stringify(workflow);

test("generic executor is inactive, tagged and credential-free", () => {
  assert.equal(workflow.active, false);
  assert.ok(workflow.tags.some((tag) => tag.name === "project:intrst"));
  assert.equal(workflow.nodes.filter((node) => node.type === "n8n-nodes-base.manualTrigger").length, 1);
  assert.equal(workflow.nodes.filter((node) => node.credentials).length, 0);
});

test("transport branches are present but credential-gated", () => {
  assert.equal(workflow.nodes.filter((node) => node.type === "n8n-nodes-base.httpRequest").length, 2);
  assert.equal(workflow.nodes.filter((node) => node.type === "@blotato/n8n-nodes-blotato.blotato").length, 3);
  for (const forbidden of ["webhook", "scheduleTrigger", "wait", "executeWorkflowTrigger"]) assert.equal(serialized.includes(forbidden), false);
  assert.equal(serialized.includes("httpRequest"), true);
  assert.equal(serialized.includes("blotato-api-key"), true);
  assert.equal(serialized.includes("READY_FOR_CREDENTIAL_BINDING"), true);
  assert.equal(workflow.nodes.filter((node) => node.credentials).length, 0);
});

test("canonical dependency order precedes adapter gate", () => {
  const order = workflow.nodes.map((node) => node.name);
  assert.ok(order.indexOf("Resolve content_output") < order.indexOf("Render platform-native payload"));
  assert.ok(order.indexOf("Render platform-native payload") < order.indexOf("Select Blotato publisher adapter"));
  assert.ok(order.indexOf("Select Blotato publisher adapter") < order.indexOf("Credential and account binding gate"));
  assert.ok(order.indexOf("Credential and account binding gate") < order.indexOf("Persist and exit"));
  assert.ok(order.indexOf("Credential and account readiness") < order.indexOf("Blotato HTTP — Facebook"));
  assert.ok(order.indexOf("Credential and account readiness") < order.indexOf("Blotato Native — Threads"));
});

test("transport URL and account routing are not input-controlled", () => {
  const http = workflow.nodes.filter((node) => node.type === "n8n-nodes-base.httpRequest");
  assert.ok(http.every((node) => node.parameters.url === "https://backend.blotato.com/v2/posts"));
  assert.ok(workflow.meta.account_config_version);
  assert.equal(serialized.includes("Authorization: Bearer"), false);
});
