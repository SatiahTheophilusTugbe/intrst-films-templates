const EXPECTED_PROJECT = Object.freeze({ id: "o8RQQQgne2c6jXr5", name: "INTRST Films" });
const EXPECTED_TABLES = Object.freeze([
  "people_queue",
  "life_files",
  "story_objects",
  "content_outputs",
  "approval_queue",
  "publishing_log",
  "performance",
  "asset_registry"
]);
const SUPPORTED_TYPES = new Set(["string", "number", "boolean", "date"]);
const REQUIRED_CONTROL_COLUMNS = new Set(["idempotency_key", "created_at"]);
const EXPECTED_COLUMN_SIGNATURES = Object.freeze({
  people_queue: ["subject_id:string", "full_name:string", "display_name:string", "category:string", "trigger_type:string", "trigger:string", "source_url:string", "candidate_reason:string", "story_value_score:number", "urgency_score:number", "priority:string", "queue_status:string", "assigned_to:string", "approved_by:string", "approved_at:date", "idempotency_key:string", "created_at:date", "updated_at:date"],
  life_files: ["life_file_id:string", "subject_id:string", "schema_version:string", "version:string", "status:string", "drive_document_url:string", "payload_json:string", "payload_hash:string", "claim_count:number", "verified_claim_count:number", "open_claim_count:number", "high_risk_claim_count:number", "source_count:number", "last_researched_at:date", "editorial_owner:string", "idempotency_key:string", "created_at:date", "updated_at:date"],
  story_objects: ["story_object_id:string", "subject_id:string", "subject_name:string", "schema_version:string", "editorial_version:string", "life_file_version:string", "story_bible_version:string", "approval_state:string", "rights_status:string", "asset_identity_status:string", "visual_mode:string", "payload_json:string", "payload_hash:string", "approved_by:string", "approved_at:date", "idempotency_key:string", "created_at:date", "updated_at:date"],
  content_outputs: ["output_id:string", "story_object_id:string", "subject_id:string", "output_type:string", "parent_output_id:string", "manifest_id:string", "manifest_version:string", "version:string", "status:string", "script_drive_url:string", "media_drive_url:string", "thumbnail_drive_url:string", "claim_ids_json:string", "asset_ids_json:string", "manifest_json:string", "editorial_approval:boolean", "rights_clearance:boolean", "publish_clearance:boolean", "created_by:string", "approved_by:string", "idempotency_key:string", "created_at:date", "updated_at:date"],
  approval_queue: ["review_id:string", "entity_type:string", "entity_id:string", "review_type:string", "priority:string", "reason:string", "story_object_id:string", "subject_id:string", "assigned_to:string", "status:string", "requested_at:date", "reviewed_at:date", "decision:string", "decision_actor:string", "notes:string", "idempotency_key:string", "created_at:date", "updated_at:date"],
  publishing_log: ["publishing_log_id:string", "output_id:string", "story_object_id:string", "subject_id:string", "platform:string", "instruction_version:string", "provider:string", "status:string", "approval_status:string", "scheduled_at:date", "published_at:date", "provider_post_id:string", "provider_post_url:string", "payload_json:string", "error_class:string", "error_message:string", "retry_count:number", "last_attempt_at:date", "idempotency_key:string", "created_at:date", "updated_at:date"],
  performance: ["performance_id:string", "output_id:string", "platform:string", "platform_post_id:string", "snapshot_at:date", "snapshot_window:string", "impressions:number", "reach:number", "views:number", "watch_time_seconds:number", "avg_watch_duration_seconds:number", "likes:number", "comments:number", "shares:number", "saves:number", "clicks:number", "followers_gained:number", "revenue_amount:number", "completion_rate:number", "ctr:number", "engagement_rate:number", "raw_payload_drive_url:string", "idempotency_key:string", "created_at:date"],
  asset_registry: ["asset_id:string", "subject_id:string", "story_object_id:string", "asset_type:string", "description:string", "source_id:string", "source_url:string", "drive_url:string", "file_hash:string", "mime_type:string", "identity_subject_id:string", "identity_confidence:number", "identity_status:string", "group_photo:boolean", "crop_verified:boolean", "technical_status:string", "rights_status:string", "rights_basis:string", "license:string", "license_url:string", "rights_documentation_url:string", "attribution_required:boolean", "attribution_text:string", "usage_status:string", "archive_value:string", "story_relevance:string", "approved_for_json:string", "rejected_reason:string", "idempotency_key:string", "created_at:date", "updated_at:date"]
});
const EXPECTED_REQUIRED_COLUMNS = Object.freeze({
  people_queue: ["subject_id", "full_name", "display_name", "category", "trigger_type", "trigger", "priority", "queue_status", "idempotency_key", "created_at", "updated_at"],
  life_files: ["life_file_id", "subject_id", "schema_version", "version", "status", "drive_document_url", "payload_json", "payload_hash", "claim_count", "verified_claim_count", "open_claim_count", "high_risk_claim_count", "source_count", "idempotency_key", "created_at", "updated_at"],
  story_objects: ["story_object_id", "subject_id", "subject_name", "schema_version", "editorial_version", "approval_state", "rights_status", "asset_identity_status", "visual_mode", "payload_json", "payload_hash", "idempotency_key", "created_at", "updated_at"],
  content_outputs: ["output_id", "story_object_id", "subject_id", "output_type", "manifest_id", "manifest_version", "version", "status", "claim_ids_json", "asset_ids_json", "manifest_json", "editorial_approval", "rights_clearance", "publish_clearance", "created_by", "idempotency_key", "created_at", "updated_at"],
  approval_queue: ["review_id", "entity_type", "entity_id", "review_type", "priority", "reason", "status", "requested_at", "idempotency_key", "created_at", "updated_at"],
  publishing_log: ["publishing_log_id", "output_id", "story_object_id", "subject_id", "platform", "instruction_version", "provider", "status", "approval_status", "payload_json", "retry_count", "idempotency_key", "created_at", "updated_at"],
  performance: ["performance_id", "output_id", "platform", "platform_post_id", "snapshot_at", "snapshot_window", "idempotency_key", "created_at"],
  asset_registry: ["asset_id", "subject_id", "asset_type", "description", "source_id", "source_url", "drive_url", "file_hash", "mime_type", "identity_status", "group_photo", "crop_verified", "technical_status", "rights_status", "attribution_required", "usage_status", "approved_for_json", "idempotency_key", "created_at", "updated_at"]
});

function add(errors, code, message, table = null) {
  errors.push({ code, message, table });
}

function sameMembers(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length && expected.every((item) => actual.includes(item));
}

export function validateDataTableContract(contract) {
  const errors = [];

  if (contract?.schema_version !== "1.0.0") add(errors, "CONTRACT_VERSION", "Unsupported INF-005 contract version.");
  if (contract?.contract_id !== "INF-005") add(errors, "CONTRACT_ID", "Contract ID must be INF-005.");
  if (contract?.project?.id !== EXPECTED_PROJECT.id || contract?.project?.name !== EXPECTED_PROJECT.name) {
    add(errors, "PROJECT_SCOPE", "Contract is outside the authorized INTRST Films project.");
  }
  if (contract?.storage_policy?.secrets_allowed !== false) add(errors, "SECRETS_POLICY", "Data Tables must not store secrets.");
  if (contract?.storage_policy?.nested_values !== "json_encoded_string") add(errors, "NESTED_VALUES", "Nested values must be JSON-encoded strings.");
  const dependencyIds = Array.isArray(contract?.open_dependencies) ? contract.open_dependencies.map((item) => item?.id) : [];
  if (!sameMembers(dependencyIds, ["INF-006-SUBJECT-ID", "INF-005-OBSERVABILITY"])) {
    add(errors, "OPEN_DEPENDENCIES", "Canonical INF-005 identity and observability dependencies must remain explicit.");
  }
  if (contract?.deployment?.environment !== "development") add(errors, "ENVIRONMENT", "INF-005 initial deployment must remain development-scoped.");
  if (contract?.deployment?.status !== "planned") add(errors, "DEPLOYMENT_STATE", "The version-controlled contract must remain planned until project-scoped postflight verification succeeds.");
  if (!contract?.deployment?.idempotency_key) add(errors, "DEPLOYMENT_IDEMPOTENCY", "Deployment idempotency key is required.");
  if (!contract?.deployment?.rollback_method) add(errors, "ROLLBACK", "Rollback method is required.");

  const tables = Array.isArray(contract?.tables) ? contract.tables : [];
  const names = tables.map((table) => table?.name);
  if (!sameMembers(names, EXPECTED_TABLES)) add(errors, "TABLE_ALLOWLIST", "INF-005 must contain exactly the eight canonical tables.");
  if (new Set(names).size !== names.length) add(errors, "DUPLICATE_TABLE", "Table names must be unique.");

  for (const table of tables) {
    const tableName = table?.name ?? "<unknown>";
    const columns = Array.isArray(table?.columns) ? table.columns : [];
    const columnNames = columns.map((column) => column?.name);
    const columnSet = new Set(columnNames);
    const signature = columns.map((column) => `${column?.name}:${column?.type}`);
    const expectedSignature = EXPECTED_COLUMN_SIGNATURES[tableName];
    const requiredColumns = columns.filter((column) => column?.required === true).map((column) => column.name);
    const expectedRequiredColumns = EXPECTED_REQUIRED_COLUMNS[tableName];

    if (columnSet.size !== columnNames.length) add(errors, "DUPLICATE_COLUMN", "Column names must be unique.", tableName);
    if (expectedSignature && !sameMembers(signature, expectedSignature)) {
      add(errors, "COLUMN_SCHEMA", "Columns and types must exactly match the canonical INF-005 schema.", tableName);
    }
    if (expectedRequiredColumns && !sameMembers(requiredColumns, expectedRequiredColumns)) {
      add(errors, "REQUIRED_SCHEMA", "Required and optional columns must exactly match the canonical INF-005 schema.", tableName);
    }
    for (const column of columns) {
      if (!SUPPORTED_TYPES.has(column?.type)) add(errors, "COLUMN_TYPE", `Unsupported n8n Data Table type: ${column?.type}.`, tableName);
      if (typeof column?.required !== "boolean") add(errors, "COLUMN_REQUIRED", `Column ${column?.name} must declare required.`, tableName);
    }
    for (const key of [...(table?.logical_key ?? []), ...(table?.idempotency_key ?? [])]) {
      if (!columnSet.has(key)) add(errors, "MISSING_KEY_COLUMN", `Declared key column ${key} does not exist.`, tableName);
    }
    for (const control of REQUIRED_CONTROL_COLUMNS) {
      if (!columnSet.has(control)) add(errors, "CONTROL_COLUMN", `Required control column ${control} is missing.`, tableName);
    }
  }

  return errors;
}

export function assertDataTableContract(contract) {
  const errors = validateDataTableContract(contract);
  if (errors.length) {
    const detail = errors.map((error) => `${error.code}${error.table ? `:${error.table}` : ""}: ${error.message}`).join("\n");
    throw new Error(`INF-005 validation failed:\n${detail}`);
  }
  return contract;
}
