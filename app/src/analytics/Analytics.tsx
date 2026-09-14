import { useMemo, useState } from "react";
import { Activity, ArrowUpRight, Gauge, MoveUpRight, Radar } from "lucide-react";
import type { Replay } from "../api";
import type { SpeedUnit } from "./metrics";
import { ballSpeed, playerMetrics, speedValue } from "./metrics";
export function Analytics({ replay }: { readonly replay: Replay }) {
  const [unit, setUnit] = useState<SpeedUnit>(() =>
    localStorage.getItem("rallylab-speed-unit") === "kmh" ? "kmh" : "mph",
  );
  const analysis = replay.analysis;
  const metrics = useMemo(
    () => [playerMetrics(analysis?.frames ?? [], 0), playerMetrics(analysis?.frames ?? [], 1)],
    [analysis],
  );
  const velocity = useMemo(() => ballSpeed(replay), [replay]);
  if (analysis === null) return null;
  const longest = Math.max(0, ...analysis.rallies.map((rally) => rally.end - rally.start));
  const active = analysis.rallies.reduce((sum, rally) => sum + rally.end - rally.start, 0);
  const duration = (replay.duration * replay.fps) / (replay.fps_override ?? replay.fps);
  return (
    <section className="analytics-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">FIND YOUR NEXT IMPROVEMENT</span>
          <h2>Match analysis</h2>
        </div>
        <div className="analytics-actions">
          <label className="unit-picker">
            Speed
            <select
              aria-label="Speed unit"
              value={unit}
              onChange={(event) => {
                const value = event.currentTarget.value === "mph" ? "mph" : "kmh";
                setUnit(value);
                localStorage.setItem("rallylab-speed-unit", value);
              }}
            >
              <option value="kmh">km/h</option>
              <option value="mph">mph</option>
            </select>
          </label>
          <span className="analysis-tag">
            <Activity size={13} /> Inferred from your video
          </span>
        </div>
      </div>
      <div className="session-numbers">
        <div>
          <Gauge size={19} />
          <span>Ball speed · 95th percentile</span>
          <strong>
            {velocity === null ? "—" : speedValue(velocity, unit).toFixed(0)}
            {velocity !== null && <small> {unit === "mph" ? "mph" : "km/h"}</small>}
          </strong>
          {velocity === null && <small>Not enough supported 3D motion</small>}
        </div>
        <div>
          <Radar size={19} />
          <span>Longest detected rally</span>
          <strong>
            {longest.toFixed(1)}
            <small> sec</small>
          </strong>
        </div>
        <div>
          <Activity size={19} />
          <span>Time in detected rallies</span>
          <strong>
            {Math.min(100, Math.round((active / duration) * 100))}
            <small>%</small>
          </strong>
        </div>
        <div>
          <MoveUpRight size={19} />
          <span>Frames analyzed</span>
          <strong>{analysis.frames.length.toLocaleString()}</strong>
        </div>
      </div>
      <div className="analysis-panels">
        <article className="analytics-card">
          <div className="chart-heading">
            <h3>Where you play</h3>
            <span>COURT POSITION</span>
          </div>
          <svg
            className="position-map"
            viewBox="0 0 400 260"
            aria-label="Estimated player position map"
          >
            <rect x="0" y="0" width="400" height="260" rx="10" fill="#edf2e8" />
            {[50, 100, 150, 200, 250, 300, 350].map((x) => (
              <line key={x} x1={x} x2={x} y1={0} y2={260} stroke="#dce5d4" />
            ))}
            {[40, 80, 120, 160, 200, 240].map((y) => (
              <line key={y} x1={0} x2={400} y1={y} y2={y} stroke="#dce5d4" />
            ))}
            <rect x="131.5" y="91.9" width="137" height="76.2" fill="#bfd3ba" stroke="#6f926e" />
            <line x1={200} x2={200} y1={85} y2={175} stroke="#6f926e" strokeWidth={2} />
            {metrics.flatMap((metric, index) =>
              metric.points
                .filter((_, pointIndex) => pointIndex % 3 === 0)
                .map((point) => (
                  <circle
                    key={`${index}-${point.x}-${point.z}`}
                    cx={Math.max(8, Math.min(392, 200 + point.x * 50))}
                    cy={Math.max(8, Math.min(252, 130 + point.z * 50))}
                    r={5}
                    fill={index === 0 ? "var(--player-one)" : "var(--player-two)"}
                    opacity={0.15}
                  />
                )),
            )}
          </svg>
          <div className="chart-legend">
            {replay.players.map((name, index) => (
              <span key={name}>
                <i className={index === 0 ? "orange-dot" : "teal-dot"} />
                {name}
              </span>
            ))}
          </div>
          <p className="chart-footnote">
            Body-center position in calibrated court space. Darker areas show more time spent there.
          </p>
        </article>
        <article className="analytics-card">
          <div className="chart-heading">
            <h3>Movement profile</h3>
            <span>TYPICAL RANGE</span>
          </div>
          <div className="mechanics-table">
            <div className="mechanics-row header">
              <span>Metric</span>
              <span>P1</span>
              <span>P2</span>
            </div>
            {(["elbow", "knee", "wristSpeed", "lean"] as const).map((metric) => (
              <div className="mechanics-row" key={metric}>
                <span>
                  {metric === "elbow"
                    ? "Elbow angle"
                    : metric === "knee"
                      ? "Knee angle"
                      : metric === "wristSpeed"
                        ? "Fast hand speed"
                        : "Trunk lean"}
                </span>
                {metrics.map((player, index) => {
                  const value = player[metric];
                  return (
                    <strong key={index === 0 ? "near" : "far"}>
                      {value === null
                        ? "—"
                        : typeof value === "number"
                          ? metric === "wristSpeed"
                            ? `${speedValue(value * 3.6, unit).toFixed(1)} ${unit === "mph" ? "mph" : "km/h"}`
                            : `${value.toFixed(1)}°`
                          : `${value[0].toFixed(0)}–${value[1].toFixed(0)}°`}
                    </strong>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="chart-heading angle-heading">
            <h3>Elbow motion</h3>
            <span>OVER TIME</span>
          </div>
          <svg
            className="angle-chart"
            viewBox="0 0 400 100"
            aria-label="Estimated right elbow angle over time"
          >
            {[25, 50, 75].map((y) => (
              <line key={y} x1={0} x2={400} y1={y} y2={y} stroke="#e1e7d9" />
            ))}
            {metrics.map((metric, index) => (
              <polyline
                key={index === 0 ? "near" : "far"}
                points={metric.curve
                  .filter((_, pointIndex) => pointIndex % 2 === 0)
                  .map(
                    (point) => `${(point.time / duration) * 400},${95 - (point.angle / 180) * 90}`,
                  )
                  .join(" ")}
                fill="none"
                stroke={index === 0 ? "var(--player-one)" : "var(--player-two)"}
                strokeWidth={2}
              />
            ))}
          </svg>
          <p className="chart-footnote">
            <ArrowUpRight size={12} /> Joint ranges need 10 supported poses and show their middle
            80%. Hand speed is the 95th percentile, not racket speed.
          </p>
        </article>
      </div>
    </section>
  );
}
