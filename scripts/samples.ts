import { z } from "zod";
const schema = z.array(
  z.object({ file: z.string(), source: z.url(), start: z.number(), end: z.number() }),
);
const samples = schema.parse(await Bun.file("config/samples.json").json());
await Promise.all(
  samples.map(async (sample) => {
    const destination = `.data/samples/${sample.file}`;
    if (await Bun.file(destination).exists()) return;
    const child = Bun.spawn(
      [
        "uvx",
        "yt-dlp",
        "--js-runtimes",
        "bun",
        "--no-progress",
        "--no-warnings",
        "--download-sections",
        `*${sample.start}-${sample.end}`,
        "--force-keyframes-at-cuts",
        "-f",
        "bestvideo[height=1080][fps>=60][ext=mp4]",
        "-o",
        destination,
        sample.source,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const [code, output] = await Promise.all([child.exited, new Response(child.stderr).text()]);
    if (code !== 0)
      throw new Error(`Sample download failed: ${sample.file}\n${output.slice(-1200)}`);
    process.stdout.write(`Downloaded ${sample.file}\n`);
  }),
);
