import { fileURLToPath } from "node:url";
import { loadTemplateRegistry } from "./template-fetcher.mjs";

const defaultRegistry = fileURLToPath(new URL("../../../registry/template-registry.json", import.meta.url));
const registryPath = process.argv[2] ?? defaultRegistry;

try {
  const registry = await loadTemplateRegistry(registryPath);
  console.log(`AUT-003 template registry valid: ${registry.template_records.length} record(s)`);
} catch (error) {
  console.error(`${error.code ?? "VALIDATION_ERROR"}: ${error.message}`);
  process.exitCode = 1;
}
