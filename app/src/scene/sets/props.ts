import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  SRGBColorSpace,
} from "three";
export type Position = readonly [number, number, number];
export function box(group: Group, position: Position, size: Position, color: string): Mesh {
  const mesh = new Mesh(
    new BoxGeometry(...size),
    new MeshStandardMaterial({ color, roughness: 0.75 }),
  );
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}
export function oval(group: Group, position: Position, size: Position, color: string): Mesh {
  const mesh = new Mesh(
    new SphereGeometry(1, 16, 12),
    new MeshStandardMaterial({ color, roughness: 0.82 }),
  );
  mesh.position.set(...position);
  mesh.scale.set(...size);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}
export function cylinder(
  group: Group,
  position: Position,
  radius: number,
  height: number,
  color: string,
): Mesh {
  const mesh = new Mesh(
    new CylinderGeometry(radius * 0.85, radius, height, 14),
    new MeshStandardMaterial({ color, roughness: 0.65 }),
  );
  mesh.position.set(...position);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}
export function sign(
  group: Group,
  text: string,
  position: Position,
  width: number,
  color: string,
  background: string,
): void {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (context === null) return;
  context.fillStyle = background;
  context.fillRect(0, 0, 1024, 256);
  context.fillStyle = color;
  context.font = "600 74px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 512, 130);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const plane = new Mesh(
    new PlaneGeometry(width, width / 4),
    new MeshBasicMaterial({ map: texture }),
  );
  plane.position.set(...position);
  group.add(plane);
}
export function bench(parent: Group, x: number, z: number, color: string): void {
  const group = new Group();
  for (const depth of [-0.17, 0, 0.17]) box(group, [0, 0.45, depth], [1.8, 0.075, 0.14], color);
  for (const side of [-0.72, 0.72]) {
    box(group, [side, 0.22, 0], [0.06, 0.44, 0.44], "#626b64");
    box(group, [side, 0.68, -0.22], [0.06, 0.55, 0.06], "#626b64");
  }
  box(group, [0, 0.76, -0.22], [1.8, 0.18, 0.07], color);
  group.position.set(x, 0, z);
  parent.add(group);
}
export function plant(parent: Group, x: number, z: number): void {
  const group = new Group();
  cylinder(group, [0, 0.24, 0], 0.23, 0.48, "#bba086");
  for (let index = 0; index < 7; index += 1) {
    const angle = index * 2.4;
    const leaf = oval(
      group,
      [Math.sin(angle) * 0.2, 0.8 + (index % 3) * 0.15, Math.cos(angle) * 0.2],
      [0.16, 0.36, 0.05],
      index % 2 === 0 ? "#76916b" : "#587e61",
    );
    leaf.rotation.z = Math.sin(angle) * 0.6;
    leaf.rotation.y = angle;
  }
  group.position.set(x, 0, z);
  parent.add(group);
}
export function paddle(parent: Group, position: Position, color: string): void {
  const group = new Group();
  oval(group, [0, 0, 0], [0.095, 0.12, 0.012], color);
  box(group, [0, -0.16, 0], [0.035, 0.13, 0.02], "#c5a078");
  group.position.set(...position);
  parent.add(group);
}
