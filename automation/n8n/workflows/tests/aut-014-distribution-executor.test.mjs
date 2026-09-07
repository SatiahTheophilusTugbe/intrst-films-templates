import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DISTRIBUTION_RENDERER_PARITY_MARKERS, renderPlatformPayload } from "../../../core/distribution/platform-renderer.mjs";

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
  assert.equal(workflow.nodes.filter((node) => node.type === "n8n-nodes-base.httpRequest").length, 3);
  assert.equal(workflow.nodes.filter((node) => node.type === "@blotato/n8n-nodes-blotato.blotato").length, 3);
  for (const forbidden of ["webhook", "scheduleTrigger", "wait", "executeWorkflowTrigger"]) assert.equal(serialized.includes(forbidden), false);
  assert.equal(serialized.includes("httpRequest"), true);
  assert.equal(serialized.includes("httpHeaderAuth"), true);
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

test("repair contract includes provider media resolution, bounded Threads rendering and durable publishing results", () => {
  assert.ok(workflow.meta.repair_contract.provider_media_resolution);
  assert.ok(serialized.includes("distribution-renderer@1.3.0"));
  assert.equal(workflow.meta.repair_contract.threads_max_characters, 500);
  assert.ok(workflow.nodes.some((node) => node.name === "Build publishing_log result row"));
  assert.ok(workflow.nodes.some((node) => node.name === "Persist publishing_log result"));
  assert.ok(serialized.includes("qHmuRSglzmNT3Oj9"));
});

test("checked-in inline renderer carries the canonical renderer parity markers", () => {
  const inline = workflow.nodes.find((node) => node.name === "Render platform-native payload")?.parameters?.jsCode ?? "";
  assert.ok(inline.length > 0);
  for (const marker of DISTRIBUTION_RENDERER_PARITY_MARKERS) assert.ok(inline.includes(marker), "inline renderer missing parity marker: " + marker);
});

test("checked-in inline renderer is behaviorally equivalent on representative platform fixtures", async () => {
  const inline = workflow.nodes.find((node) => node.name === "Render platform-native payload")?.parameters?.jsCode ?? "";
  const manifest = {
    caption: String.raw`Dolly turned a family wound into a library for millions of children. \n\n${"The story continued with durable work. ".repeat(8)}`,
    engagement_intent: "Which part of her legacy changed how you understand her?",
    hashtags: ["Literacy", "DollyParton", "Books"],
  };
  const configuration = {
    accounts: {
      facebook: { blotato_account_id: "22864", profile_page_id: "101607426321841" },
      instagram: { blotato_account_id: "69849" },
      threads: { blotato_account_id: "9386" },
      x: { blotato_account_id: "25655" },
      tiktok: { blotato_account_id: "58729" },
    },
    adapter_modes: { facebook: "http", instagram: "http", threads: "native", x: "native", tiktok: "http" },
  };
  const asset = { source_url: "https://commons.wikimedia.org/wiki/File:Young-Dolly-Parton.jpg" };
  const output = { output_id: "SYNTHETIC-OUT", manifest_json: JSON.stringify(manifest) };
  const fields = ["caption", "first_comment", "hashtags", "character_count", "media_urls", "adapter_mode", "engagement_rendered"];
  const normalize = (value) => Object.fromEntries(fields.map((field) => [field, value[field] ?? null]));
  const inlineRunner = new Function("$input", "$", `return (async () => {${inline}})()`);
  for (const platform of ["facebook", "instagram", "threads", "x", "tiktok"]) {
    const canonical = renderPlatformPayload({
      platform,
      caption_body: manifest.caption,
      engagement_intent: manifest.engagement_intent,
      hashtags: manifest.hashtags,
      media_urls: ["https://commons.wikimedia.org/wiki/Special:FilePath/Young-Dolly-Parton.jpg"],
      account_id: configuration.accounts[platform].blotato_account_id,
    });
    const input = { json: { output, platform, distribution_config: configuration } };
    const inlineResult = (await inlineRunner({ all: () => [input] }, () => ({ first: () => ({ json: asset }) })))[0].json;
    assert.deepEqual(normalize(inlineResult), normalize(canonical), `renderer parity mismatch for ${platform}`);
    assert.equal(canonical.caption.includes("\\n"), false, `canonical renderer leaked escaped newlines for ${platform}`);
    assert.equal(inlineResult.caption.includes("\\n"), false, `inline renderer leaked escaped newlines for ${platform}`);
    if (platform !== "x") assert.equal(canonical.caption.includes("\n\n"), true, `paragraph breaks missing for ${platform}`);
  }
});

test("transport branches are bounded and preserve the corrected Facebook account/page contract", () => {
  const transports = workflow.nodes.filter((node) => node.type === "n8n-nodes-base.httpRequest" || node.type === "@blotato/n8n-nodes-blotato.blotato");
  assert.ok(transports.every((node) => node.retryOnFail !== true));
  assert.ok(serialized.includes("profile_page_id"));
  assert.ok(serialized.includes('profile_page_id'));
  assert.ok(serialized.includes('101607426321841'));
});

test("persistence fan-in preserves per-platform identity and atomic claim remains fail-closed", () => {
  const logBuilder = workflow.nodes.find((node) => node.name === "Build publishing_log result row")?.parameters?.jsCode ?? "";
  const runBuilder = workflow.nodes.find((node) => node.name === "Build workflow_runs terminal row")?.parameters?.jsCode ?? "";
  const gate = workflow.nodes.find((node) => node.name === "Credential and account binding gate")?.parameters?.jsCode ?? "";
  const duplicateLookup = workflow.nodes.find((node) => node.name === "Exact publishing duplicate lookup")?.parameters ?? {};
  assert.match(logBuilder, /\$input\.all\(\)\.map/);
  assert.match(runBuilder, /\$input\.all\(\)\.map/);
  assert.doesNotMatch(logBuilder, /\$input\.first\(\)/);
  assert.doesNotMatch(runBuilder, /\$input\.first\(\)/);
  assert.match(logBuilder, /account_id/);
  assert.match(logBuilder, /provider_submission_id/);
  assert.match(logBuilder, /provider_post_id/);
  assert.match(logBuilder, /platform_post_id/);
  assert.match(gate, /atomic_claim_binding/);
  assert.match(gate, /BLOCKED_ATOMIC_CLAIM_REQUIRED/);
  assert.equal(duplicateLookup.filters.conditions.length, 1);
  assert.equal(duplicateLookup.filters.conditions[0].keyName, "idempotency_key");
});

test("centralized runtime configuration records the unresolved production claim boundary", () => {
  const config = workflow.nodes.find((node) => node.name === "Resolve centralized distribution config")?.parameters?.jsCode ?? "";
  assert.match(config, /distribution-runtime-config@1\.5\.0/);
  assert.match(config, /atomic_claim_binding/);
  assert.match(config, /guarantee:false/);
  assert.equal(serialized.includes("linkedin"), false);
});

test("transport URL and account routing are not input-controlled", () => {
  const http = workflow.nodes.filter((node) => node.type === "n8n-nodes-base.httpRequest");
  assert.ok(http.every((node) => node.parameters.url === "https://backend.blotato.com/v2/posts"));
  assert.ok(workflow.meta.account_config_version);
  assert.equal(serialized.includes("Authorization: Bearer"), false);
  assert.equal(serialized.includes("linkedin"), false);
});
