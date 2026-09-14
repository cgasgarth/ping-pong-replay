import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
const excluded = new Set([".git", ".venv", ".data", "node_modules", "dist", "__pycache__", ".pytest_cache", ".ruff_cache"]);
const problems: string[] = [];
async function inspect(directory: string): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile());
  if (files.length > 6) problems.push(`${directory}: ${files.length} files; maximum 6`);
  await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory() && !excluded.has(entry.name)) await inspect(path);
    if (entry.isFile() && /\.(?:tsx?|py|swift|css|html|md|json|ya?ml|toml)$/u.test(entry.name)) {
      const content = await readFile(path, "utf8");
      const lines = content.trimEnd().split("\n").length;
      if (lines > 600) problems.push(`${path}: ${lines} lines; maximum 600`);
    }
  }));
}
await inspect(".");
if (problems.length > 0) throw new Error(problems.join("\n"));
process.stdout.write("Structure: passed (600 lines/file, 6 files/folder).\n");
