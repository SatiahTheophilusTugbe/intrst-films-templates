import { readFileSync } from "node:fs";
import { validateStudioObject, validateContinuitySnapshot } from "../../studio-v2.mjs";
import { buildPropertyObjects, buildContinuitySnapshots, validateObjectGraph, summarizePropertyCosts, runtimeContract } from "./christmas-invoice.mjs";

const objects = buildPropertyObjects();
const snapshots = buildContinuitySnapshots();
for (const object of objects) validateStudioObject(object);
for (const snapshot of snapshots) validateContinuitySnapshot(snapshot);
const graph = validateObjectGraph(objects, snapshots);
if (!graph.valid) throw new Error(`Property graph invalid: ${graph.errors.join(", ")}`);
const cost = summarizePropertyCosts();
if (cost.ledger.budget_opened_minor !== 60000 || cost.ledger.actual_minor !== 0) throw new Error("Proof budget is not the locked zero-spend $600 ceiling.");
if (runtimeContract.authorization.generation_enabled !== false || runtimeContract.authorization.automatic_paid_retries !== 0) throw new Error("Generation safety gate drifted.");
const sql = readFileSync(new URL("../../postgres/generation-attempt-claims.v1.sql", import.meta.url), "utf8");
for (const marker of ["operation_key text NOT NULL UNIQUE", "UNIQUE (generation_job_id, attempt_number)", "ON CONFLICT DO NOTHING", "outcome_unknown"]) if (!sql.includes(marker)) throw new Error(`Atomic claim SQL marker missing: ${marker}`);
if (/\bDELETE\s+FROM\s+intrst_generation_attempt_claims\b/i.test(sql)) throw new Error("Generation claim migration must not contain a delete/reset path.");
console.log(JSON.stringify({ verdict:"PROPERTY_RUNTIME_VALID", objects:objects.length, continuity_snapshots:snapshots.length, generation_jobs:0, provider_calls:0, budget_minor:60000, actual_cost_minor:0 }, null, 2));
