import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const read = path => JSON.parse(readFileSync(resolve(root, path), "utf8"));

const objectModel = read("automation/core/studio-v2/studio-v2.object-model.json");
const router = read("automation/core/studio-v2/model-router.contract.json");
const continuity = read("automation/core/studio-v2/continuity-engine.contract.json");
const jobs = read("automation/core/studio-v2/generation-job.state-machine.json");
const cost = read("automation/core/studio-v2/cost-accounting.contract.json");
const migration = read("automation/core/studio-v2/resilience-and-migration.plan.json");
for (const schema of ["studio-v2-object.schema.json", "studio-v2-model-route.schema.json", "studio-v2-continuity-state.schema.json", "studio-v2-generation-job.schema.json", "studio-v2-cost-ledger.schema.json"]) read(`schemas/${schema}`);

assert.equal(objectModel.doctrine.migration, "additive");
assert.equal(objectModel.doctrine.legacy_story_object_preserved, true);
assert.equal(objectModel.doctrine.property_specific_generation_authorized, false);
assert.equal(objectModel.doctrine.monolithic_workflow_allowed, false);
assert.equal(new Set(objectModel.identifier_extension.types.map(x => x.code)).size, objectModel.identifier_extension.types.length);
assert.deepEqual(objectModel.object_types.map(x => x.object_type), ["signal", "series", "character", "relationship", "location", "episode", "scene", "shot"]);
assert.equal(Object.values(router.scoring_policy.weights).reduce((a, b) => a + b, 0), 100);
assert.equal(router.adapter_contract.required_methods.length, 8);
assert.equal(continuity.snapshot_policy.append_only, true);
assert.ok(continuity.dimensions.includes("knowledge_state") && continuity.dimensions.includes("voice_and_performance_identity"));
assert.equal(jobs.attempt_rules.some(x => x.includes("Automatic paid-generation retries default to zero")), true);
assert.equal(cost.accounting_policy.amount_representation, "integer_minor_units");
assert.equal(migration.data_table_proposal.existing_tables_modified, false);
assert.equal(migration.data_table_proposal.tables.length, 6);
assert.equal(migration.atomic_generation_claim_proposal.status, "design_only_not_migrated_not_proven");
assert.equal(migration.migration_phases[0].status, "complete_by_STU-004");
assert.equal(migration.migration_phases.some(x => x.status.includes("blocked_until_STU-005")), true);
assert.equal(migration.resilience.retry_policy.paid_generation_automatic_retries, 0);

console.log("STU-004 Studio v2 architecture contracts valid");
