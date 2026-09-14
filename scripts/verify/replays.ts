import { Vector3 } from "three";
import { replaySchema } from "../../app/src/api";
import { createAvatar } from "../../app/src/components/avatar";
import { placement, tableIntersections } from "../../app/src/scene/motion/placement";
import { dispose } from "../../app/src/components/court";

const paths = Bun.argv.slice(2);
if (paths.length === 0) throw new Error("Pass one or more exported replay JSON files.");
const replays = await Promise.all(
  paths.map(async (path) => replaySchema.parse(await Bun.file(path).json())),
);
for (const replay of replays) {
  if (replay.analysis === null) throw new Error(`${replay.id}: missing analysis`);
  const rigs = new Map<number, ReturnType<typeof createAvatar>>();
  let poses = 0;
  let intersections = 0;
  let detachedHeads = 0;
  let maximumCorrection = 0;
  for (const frame of replay.analysis.frames) {
    for (const pose of frame.players) {
      poses += 1;
      const offset = placement(pose);
      maximumCorrection = Math.max(maximumCorrection, Math.hypot(offset.x, offset.z));
      intersections += tableIntersections(pose, offset);
      let rig = rigs.get(pose.player);
      if (rig === undefined) {
        rig = createAvatar(pose, "open");
        rigs.set(pose.player, rig);
      } else rig.update(pose);
      const head = rig.group.getObjectByName("head");
      const left = pose.joints[5],
        right = pose.joints[6];
      if (head === undefined || left === undefined || right === undefined)
        throw new Error("Incomplete avatar rig");
      const shoulder = new Vector3(
        (left.x + right.x) / 2,
        (left.y + right.y) / 2,
        (left.z + right.z) / 2,
      );
      if (head.position.distanceTo(shoulder) > 0.281) detachedHeads += 1;
    }
  }
  for (const rig of rigs.values()) dispose(rig.group);
  const result = {
    id: replay.id,
    poses,
    tableIntersections: intersections,
    detachedHeads,
    maximumCorrection: Number(maximumCorrection.toFixed(3)),
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (intersections > 0 || detachedHeads > 0 || maximumCorrection > 1)
    throw new Error(`${replay.title}: avatar quality gate failed`);
}
