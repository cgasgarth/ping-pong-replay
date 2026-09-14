import type { Theme } from "../scene/themes";
import {
  BoxGeometry,
  Texture,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  GridHelper,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
} from "three";
export function court(theme: Theme): Group {
  const group = new Group();
  function box(
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    color: string,
  ) {
    const mesh = new Mesh(
      new BoxGeometry(width, height, depth),
      new MeshStandardMaterial({ color, roughness: 0.7 }),
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  box(0, 0.73, 0, 2.74, 0.06, 1.525, theme.court);
  for (const z of [-0.747, 0.747]) box(0, 0.763, z, 2.72, 0.006, 0.015, theme.line);
  for (const x of [-1.355, 1.355]) box(x, 0.763, 0, 0.015, 0.006, 1.51, theme.line);
  box(0, 0.763, 0, 2.72, 0.006, 0.009, theme.line);
  for (const x of [-1, 1])
    for (const z of [-0.55, 0.55]) box(x, 0.36, z, 0.05, 0.72, 0.05, "#81948a");
  box(0, 0.84, -0.85, 0.02, 0.19, 0.02, "#c3d2c7");
  box(0, 0.84, 0.85, 0.02, 0.19, 0.02, "#c3d2c7");
  box(0, 0.918, 0, 0.012, 0.012, 1.72, "#dce7d7");
  const net = new Mesh(
    new PlaneGeometry(1.7, 0.15, 45, 5),
    new MeshStandardMaterial({
      color: "#bdd0c2",
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    }),
  );
  net.rotation.y = Math.PI / 2;
  net.position.y = 0.84;
  group.add(net);
  const grid = new GridHelper(18, 36, new Color("#365349"), new Color("#213f34"));
  if (theme.name === "Rally Lab" || theme.name === "Neon Nights") group.add(grid);
  return group;
}
export function segment(
  points: readonly (readonly [number, number, number])[],
  color: string,
): Line {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(points.flat(), 3));
  return new Line(geometry, new LineBasicMaterial({ color, transparent: true, opacity: 0.8 }));
}
export function dispose(group: Group): void {
  group.traverse((object) => {
    if (object instanceof Mesh || object instanceof Line) {
      const drawable: Mesh | Line = object;
      drawable.geometry.dispose();
      const materials = Array.isArray(drawable.material) ? drawable.material : [drawable.material];
      for (const material of materials) {
        if ("map" in material && material.map instanceof Texture) material.map.dispose();
        material.dispose();
      }
    }
  });
  group.clear();
}
