import { createPublisherAdapter, validateDistributionRequest } from "./distribution-executor.mjs";

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
