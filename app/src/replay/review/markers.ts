import type { Rally } from "../../api";

export function addMarker(rallies: readonly Rally[], time: number, duration: number): Rally[] {
  if (time < 0 || time >= duration || rallies.some((rally) => Math.abs(rally.start - time) < 0.05))
    return [...rallies];
  const containing = rallies.find((rally) => rally.start < time && rally.end > time);
  const next = rallies.find((rally) => rally.start > time);
  const end = containing?.end ?? next?.start ?? duration;
  return [
    ...rallies.map((rally) =>
      rally === containing
        ? { ...rally, end: time, winner: null, source: "reviewed" as const }
        : rally,
    ),
    { start: time, end, server: null, winner: null, confidence: 1, source: "reviewed" as const },
  ].toSorted((first, second) => first.start - second.start);
}
