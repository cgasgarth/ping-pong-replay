import { Material, Matrix4, Line, Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from "three";
import { catFace, catTail } from "../scene/cat";
import { face } from "../scene/faces";
import { placement } from "../scene/motion/placement";
import { themes } from "../scene/themes";
import type { ThemeId } from "../scene/themes";
import type { PlayerPose } from "../api";
const links = [
  [5, 7],
  [7, 9],
  [6, 8],
  [8, 10],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
] as const;
export interface AvatarRig {
  readonly group: Group;
  readonly update: (pose: PlayerPose) => void;
}
export function createAvatar(initial: PlayerPose, theme: ThemeId): AvatarRig {
  const group = new Group();
  const geometry = new SphereGeometry(1, 16, 12);
  const materials = new Map<string, MeshStandardMaterial>();
  const jersey = themes[theme].shirts[initial.player === 0 ? 0 : 1];
  const skin = theme === "mishka" ? "#85847e" : "#e3d5bc";
  function mesh(color: string): Mesh {
    let material = materials.get(color);
    if (material === undefined) {
      material = new MeshStandardMaterial({ color, roughness: 0.8, transparent: true });
      materials.set(color, material);
    }
    const object = new Mesh(geometry, material);
    object.castShadow = true;
    object.receiveShadow = true;
    group.add(object);
    return object;
  }
  const torso = mesh(jersey);
  const pelvis = mesh("#263b3a");
  const head = mesh(skin);
  const neck = mesh(skin);
  head.name = "head";
  neck.name = "neck";
  torso.name = "torso";
  const bones = links.map(([start, end]) => ({
    start,
    end,
    mesh: mesh(start === 11 || start === 12 ? "#263b3a" : skin),
    joint: mesh(skin),
  }));
  const shoes = [mesh("#e9eadd"), mesh("#e9eadd")];
  const faceJoint = initial.joints[0];
  const features =
    faceJoint === undefined
      ? new Group()
      : theme === "mishka"
        ? catFace(faceJoint)
        : face(faceJoint, theme === "wii", initial.player);
  group.add(features);
  const tail = theme === "mishka" ? catTail(initial) : new Group();
  group.add(tail);
  const fadingMaterials = new Set<Material>();
  group.traverse((object) => {
    if (object instanceof Mesh || object instanceof Line) {
      const renderable: Mesh | Line = object;
      const values = Array.isArray(renderable.material)
        ? renderable.material
        : [renderable.material];
      for (const material of values) {
        material.transparent = true;
        fadingMaterials.add(material);
      }
    }
  });
  const points = Array.from({ length: 17 }, () => new Vector3());
  const up = new Vector3(0, 1, 0);
  const direction = new Vector3();
  const shoulder = new Vector3();
  const hips = new Vector3();
  const bodyUp = new Vector3();
  const bodyRight = new Vector3();
  const bodyForward = new Vector3();
  const basis = new Matrix4();
  function update(pose: PlayerPose): void {
    group.visible = true;
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];
      const joint = pose.joints[index];
      if (point !== undefined && joint !== undefined) point.set(joint.x, joint.y, joint.z);
    }
    const leftShoulder = points[5];
    const rightShoulder = points[6];
    const leftHip = points[11];
    const rightHip = points[12];
    if (
      leftShoulder !== undefined &&
      rightShoulder !== undefined &&
      leftHip !== undefined &&
      rightHip !== undefined
    ) {
      shoulder.copy(leftShoulder).add(rightShoulder).multiplyScalar(0.5);
      hips.copy(leftHip).add(rightHip).multiplyScalar(0.5);
      torso.position.copy(shoulder).add(hips).multiplyScalar(0.5);
      torso.scale.set(
        Math.max(0.16, leftShoulder.distanceTo(rightShoulder) * 0.57),
        shoulder.distanceTo(hips) * 0.64,
        0.125,
      );
      bodyUp.copy(shoulder).sub(hips).normalize();
      bodyRight.copy(leftShoulder).sub(rightShoulder).normalize();
      bodyForward.crossVectors(bodyRight, bodyUp).normalize();
      if (bodyForward.lengthSq() > 0.5) {
        bodyRight.crossVectors(bodyUp, bodyForward).normalize();
        basis.makeBasis(bodyRight, bodyUp, bodyForward);
        torso.quaternion.setFromRotationMatrix(basis);
        pelvis.rotation.y = Math.atan2(bodyForward.x, bodyForward.z);
      }
      pelvis.position.copy(hips);
      pelvis.scale.set(Math.max(0.14, leftHip.distanceTo(rightHip) * 0.63), 0.14, 0.13);
    }
    for (const bone of bones) {
      const start = points[bone.start];
      const end = points[bone.end];
      if (start === undefined || end === undefined) continue;
      const upper = bone.start === 11 || bone.start === 12;
      const radius = bone.start >= 11 ? 0.07 : 0.052;
      bone.mesh.position.copy(start).add(end).multiplyScalar(0.5);
      bone.mesh.scale.set(
        upper ? 0.095 : radius,
        start.distanceTo(end) / 2 + 0.025,
        upper ? 0.085 : radius,
      );
      bone.mesh.quaternion.setFromUnitVectors(up, direction.copy(end).sub(start).normalize());
      bone.joint.position.copy(end);
      bone.joint.scale.setScalar(radius);
    }
    const center = points[0];
    if (center !== undefined) {
      const headDirection = direction.copy(center).sub(shoulder);
      if (headDirection.length() < 0.1 || headDirection.y < 0.04)
        headDirection.copy(shoulder).sub(hips).normalize().multiplyScalar(0.23);
      headDirection.clampLength(0.19, 0.28);
      head.position.copy(shoulder).add(headDirection);
      const neckEnd = head.position
        .clone()
        .addScaledVector(headDirection.clone().normalize(), -0.09);
      neck.position.copy(shoulder).add(neckEnd).multiplyScalar(0.5);
      neck.scale.set(
        theme === "mishka" ? 0.08 : 0.052,
        shoulder.distanceTo(neckEnd) / 2 + 0.035,
        theme === "mishka" ? 0.08 : 0.052,
      );
      neck.quaternion.setFromUnitVectors(up, direction.copy(neckEnd).sub(shoulder).normalize());
      const headSize: readonly [number, number, number] =
        theme === "wii"
          ? [0.145, 0.16, 0.14]
          : theme === "mishka"
            ? [0.14, 0.135, 0.13]
            : [0.105, 0.13, 0.11];
      head.scale.set(headSize[0], headSize[1], headSize[2]);
      features.position.copy(head.position);
      features.rotation.y = Math.atan2(bodyForward.x, bodyForward.z);
    }
    for (let index = 0; index < 2; index += 1) {
      const foot = points[15 + index],
        shoe = shoes[index];
      if (foot !== undefined && shoe !== undefined) {
        shoe.position.copy(foot);
        shoe.position.y += 0.02;
        shoe.scale.set(0.075, 0.05, 0.14);
        shoe.rotation.y = Math.atan2(-hips.x, -hips.z);
      }
    }
    if (theme === "mishka") {
      tail.position.copy(hips);
      tail.rotation.y = Math.atan2(hips.x, hips.z);
    }
    const offset = placement(pose);
    group.position.set(offset.x, offset.y, offset.z);
    const opacity =
      pose.state === "held"
        ? Math.max(
            0.08,
            pose.joints.reduce((sum, joint) => sum + joint.confidence, 0) / pose.joints.length,
          )
        : 1;
    for (const material of fadingMaterials) material.opacity = opacity;
  }
  update(initial);
  return { group, update };
}
