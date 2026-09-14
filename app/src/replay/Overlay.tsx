import type { Frame } from "../api";

const edges = [
  [5, 6],
  [5, 7],
  [7, 9],
  [6, 8],
  [8, 10],
  [5, 11],
  [6, 12],
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
] as const;
export function Overlay({ frame }: { readonly frame: Frame | undefined }) {
  return (
    <svg
      className="pose-overlay"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-label="AI tracking overlay"
    >
      {frame?.players.map((pose) => (
        <g key={pose.player} stroke={pose.player === 0 ? "var(--player-one)" : "var(--player-two)"}>
          {edges.map(([a, b]) => {
            const first = pose.joints[a],
              second = pose.joints[b];
            return first !== undefined &&
              second !== undefined &&
              first.confidence > 0.35 &&
              second.confidence > 0.35 ? (
              <line
                key={`${a}-${b}`}
                x1={first.u * 100}
                y1={first.v * 100}
                x2={second.u * 100}
                y2={second.v * 100}
                strokeWidth={0.3}
              />
            ) : null;
          })}
        </g>
      ))}
      {frame?.ball !== undefined && frame.ball !== null && (
        <ellipse
          cx={frame.ball.u * 100}
          cy={frame.ball.v * 100}
          rx={0.65}
          ry={1.1}
          stroke="#ffb348"
          fill="none"
          strokeWidth={0.25}
        />
      )}
    </svg>
  );
}
