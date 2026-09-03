import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createId, createUlid, isCanonicalId, isLegacyId, parseId, RECORD_TYPES, resolveSubjectIdentity } from "../ids.mjs";
import { validateIdentifierPolicy } from "../validate-identifier-policy.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const policy = JSON.parse(fs.readFileSync(path.join(here, "..", "inf-006.identifier-policy.json"), "utf8"));
const zeroEntropy = new Uint8Array(10);
const timestamp = Date.parse("2026-09-03T00:00:00.000Z");

assert.deepEqual(validateIdentifierPolicy(policy), []);

const ulid = createUlid({ timestamp, entropy: zeroEntropy });
assert.equal(ulid, "01M1J91D000000000000000000");

const subjectId = createId("subject", { timestamp, entropy: zeroEntropy });
assert.equal(subjectId, "INT-SUB-01M1J91D000000000000000000");
assert.equal(createId("SUB", { timestamp, entropy: zeroEntropy }), subjectId);
assert.equal(isCanonicalId(subjectId), true);
assert.equal(isCanonicalId(subjectId, "subject"), true);
assert.equal(isCanonicalId(subjectId, "asset"), false);

const parsed = parseId(subjectId);
assert.equal(parsed.type, "subject");
assert.equal(parsed.code, "SUB");
assert.equal(parsed.timestamp, timestamp);
assert.equal(parsed.created_at, "2026-09-03T00:00:00.000Z");

const nextMillisecond = createId("subject", { timestamp: timestamp + 1, entropy: zeroEntropy });
assert.equal(subjectId < nextMillisecond, true);

const generatedIds = new Set(Array.from({ length: 1000 }, () => createId("run")));
assert.equal(generatedIds.size, 1000);

for (const [name, code] of Object.entries(RECORD_TYPES)) {
  const id = createId(name, { timestamp, entropy: zeroEntropy });
  assert.equal(id.startsWith(`INT-${code}-`), true);
  assert.equal(parseId(id).type, name);
}

assert.equal(isCanonicalId("SUBJ-001"), false);
assert.equal(isLegacyId("SUBJ-001"), true);
assert.equal(isLegacyId("CLM-015"), true);
assert.equal(isLegacyId("hayden-panettiere"), true);
assert.equal(isLegacyId(subjectId), false);

assert.equal(resolveSubjectIdentity({ subject_id: subjectId }), subjectId);
assert.equal(resolveSubjectIdentity({ person_id: subjectId }), subjectId);
assert.equal(resolveSubjectIdentity({ subject_id: subjectId, person_id: subjectId }), subjectId);
assert.throws(() => resolveSubjectIdentity({ subject_id: subjectId, person_id: createId("subject") }), /must equal/);
assert.throws(() => resolveSubjectIdentity({ subject_id: "SUBJ-001" }), /canonical/);
assert.throws(() => createId("unknown"), /Unknown/);
assert.throws(() => createUlid({ timestamp, entropy: new Uint8Array(9) }), /10 bytes/);
assert.throws(() => createUlid({ timestamp: -1, entropy: zeroEntropy }), /timestamp/);
assert.throws(() => createUlid({ timestamp: Number(1n << 48n), entropy: zeroEntropy }), /timestamp/);
assert.throws(() => parseId("INT-SUB-01K46KBN00IIIIIIIIIIIIIIII"), /does not match/);
assert.throws(() => parseId("INT-XYZ-01M1J91D000000000000000000"), /Unknown/);
assert.throws(() => parseId("INT-SUB-Z1M1J91D000000000000000000"), /48 bits/);

const changedTypes = structuredClone(policy);
changedTypes.record_types[0].code = "PER";
assert.ok(validateIdentifierPolicy(changedTypes).some((error) => error.code === "TYPE_ALLOWLIST"));

const remappedRunTable = structuredClone(policy);
remappedRunTable.record_types.find((record) => record.name === "run").table = "publishing_log";
assert.ok(validateIdentifierPolicy(remappedRunTable).some((error) => error.code === "TYPE_ALLOWLIST"));

const weakenedPattern = structuredClone(policy);
weakenedPattern.record_id_pattern = ".*";
assert.ok(validateIdentifierPolicy(weakenedPattern).some((error) => error.code === "PATTERN"));

const changedAlphabet = structuredClone(policy);
changedAlphabet.generation.alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
assert.ok(validateIdentifierPolicy(changedAlphabet).some((error) => error.code === "ENCODING"));

const legacyGeneration = structuredClone(policy);
legacyGeneration.legacy.generatable = true;
assert.ok(validateIdentifierPolicy(legacyGeneration).some((error) => error.code === "LEGACY_GENERATION"));

const expandedWorkflowClass = structuredClone(policy);
expandedWorkflowClass.human_names.workflow_classes.push("OTHER");
assert.ok(validateIdentifierPolicy(expandedWorkflowClass).some((error) => error.code === "WORKFLOW_NAMING"));

const missingRunLedger = structuredClone(policy);
missingRunLedger.observability_decision.workflow_runs_required = false;
assert.ok(validateIdentifierPolicy(missingRunLedger).some((error) => error.code === "OBSERVABILITY"));

console.log(`inf-006-identifiers: ${Object.keys(RECORD_TYPES).length + 38} cases passed`);
