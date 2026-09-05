import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const COMMIT_SHA = /^[a-f0-9]{40}$/;
const TEMPLATE_ID = /^INT-TPL-[0-9]{3}$/;
const ALLOWED_ENVIRONMENTS = new Set(["development", "staging", "production"]);
const ALLOWED_STATUSES = new Set(["development", "active", "blocked_external_dependency", "retired"]);
const SECRET_KEYS = /(?:secret|token|password|authorization|private[_-]?key|credential[_-]?id)/i;
const CREDENTIAL_REF = /^INT \| [^|]+ \| (Development|Staging|Production) \| [^|]+$/;
const SHA256 = /^[a-f0-9]{64}$/;

export class TemplateFetchError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "TemplateFetchError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new TemplateFetchError(code, message, details);
}

export async function loadTemplateRegistry(pathOrUrl, { fetchImpl = globalThis.fetch } = {}) {
  let raw;
  if (/^https:\/\//.test(pathOrUrl)) {
    if (typeof fetchImpl !== "function") fail("FETCH_UNAVAILABLE", "No HTTPS fetch implementation is available.");
    const response = await fetchImpl(pathOrUrl, { headers: { Accept: "application/json" } });
    if (!response.ok) fail("REGISTRY_FETCH_FAILED", `Registry fetch failed with HTTP ${response.status}.`, { status: response.status });
    raw = await response.text();
  } else {
    raw = await readFile(pathOrUrl, "utf8");
  }

  let registry;
  try {
    registry = JSON.parse(raw);
  } catch {
    fail("REGISTRY_INVALID_JSON", "Template registry is not valid JSON.");
  }
  validateTemplateRegistry(registry);
  return registry;
}

export function validateTemplateRegistry(registry) {
  if (!registry || typeof registry !== "object" || Array.isArray(registry)) fail("REGISTRY_INVALID", "Registry must be an object.");
  if (registry.contract_id !== "AUT-003") fail("REGISTRY_CONTRACT_MISMATCH", "Registry contract_id must be AUT-003.");
  if (!SEMVER.test(registry.schema_version ?? "") || !SEMVER.test(registry.version ?? "")) fail("REGISTRY_VERSION_INVALID", "Registry versions must be semantic versions.");
  if (registry.brand !== "INTRST Films") fail("REGISTRY_BRAND_MISMATCH", "Registry brand must be INTRST Films.");
  if (!Array.isArray(registry.template_records)) fail("REGISTRY_RECORDS_INVALID", "template_records must be an array.");

  const identities = new Set();
  for (const record of registry.template_records) {
    validateRecord(record);
    const identity = `${record.template_id}@${record.template_version}`;
    if (identities.has(identity)) fail("TEMPLATE_DUPLICATE", `Duplicate template identity: ${identity}.`);
    identities.add(identity);
  }
  assertNoSecretMaterial(registry);
  return true;
}

function validateRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) fail("TEMPLATE_RECORD_INVALID", "Template record must be an object.");
  if (!TEMPLATE_ID.test(record.template_id ?? "")) fail("TEMPLATE_ID_INVALID", "Template ID must match INT-TPL-NNN.");
  if (!SEMVER.test(record.template_version ?? "")) fail("TEMPLATE_VERSION_INVALID", "Template version must be semantic.");
  if (!ALLOWED_ENVIRONMENTS.has(record.environment)) fail("TEMPLATE_ENVIRONMENT_INVALID", "Template environment is invalid.");
  if (!ALLOWED_STATUSES.has(record.status)) fail("TEMPLATE_STATUS_INVALID", "Template status is invalid.");
  if (typeof record.canonical !== "boolean") fail("TEMPLATE_CANONICAL_INVALID", "Template canonical flag must be boolean.");
  if (!record.source || !["repository_file", "canva_brand_template"].includes(record.source.kind)) fail("TEMPLATE_SOURCE_INVALID", "Template source kind is unsupported.");
  if (record.source.kind === "repository_file") {
    if (record.source.provider !== "github" || record.source.repository !== "SatiahTheophilusTugbe/intrst-films-templates") fail("REPOSITORY_SOURCE_INVALID", "Repository templates must use the authorized INTRST repository.");
    if (!record.source.path || record.source.path.startsWith("/") || record.source.path.includes("..")) fail("REPOSITORY_PATH_INVALID", "Repository path must remain relative and cannot traverse directories.");
    if (!SHA256.test(record.source.sha256 ?? "")) fail("TEMPLATE_DIGEST_INVALID", "Repository template requires a lowercase SHA-256 digest.");
  }
  if (record.source.kind === "canva_brand_template") {
    if (record.source.provider !== "canva" || !/^[A-Za-z0-9_-]+$/.test(record.source.external_id ?? "")) fail("CANVA_SOURCE_INVALID", "Canva template reference is invalid.");
    if (record.source.url !== `https://www.canva.com/brand/brand-templates/${record.source.external_id}`) fail("CANVA_SOURCE_URL_MISMATCH", "Canva template URL must match its external ID.");
    if (!CREDENTIAL_REF.test(record.credential_ref ?? "")) fail("CREDENTIAL_REFERENCE_INVALID", "Canva templates require a logical development credential reference.");
  }
  if (!record.dataset || !["not_tested", "verified", "blocked"].includes(record.dataset.status) || !record.dataset.fields || typeof record.dataset.fields !== "object") fail("TEMPLATE_DATASET_INVALID", "Template dataset contract is invalid.");
  for (const fieldType of Object.values(record.dataset.fields)) if (!["text", "image", "chart"].includes(fieldType)) fail("TEMPLATE_FIELD_TYPE_INVALID", "Template dataset field type is invalid.");
  if (!record.capabilities || typeof record.capabilities !== "object") fail("TEMPLATE_CAPABILITIES_INVALID", "Template capabilities are required.");
  for (const [name, capability] of Object.entries(record.capabilities)) {
    if (!capability || !["not_tested", "verified", "available", "blocked"].includes(capability.status)) fail("CAPABILITY_STATUS_INVALID", `Capability ${name} has an invalid status.`);
    if (capability.status === "blocked" && !capability.reason) fail("CAPABILITY_REASON_REQUIRED", `Blocked capability ${name} requires a reason.`);
  }
}

function assertNoSecretMaterial(value, path = "registry") {
  if (Array.isArray(value)) return value.forEach((item, index) => assertNoSecretMaterial(item, `${path}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_KEYS.test(key)) fail("SECRET_METADATA_PROHIBITED", `Prohibited secret-like field at ${path}.${key}.`);
    assertNoSecretMaterial(child, `${path}.${key}`);
  }
}

export function selectTemplate(registry, { templateId, version, fallbackVersions = [], environment = "development", requireCanonical = false, requiredCapabilities = [] }) {
  validateTemplateRegistry(registry);
  if (!TEMPLATE_ID.test(templateId ?? "")) fail("TEMPLATE_ID_INVALID", "A valid templateId is required.");
  if (!SEMVER.test(version ?? "")) fail("TEMPLATE_VERSION_REQUIRED", "An exact semantic template version is required.");
  if (!Array.isArray(fallbackVersions) || fallbackVersions.some((fallback) => !SEMVER.test(fallback))) fail("TEMPLATE_FALLBACK_INVALID", "Fallback versions must be an ordered list of semantic versions.");
  if (!ALLOWED_ENVIRONMENTS.has(environment)) fail("TEMPLATE_ENVIRONMENT_INVALID", "Requested environment is invalid.");

  const requestedVersions = [...new Set([version, ...fallbackVersions])];
  const candidate = requestedVersions
    .map((requestedVersion) => registry.template_records.find((record) => record.template_id === templateId && record.template_version === requestedVersion))
    .find(Boolean);
  if (!candidate) fail("TEMPLATE_NOT_FOUND", `Template ${templateId}@${version} and its explicit fallbacks were not found.`);

  const record = structuredClone(candidate);
  if (record.environment !== environment) fail("TEMPLATE_ENVIRONMENT_MISMATCH", "Template environment does not match the request.", { expected: environment, actual: record.environment });
  if (record.status === "retired") fail("TEMPLATE_RETIRED", "Retired templates cannot be selected.");
  if (requireCanonical && !record.canonical) fail("TEMPLATE_NOT_CANONICAL", "A noncanonical template cannot satisfy a canonical request.");
  if (environment === "production" && (!record.canonical || record.status !== "active" || record.approvals?.brand_design !== true || record.approvals?.production !== true)) {
    fail("PRODUCTION_TEMPLATE_NOT_APPROVED", "Production requires an active canonical template with Brand + Design and production approvals.");
  }
  for (const capabilityName of requiredCapabilities) requireTemplateCapability(record, capabilityName);
  return record;
}

export function requireTemplateCapability(record, capabilityName) {
  const capability = record.capabilities?.[capabilityName];
  if (!capability) fail("CAPABILITY_UNDECLARED", `Capability ${capabilityName} is not declared.`);
  if (!["verified", "available"].includes(capability.status)) fail("CAPABILITY_BLOCKED", `Capability ${capabilityName} is ${capability.status}.`, { reason: capability.reason ?? null });
  return true;
}

export function buildGitHubRawUrl(record, commitSha) {
  if (record.source?.kind !== "repository_file") fail("SOURCE_NOT_REPOSITORY", "Template is not backed by a repository file.");
  if (!COMMIT_SHA.test(commitSha ?? "")) fail("IMMUTABLE_REF_REQUIRED", "A lowercase 40-character Git commit SHA is required.");
  const path = record.source.path;
  if (!path || path.startsWith("/") || path.includes("..")) fail("REPOSITORY_PATH_INVALID", "Repository path must remain relative and cannot traverse directories.");
  return `https://raw.githubusercontent.com/${record.source.repository}/${commitSha}/${path}`;
}

export async function fetchRepositoryTemplate(record, { commitSha, fetchImpl = globalThis.fetch } = {}) {
  const url = buildGitHubRawUrl(record, commitSha);
  if (typeof fetchImpl !== "function") fail("FETCH_UNAVAILABLE", "No HTTPS fetch implementation is available.");
  const response = await fetchImpl(url, { headers: { Accept: "text/plain" } });
  if (!response.ok) fail("TEMPLATE_FETCH_FAILED", `Template fetch failed with HTTP ${response.status}.`, { status: response.status });
  const content = await response.text();
  const sha256 = createHash("sha256").update(content).digest("hex");
  if (sha256 !== record.source.sha256) fail("TEMPLATE_DIGEST_MISMATCH", "Fetched template content failed SHA-256 verification.", { expected: record.source.sha256, actual: sha256 });
  return { content, sha256, source_url: url, template_id: record.template_id, template_version: record.template_version };
}

export function getProviderReference(record, { requiredCapability } = {}) {
  if (record.source?.kind !== "canva_brand_template") fail("SOURCE_NOT_PROVIDER_REFERENCE", "Template is not a Canva provider reference.");
  if (requiredCapability) requireTemplateCapability(record, requiredCapability);
  return {
    provider: record.source.provider,
    external_id: record.source.external_id,
    url: record.source.url,
    template_id: record.template_id,
    template_version: record.template_version,
    environment: record.environment,
    credential_ref: record.credential_ref ?? null
  };
}
