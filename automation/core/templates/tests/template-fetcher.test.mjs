import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { TemplateFetchError, buildGitHubRawUrl, fetchRepositoryTemplate, getProviderReference, loadTemplateRegistry, requireTemplateCapability, selectTemplate, validateTemplateRegistry } from "../template-fetcher.mjs";

const registryPath = fileURLToPath(new URL("../../../../registry/template-registry.json", import.meta.url));
let passed = 0;

function test(name, fn) {
  return Promise.resolve().then(fn).then(() => { passed += 1; console.log(`ok - ${name}`); });
}

function expectCode(code, fn) {
  assert.throws(fn, (error) => error instanceof TemplateFetchError && error.code === code);
}

const registry = await loadTemplateRegistry(registryPath);

await test("loads and validates the canonical registry", () => assert.equal(validateTemplateRegistry(registry), true));
await test("preserves the existing design-family selector", () => assert.ok(registry.design_families.image_post.includes("portrait-tension")));
await test("selects the exact development fixture", () => {
  const record = selectTemplate(registry, { templateId: "INT-TPL-900", version: "0.1.0", environment: "development" });
  assert.equal(record.source.external_id, "EAHUTRYq_Pw");
});
await test("refuses to treat the smoke fixture as canonical", () => expectCode("TEMPLATE_NOT_CANONICAL", () => selectTemplate(registry, { templateId: "INT-TPL-900", version: "0.1.0", environment: "development", requireCanonical: true })));
await test("blocks Canva Autofill generation when entitlement is unavailable", () => expectCode("CAPABILITY_BLOCKED", () => requireTemplateCapability(registry.template_records[0], "autofill_generation")));
await test("allows verified dataset discovery", () => assert.equal(requireTemplateCapability(registry.template_records[0], "dataset_discovery"), true));
await test("returns only a sanitized provider reference", () => {
  const reference = getProviderReference(registry.template_records[0], { requiredCapability: "dataset_discovery" });
  assert.deepEqual(Object.keys(reference).sort(), ["credential_ref", "environment", "external_id", "provider", "template_id", "template_version", "url"]);
});
await test("requires an exact version on every selection", () => expectCode("TEMPLATE_VERSION_REQUIRED", () => selectTemplate(registry, { templateId: "INT-TPL-900", environment: "development" })));
await test("uses only an explicitly ordered fallback", () => {
  const record = selectTemplate(registry, { templateId: "INT-TPL-900", version: "0.2.0", fallbackVersions: ["0.1.0"], environment: "development" });
  assert.equal(record.template_version, "0.1.0");
});
await test("rejects malformed fallback versions", () => expectCode("TEMPLATE_FALLBACK_INVALID", () => selectTemplate(registry, { templateId: "INT-TPL-900", version: "0.2.0", fallbackVersions: ["latest"], environment: "development" })));
await test("rejects duplicate template identity", () => {
  const copy = structuredClone(registry);
  copy.template_records.push(structuredClone(copy.template_records[0]));
  expectCode("TEMPLATE_DUPLICATE", () => validateTemplateRegistry(copy));
});
await test("rejects secret-like registry keys", () => {
  const copy = structuredClone(registry);
  copy.template_records[0].secret_value = "not-a-real-secret";
  expectCode("SECRET_METADATA_PROHIBITED", () => validateTemplateRegistry(copy));
});
await test("rejects environment mismatch", () => expectCode("TEMPLATE_ENVIRONMENT_MISMATCH", () => selectTemplate(registry, { templateId: "INT-TPL-900", version: "0.1.0", environment: "staging" })));
await test("fails production promotion closed", () => {
  const copy = structuredClone(registry);
  copy.template_records[0].environment = "production";
  expectCode("PRODUCTION_TEMPLATE_NOT_APPROVED", () => selectTemplate(copy, { templateId: "INT-TPL-900", version: "0.1.0", environment: "production" }));
});

const content = "# deterministic template fixture\n";
const digest = createHash("sha256").update(content).digest("hex");
const repoRecord = {
  ...structuredClone(registry.template_records[0]),
  source: { provider: "github", kind: "repository_file", repository: "SatiahTheophilusTugbe/intrst-films-templates", path: "image-posts/example.md", sha256: digest }
};
const commitSha = "0123456789abcdef0123456789abcdef01234567";

await test("builds a commit-pinned GitHub raw URL", () => assert.equal(buildGitHubRawUrl(repoRecord, commitSha), `https://raw.githubusercontent.com/SatiahTheophilusTugbe/intrst-films-templates/${commitSha}/image-posts/example.md`));
await test("rejects mutable Git references", () => expectCode("IMMUTABLE_REF_REQUIRED", () => buildGitHubRawUrl(repoRecord, "main")));
await test("rejects repository path traversal", () => {
  const copy = structuredClone(repoRecord);
  copy.source.path = "../secret";
  expectCode("REPOSITORY_PATH_INVALID", () => buildGitHubRawUrl(copy, commitSha));
});
await test("fetches and verifies repository template content", async () => {
  const result = await fetchRepositoryTemplate(repoRecord, { commitSha, fetchImpl: async () => ({ ok: true, status: 200, text: async () => content }) });
  assert.equal(result.sha256, digest);
  assert.equal(result.content, content);
});
await test("rejects repository digest mismatch", async () => {
  await assert.rejects(() => fetchRepositoryTemplate(repoRecord, { commitSha, fetchImpl: async () => ({ ok: true, status: 200, text: async () => "tampered" }) }), (error) => error instanceof TemplateFetchError && error.code === "TEMPLATE_DIGEST_MISMATCH");
});

console.log(`AUT-003 template fetcher: ${passed} cases passed`);
