import { z } from "zod";
import { replaySchema } from "../../app/src/api";
const labels = z
  .object({
    width: z.number(),
    height: z.number(),
    observations: z.array(
      z.object({
        time: z.number(),
        player: z.number(),
        region: z.tuple([z.number(), z.number(), z.number(), z.number()]),
      }),
    ),
  })
  .parse(await Bun.file("config/validation/identity.json").json());
const path = Bun.argv[2];
if (path === undefined) throw new Error("Pass the exported 275–287 second source clip.");
const replay = replaySchema.parse(await Bun.file(path).json());
let passed = 0;
for (const label of labels.observations) {
  const frame = replay.analysis?.frames.find((item) => Math.abs(item.time - label.time) < 0.001);
  const pose = frame?.players.find((item) => item.player === label.player);
  if (pose === undefined) throw new Error(`Missing participant at ${label.time}s`);
  const points = [5, 6, 11, 12].map((index) => pose.joints[index]);
  const u = (points.reduce((sum, joint) => sum + (joint?.u ?? 0), 0) / 4) * labels.width;
  const v = (points.reduce((sum, joint) => sum + (joint?.v ?? 0), 0) / 4) * labels.height;
  const [left, top, right, bottom] = label.region;
  if (u < left || u > right || v < top || v > bottom)
    throw new Error(
      `Player ${label.player + 1}, ${label.time}s: torso outside manually labeled region`,
    );
  passed += 1;
}
process.stdout.write(
  `Participant identity: ${passed}/${labels.observations.length} manual regions passed.\n`,
);
