import { expect, test } from "bun:test";
import { addMarker } from "../../app/src/replay/review/markers";
import { playerMetrics } from "../../app/src/analytics/metrics";

test("inserting a serve splits the rally without duplicate or overlapping intervals", () => {
  const events = [
    { start: 0, end: 10, confidence: 1, server: null, winner: 0, source: "reviewed" as const },
  ];
  const split = addMarker(events, 4, 10);
  expect(split.map((event) => [event.start, event.end])).toEqual([
    [0, 4],
    [4, 10],
  ]);
  expect(split.every((event) => event.winner === null)).toBe(true);
  expect(addMarker(split, 4, 10)).toHaveLength(2);
  expect(addMarker(split, 10, 10)).toHaveLength(2);
});

test("low-confidence wrists cannot produce hand speed", () => {
  const frames = Array.from({ length: 15 }, (_, index) => ({
    time: index / 30,
    ball: null,
    players: [
      {
        player: 0,
        state: "partial" as const,
        elbow: null,
        knee: null,
        stance: null,
        joints: Array.from({ length: 17 }, () => ({
          x: index * 0.1,
          y: 1,
          z: 0,
          u: 0.5,
          v: 0.5,
          confidence: 0.1,
        })),
      },
    ],
  }));
  expect(playerMetrics(frames, 0).wristSpeed).toBeNull();
  expect(playerMetrics(frames, 0).lean).toBeNull();
});

test("ball speed needs enough supported 3D motion", async () => {
  const { ballSpeed } = await import("../../app/src/analytics/metrics");
  const replay = {
    id: "test",
    title: "Test",
    players: ["A", "B"] as const,
    created: "2026-09-14",
    duration: 2,
    fps: 60,
    fps_override: null,
    width: 1920,
    height: 1080,
    status: "complete" as const,
    progress: 1,
    error: null,
    corners: [],
    analysis: {
      ball_coverage: 1,
      pose_coverage: 0,
      device: "test",
      elapsed: 1,
      notes: [],
      rallies: [],
      stats: [],
      frames: Array.from({ length: 120 }, (_, index) => ({
        time: index / 60,
        players: [],
        ball: {
          x: index / 6,
          y: 1,
          z: 0,
          u: 0.5,
          v: 0.5,
          confidence: 1,
          mode: "learned-3d" as const,
        },
      })),
    },
  };
  expect(ballSpeed(replay)).toBeCloseTo(36);
  const sparse = {
    ...replay,
    analysis: {
      ...replay.analysis,
      frames: replay.analysis.frames.map((frame, index) => ({
        ...frame,
        ball: {
          ...frame.ball,
          mode: index < 20 ? ("learned-3d" as const) : ("table-plane" as const),
        },
      })),
    },
  };
  expect(ballSpeed(sparse)).toBeNull();
});

test("table corrections anticipate contact without a sudden body jump", async () => {
  const { buildPlacementTrack, plannedPlacement } =
    await import("../../app/src/scene/motion/placement-track");
  const { tableIntersections } = await import("../../app/src/scene/motion/placement");
  const frames = [-2, -1.1, -2].map((x, index) => ({
    time: index / 10,
    ball: null,
    players: [
      {
        player: 0,
        state: "observed" as const,
        elbow: null,
        knee: null,
        stance: null,
        joints: Array.from({ length: 17 }, (_, joint) => ({
          x,
          y: joint >= 15 ? 0 : 0.75,
          z: 0,
          u: 0.5,
          v: 0.5,
          confidence: 1,
        })),
      },
    ],
  }));
  const track = buildPlacementTrack(frames);
  const offsets = frames.map((frame) => {
    const pose = frame.players[0];
    if (pose === undefined) throw new Error("Missing fixture pose");
    const offset = plannedPlacement(track, pose, frame.time);
    expect(tableIntersections(pose, offset)).toBe(0);
    return offset.x;
  });
  expect(Math.abs((offsets[1] ?? 0) - (offsets[0] ?? 0))).toBeLessThanOrEqual(0.126);
  expect(Math.abs((offsets[2] ?? 0) - (offsets[1] ?? 0))).toBeLessThanOrEqual(0.126);
});
