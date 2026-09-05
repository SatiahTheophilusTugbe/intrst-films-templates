const EXPECTED_TYPE_SIGNATURES = Object.freeze([
  "subject:SUB:subject_id:people_queue",
  "life_file:LIF:life_file_id:life_files",
  "story:STY:story_id:null",
  "story_object:STO:story_object_id:story_objects",
  "source:SRC:source_id:null",
  "claim:CLM:claim_id:null",
  "quote:QTE:quote_id:null",
  "asset:AST:asset_id:asset_registry",
  "manifest:MAN:manifest_id:null",
  "output:OUT:output_id:content_outputs",
  "review:REV:review_id:approval_queue",
  "publishing:PUB:publishing_log_id:publishing_log",
  "performance:PRF:performance_id:performance",
  "run:RUN:run_id:workflow_runs",
  "render_job:RND:render_job_id:null",
  "decision:DEC:decision_id:null",
  "experiment:EXP:experiment_id:null",
  "intelligence:ITL:intelligence_id:null",
  "provider_usage:USG:usage_id:null",
  "cache_entry:CAC:cache_entry_id:null"
]);
const EXPECTED_LEGACY_PATTERNS = Object.freeze([
  "^SUBJ-[0-9]{3,}$",
  "^(SRC|CLM|AST|VID|MUS|DOC|AUD|REF|UNK)-[0-9]{3,}$",
  "^[a-z0-9]+(?:-[a-z0-9]+)+$"
]);
const EXPECTED_WORKFLOW_CLASSES = Object.freeze(["AUT", "SVC", "VAL", "UTIL", "TST", "EXP", "INF"]);
const EXPECTED_WORKFLOW_ENVIRONMENTS = Object.freeze(["DEV", "STG", "PROD"]);

function add(errors, code, message) {
  errors.push({ code, message });
}

function sameArray(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

export function validateIdentifierPolicy(policy) {
  const errors = [];
  if (policy?.schema_version !== "1.0.0") add(errors, "POLICY_VERSION", "Unsupported INF-006 policy version.");
  if (policy?.contract_id !== "INF-006") add(errors, "CONTRACT_ID", "Contract ID must be INF-006.");
  if (policy?.organization_prefix !== "INT") add(errors, "PREFIX", "Organization prefix must be INT.");
  if (policy?.record_id_format !== "INT-{TYPE}-{ULID}") add(errors, "FORMAT", "Canonical record format was modified.");
  if (policy?.record_id_pattern !== "^INT-[A-Z]{3}-[0-9A-HJKMNP-TV-Z]{26}$") add(errors, "PATTERN", "Canonical record pattern was modified.");

  const records = Array.isArray(policy?.record_types) ? policy.record_types : [];
  const signatures = records.map((record) => `${record?.name}:${record?.code}:${record?.primary_field}:${record?.table}`);
  if (!sameArray(signatures, EXPECTED_TYPE_SIGNATURES)) add(errors, "TYPE_ALLOWLIST", "Record type mapping or ordering was modified.");
  if (new Set(records.map((record) => record?.code)).size !== records.length) add(errors, "DUPLICATE_TYPE", "Record type codes must be unique.");

  if (policy?.subject_identity?.canonical_field !== "subject_id") add(errors, "SUBJECT_FIELD", "Canonical identity field must be subject_id.");
  if (policy?.subject_identity?.life_file_v1_alias !== "person_id") add(errors, "LIFE_FILE_ALIAS", "Life File v1 alias must remain person_id.");
  if (policy?.generation?.algorithm !== "ulid" || policy?.generation?.entropy_bits !== 80 || policy?.generation?.timestamp_precision !== "millisecond") add(errors, "GENERATION", "IDs must use millisecond ULIDs with 80 entropy bits.");
  if (policy?.generation?.alphabet !== "0123456789ABCDEFGHJKMNPQRSTVWXYZ" || policy?.generation?.case !== "uppercase" || policy?.generation?.central_counter_required !== false) add(errors, "ENCODING", "ULID alphabet, case or counter policy was modified.");
  if (policy?.generation?.regenerate_on_retry !== false || policy?.generation?.regenerate_on_update !== false) add(errors, "IMMUTABILITY", "IDs must survive retries and updates.");
  if (policy?.versioning?.entity_id_is_version !== false || policy?.versioning?.new_id_on_new_version !== false) add(errors, "VERSION_IDENTITY", "Version changes must not change entity IDs.");
  if (policy?.idempotency?.entity_id_is_idempotency_key !== false || policy?.idempotency?.key_is_separate !== true) add(errors, "IDEMPOTENCY_BOUNDARY", "Entity IDs and idempotency keys must remain separate.");
  if (policy?.external_ids?.store_separately !== true || policy?.external_ids?.never_replace_canonical_id !== true) add(errors, "EXTERNAL_IDS", "Provider and platform identifiers must remain external references.");
  if (policy?.legacy?.readable !== true || policy?.legacy?.generatable !== false || policy?.legacy?.eligible_as_global_primary_key !== false) add(errors, "LEGACY_GENERATION", "Legacy identifiers must remain read-only aliases.");
  if (!sameArray(policy?.legacy?.patterns, EXPECTED_LEGACY_PATTERNS)) add(errors, "LEGACY_PATTERNS", "Legacy pattern allowlist was modified.");
  if (policy?.human_names?.workflow !== "INT-{CLASS}-{NNN} — {human_name} — {ENV}" || !sameArray(policy?.human_names?.workflow_classes, EXPECTED_WORKFLOW_CLASSES) || !sameArray(policy?.human_names?.workflow_environments, EXPECTED_WORKFLOW_ENVIRONMENTS)) add(errors, "WORKFLOW_NAMING", "Workflow naming grammar was modified.");
  if (policy?.observability_decision?.workflow_runs_required !== true || policy?.observability_decision?.persistence !== "workflow_runs_data_table" || policy?.observability_decision?.implementation !== "formal_INF-005_minor_extension_before_first_workflow") add(errors, "OBSERVABILITY", "workflow_runs persistence decision is required.");
  return errors;
}
