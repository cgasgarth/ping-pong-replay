import { Activity, ArrowUpRight, Check, Flag, Plus, Trash2 } from "lucide-react";
import { clock, json, replaySchema, request } from "../api";
import { addMarker } from "./review/markers";
import type { Rally, Replay } from "../api";

interface Props {
  readonly replay: Replay;
  readonly time: number;
  readonly onSeek: (time: number) => void;
  readonly onChange: (replay: Replay) => void;
  readonly onError: (error: string) => void;
}
export function Insights({ replay, time, onSeek, onChange, onError }: Props) {
  const data = replay.analysis;
  async function update(rallies: readonly Rally[]) {
    try {
      onChange(await request(`/replays/${replay.id}/rallies`, replaySchema, json("PUT", rallies)));
    } catch (error) {
      onError(String(error));
    }
  }
  return (
    <aside className="insights">
      <div className="insights-heading">
        <Activity size={17} />
        <h2>Session insights</h2>
        <span className="estimate-pill">ESTIMATES</span>
      </div>
      <div className="players-insights">
        {([0, 1] as const).map((index) => {
          const name = replay.players[index];
          const stats = data?.stats[index];
          return (
            <section key={index} className="player-insight">
              <h3>
                <i className={index === 0 ? "orange-dot" : "teal-dot"} />
                {name}
                <span>P{index + 1}</span>
              </h3>
              <div className="metric-pair">
                <div>
                  <strong>
                    {stats?.elbow_mean?.toFixed(0) ?? "—"}
                    <small>°</small>
                  </strong>
                  <span>Right elbow</span>
                </div>
                <div>
                  <strong>
                    {stats?.knee_mean?.toFixed(0) ?? "—"}
                    <small>°</small>
                  </strong>
                  <span>Right knee</span>
                </div>
              </div>
              <div className="small-metrics">
                <span>
                  Mean stance <b>{stats?.stance_mean?.toFixed(2) ?? "—"} m</b>
                </span>
                <span>
                  Court movement <b>{stats?.distance.toFixed(1) ?? "—"} m</b>
                </span>
              </div>
            </section>
          );
        })}
      </div>
      <div className="rallies-heading">
        <h3>
          <Flag size={15} /> Serves & points
        </h3>
        {data !== null && (
          <button
            type="button"
            aria-label="Add serve at current time"
            className="icon-button"
            disabled={time >= (replay.duration * replay.fps) / (replay.fps_override ?? replay.fps)}
            onClick={() => {
              const duration = (replay.duration * replay.fps) / (replay.fps_override ?? replay.fps);
              const events = addMarker(data.rallies, time, duration);
              void update(events);
            }}
          >
            <Plus size={16} />
          </button>
        )}
      </div>
      <div className="rally-list">
        {data?.rallies.map((rally, index) => (
          <div
            className={time >= rally.start && time <= rally.end ? "rally-row current" : "rally-row"}
            key={rally.start}
          >
            <button
              type="button"
              onClick={() => {
                onSeek(rally.start);
              }}
            >
              <span className="rally-number">{(index + 1).toString().padStart(2, "0")}</span>
              <span>
                <strong>Serve {index + 1}</strong>
                <small>
                  {clock(rally.start)} — {clock(rally.end)}
                </small>
              </span>
              <ArrowUpRight size={15} />
            </button>
            <label>
              Point to
              <select
                aria-label={`Winner of rally ${index + 1}`}
                value={rally.winner ?? ""}
                onChange={(event) => {
                  const { value } = event.currentTarget;
                  void update(
                    data.rallies.map((item, itemIndex) =>
                      itemIndex === index
                        ? {
                            ...item,
                            source: "reviewed",
                            winner: value === "" ? null : Number(value),
                          }
                        : item,
                    ),
                  );
                }}
              >
                <option value="">Uncertain</option>
                {([0, 1] as const).map((player) => (
                  <option key={player} value={player}>
                    {replay.players[player]}
                  </option>
                ))}
              </select>
              {rally.source === "reviewed" && <Check size={12} />}
            </label>
            <button
              type="button"
              className="remove-marker"
              aria-label={`Remove serve ${index + 1}`}
              onClick={() => {
                void update(data.rallies.filter((_, itemIndex) => itemIndex !== index));
              }}
            >
              <Trash2 size={12} /> Remove marker
            </button>
          </div>
        ))}
        {(data === null || data.rallies.length === 0) && (
          <p className="empty-insights">
            {data === null
              ? "Analyze this video to find serve markers and player movement."
              : "No confident rally segments found. Add a marker at the current time with +."}
          </p>
        )}
      </div>
      {data !== null && (
        <div className="quality">
          <h3>Tracking quality</h3>
          <label>
            Ball observations <b>{Math.round(data.ball_coverage * 100)}%</b>
          </label>
          <meter min={0} max={1} value={data.ball_coverage} />
          <label>
            Player observations <b>{Math.round(data.pose_coverage * 100)}%</b>
          </label>
          <meter min={0} max={1} value={data.pose_coverage} />
          <details>
            <summary>How to read these results</summary>
            {data.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
            <p>Avatar faces point toward the table. Gaze direction is not measured.</p>
            <p>
              {data.device} · {data.elapsed}s analysis
            </p>
          </details>
        </div>
      )}
    </aside>
  );
}
