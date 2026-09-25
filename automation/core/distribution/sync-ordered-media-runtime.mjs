import fs from "node:fs";
const file = new URL("../../n8n/workflows/INT-AUT-014-distribution-executor-dev.workflow.json", import.meta.url);
const workflow = JSON.parse(fs.readFileSync(file, "utf8"));
const render = workflow.nodes.find(n => n.name === "Render platform-native payload");
const source = fs.readFileSync(new URL("ordered-media.mjs", import.meta.url), "utf8").replace(/^export /gm, "");
const marker = "// END ORDERED MEDIA\n";
if (!render.parameters.jsCode.startsWith("// BEGIN ORDERED MEDIA\n") || !render.parameters.jsCode.includes(marker)) throw new Error("MEDIA_BOUNDARY_MISSING");
const expected = "// BEGIN ORDERED MEDIA\n" + source + "\n" + marker + render.parameters.jsCode.slice(render.parameters.jsCode.indexOf(marker) + marker.length);
if (process.argv.includes("--write")) {
  render.parameters.jsCode = expected;
  fs.writeFileSync(file, JSON.stringify(workflow, null, 2) + "\n");
} else if (render.parameters.jsCode !== expected) throw new Error("ORDERED_MEDIA_RUNTIME_SOURCE_DRIFT");
else console.log("Ordered media source parity passed");
