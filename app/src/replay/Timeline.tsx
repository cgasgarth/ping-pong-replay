import { Pause, Play, RotateCcw, SkipBack, SkipForward, StepBack, StepForward } from "lucide-react";
import { clock } from "../api";
import type { Rally } from "../api";

interface Props {
  readonly time: number;
  readonly duration: number;
  readonly playing: boolean;
  readonly speed: number;
  readonly rallies: readonly Rally[];
  readonly fps: number;
  readonly onSeek: (time: number) => void;
  readonly onPlay: () => void;
  readonly onSpeed: (speed: number) => void;
}
export function Timeline({
  time,
  duration,
  playing,
  speed,
  rallies,
  fps,
  onSeek,
  onPlay,
  onSpeed,
}: Props) {
  function previous() {
    const rally = rallies.findLast((event) => event.start < time - 0.2);
    onSeek(rally?.start ?? 0);
  }
  function next() {
    const rally = rallies.find((event) => event.start > time + 0.2);
    onSeek(rally?.start ?? duration);
  }
  return (
    <section className="timeline">
      <div className="timeline-label">
        <span>SESSION TIMELINE</span>
        <span>
          <i /> Serve markers <small>{rallies.length}</small>
        </span>
      </div>
      <div className="scrubber">
        <div className="rally-segments">
          {rallies.map((rally) => (
            <span
              key={rally.start}
              style={{
                left: `${(rally.start / duration) * 100}%`,
                width: `${((rally.end - rally.start) / duration) * 100}%`,
              }}
            />
          ))}
        </div>
        <input
          type="range"
          aria-label="Replay timeline"
          min={0}
          max={duration || 1}
          step={0.001}
          value={time}
          onChange={(event) => {
            onSeek(Number(event.currentTarget.value));
          }}
        />
        <div className="serve-markers">
          {rallies.map((rally, index) => (
            <button
              key={rally.start}
              type="button"
              aria-label={`Jump to serve ${index + 1}`}
              title={`Serve ${index + 1} · ${clock(rally.start)}`}
              style={{ left: `${(rally.start / duration) * 100}%` }}
              onClick={() => {
                onSeek(rally.start);
              }}
            />
          ))}
        </div>
      </div>
      <div className="playback">
        <span className="time-readout">
          {clock(time)}
          <span> / {clock(duration)}</span>
        </span>
        <div className="transport">
          <button
            type="button"
            aria-label="Restart replay"
            onClick={() => {
              onSeek(0);
            }}
          >
            <RotateCcw size={16} />
          </button>
          <button type="button" aria-label="Previous serve" onClick={previous}>
            <SkipBack size={18} />
          </button>
          <button
            type="button"
            aria-label="Previous frame"
            onClick={() => {
              onSeek(Math.max(0, time - 1 / fps));
            }}
          >
            <StepBack size={16} />
          </button>
          <button
            type="button"
            className="play-button"
            aria-label={playing ? "Pause replay" : "Play replay"}
            onClick={onPlay}
          >
            {playing ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button
            type="button"
            aria-label="Next frame"
            onClick={() => {
              onSeek(Math.min(duration, time + 1 / fps));
            }}
          >
            <StepForward size={16} />
          </button>
          <button type="button" aria-label="Next serve" onClick={next}>
            <SkipForward size={18} />
          </button>
        </div>
        <label className="speed">
          Speed{" "}
          <select
            aria-label="Playback speed"
            value={speed}
            onChange={(event) => {
              onSpeed(Number(event.currentTarget.value));
            }}
          >
            {[0.25, 0.5, 0.75, 1, 1.5, 2, 4].map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
