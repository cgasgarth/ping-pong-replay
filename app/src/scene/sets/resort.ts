import { ConeGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import { bench, box, cylinder, oval, sign } from "./props";
export function resort(group: Group): void {
  box(group, [0, -0.04, -14], [50, 0.06, 22], "#6bbdce");
  box(group, [0, -0.09, 0], [10, 0.12, 8], "#eddfba");
  for (let index = 0; index < 32; index += 1)
    box(
      group,
      [0, -0.015, (index - 15.5) * 0.23],
      [8.5, 0.035, 0.225],
      index % 3 === 0 ? "#d7bd8e" : "#dfc89e",
    );
  for (const x of [-4.3, 4.3]) {
    box(group, [x, 0.65, 0], [0.06, 0.07, 7.7], "#eee7d6");
    for (const z of [-3.6, -1.8, 0, 1.8, 3.6]) cylinder(group, [x, 0.35, z], 0.045, 0.7, "#eee7d6");
  }
  for (const x of [-3.8, 3.8]) {
    const palm = new Group();
    const trunk = cylinder(palm, [0, 1.15, 0], 0.12, 2.3, "#a78658");
    trunk.rotation.z = x < 0 ? -0.1 : 0.1;
    for (let index = 0; index < 7; index += 1) {
      const angle = (index * Math.PI * 2) / 7;
      const leaf = oval(
        palm,
        [Math.sin(angle) * 0.5, 2.2, Math.cos(angle) * 0.5],
        [0.19, 0.06, 0.88],
        index % 2 === 0 ? "#7da75f" : "#66954f",
      );
      leaf.rotation.y = angle;
      leaf.rotation.x = 0.25;
    }
    palm.position.set(x, 0, -3.6);
    group.add(palm);
  }
  bench(group, -2.9, 3.5, "#cadbcf");
  bench(group, 2.9, -3.2, "#cadbcf");
  cylinder(group, [-3.5, 1.15, 2.8], 0.035, 2.3, "#eee6d2");
  const canopy = new Mesh(
    new ConeGeometry(1.1, 0.5, 16),
    new MeshStandardMaterial({ color: "#e4b366", roughness: 0.85 }),
  );
  canopy.position.set(-3.5, 2.4, 2.8);
  group.add(canopy);
  cylinder(group, [3.5, 0.4, 2.9], 0.38, 0.06, "#bda27f");
  cylinder(group, [3.5, 0.19, 2.9], 0.035, 0.38, "#eee6d2");
  for (let index = 0; index < 8; index += 1) {
    const cloud = oval(
      group,
      [Math.sin(index * 2) * 15, 4.5 + (index % 3) * 0.4, Math.cos(index * 2) * 15],
      [1.8, 0.48, 0.7],
      "#f8fbf5",
    );
    cloud.castShadow = false;
  }
  box(group, [0, 0.58, -3.8], [3.2, 0.75, 0.08], "#e6ecde");
  sign(group, "RESORT CLUB", [0, 0.65, -3.75], 2.5, "#437f83", "#e6ecde");
}
