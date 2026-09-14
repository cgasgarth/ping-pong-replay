import { BoxGeometry, Group, InstancedMesh, MeshStandardMaterial, Object3D } from "three";
import { box, sign } from "./props";
export function arena(group: Group): void {
  box(group, [0, -0.015, 0], [8, 0.03, 6], "#365daa");
  const seats = new InstancedMesh(
    new BoxGeometry(0.34, 0.08, 0.35),
    new MeshStandardMaterial({ color: "#4d6391", roughness: 0.8 }),
    390,
  );
  const backs = new InstancedMesh(
    new BoxGeometry(0.34, 0.34, 0.07),
    new MeshStandardMaterial({ color: "#435989", roughness: 0.8 }),
    390,
  );
  const transform = new Object3D();
  let count = 0;
  for (let side = 0; side < 3; side += 1) {
    for (let row = 0; row < 5; row += 1) {
      const depth = 5 + row * 0.62;
      const level = 0.32 + row * 0.42;
      box(
        group,
        side === 0 ? [0, level / 2, -depth] : [side === 1 ? -depth : depth, level / 2, 0],
        side === 0 ? [13, level, 0.62] : [0.62, level, 13],
        "#263956",
      );
      for (let column = 0; column < 26; column += 1) {
        const x = (column - 12.5) * 0.48;
        transform.position.set(
          side === 0 ? x : side === 1 ? -depth : depth,
          level + 0.13,
          side === 0 ? -depth : x,
        );
        transform.rotation.y = side === 0 ? 0 : side === 1 ? Math.PI / 2 : -Math.PI / 2;
        transform.updateMatrix();
        seats.setMatrixAt(count, transform.matrix);
        transform.translateZ(-0.15);
        transform.position.y += 0.17;
        transform.updateMatrix();
        backs.setMatrixAt(count, transform.matrix);
        count += 1;
      }
    }
  }
  group.add(seats, backs);
  for (const z of [-3.6, 3.6]) {
    box(group, [0, 0.36, z], [7.8, 0.7, 0.1], "#172c54");
    box(group, [0, 0.74, z], [7.9, 0.035, 0.14], "#d8e76d");
  }
  sign(group, "NIGHT SESSION", [0, 0.4, -3.54], 2.8, "#eaf0dd", "#172c54");
  for (const x of [-4.5, 4.5]) {
    box(group, [x, 2.5, -3.7], [0.075, 5, 0.075], "#55647e");
    box(group, [x, 5, -3.7], [1.4, 0.18, 0.4], "#4d5970");
    for (const offset of [-0.45, 0, 0.45]) {
      const lamp = box(group, [x + offset, 4.92, -3.5], [0.33, 0.14, 0.04], "#f7f5de");
      const material = lamp.material;
      if (material instanceof MeshStandardMaterial) {
        material.emissive.set("#f7f5de");
        material.emissiveIntensity = 2;
      }
    }
  }
  box(group, [0, 3.4, -7.8], [4.2, 1.1, 0.16], "#0c1730");
  sign(group, "OPEN ARENA", [0, 3.42, -7.7], 3.7, "#d8e76d", "#0c1730");
  for (const x of [-3.9, 3.9]) box(group, [x, 0.015, 0], [0.025, 0.02, 6], "#90a5c9");
}
