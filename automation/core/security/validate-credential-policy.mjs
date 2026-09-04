const PROJECT = Object.freeze({
  repository: "SatiahTheophilusTugbe/intrst-films-templates",
  n8n_project_name: "INTRST Films",
  n8n_project_id: "o8RQQQgne2c6jXr5"
});
const PRINCIPLES = Object.freeze(["least_privilege", "dedicated_integration_identity", "environment_isolation", "reference_not_value", "redact_before_persist", "fail_closed", "explicit_rotation_and_revocation"]);
const SECRET_CLASSES = Object.freeze(["api_key", "access_token", "refresh_token", "oauth_client_secret", "private_key", "service_account_key", "webhook_secret", "password", "session_cookie"]);
const STORE_SIGNATURES = Object.freeze([
  "n8n_runtime:n8n_credentials:project_scoped_when_supported|workflow_receives_reference_only|raw_value_not_exported",
  "codex_n8n_mcp:managed_oauth_connection:interactive_login_only|raw_value_not_entered_in_chat|connection_scoped_to_authorized_instance",
  "local_deployment_tooling:approved_environment_secret_store:not_committed|not_echoed|not_written_to_artifacts|dedicated_key_only"
]);
const PROHIBITED_SURFACES = Object.freeze(["git_repository", "workflow_export", "data_table", "workflow_run_log", "prompt_or_chat", "issue_or_pull_request", "screenshot_or_recording", "google_drive_document", "shell_history", "rendered_output"]);
const ENVIRONMENTS = Object.freeze(["Development", "Staging", "Production"]);
const ALLOWED_METADATA = Object.freeze(["provider", "credential_type", "environment", "purpose", "logical_reference", "required_scopes"]);
const PROHIBITED_METADATA = Object.freeze(["credential_id", "secret_value", "token_fragment", "authorization_header", "private_key_material", "raw_oauth_payload"]);
const LIFECYCLE_STATES = Object.freeze(["requested", "provisioned", "validated", "active", "rotation_due", "revoked", "retired"]);
const PROVISIONING_REQUIRES = Object.freeze(["owner", "provider", "purpose", "environment", "minimum_scopes", "approved_store"]);
const ROTATION_EVENTS = Object.freeze(["suspected_exposure", "confirmed_exposure", "owner_departure", "scope_reduction", "provider_requirement", "failed_security_review"]);
const OBSERVABILITY_ALLOWED = Object.freeze(["credential_ref", "provider", "credential_type", "environment", "purpose", "health_status", "checked_at", "error_class"]);
const OBSERVABILITY_PROHIBITED = Object.freeze(["secret_value", "authorization_header", "token_fragment", "request_headers", "raw_provider_payload", "private_key_material"]);
const REQUIRED_BEFORE = Object.freeze(["AUT-003", "external_provider_adapter", "workflow_activation", "production_promotion"]);
const GATE_CHECKS = Object.freeze(["reference_resolves", "environment_matches", "minimum_scopes_confirmed", "healthcheck_passes", "logs_are_redacted", "rollback_or_revocation_path_exists"]);
const BREAK_GLASS_RECORD = Object.freeze(["actor", "reason", "scope", "started_at", "expires_at", "affected_credential_ref"]);
const INCIDENT_ACTIONS = Object.freeze(["stop_affected_execution", "alert_operator", "revoke_affected_secret", "replace_environment_reference", "verify_redaction", "document_decision", "run_regression_tests"]);

function sameArray(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function add(errors, code, message) {
  errors.push({ code, message });
}

export function validateCredentialPolicy(policy) {
  const errors = [];
  if (policy?.schema_version !== "1.0.0" || policy?.contract_id !== "INF-007") add(errors, "IDENTITY", "Unexpected INF-007 identity or version.");
  if (policy?.status !== "development") add(errors, "STATUS", "Policy remains development until the canonical tracker records review completion.");
  if (policy?.mode !== "deny_by_default") add(errors, "MODE", "Credential access must deny by default.");
  if (JSON.stringify(policy?.project) !== JSON.stringify(PROJECT)) add(errors, "PROJECT_SCOPE", "Credential policy project scope was modified.");
  if (!sameArray(policy?.principles, PRINCIPLES)) add(errors, "PRINCIPLES", "Credential principles were modified.");
  if (!sameArray(policy?.secret_classes, SECRET_CLASSES)) add(errors, "SECRET_CLASSES", "Secret-class allowlist was modified.");
  const stores = Array.isArray(policy?.approved_stores) ? policy.approved_stores.map((store) => `${store?.surface}:${store?.store}:${(store?.conditions ?? []).join("|")}`) : [];
  if (!sameArray(stores, STORE_SIGNATURES)) add(errors, "APPROVED_STORES", "Approved secret stores or conditions were modified.");
  if (!sameArray(policy?.prohibited_surfaces, PROHIBITED_SURFACES)) add(errors, "PROHIBITED_SURFACES", "Prohibited secret surfaces were modified.");
  const reference = policy?.credential_reference;
  if (reference?.field !== "credential_ref" || reference?.naming_format !== "INT | {Provider} | {Environment} | {Purpose}" || !sameArray(reference?.allowed_environments, ENVIRONMENTS)) add(errors, "REFERENCE_FORMAT", "Credential reference format or environments were modified.");
  if (!sameArray(reference?.allowed_repository_metadata, ALLOWED_METADATA) || !sameArray(reference?.prohibited_repository_metadata, PROHIBITED_METADATA)) add(errors, "REPOSITORY_METADATA", "Repository credential metadata boundary was modified.");
  const access = policy?.access_control;
  if (access?.least_privilege_required !== true || access?.dedicated_identity_required !== true || access?.personal_login_allowed_only_when_provider_requires !== true || access?.project_ownership_verification_required !== true || access?.cross_project_reuse_allowed !== false || access?.credential_value_inspection_by_codex_allowed !== false || access?.credential_listing !== "name_type_and_project_only" || access?.production_use_requires_explicit_authorization !== true) add(errors, "ACCESS_CONTROL", "Least-privilege or project-isolation controls were weakened.");
  const isolation = policy?.environment_isolation;
  if (isolation?.separate_credentials_required !== true || isolation?.development_may_use_production_credential !== false || isolation?.staging_may_use_production_credential !== false || isolation?.fallback_to_other_environment_allowed !== false || isolation?.promotion_copies_secret_values !== false || isolation?.promotion_resolves_environment_specific_reference !== true) add(errors, "ENVIRONMENT_ISOLATION", "Environment isolation was weakened.");
  const lifecycle = policy?.lifecycle;
  if (!sameArray(lifecycle?.states, LIFECYCLE_STATES) || !sameArray(lifecycle?.provisioning_requires, PROVISIONING_REQUIRES) || lifecycle?.validation !== "non_mutating_healthcheck_when_available" || lifecycle?.static_secret_max_age_days !== 90 || !sameArray(lifecycle?.rotation_events, ROTATION_EVENTS) || lifecycle?.revocation_is_immediate_on_exposure !== true || lifecycle?.retired_credentials_must_not_remain_referenced !== true) add(errors, "LIFECYCLE", "Credential lifecycle or rotation controls were modified.");
  const observability = policy?.observability;
  if (!sameArray(observability?.allowed_fields, OBSERVABILITY_ALLOWED) || !sameArray(observability?.prohibited_fields, OBSERVABILITY_PROHIBITED) || observability?.redaction_required_before_logging !== true || observability?.redaction_replacement !== "[REDACTED]") add(errors, "OBSERVABILITY", "Credential logging boundary was weakened.");
  const failure = policy?.failure_policy;
  if (failure?.error_class !== "CREDENTIAL_FAILURE" || failure?.retry !== "none_until_operator_resolution" || failure?.workflow_action !== "stop_and_alert" || failure?.fallback_to_different_credential !== false || failure?.fallback_to_different_environment !== false || failure?.record_secret_value_in_error !== false) add(errors, "FAILURE_POLICY", "Credential failures must stop, alert and never fall back or leak values.");
  const emergency = policy?.break_glass;
  if (emergency?.enabled !== true || emergency?.requires_explicit_user_or_admin_authorization !== true || emergency?.time_bounded !== true || !sameArray(emergency?.minimum_record, BREAK_GLASS_RECORD) || emergency?.post_event_rotation_required !== true || emergency?.post_event_review_required !== true) add(errors, "BREAK_GLASS", "Emergency access controls were weakened.");
  if (!sameArray(policy?.incident_response?.actions, INCIDENT_ACTIONS) || policy?.incident_response?.automatic_cross_project_action_allowed !== false || policy?.incident_response?.production_reactivation_requires_explicit_authorization !== true) add(errors, "INCIDENT_SCOPE", "Incident response may not cross projects or reactivate production implicitly.");
  if (!sameArray(policy?.deployment_gate?.required_before, REQUIRED_BEFORE) || !sameArray(policy?.deployment_gate?.checks, GATE_CHECKS) || policy?.deployment_gate?.failure_behavior !== "block") add(errors, "DEPLOYMENT_GATE", "Credential gate requirements were modified.");
  return errors;
}
