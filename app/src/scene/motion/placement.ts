import type { PlayerPose } from "../../api";
export interface Placement {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}
const segments = [
  [5, 6, 0.2],
  [5, 11, 0.19],
  [6, 12, 0.19],
  [11, 12, 0.18],
  [5, 7, 0.065],
  [7, 9, 0.065],
  [6, 8, 0.065],
  [8, 10, 0.065],
  [11, 13, 0.1],
  [13, 15, 0.09],
  [12, 14, 0.1],
  [14, 16, 0.09],
] as const;
interface Collider {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly radius: number;
}
function colliders(pose: PlayerPose): Collider[] {
  return segments.flatMap(([first, last, radius]) => {
    const start = pose.joints[first];
    const end = pose.joints[last];
    if (start === undefined || end === undefined) return [];
    return Array.from({ length: 13 }, (_, step) => {
      const alpha = step / 12;
      return {
        x: start.x + (end.x - start.x) * alpha,
        y: start.y + (end.y - start.y) * alpha,
        z: start.z + (end.z - start.z) * alpha,
        radius,
      };
    });
  });
}
function intersects(point: Collider, offset: Placement): boolean {
  return (
    point.y + offset.y - point.radius < 0.79 &&
    point.y + offset.y + point.radius > 0 &&
    Math.abs(point.x + offset.x) < 1.37 + point.radius &&
    Math.abs(point.z + offset.z) < 0.7625 + point.radius
  );
}
export function placement(pose: PlayerPose): Placement {
  const feet = [pose.joints[15]?.y ?? 0, pose.joints[16]?.y ?? 0];
  const offset = { x: 0, y: Math.max(0, 0.055 - Math.min(...feet)), z: 0 };
  const hipX = ((pose.joints[11]?.x ?? 0) + (pose.joints[12]?.x ?? 0)) / 2;
  const side = hipX < 0 ? -1 : 1;
  const points = colliders(pose);
  for (let pass = 0; pass < 4; pass += 1) {
    let shift = 0;
    for (const point of points) {
      if (intersects(point, offset)) {
        const amount = 1.37 + point.radius + 0.015 - side * (point.x + offset.x);
        shift = Math.max(shift, amount);
      }
    }
    if (shift === 0) break;
    offset.x += side * shift;
  }
  return offset;
}
export function tableIntersections(pose: PlayerPose, offset: Placement): number {
  return colliders(pose).filter((point) => intersects(point, offset)).length;
}
