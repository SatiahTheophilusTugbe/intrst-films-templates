import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { validateInf0052 } from "../data-tables/validate-inf-005-2.mjs";

const contract=JSON.parse(await readFile(fileURLToPath(new URL("../../core/media-intelligence/media-intelligence.data-tables.proposal.json",import.meta.url)),"utf8"));
let passed=0; const test=(name,mutate,code)=>{const copy=structuredClone(contract);mutate?.(copy);const errors=validateInf0052(copy);if(code)assert.ok(errors.some((error)=>error.code===code),name);else assert.deepEqual(errors,[],name);passed+=1;};

test("canonical INF-005.2 passes");
test("project cannot change",v=>{v.project.id="other"},"PROJECT");
test("production deployment prohibited",v=>{v.deployment.environment="production"},"DEPLOYMENT");
test("row insertion prohibited",v=>{v.deployment.insert_rows=true},"DEPLOYMENT");
test("existing table mutation prohibited",v=>{v.deployment.modify_existing_tables=true},"DEPLOYMENT");
test("workflow creation prohibited",v=>{v.deployment.create_workflows=true},"DEPLOYMENT");
test("provider calls prohibited",v=>{v.deployment.call_providers=true},"DEPLOYMENT");
test("credential-value inspection prohibited",v=>{v.deployment.inspect_credential_values=true},"DEPLOYMENT");
test("table expansion prohibited",v=>{v.tables.push(structuredClone(v.tables[0]))},"TABLE_ALLOWLIST");
test("table rename prohibited",v=>{v.tables[0].name="other"},"TABLE_ALLOWLIST");
test("nine baseline tables immutable",v=>{v.base_contract.immutable_existing_table_count=8},"BASELINE");
test("idempotency key locked",v=>{v.deployment.idempotency_key="changed"},"RECOVERY");
test("rollback locked",v=>{v.deployment.rollback_method="delete_everything"},"RECOVERY");
test("polling flag required",v=>{v.tables[0].columns=v.tables[0].columns.filter((column)=>column.name!=="polling_prohibited")},"EFFICIENCY_FIELD");
test("resume state required",v=>{v.tables[1].columns=v.tables[1].columns.filter((column)=>column.name!=="terminal_or_resume_state")},"EFFICIENCY_FIELD");
test("next action required",v=>{v.tables[2].columns=v.tables[2].columns.filter((column)=>column.name!=="next_action_at")},"EFFICIENCY_FIELD");
test("key must reference column",v=>{v.tables[0].logical_key=["missing"]},"KEY_REFERENCE");
test("duplicate columns prohibited",v=>{v.tables[0].columns.push(structuredClone(v.tables[0].columns[0]))},"DUPLICATE_COLUMN");

console.log(`INF-005.2 Media Intelligence tables: ${passed} cases passed`);
