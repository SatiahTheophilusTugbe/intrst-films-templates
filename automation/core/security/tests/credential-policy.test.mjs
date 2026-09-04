import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanSecretExposure } from "../scan-secret-exposure.mjs";
import { validateCredentialPolicy } from "../validate-credential-policy.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const policy = JSON.parse(fs.readFileSync(path.join(here, "..", "inf-007.credential-policy.json"), "utf8"));
const clone = () => structuredClone(policy);
const expectCode = (candidate, code) => assert.ok(validateCredentialPolicy(candidate).some((error) => error.code === code), `Expected ${code}`);

assert.deepEqual(validateCredentialPolicy(policy), []);

const wrongProject = clone();
wrongProject.project.n8n_project_id = "other";
expectCode(wrongProject, "PROJECT_SCOPE");

const allowedGit = clone();
allowedGit.prohibited_surfaces = allowedGit.prohibited_surfaces.filter((surface) => surface !== "git_repository");
expectCode(allowedGit, "PROHIBITED_SURFACES");

const visibleValues = clone();
visibleValues.access_control.credential_value_inspection_by_codex_allowed = true;
expectCode(visibleValues, "ACCESS_CONTROL");

const crossProject = clone();
crossProject.access_control.cross_project_reuse_allowed = true;
expectCode(crossProject, "ACCESS_CONTROL");

const productionInDev = clone();
productionInDev.environment_isolation.development_may_use_production_credential = true;
expectCode(productionInDev, "ENVIRONMENT_ISOLATION");

const copiedPromotion = clone();
copiedPromotion.environment_isolation.promotion_copies_secret_values = true;
expectCode(copiedPromotion, "ENVIRONMENT_ISOLATION");

const infiniteStaticSecret = clone();
infiniteStaticSecret.lifecycle.static_secret_max_age_days = 0;
expectCode(infiniteStaticSecret, "LIFECYCLE");

const missingProvisioningEvidence = clone();
missingProvisioningEvidence.lifecycle.provisioning_requires = [];
expectCode(missingProvisioningEvidence, "LIFECYCLE");

const logsTokenFragments = clone();
logsTokenFragments.observability.allowed_fields.push("token_fragment");
expectCode(logsTokenFragments, "OBSERVABILITY");

const retriesCredentialFailure = clone();
retriesCredentialFailure.failure_policy.retry = "exponential";
expectCode(retriesCredentialFailure, "FAILURE_POLICY");

const credentialFallback = clone();
credentialFallback.failure_policy.fallback_to_different_credential = true;
expectCode(credentialFallback, "FAILURE_POLICY");

const unlimitedEmergency = clone();
unlimitedEmergency.break_glass.time_bounded = false;
expectCode(unlimitedEmergency, "BREAK_GLASS");

const unauditedEmergency = clone();
unauditedEmergency.break_glass.minimum_record = [];
expectCode(unauditedEmergency, "BREAK_GLASS");

const crossProjectIncident = clone();
crossProjectIncident.incident_response.automatic_cross_project_action_allowed = true;
expectCode(crossProjectIncident, "INCIDENT_SCOPE");

const incompleteIncident = clone();
incompleteIncident.incident_response.actions = [];
expectCode(incompleteIncident, "INCIDENT_SCOPE");

const removedGate = clone();
removedGate.deployment_gate.required_before = removedGate.deployment_gate.required_before.filter((item) => item !== "AUT-003");
expectCode(removedGate, "DEPLOYMENT_GATE");

assert.deepEqual(scanSecretExposure("credential_ref: INT | OpenAI | Development | Generation"), []);
assert.deepEqual(scanSecretExposure("X-N8N-API-KEY: <secret>"), []);
assert.deepEqual(scanSecretExposure("Authorization: Bearer ${TOKEN}"), []);
assert.ok(scanSecretExposure("Authorization: Bearer " + "synthetic_" + "token_value_123456").some((finding) => finding.code === "BEARER_TOKEN"));
assert.ok(scanSecretExposure("X-N8N-API-KEY=" + "synthetic_" + "n8n_key_123456789").some((finding) => finding.code === "N8N_API_KEY"));
assert.ok(scanSecretExposure("client_secret=" + "synthetic_" + "client_value_12345").some((finding) => finding.code === "ASSIGNED_SECRET"));
assert.ok(scanSecretExposure("-----BEGIN " + "PRIVATE KEY-----").some((finding) => finding.code === "PRIVATE_KEY"));

console.log("inf-007-credentials: 24 cases passed");
