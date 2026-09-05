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
const REQUIRED_SEQUENCE=["workflow_runs start","Validate fixed test authorization","Validate fixed Dolly video ID","Derive media:v2 cache key","Exact cache lookup","Exact prior-usage lookup","Single-operator/manual-test guard","One-attempt budget gate","Approval gate (pending)","TranscriptAPI single request (approval required)","Record immutable provider_usage outcome","Strict sanitized response validation","Sanitized normalization","Cache and source persistence","workflow_runs terminal state","Persist and exit"];
function fail(message){throw new Error(`INT-TST-013 invalid: ${message}`);}
export function validateControlledWorkflow(w){
  if(!w||typeof w!=="object")fail("root");
  if(w.name!==WORKFLOW_NAME||w.active!==false)fail("name or inactive state");
  if(w.meta?.project_id!==PROJECT_ID||w.meta?.environment!=="development"||w.meta?.test_only!==true||w.meta?.approval_pending!==true||w.meta?.provider_call_budget!==1||w.meta?.maximum_real_transport_attempts!==1||w.meta?.automatic_retries!==0||w.meta?.authorized_video_id!==VIDEO_ID)fail("fixed test metadata");
  if(!Array.isArray(w.tags)||!w.tags.some(t=>t?.name==="project:intrst"))fail("project tag");
  if(!Array.isArray(w.nodes)||w.nodes.length!==17)fail("node count");
  if(w.nodes[0]?.type!=="n8n-nodes-base.manualTrigger"||w.nodes.filter(n=>n.type==="n8n-nodes-base.manualTrigger").length!==1)fail("Manual Trigger inventory");
  if(w.nodes.some(n=>FORBIDDEN_TYPES.has(n.type)))fail("forbidden trigger");
  if(w.nodes.some(n=>n.type!=="n8n-nodes-base.manualTrigger"&&n.type!=="n8n-nodes-base.code"&&n.type!=="n8n-nodes-base.httpRequest"))fail("unexpected node");
  if(w.nodes.some(n=>Object.prototype.hasOwnProperty.call(n,"credentials")&&n.name!=="TranscriptAPI single request (approval required)"))fail("unexpected credentials");
  const http=w.nodes.find(n=>n.type==="n8n-nodes-base.httpRequest");
  if(!http||http.name!=="TranscriptAPI single request (approval required)"||http.credentials?.httpHeaderAuth?.name!==CREDENTIAL_NAME)fail("credential binding");
  if(http.parameters.url!=="https://api.transcriptapi.com/v1/transcript"||http.parameters.options?.response?.response?.responseFormat!=="json"||http.parameters.options?.timeout!==5000)fail("fixed provider request");
  const serialized=JSON.stringify(w);
  if(/ScrapeCreators|scrapecreators|scheduleTrigger|webhook|executeWorkflowTrigger|wait|polling|setInterval|setTimeout|retryOnFail|maxTries|production_mode|live_mode/i.test(serialized))fail("forbidden mode or retry capability");
  if(!serialized.includes(`approved_video_id:'${VIDEO_ID}'`)||!serialized.includes("approval_pending!==false"))fail("approval gate not fixed");
  if(w.nodes.slice(1).map(n=>n.name).some((n,i)=>n!==REQUIRED_SEQUENCE[i]))fail("sequence");
  if(w.connections["One-attempt budget gate"]?.main?.[0]?.[0]?.node!=="Approval gate (pending)"||w.connections["Approval gate (pending)"]?.main?.[0]?.[0]?.node!==http.name)fail("gate ordering");
  if(w.connections["Record immutable provider_usage outcome"]?.main?.[0]?.[0]?.node!=="Strict sanitized response validation"||w.connections["Cache and source persistence"]?.main?.[0]?.[0]?.node!=="workflow_runs terminal state")fail("persistence ordering");
  const terminal=w.nodes.find(n=>n.name==="Persist and exit")?.parameters?.jsCode??"";
  if(!["status:'persist_and_exit'","external_writes:0","provider_calls:0","credits_consumed:0"].every(s=>terminal.includes(s)))fail("terminal contract");
  if(/transcript_text|raw_transcript|response_body|request_headers|api_key|secret|token|credential_id/i.test(serialized))fail("sensitive/raw transcript material");
  return true;
}
export function loadControlledWorkflow(){const w=JSON.parse(fs.readFileSync(WORKFLOW_PATH,"utf8"));validateControlledWorkflow(w);return w;}
if(process.argv[1]===fileURLToPath(import.meta.url)){loadControlledWorkflow();console.log("INT-TST-013 controlled workflow valid; approval pending; no provider call permitted");}
