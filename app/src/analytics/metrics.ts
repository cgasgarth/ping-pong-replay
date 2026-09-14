import type { Frame, PlayerPose, Replay } from "../api";
export interface PlayerMetrics {
  readonly elbow: readonly [number, number] | null;
  readonly knee: readonly [number, number] | null;
  readonly wristSpeed: number | null;
  readonly lean: number | null;
  readonly points: readonly { readonly x: number; readonly z: number }[];
  readonly curve: readonly { readonly time: number; readonly angle: number }[];
}
function percentile(values: readonly number[], fraction: number): number | null {
  const sorted = values.toSorted((first, second) => first - second);
  return sorted[Math.floor((sorted.length - 1) * fraction)] ?? null;
}
function range(values: readonly number[]): readonly [number, number] | null {
  const low = percentile(values, 0.1);
  const high = percentile(values, 0.9);
  return low === null || high === null ? null : [low, high];
}
function sampleMetrics(
  samples: readonly { readonly time: number; readonly pose: PlayerPose }[],
): PlayerMetrics {
  const speeds: number[] = [];
  const leans: number[] = [];
  const points: { x: number; z: number }[] = [];
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    if (sample === undefined) continue;
    const pose = sample.pose;
    const left = pose.joints[11],
      right = pose.joints[12],
      shoulderLeft = pose.joints[5],
      shoulderRight = pose.joints[6];
    if (
      left !== undefined &&
      right !== undefined &&
      shoulderLeft !== undefined &&
      shoulderRight !== undefined
    ) {
      points.push({ x: (left.x + right.x) / 2, z: (left.z + right.z) / 2 });
      const dx = (shoulderLeft.x + shoulderRight.x - left.x - right.x) / 2,
        dy = (shoulderLeft.y + shoulderRight.y - left.y - right.y) / 2,
        dz = (shoulderLeft.z + shoulderRight.z - left.z - right.z) / 2;
      leans.push((Math.atan2(Math.hypot(dx, dz), Math.abs(dy)) * 180) / Math.PI);
    }
    const previous = samples[index - 1];
    const wrist = pose.joints[10];
    const earlier = previous?.pose.joints[10];
    if (previous !== undefined && wrist !== undefined && earlier !== undefined) {
      const dt = sample.time - previous.time;
      if (dt > 0 && dt < 0.2) {
        const speed =
          Math.hypot(wrist.x - earlier.x, wrist.y - earlier.y, wrist.z - earlier.z) / dt;
        if (speed < 15) speeds.push(speed);
      }
    }
  }
  return {
    elbow: range(samples.flatMap((item) => (item.pose.elbow === null ? [] : [item.pose.elbow]))),
    knee: range(samples.flatMap((item) => (item.pose.knee === null ? [] : [item.pose.knee]))),
    wristSpeed: speeds.length >= 10 ? percentile(speeds, 0.95) : null,
    lean: percentile(leans, 0.5),
    points,
    curve: samples.flatMap((item) =>
      item.pose.elbow === null ? [] : [{ time: item.time, angle: item.pose.elbow }],
    ),
  };
}
export function playerMetrics(frames: readonly Frame[], player: number): PlayerMetrics {
  return sampleMetrics(
    frames.flatMap((frame) =>
      frame.players
        .filter((pose) => pose.player === player && pose.state !== "held")
        .map((pose) => ({ time: frame.time, pose })),
    ),
  );
}
export function ballSpeed(replay: Replay): number | null {
  const frames = replay.analysis?.frames ?? [];
  const speeds: number[] = [];
  for (let index = 1; index < frames.length; index += 1) {
    const frame = frames[index],
      previous = frames[index - 1];
    const ball = frame?.ball,
      earlier = previous?.ball;
    if (
      frame === undefined ||
      previous === undefined ||
      ball === undefined ||
      ball === null ||
      earlier === undefined ||
      earlier === null
    )
      continue;
    if (ball.mode === "table-plane" || earlier.mode !== ball.mode) continue;
    const dt = frame.time - previous.time;
    if (dt <= 0 || dt > 0.12) continue;
    const speed = Math.hypot(ball.x - earlier.x, ball.y - earlier.y, ball.z - earlier.z) / dt;
    if (speed < 30) speeds.push(speed * 3.6);
  }
  return speeds.length >= 10 ? percentile(speeds, 0.95) : null;
}

export type SpeedUnit = "kmh" | "mph";
export function speedValue(kmh: number, unit: SpeedUnit): number {
  return unit === "mph" ? kmh / 1.609344 : kmh;
}
