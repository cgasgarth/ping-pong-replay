import type { PlayerPose } from "../../api";
const arms = [
  [5, 7],
  [7, 9],
  [6, 8],
  [8, 10],
] as const;

export function contactPose(pose: PlayerPose): PlayerPose {
  const joints = pose.joints.map((joint) => ({ ...joint }));
  for (const [first, last] of arms) {
    const start = joints[first];
    const end = joints[last];
    if (start === undefined || end === undefined) continue;
    for (let step = 1; step <= 12; step += 1) {
      const alpha = step / 12;
      const x = start.x + (end.x - start.x) * alpha;
      const z = start.z + (end.z - start.z) * alpha;
      const y = start.y + (end.y - start.y) * alpha;
      if (Math.abs(x) < 1.435 && Math.abs(z) < 0.8275 && y > 0.635 && y < 0.855)
        end.y = Math.max(end.y, Math.min(0.95, (0.856 - start.y * (1 - alpha)) / alpha));
    }
  }
  return { ...pose, joints };
}
