import {
  BufferGeometry,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from "three";
import type { Joint } from "../api";
export function face(head: Joint, playful: boolean, player: number): Group {
  const group = new Group();
  const size = playful ? 1.35 : 1;
  group.position.set(head.x,head.y,head.z);
  group.rotation.y=Math.atan2(-head.x,-head.z);
  const forward = new Vector3(0,0,1);
  const right = new Vector3(1,0,0);
  function feature(
    position: Readonly<Pick<Vector3, "x" | "y" | "z">>,
    scale: readonly [number, number, number],
    color: string,
  ) {
    const mesh = new Mesh(
      new SphereGeometry(1, 12, 10),
      new MeshStandardMaterial({ color, roughness: 0.8 }),
    );
    mesh.position.copy(position);
    mesh.scale.set(...scale);
    group.add(mesh);
  }
  const origin = new Vector3(0,0,0);
  for (const side of [-1, 1]) {
    const eye = origin
      .clone()
      .addScaledVector(forward, 0.108 * size)
      .addScaledVector(right, side * 0.038 * size);
    eye.y += 0.025 * size;
    feature(eye, [0.012 * size, 0.017 * size, 0.012 * size], "#413e3a");
  }
  feature(
    origin.clone().add(new Vector3(0, 0.092 * size, 0)),
    [0.11 * size, 0.052 * size, 0.11 * size],
    player === 0 ? "#51463c" : "#786249",
  );
  const mouth = [-1, -0.5, 0, 0.5, 1].map((offset) => {
    const point = origin
      .clone()
      .addScaledVector(forward, 0.112 * size)
      .addScaledVector(right, offset * 0.026 * size);
    point.y -= 0.037 * size - Math.abs(offset) * 0.009;
    return point;
  });
  group.add(
    new Line(
      new BufferGeometry().setFromPoints(mouth),
      new LineBasicMaterial({ color: "#9c7762" }),
    ),
  );
  return group;
}
