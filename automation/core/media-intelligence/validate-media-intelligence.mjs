import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const policyPath = fileURLToPath(new URL("./media-intelligence.policy.json", import.meta.url));
const proposalPath = fileURLToPath(new URL("./media-intelligence.data-tables.proposal.json", import.meta.url));
const schemaPaths = ["schemas/media-intelligence-request.schema.json", "schemas/media-source.schema.json", "schemas/media-intelligence-object.schema.json", "schemas/provider-usage-event.schema.json"];
const SECRET_KEY = /(?:api[_-]?key|secret|token|password|authorization|private[_-]?key|credential[_-]?id)/i;

function noSecretKeys(value, path = "document") {
  if (Array.isArray(value)) return value.forEach((item, index) => noSecretKeys(item, `${path}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_KEY.test(key)) throw new Error(`Secret-like key prohibited at ${path}.${key}`);
    noSecretKeys(child, `${path}.${key}`);
  }
}

export function validateMediaIntelligencePolicy(policy, proposal) {
  if (policy.contract_id !== "MEDIA-INTELLIGENCE-PHASE-1" || policy.version !== "1.0.0") throw new Error("Unsupported Media Intelligence policy.");
  if (policy.environment !== "development" || policy.routing.cache_first !== true || policy.routing.primary_provider !== "transcriptapi" || policy.routing.specialist_provider !== "scrapecreators") throw new Error("Provider routing policy was weakened.");
  if (policy.routing.polling_prohibited !== true || policy.routing.execution_policy !== "automation/n8n/execution-conservation.policy.json") throw new Error("Execution conservation policy is not bound to Media Intelligence.");
  const specialist = policy.providers.scrapecreators;
  if (specialist.protected_credit_floor !== 20 || specialist.paid_upgrade_authorized !== false || specialist.broad_polling_authorized !== false) throw new Error("ScrapeCreators protection policy was weakened.");
  if (policy.governance.transcript_direct_to_script !== false || policy.governance.audience_signal_eligible_for_claims !== false || policy.governance.source_discovery_confers_reuse_rights !== false) throw new Error("Editorial evidence policy was weakened.");
  if (proposal.status !== "planned" || proposal.extension_id !== "INF-005.2" || proposal.project.id !== "o8RQQQgne2c6jXr5" || proposal.base_contract.existing_tables_modified !== false || proposal.deployment.insert_rows !== false) throw new Error("Data Table extension must remain planned, non-mutating and project-scoped.");
  const names = proposal.tables.map((table) => table.name);
  if (JSON.stringify(names) !== JSON.stringify(["media_sources", "media_intelligence", "provider_usage"])) throw new Error("Unexpected Media Intelligence table expansion.");
  noSecretKeys(policy);
  noSecretKeys(proposal);
  return true;
}

export async function loadAndValidateMediaIntelligence() {
  const [policy, proposal, ...schemas] = await Promise.all([policyPath, proposalPath, ...schemaPaths.map((path) => `${root}${path}`)].map(async (path) => JSON.parse(await readFile(path, "utf8"))));
  validateMediaIntelligencePolicy(policy, proposal);
  for (const schema of schemas) if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema" || !schema.$id || schema.type !== "object") throw new Error(`Invalid schema declaration: ${schema.$id ?? "unknown"}`);
  return { policy, proposal, schemas };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await loadAndValidateMediaIntelligence();
  console.log(`Media Intelligence policy valid: ${result.schemas.length} schemas, ${result.proposal.tables.length} proposed tables`);
}
