import type { ReadonlyDeep } from "type-fest";
import { z } from "zod";

const joint = z.object({
    confidence: z.number(),
    u: z.number(),
    v: z.number(),
    x: z.number(),
    y: z.number(),
    z: z.number(),
  });
const player = z.object({
    elbow: z.number().nullable(),
    joints: z.array(joint),
    knee: z.number().nullable(),
    player: z.number(),
    state: z.enum(["observed", "partial", "held"]),
    stance: z.number().nullable(),
  });
const ball = z.object({
    confidence: z.number(),
    mode: z.enum(["learned-3d", "flight-fit", "table-plane"]),
    u: z.number(),
    v: z.number(),
    x: z.number(),
    y: z.number(),
    z: z.number(),
  });
const frame = z.object({ ball: ball.nullable(), players: z.array(player), time: z.number() });
export const rallySchema = z.object({
  confidence: z.number(),
  end: z.number(),
  server: z.number().nullable(),
  source: z.enum(["estimated", "reviewed"]),
  start: z.number(),
  winner: z.number().nullable(),
});
const stats = z.object({
    distance: z.number(),
    elbow_mean: z.number().nullable(),
    knee_mean: z.number().nullable(),
    samples: z.number(),
    stance_mean: z.number().nullable(),
  });
const analysis = z.object({
    ball_coverage: z.number(),
    device: z.string(),
    elapsed: z.number(),
    frames: z.array(frame),
    notes: z.array(z.string()),
    pose_coverage: z.number(),
    rallies: z.array(rallySchema),
    stats: z.array(stats),
  });
export const replaySchema = z.object({
  analysis: analysis.nullable(),
  corners: z.array(z.object({ x: z.number(), y: z.number() })),
  created: z.string(),
  duration: z.number(),
  error: z.string().nullable(),
  fps: z.number(),
  fps_override: z.number().nullable(),
  height: z.number(),
  id: z.string(),
  players: z.tuple([z.string(), z.string()]),
  progress: z.number(),
  status: z.enum(["ready", "queued", "analyzing", "complete", "failed"]),
  title: z.string(),
  width: z.number(),
});
export type Replay = ReadonlyDeep<z.infer<typeof replaySchema>>;
export type Frame = ReadonlyDeep<z.infer<typeof frame>>;
export type PlayerPose = ReadonlyDeep<z.infer<typeof player>>;
export type Joint = ReadonlyDeep<z.infer<typeof joint>>;
export type Rally = ReadonlyDeep<z.infer<typeof rallySchema>>;
export async function request<T>(
  path: string,
  schema: Readonly<Pick<z.ZodType<T>, "parse">>,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`/api${path}`, options);
  const data: unknown = await response.json();
  if (!response.ok) {
    const error = z.object({ detail: z.string() }).safeParse(data);
    throw new Error(error.success ? error.data.detail : `Request failed (${response.status})`);
  }
  return schema.parse(data);
}
export function json(method: string, body: unknown): RequestInit {
  return { body: JSON.stringify(body), headers: { "Content-Type": "application/json" }, method };
}
export function clock(time: number): string {
  return `${Math.floor(time / 60)}:${Math.floor(time % 60)
    .toString()
    .padStart(2, "0")}`;
}
