import { Group, MeshStandardMaterial } from "three";
import { bench, box, sign } from "./props";
export function neon(group: Group): void {
  box(group, [0, 2, -5.7], [13, 4, 0.14], "#211733");
  for (let index = 0; index < 12; index += 1) {
    const light = box(
      group,
      [(index - 5.5) * 0.95, 1.7, -5.6],
      [0.025, 2.8, 0.04],
      index % 2 === 0 ? "#9d65c7" : "#65c6c8",
    );
    if (light.material instanceof MeshStandardMaterial) {
      light.material.emissive.copy(light.material.color);
      light.material.emissiveIntensity = 1.8;
    }
  }
  for (const z of [-3.4, 3.4]) {
    const line = box(group, [0, 0.005, z], [8.3, 0.02, 0.025], "#cb82d6");
    if (line.material instanceof MeshStandardMaterial) {
      line.material.emissive.set("#ac54c0");
      line.material.emissiveIntensity = 1.5;
    }
  }
  sign(group, "AFTER HOURS", [0, 2.7, -5.59], 3.2, "#e4a3e8", "#211733");
  bench(group, -3.7, -3.4, "#4b355d");
  bench(group, 3.7, -3.4, "#4b355d");
  for (const x of [-4.8, 4.8]) {
    box(group, [x, 0.65, -4.6], [0.65, 1.3, 0.65], "#372345");
    box(group, [x, 1.35, -4.64], [0.75, 0.16, 0.65], "#543464");
    box(group, [x, 1.07, -4.29], [0.49, 0.48, 0.04], "#99d2d0");
    sign(group, "PLAY", [x, 1.1, -4.26], 0.4, "#372345", "#99d2d0");
    box(group, [x, 0.76, -4.19], [0.65, 0.07, 0.23], "#684379");
  }
}
