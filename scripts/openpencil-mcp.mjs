import { fileURLToPath } from "node:url";

// Resolve file-tool paths from this checkout, including clients launched elsewhere.
const root = fileURLToPath(new URL("..", import.meta.url));
process.chdir(root);
process.env.OPENPENCIL_MCP_ROOT = root;
await import("@open-pencil/mcp/stdio");
