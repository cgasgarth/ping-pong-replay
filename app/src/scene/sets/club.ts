import { Group } from "three";
import { bench, box, cylinder, paddle, plant, sign } from "./props";
export function club(group: Group): void {
  for (let index = 0; index < 34; index += 1)
    box(
      group,
      [(index - 16.5) * 0.38, -0.015, 0],
      [0.375, 0.025, 12],
      index % 3 === 0 ? "#c7a781" : "#bd9b73",
    );
  box(group, [0, 1.8, -5.8], [13, 3.6, 0.12], "#d8d7c6");
  box(group, [0, 0.38, -5.7], [13, 0.75, 0.08], "#ac9777");
  box(group, [0, 0.03, -5.62], [13, 0.06, 0.05], "#87765c");
  for (const x of [-4.2, -1.4, 1.4, 4.2]) {
    box(group, [x, 2.2, -5.69], [2, 1.75, 0.05], "#9fbbc0");
    for (const offset of [-1, 0, 1])
      box(group, [x + offset, 2.2, -5.6], [0.045, 1.83, 0.06], "#eee9d7");
    for (const y of [1.34, 2.2, 3.07]) box(group, [x, y, -5.6], [2.05, 0.045, 0.06], "#eee9d7");
    box(group, [x, 1.3, -5.53], [2.15, 0.07, 0.2], "#e7dfcb");
  }
  bench(group, -3.5, -3.8, "#9e805e");
  bench(group, 3.5, -3.8, "#9e805e");
  box(group, [0, 1.25, -5.65], [2, 0.75, 0.09], "#827960");
  sign(group, "PRACTICE / REPEAT", [0, 1.27, -5.59], 1.8, "#eee8d5", "#827960");
  for (const x of [-4.8, 4.8]) plant(group, x, -4.9);
  for (let index = 0; index < 4; index += 1)
    paddle(group, [-3.9 + index * 0.24, 0.73, -3.6], index % 2 === 0 ? "#914a43" : "#34443e");
  cylinder(group, [3.7, 0.62, -3.8], 0.045, 0.28, "#8eb8b3");
  box(group, [2.9, 0.52, -3.8], [0.4, 0.03, 0.42], "#e6dfce");
  const cart = new Group();
  box(cart, [0, 0.7, 0], [0.6, 0.06, 0.45], "#9b9e8c");
  for (const x of [-0.26, 0.26])
    for (const z of [-0.18, 0.18]) {
      box(cart, [x, 0.37, z], [0.03, 0.65, 0.03], "#69736a");
      cylinder(cart, [x, 0.06, z], 0.055, 0.06, "#48544a");
    }
  cart.position.set(4.4, 0, -2);
  group.add(cart);
}
