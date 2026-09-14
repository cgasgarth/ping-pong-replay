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
