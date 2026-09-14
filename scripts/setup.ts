import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
const assetSchema = z.array(z.object({ path: z.string(), url: z.url(), sha256: z.string().length(64), member: z.string().optional() }));
const assets = assetSchema.parse(await Bun.file("config/models.json").json());
async function download(asset: Readonly<z.infer<typeof assetSchema>[number]>): Promise<void> {
  const file = Bun.file(asset.path);
  if (await file.exists()) {
    const hash = new Bun.CryptoHasher("sha256").update(await file.arrayBuffer()).digest("hex");
    if (hash === asset.sha256) return;
  }
  if (asset.member !== undefined) { await run(["uv", "run", "python", "backend/replay/setup/archive.py", asset.url, asset.member, asset.path, asset.sha256]); return; }
  const response = await fetch(asset.url);
  if (!response.ok) throw new Error(`Download failed: ${asset.path} (${response.status})`);
  const bytes = await response.arrayBuffer();
  const hash = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
  if (hash !== asset.sha256) throw new Error(`Checksum mismatch: ${asset.path}`);
  await mkdir(dirname(asset.path), { recursive: true });
  await Bun.write(asset.path, bytes);
  process.stdout.write(`Downloaded ${asset.path}\n`);
}
async function run(command: readonly string[]): Promise<void> {
  const child = Bun.spawn([...command], { stdout: "inherit", stderr: "inherit" });
  if (await child.exited !== 0) throw new Error(`Setup failed: ${command.join(" ")}`);
}
if (process.platform !== "darwin") throw new Error("RallyLab analysis requires macOS.");
await run(["uv", "sync", "--locked"]);
await Promise.all(assets.map((asset) => download(asset)));
await run(["xcrun", "swiftc", "-O", "-swift-version", "6", "-strict-concurrency=complete", "-warnings-as-errors", "native/Pose.swift", "-o", ".data/models/pose-native"]);
await run(["uv", "run", "python", "backend/replay/service/weights.py"]);
process.stdout.write("Models are ready. Start RallyLab with bun run dev.\n");
