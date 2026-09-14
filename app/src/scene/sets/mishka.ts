import {
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  TextureLoader,
  SRGBColorSpace,
} from "three";
import { box, cylinder, oval, plant, sign } from "./props";
export function mishka(group: Group): void {
  for (let index = 0; index < 32; index += 1)
    box(
      group,
      [(index - 15.5) * 0.38, -0.015, 0],
      [0.375, 0.025, 12],
      index % 3 === 0 ? "#d5c7b2" : "#dccaaf",
    );
  box(group, [0, 1.9, -5.7], [13, 3.8, 0.12], "#e1ddcf");
  box(group, [0, 0.12, -5.6], [13, 0.24, 0.06], "#efe9da");
  for (const x of [-4, 4]) {
    box(group, [x, 2, -5.6], [2.2, 2.6, 0.06], "#afc4b7");
    for (const offset of [-1.1, 0, 1.1])
      box(group, [x + offset, 2, -5.54], [0.06, 2.67, 0.06], "#f0ebdd");
    for (const y of [0.7, 2, 3.3]) box(group, [x, y, -5.52], [2.28, 0.06, 0.06], "#f0ebdd");
  }
  box(group, [0, 0.24, -4.15], [2.8, 0.35, 0.9], "#b9af9d");
  for (const x of [-0.88, 0, 0.88]) {
    oval(group, [x, 0.49, -4.05], [0.5, 0.19, 0.43], "#e9e3d5");
    oval(group, [x, 0.9, -4.43], [0.5, 0.45, 0.15], "#e9e3d5");
  }
  for (const x of [-1.43, 1.43]) oval(group, [x, 0.67, -4.15], [0.18, 0.35, 0.55], "#e1d9c9");
  plant(group, 4.8, -4.2);
  plant(group, -4.8, -4.2);
  box(group, [0, 2.35, -5.59], [2.2, 1.48, 0.07], "#a89070");
  const texture = new TextureLoader().load("/mishka.png");
  texture.colorSpace = SRGBColorSpace;
  const picture = new Mesh(new PlaneGeometry(2.05, 1.36), new MeshBasicMaterial({ map: texture }));
  picture.position.set(0, 2.35, -5.54);
  group.add(picture);
  sign(group, "MISHKA'S CLUB", [0, 1.34, -5.53], 1.85, "#657449", "#e1ddcf");
  cylinder(group, [3.6, 0.55, -2.9], 0.16, 1.1, "#bea887");
  box(group, [3.6, 0.025, -2.9], [0.65, 0.05, 0.65], "#938b7a");
  for (let index = 0; index < 15; index += 1)
    cylinder(group, [3.6, 0.12 + index * 0.06, -2.9], 0.163, 0.012, "#d1bca0");
  for (const x of [-3, 3]) {
    oval(group, [x, 0.055, 2.8], [0.08, 0.055, 0.08], x < 0 ? "#b7c878" : "#bf9e81");
  }
}
