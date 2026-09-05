import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here=path.dirname(fileURLToPath(import.meta.url));
export const WORKFLOW_PATH=path.join(here,"INT-TST-013-dolly-transcriptapi-controlled-test-dev.workflow.json");
export const WORKFLOW_NAME="INT-TST-013 — Dolly TranscriptAPI Controlled Test — DEV";
export const PROJECT_ID="o8RQQQgne2c6jXr5";
export const CREDENTIAL_NAME="INT | TranscriptAPI | Development | Media Intelligence";
export const VIDEO_ID="PIa6Vot1XcM";
const FORBIDDEN_TYPES=new Set(["n8n-nodes-base.webhook","n8n-nodes-base.scheduleTrigger","n8n-nodes-base.wait","n8n-nodes-base.executeWorkflowTrigger"]);
const REQUIRED_SEQUENCE=["workflow_runs start","workflow_runs START durable insert","Validate fixed test authorization","Validate fixed Dolly video ID","Derive media:v2 cache key","Exact media cache lookup","Cache lookup gate","Cache hit decision","Exact provider_usage lookup","Prior usage reconciliation gate","Single-operator/manual-test guard","One-attempt budget gate","Controlled-test authorization gate","TranscriptAPI single request (approval required)","Record immutable provider_usage outcome","provider_usage immutable insert","Strict sanitized response validation","Sanitized normalization","Cache and source persistence","media_sources durable insert","workflow_runs terminal state","workflow_runs terminal durable insert","Persist and exit"];
function fail(message){throw new Error(`INT-TST-013 invalid: ${message}`);}
function normalizeCode(value){return String(value??"").replace(/\r\n/g,"\n").trim();}
export function canonicalizeControlledWorkflow(w){
  const nodes=[...(w.nodes??[])].map(n=>{const parameters={...(n.parameters??{})};if(typeof parameters.jsCode==="string")parameters.jsCode=normalizeCode(parameters.jsCode);if(n.type==="n8n-nodes-base.dataTable"&&parameters.columns&&typeof parameters.columns==="object"){parameters.columns={...parameters.columns};delete parameters.columns.schema;}const credentials=Object.fromEntries(Object.entries(n.credentials??{}).map(([key,value])=>[key,{name:value?.name??null}]));return {name:n.name,type:n.type,typeVersion:n.typeVersion,disabled:n.disabled===true,parameters,credentials};}).sort((a,b)=>a.name.localeCompare(b.name));
  const connections={};for(const source of Object.keys(w.connections??{}).sort())connections[source]=w.connections[source];
  return {workflow_name:w.name,active:w.active===true,settings:{executionOrder:w.settings?.executionOrder??null},tags:[...(w.tags??[])].map(t=>t?.name).filter(Boolean).sort(),nodes,connections,invariants:{manual_trigger_present:(w.nodes??[]).some(n=>n.type==="n8n-nodes-base.manualTrigger"),forbidden_nodes_absent:!(w.nodes??[]).some(n=>FORBIDDEN_TYPES.has(n.type)),credentials_are_logical_only:!(w.nodes??[]).some(n=>Object.values(n.credentials??{}).some(c=>typeof c?.name!=="string")),fixed_video_id:VIDEO_ID,approval_status:"controlled_test_authorized",maximum_real_transport_attempts:1,automatic_retries:0,terminal_output:{status:"persist_and_exit",external_writes:0,provider_calls:0,credits_consumed:0}}};
}
export function semanticFingerprint(w){return JSON.stringify(canonicalizeControlledWorkflow(w));}
export function compareSemanticFingerprint(reference,deployed){return {equal:semanticFingerprint(reference)===semanticFingerprint(deployed),expected:JSON.parse(semanticFingerprint(reference)),actual:JSON.parse(semanticFingerprint(deployed))};}
export function validateControlledWorkflow(w){
  if(!w||typeof w!=="object")fail("root");
  if(w.name!==WORKFLOW_NAME||w.active!==false)fail("name or inactive state");
  if(w.meta?.project_id!==PROJECT_ID||w.meta?.environment!=="development"||w.meta?.test_only!==true||w.meta?.approval_pending!==false||w.meta?.approval_status!=="controlled_test_authorized"||w.meta?.authorization_id!=="AUT-013-DOLLY-001"||w.meta?.provider_call_budget!==1||w.meta?.maximum_real_transport_attempts!==1||w.meta?.automatic_retries!==0||w.meta?.authorized_video_id!==VIDEO_ID)fail("fixed test metadata");
  if(!Array.isArray(w.tags)||!w.tags.some(t=>t?.name==="project:intrst"))fail("project tag");
  if(!Array.isArray(w.nodes)||w.nodes.length!==24)fail("node count");
  if(w.nodes[0]?.type!=="n8n-nodes-base.manualTrigger"||w.nodes.filter(n=>n.type==="n8n-nodes-base.manualTrigger").length!==1)fail("Manual Trigger inventory");
  if(w.nodes.some(n=>FORBIDDEN_TYPES.has(n.type)))fail("forbidden trigger");
  if(w.nodes.some(n=>n.type!=="n8n-nodes-base.manualTrigger"&&n.type!=="n8n-nodes-base.code"&&n.type!=="n8n-nodes-base.httpRequest"&&n.type!=="n8n-nodes-base.dataTable"&&n.type!=="n8n-nodes-base.if"))fail("unexpected node");
  if(w.nodes.some(n=>Object.prototype.hasOwnProperty.call(n,"credentials")&&n.name!=="TranscriptAPI single request (approval required)"))fail("unexpected credentials");
  const http=w.nodes.find(n=>n.type==="n8n-nodes-base.httpRequest");
  if(!http||http.name!=="TranscriptAPI single request (approval required)"||http.credentials?.httpHeaderAuth?.name!==CREDENTIAL_NAME)fail("credential binding");
  if(http.parameters.url!=="https://api.transcriptapi.com/v1/transcript"||http.parameters.options?.response?.response?.responseFormat!=="json"||http.parameters.options?.timeout!==5000)fail("fixed provider request");
  const serialized=JSON.stringify(w);
  if(/ScrapeCreators|scrapecreators|scheduleTrigger|webhook|executeWorkflowTrigger|waitNode|polling_loop|polling_enabled|setInterval|setTimeout|retryOnFail|maxTries|production_mode|live_mode/i.test(serialized))fail("forbidden mode or retry capability");
  if(!serialized.includes(`approved_video_id:'${VIDEO_ID}'`)||!serialized.includes("CONTROLLED_TEST_AUTHORIZATION_INVALID"))fail("approval gate not fixed");
  if(w.nodes.slice(1).map(n=>n.name).some((n,i)=>n!==REQUIRED_SEQUENCE[i]))fail("sequence");
  if(w.connections["One-attempt budget gate"]?.main?.[0]?.[0]?.node!=="Controlled-test authorization gate"||w.connections["Controlled-test authorization gate"]?.main?.[0]?.[0]?.node!==http.name)fail("gate ordering");
  if(w.connections["Exact media cache lookup"]?.main?.[0]?.[0]?.node!=="Cache lookup gate"||w.connections["Cache lookup gate"]?.main?.[0]?.[0]?.node!=="Cache hit decision"||w.connections["Exact provider_usage lookup"]?.main?.[0]?.[0]?.node!=="Prior usage reconciliation gate")fail("table lookup ordering");
  if(w.connections["Record immutable provider_usage outcome"]?.main?.[0]?.[0]?.node!=="provider_usage immutable insert"||w.connections["provider_usage immutable insert"]?.main?.[0]?.[0]?.node!=="Strict sanitized response validation"||w.connections["Cache and source persistence"]?.main?.[0]?.[0]?.node!=="media_sources durable insert"||w.connections["media_sources durable insert"]?.main?.[0]?.[0]?.node!=="workflow_runs terminal state"||w.connections["workflow_runs terminal state"]?.main?.[0]?.[0]?.node!=="workflow_runs terminal durable insert")fail("persistence ordering");
  const terminal=w.nodes.find(n=>n.name==="Persist and exit")?.parameters?.jsCode??"";
  if(!["status:'persist_and_exit'","external_writes:0","provider_calls:0","credits_consumed:0"].every(s=>terminal.includes(s)))fail("terminal contract");
  if(/raw_transcript|response_body|request_headers|api_key|secret|token|credential_id/i.test(serialized))fail("sensitive/raw transcript material");
  return true;
}
export function loadControlledWorkflow(){const w=JSON.parse(fs.readFileSync(WORKFLOW_PATH,"utf8"));validateControlledWorkflow(w);return w;}
if(process.argv[1]===fileURLToPath(import.meta.url)){loadControlledWorkflow();console.log("INT-TST-013 controlled workflow valid; supervised authorization fixed; one provider call maximum");}
