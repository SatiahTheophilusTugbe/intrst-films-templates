import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const workflow = JSON.parse(fs.readFileSync(path.join(here, "INT-AUT-014-distribution-executor-dev.workflow.json"), "utf8"));
const names = workflow.nodes.map((node) => node.name);
const forbidden = new Set(["n8n-nodes-base.httpRequest", "n8n-nodes-base.webhook", "n8n-nodes-base.scheduleTrigger", "n8n-nodes-base.wait", "n8n-nodes-base.executeWorkflowTrigger"]);
if (workflow.name !== "INT-AUT-014 — Distribution Executor — DEV" || workflow.active !== false) throw new Error("workflow name or inactive state invalid");
if (!workflow.tags.some((tag) => tag.name === "project:intrst")) throw new Error("required project tag missing");
if (workflow.nodes.filter((node) => node.type === "n8n-nodes-base.manualTrigger").length !== 1) throw new Error("Manual Trigger must be the only trigger");
if (workflow.nodes.some((node) => forbidden.has(node.type))) throw new Error("forbidden network/trigger node present");
if (workflow.nodes.some((node) => node.credentials)) throw new Error("credential reference present");
if (JSON.stringify(workflow).match(/https?:\/\//i)) throw new Error("provider URL present");
for (const required of ["Resolve content_output", "Resolve story_object", "Resolve asset_registry", "Resolve approval_queue", "Render platform-native payload", "Select Blotato publisher adapter", "Credential and account binding gate", "Persist and exit"]) if (!names.includes(required)) throw new Error(`missing node: ${required}`);
if (!JSON.stringify(workflow).includes("READY_FOR_CREDENTIAL_BINDING") || !JSON.stringify(workflow).includes("automatic_retries:0")) throw new Error("credential-gated terminal contract missing");
console.log("INT-AUT-014 inactive generic Distribution Executor valid");
