import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const defaultPath = fileURLToPath(new URL("../../core/media-intelligence/media-intelligence.data-tables.proposal.json", import.meta.url));
const expectedTables = ["media_sources", "media_intelligence", "provider_usage"];
const allowedTypes = new Set(["string", "number", "boolean", "date"]);
const efficiencyFields = new Set(["next_action_at", "terminal_or_resume_state", "polling_prohibited"]);

export function validateInf0052(contract) {
  const errors=[]; const add=(code,message)=>errors.push({code,message});
  if (contract?.schema_version!=="1.0.0" || contract?.extension_id!=="INF-005.2" || contract?.extension_version!=="1.0.0") add("IDENTITY","INF-005.2 identity changed.");
  if (contract?.status!=="planned") add("STATUS","Predeployment contract must remain planned.");
  if (contract?.project?.id!=="o8RQQQgne2c6jXr5" || contract?.project?.name!=="INTRST Films") add("PROJECT","Unauthorized project.");
  if (contract?.base_contract?.immutable_existing_table_count!==9 || contract?.base_contract?.existing_tables_modified!==false) add("BASELINE","Nine deployed baseline tables must remain unchanged.");
  const deployment=contract?.deployment ?? {};
  if (deployment.environment!=="development" || deployment.expected_current_state!=="media_sources_media_intelligence_provider_usage_absent" || deployment.insert_rows!==false || deployment.modify_existing_tables!==false || deployment.create_workflows!==false || deployment.call_providers!==false || deployment.inspect_credential_values!==false) add("DEPLOYMENT","Deployment scope was expanded.");
  if (deployment.idempotency_key!=="INF-005.2:o8RQQQgne2c6jXr5:media-intelligence:1.0.0" || !deployment.rollback_method?.startsWith("archive_only_the_three_created_INF_005_2_tables")) add("RECOVERY","Idempotency or rollback contract changed.");
  const tables=Array.isArray(contract?.tables)?contract.tables:[];
  if (JSON.stringify(tables.map((table)=>table.name))!==JSON.stringify(expectedTables)) add("TABLE_ALLOWLIST","Exactly three ordered Media Intelligence tables are allowed.");
  for (const table of tables) {
    const names=new Set();
    for (const column of table.columns ?? []) {
      if (!/^[a-z][a-z0-9_]*$/.test(column.name ?? "") || !allowedTypes.has(column.type) || typeof column.required!=="boolean") add("COLUMN",`Invalid column in ${table.name}.`);
      if (names.has(column.name)) add("DUPLICATE_COLUMN",`Duplicate ${table.name}.${column.name}.`); names.add(column.name);
    }
    for (const field of efficiencyFields) if (!names.has(field)) add("EFFICIENCY_FIELD",`${table.name}.${field} is required.`);
    for (const key of [...(table.logical_key ?? []), ...(table.idempotency_key ?? [])]) if (!names.has(key)) add("KEY_REFERENCE",`${table.name} key ${key} has no column.`);
  }
  return errors;
}

if (process.argv[1]===fileURLToPath(import.meta.url)) {
  const contract=JSON.parse(await readFile(process.argv[2]??defaultPath,"utf8")); const errors=validateInf0052(contract);
  if(errors.length){console.error(JSON.stringify(errors,null,2));process.exitCode=1;} else console.log("INF-005.2 Media Intelligence Data Tables contract valid");
}
