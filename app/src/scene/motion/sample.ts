import type { Frame, Joint, PlayerPose } from "../../api";
function mix(first: number, second: number, alpha: number): number {
  return first + (second - first) * alpha;
}
function jointAt(first: Joint, second: Joint, alpha: number): Joint {
  return {
    ...first,
    x: mix(first.x, second.x, alpha),
    y: mix(first.y, second.y, alpha),
    z: mix(first.z, second.z, alpha),
    u: mix(first.u, second.u, alpha),
    v: mix(first.v, second.v, alpha),
    confidence: mix(first.confidence, second.confidence, alpha),
  };
}
function poseAt(first: PlayerPose, second: PlayerPose, alpha: number): PlayerPose {
  return {
    ...first,
    joints: first.joints.map((joint, index) => {
      const next = second.joints[index];
      return next === undefined ? joint : jointAt(joint, next, alpha);
    }),
  };
}
export function sampleFrame(frames: readonly Frame[], time: number): Frame | undefined {
  let low = 0;
  let high = frames.length - 1;
  let index = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = frames[middle];
    if (candidate !== undefined && candidate.time <= time) {
      index = middle;
      low = middle + 1;
    } else high = middle - 1;
  }
  const current = frames[index];
  if (current === undefined) return undefined;
  let previous: Frame | undefined;
  let next: Frame | undefined;
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    const item = frames[cursor];
    if (item === undefined || time - item.time > 0.15) break;
    if (item.players.length > 0) {
      previous = item;
      break;
    }
  }
  for (let cursor = index + 1; cursor < frames.length; cursor += 1) {
    const item = frames[cursor];
    if (item === undefined || item.time - time > 0.15) break;
    if (item.players.length > 0) {
      next = item;
      break;
    }
  }
  const players =
    previous?.players.map((pose) => {
      const following = next?.players.find((item) => item.player === pose.player);
      if (following === undefined || previous === undefined || next === undefined) return pose;
      const alpha = Math.max(0, Math.min(1, (time - previous.time) / (next.time - previous.time)));
      return poseAt(pose, following, alpha);
    }) ?? [];
  return { ...current, time, players };
}

export function ballTrail(
  frames: readonly Frame[],
  time: number,
): readonly (readonly [number, number, number])[] {
  let low = 0;
  let high = frames.length - 1;
  let index = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const frame = frames[middle];
    if (frame !== undefined && frame.time <= time) {
      index = middle;
      low = middle + 1;
    } else high = middle - 1;
  }
  const points: [number, number, number][] = [];
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    const frame = frames[cursor];
    if (frame === undefined || time - frame.time > 0.45) break;
    if (frame.ball !== null) points.push([frame.ball.x, frame.ball.y, frame.ball.z]);
  }
  return points.toReversed();
}
