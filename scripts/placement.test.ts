import { describe, expect, test } from "bun:test";
import type { PlayerPose } from "../app/src/api";
import { placement, tableIntersections } from "../app/src/scene/motion/placement";
const pose: PlayerPose = {
  player: 0,
  state: "observed",
  elbow: null,
  knee: null,
  stance: null,
  joints: Array.from({ length: 17 }, (_, index) => ({
    x: -1.1,
    y: index >= 15 ? 0 : 0.7,
    z: 0,
    u: 0.4,
    v: 0.6,
    confidence: 1,
  })),
};
describe("avatar placement", () => {
  test("keeps a body out of the solid table volume", () => {
    expect(tableIntersections(pose, { x: 0, y: 0, z: 0 })).toBeGreaterThan(0);
    expect(tableIntersections(pose, placement(pose))).toBe(0);
  });
  test("does not alter the observed pose", () => {
    const before = JSON.stringify(pose);
    placement(pose);
    expect(JSON.stringify(pose)).toBe(before);
  });
  test("leaves a player clear of the table in place", () => {
    const outside = { ...pose, joints: pose.joints.map((joint) => ({ ...joint, x: -2.2 })) };
    expect(placement(outside).x).toBe(0);
  });
});

test("interpolates between observed frames instead of stepping", async () => {
  const { sampleFrame } = await import("../app/src/scene/motion/sample");
  const moved = { ...pose, joints: pose.joints.map((joint) => ({ ...joint, x: joint.x + 0.1 })) };
  const sampled = sampleFrame(
    [
      { time: 0, players: [pose], ball: null },
      { time: 0.1, players: [moved], ball: null },
    ],
    0.05,
  );
  expect(sampled?.players[0]?.joints[0]?.x).toBeCloseTo(-1.05);
});

test("does not interpolate across a long tracking gap", async () => {
  const { sampleFrame } = await import("../app/src/scene/motion/sample");
  const sampled = sampleFrame(
    [
      { time: 0, players: [pose], ball: null },
      { time: 1, players: [], ball: null },
      { time: 2, players: [pose], ball: null },
    ],
    1,
  );
  expect(sampled?.players).toEqual([]);
});

test("keeps an exaggerated head estimate attached to the shoulders", async () => {
  const { createAvatar } = await import("../app/src/components/avatar");
  const estimated = {
    ...pose,
    joints: pose.joints.map((joint, index) => ({
      ...joint,
      x: -2,
      y:
        index === 0
          ? 3.5
          : index === 5 || index === 6
            ? 1.3
            : index === 11 || index === 12
              ? 0.9
              : 0.5,
    })),
  };
  const rig = createAvatar(estimated, "lab");
  expect(rig.group.getObjectByName("head")?.position.y).toBeLessThanOrEqual(1.6);
  expect(rig.group.getObjectByName("neck")).toBeDefined();
});

test("converts speed units without changing the stored metric value", async () => {
  const { speedValue } = await import("../app/src/analytics/metrics");
  expect(speedValue(36, "kmh")).toBe(36);
  expect(speedValue(36, "mph")).toBeCloseTo(22.36936, 4);
});

test("turns the torso across the shoulder axis", async () => {
  const { createAvatar } = await import("../app/src/components/avatar");
  const { Vector3 } = await import("three");
  const turned = {
    ...pose,
    joints: pose.joints.map((joint, index) => ({
      ...joint,
      x: -2,
      y: index === 5 || index === 6 ? 1.4 : 0.9,
      z: index === 5 || index === 11 ? -0.2 : 0.2,
    })),
  };
  const rig = createAvatar(turned, "lab");
  const torso = rig.group.getObjectByName("torso");
  expect(torso).toBeDefined();
  if (torso === undefined) throw new Error("Missing torso");
  const shoulderAxis = new Vector3(1, 0, 0).applyQuaternion(torso.quaternion);
  expect(shoulderAxis.z).toBeCloseTo(-1);
});
