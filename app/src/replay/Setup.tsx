import { useState } from "react";
import { Crosshair, Play, RotateCcw, X } from "lucide-react";
import { json, replaySchema, request } from "../api";
import type { Replay } from "../api";

interface Props {
  readonly replay: Replay;
  readonly onClose: () => void;
  readonly onChange: (replay: Replay) => void;
  readonly onError: (error: string) => void;
}
export function Setup({ replay, onClose, onChange, onError }: Props) {
  const [title, setTitle] = useState(replay.title);
    const [players, setPlayers] = useState<[string, string]>([...replay.players]);
    const [fps, setFps] = useState(replay.fps_override?.toString() ?? "");
    const [corners, setCorners] = useState<Replay["corners"]>(replay.corners);
    const [busy, setBusy] = useState(false);
  async function save(run: boolean) {
    setBusy(true);
    try {
      const changed = await request(
        `/replays/${replay.id}`,
        replaySchema,
        json("PATCH", { corners, fps_override: fps === "" ? null : Number(fps), players, title }),
      );
      onChange(
        run
          ? await request(`/replays/${replay.id}/analyze`, replaySchema, { method: "POST" })
          : changed,
      );
      onClose();
    } catch (error) {
      onError(String(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <dialog open
        className="setup-panel"
        aria-modal="true"
        aria-labelledby="setup-heading"
      >
        <div className="section-heading">
          <div>
            <span className="eyebrow">MAKE IT YOUR SESSION</span>
            <h2 id="setup-heading">Set up your replay</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Close setup" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <label className="field">
          Session name
          <input
            value={title}
            maxLength={100}
            required
            onChange={(event) => {
              setTitle(event.currentTarget.value);
            }}
          />
        </label>
        <div className="field-row">
          {([0, 1] as const).map((index) => (
            <label className="field" key={index}>
              Player {index + 1}
              <input
                aria-label={`Player ${index + 1} name`}
                value={players[index]}
                maxLength={50}
                onChange={(event) => {
                  const next: [string, string] = [...players];
                  if (index === 0) {
                    next[0] = event.currentTarget.value;
                  } else {
                    next[1] = event.currentTarget.value;
                  }
                  setPlayers(next);
                }}
              />
            </label>
          ))}
        </div>
        <div className="field-row">
          <label className="field">
            Frame rate override
            <input
              type="number"
              min={60}
              max={240}
              step="any"
              placeholder={`Auto · ${replay.fps.toFixed(2)} fps`}
              value={fps}
              onChange={(event) => {
                setFps(event.currentTarget.value);
              }}
            />
          </label>
          <p className="field-hint">
            Detected {replay.fps.toFixed(2)} fps at {replay.width} × {replay.height}. Leave blank to
            use video timestamps.
          </p>
        </div>
        <div className="calibration-heading">
          <span>
            <Crosshair size={16} /> Table calibration
          </span>
          <button
            className="text-button"
            type="button"
            onClick={() => {
              setCorners([]);
            }}
          >
            <RotateCcw size={14} /> Reset corners
          </button>
        </div>
        <p className="muted">
          Select top-left, top-right, bottom-right, then bottom-left. The first edge must be a long
          table edge. {corners.length}/4 selected.
        </p>
        <button
          type="button"
          className="calibration-image"
          aria-label="Select table corners on video"
          onClick={(event) => {
            if (corners.length === 4) {
              return;
            }
            const rect = event.currentTarget.getBoundingClientRect();
            setCorners([
              ...corners,
              {
                x: (event.clientX - rect.left) / rect.width,
                y: (event.clientY - rect.top) / rect.height,
              },
            ]);
          }}
        >
          <img
            src={`/api/replays/${replay.id}/thumbnail`}
            alt="First video frame for table calibration"
          />
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polygon
              points={corners.map((point) => `${point.x * 100},${point.y * 100}`).join(" ")}
            />
          </svg>
          {corners.map((point, index) => (
            <span
              className="corner"
              key={`${point.x}-${point.y}`}
              style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
            >
              {index + 1}
            </span>
          ))}
        </button>
        <div className="setup-actions">
          <button
            className="button secondary"
            type="button"
            disabled={busy || title.trim() === ""}
            onClick={() => {
              void save(false);
            }}
          >
            Save settings
          </button>
          <button
            className="button primary"
            type="button"
            disabled={busy || corners.length !== 4 || title.trim() === ""}
            onClick={() => {
              void save(true);
            }}
          >
            <Play size={16} />
            {busy ? "Saving…" : "Analyze on this Mac"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
