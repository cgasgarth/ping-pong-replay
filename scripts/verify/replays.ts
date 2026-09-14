import { buildPlacementTrack, plannedPlacement } from "../../app/src/scene/motion/placement-track";
import { Vector3 } from "three";
import { replaySchema } from "../../app/src/api";
import { sampleFrame } from "../../app/src/scene/motion/sample";
import { createAvatar } from "../../app/src/components/avatar";
import { tableIntersections } from "../../app/src/scene/motion/placement";
import { dispose } from "../../app/src/components/court";

const paths = Bun.argv.slice(2);
if (paths.length === 0) throw new Error("Pass one or more exported replay JSON files.");
const replays = await Promise.all(
  paths.map(async (path) => replaySchema.parse(await Bun.file(path).json())),
);
for (const replay of replays) {
  if (replay.analysis === null) throw new Error(`${replay.id}: missing analysis`);
  const plan = buildPlacementTrack(replay.analysis.frames);
  const rigs = new Map<number, ReturnType<typeof createAvatar>>();
  const poses = replay.analysis.frames.reduce((total, frame) => total + frame.players.length, 0);
  let renderSamples = 0;
  let intersections = 0;
  let detachedHeads = 0;
  let maximumCorrection = 0;
  let maximumRenderedSpeed = 0;
  const previous = new Map<number, { time: number; x: number; z: number }>();
  const source = replay.analysis.frames;
  const renderFrames = source.flatMap((frame, index) => {
    const next = source[index + 1];
    const times = next === undefined ? [frame.time] : [frame.time, (frame.time + next.time) / 2];
    return times.flatMap((time) => {
      const sampled = sampleFrame(source, time);
      return sampled === undefined ? [] : [sampled];
    });
  });
  for (const frame of renderFrames) {
    for (const pose of frame.players) {
      renderSamples += 1;
      const offset = plannedPlacement(plan, pose, frame.time);
      const hip = pose.joints[11],
        otherHip = pose.joints[12];
      if (hip === undefined || otherHip === undefined) throw new Error("Missing hip joints");
      const x = (hip.x + otherHip.x) / 2 + offset.x;
      const z = (hip.z + otherHip.z) / 2 + offset.z;
      const old = previous.get(pose.player);
      if (old !== undefined && frame.time - old.time > 0 && frame.time - old.time < 0.1)
        maximumRenderedSpeed = Math.max(
          maximumRenderedSpeed,
          Math.hypot(x - old.x, z - old.z) / (frame.time - old.time),
        );
      previous.set(pose.player, { time: frame.time, x, z });
      maximumCorrection = Math.max(maximumCorrection, Math.hypot(offset.x, offset.z));
      intersections += tableIntersections(pose, offset);
      let rig = rigs.get(pose.player);
      if (rig === undefined) {
        rig = createAvatar(pose, "open");
        rigs.set(pose.player, rig);
      }
      rig.update(pose, offset);
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
    renderSamples,
    tableIntersections: intersections,
    detachedHeads,
    maximumCorrection: Number(maximumCorrection.toFixed(3)),
    maximumRenderedSpeed: Number(maximumRenderedSpeed.toFixed(3)),
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (intersections > 0 || detachedHeads > 0 || maximumCorrection > 1 || maximumRenderedSpeed > 4.8)
    throw new Error(`${replay.title}: avatar quality gate failed`);
}
