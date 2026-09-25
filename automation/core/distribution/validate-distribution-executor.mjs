import { createPublisherAdapter, validateDistributionRequest } from "./distribution-executor.mjs";
import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync(new URL("ordered-media.mjs", import.meta.url), "utf8").replace(/^export /gm, "");
const workflow = JSON.parse(fs.readFileSync(new URL("../../n8n/workflows/INT-AUT-014-distribution-executor-dev.workflow.json", import.meta.url), "utf8"));
const inline = workflow.nodes.find(n => n.name === "Render platform-native payload").parameters.jsCode;
assert.ok(inline.startsWith("// BEGIN ORDERED MEDIA\n" + source + "\n// END ORDERED MEDIA\n"), "Canonical/inline media source differs");
const schema = JSON.parse(fs.readFileSync(new URL("../../../schemas/ordered-media-set.schema.json", import.meta.url), "utf8"));
assert.deepEqual(schema.properties.format.enum, ["single_image", "carousel", "archive", "evidence"]);

const request = {
  content_output_id: "INT-OUT-01K4X4Q7B6D0MMPY000000004",
  run_id: "INT-RUN-01K4X4Q7B6D0MMPY000000008",
  mode: "controlled_manual",
  budget: { max_publications: 1, max_attempts: 1, automatic_retries: 0 },
};

validateDistributionRequest(request);
createPublisherAdapter({
  name: "validation-adapter",
  validateConfig: async () => true,
  submit: async () => ({ status: "submitted" }),
  normalizeResult: (value) => value,
  normalizeError: () => "UNKNOWN",
});
console.log("Distribution Executor contract valid; runtime publication remains credential-gated.");
