import type { Frame, PlayerPose } from "../../api";
import { placement } from "./placement";
import { sampleFrame } from "./sample";
import type { Placement } from "./placement";
interface Sample {
  readonly time: number;
  amount: number;
  readonly side: number;
}
export type PlacementTrack = ReadonlyMap<number, readonly Readonly<Sample>[]>;
const correctionSpeed = 1.25;

export function buildPlacementTrack(frames: readonly Frame[]): PlacementTrack {
  const tracks = new Map<number, Sample[]>();
  const times = frames.flatMap((source, index) => {
    const next = frames[index + 1];
    return next === undefined ? [source.time] : [source.time, (source.time + next.time) / 2];
  });
  for (const time of times) {
    const frame = sampleFrame(frames, time);
    if (frame === undefined) continue;
    for (const pose of frame.players) {
      const offset = placement(pose);
      const side = (pose.joints[11]?.x ?? 0) < 0 ? -1 : 1;
      const track = tracks.get(pose.player) ?? [];
      track.push({ time: frame.time, amount: Math.abs(offset.x), side });
      tracks.set(pose.player, track);
    }
  }
  for (const track of tracks.values()) {
    for (const direction of [1, -1]) {
      for (let step = 1; step < track.length; step += 1) {
        const index = direction === 1 ? step : track.length - 1 - step;
        const sample = track[index];
        const neighbor = track[index - direction];
        if (sample === undefined || neighbor === undefined) continue;
        const elapsed = Math.abs(sample.time - neighbor.time);
        if (elapsed > 0.8 || sample.side !== neighbor.side) continue;
        sample.amount = Math.max(sample.amount, neighbor.amount - correctionSpeed * elapsed);
      }
    }
  }
  return tracks;
}

export function plannedPlacement(track: PlacementTrack, pose: PlayerPose, time: number): Placement {
  const required = placement(pose);
  const samples = track.get(pose.player) ?? [];
  let low = 0;
  let high = samples.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if ((samples[middle]?.time ?? Infinity) < time) low = middle + 1;
    else high = middle;
  }
  const before = samples[Math.max(0, low - 1)];
  const after = samples[low] ?? before;
  if (before === undefined || after === undefined) return required;
  const gap = after.time - before.time;
  const alpha = gap > 0 && gap < 0.8 ? Math.max(0, Math.min(1, (time - before.time) / gap)) : 0;
  const amount = before.amount + (after.amount - before.amount) * alpha;
  return { ...required, x: before.side * Math.max(Math.abs(required.x), amount) };
}
