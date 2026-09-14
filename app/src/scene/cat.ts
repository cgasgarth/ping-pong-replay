import {
  CatmullRomCurve3,
  ConeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import type { Joint, PlayerPose } from "../api";
export function catFace(head: Joint): Group {
  const group = new Group();
  group.position.set(head.x, head.y, head.z);
  group.rotation.y = Math.atan2(-head.x, -head.z);
  function oval(
    position: readonly [number, number, number],
    scale: readonly [number, number, number],
    color: string,
  ): void {
    const mesh = new Mesh(
      new SphereGeometry(1, 14, 10),
      new MeshStandardMaterial({ color, roughness: 0.94 }),
    );
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    group.add(mesh);
  }
  for (let index = 0; index < 12; index += 1) {
    const angle = (index * Math.PI * 2) / 12;
    const mesh = new Mesh(
      new SphereGeometry(1, 10, 8),
      new MeshStandardMaterial({ color: index % 2 === 0 ? "#85847e" : "#777976", roughness: 1 }),
    );
    mesh.position.set(Math.sin(angle) * 0.13, Math.cos(angle) * 0.13 - 0.025, 0);
    mesh.scale.set(0.045, 0.065, 0.065);
    mesh.rotation.z = -angle;
    group.add(mesh);
  }
  for (const side of [-1, 1]) {
    const ear = new Mesh(
      new ConeGeometry(0.065, 0.16, 3),
      new MeshStandardMaterial({ color: "#747573", roughness: 1 }),
    );
    ear.position.set(side * 0.102, 0.15, 0);
    ear.rotation.z = -side * 0.15;
    group.add(ear);
    const inner = new Mesh(
      new ConeGeometry(0.035, 0.095, 3),
      new MeshStandardMaterial({ color: "#a99d99", roughness: 1 }),
    );
    inner.position.set(side * 0.105, 0.152, 0.037);
    group.add(inner);
    oval([side * 0.055, 0.019, 0.13], [0.038, 0.023, 0.016], "#c4d282");
    oval([side * 0.055, 0.02, 0.147], [0.009, 0.02, 0.007], "#343938");
    oval([side * 0.047, 0.029, 0.153], [0.005, 0.006, 0.004], "#fbf7da");
    oval([side * 0.042, -0.047, 0.123], [0.047, 0.035, 0.034], "#a6a69e");
  }
  oval([0, -0.032, 0.162], [0.017, 0.011, 0.009], "#3f4442");
  for (const side of [-1, 1])
    for (const slope of [-1, 0, 1]) {
      const start = new Vector3(side * 0.055, -0.049, 0.145);
 const
        end = new Vector3(side * 0.2, -0.055 + slope * 0.03, 0.12);
      const tube = new TubeGeometry(new CatmullRomCurve3([start, end]), 3, 0.0018, 4, false);
      group.add(new Mesh(tube, new MeshStandardMaterial({ color: "#d1d0c4", roughness: 0.8 })));
    }
  return group;
}
export function catTail(pose:PlayerPose):Group {
  const group=new Group();const left=pose.joints[11];const right=pose.joints[12];if(left===undefined||right===undefined)return group;
  group.position.set((left.x+right.x)/2,(left.y+right.y)/2,(left.z+right.z)/2);group.rotation.y=Math.atan2(group.position.x,group.position.z);
  const points=[new Vector3(0,0,0.1),new Vector3(0,-0.12,0.28),new Vector3(0,-0.22,0.55),new Vector3(0,0.06,0.72)];
  group.add(new Mesh(new TubeGeometry(new CatmullRomCurve3(points),16,0.055,10,false),new MeshStandardMaterial({color:'#85847e',roughness:1})));return group;
}
