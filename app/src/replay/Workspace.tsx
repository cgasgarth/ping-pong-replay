import { ballTrail, sampleFrame } from "../scene/motion/sample";
import { Analytics } from "../analytics/Analytics";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Box,
  Check,
  Download,
  Expand,
  Film,
  RotateCcw,
  RefreshCw,
  Settings2,
  Sparkles,
} from "lucide-react";
import { replaySchema, request } from "../api";
import type { Frame, Replay } from "../api";
const Scene = lazy(async () => {
  const sceneModule = await import("./Scene");
  return { default: sceneModule.Scene };
});
import { Overlay } from "./Overlay";
import { Timeline } from "./Timeline";
import { Setup } from "./Setup";
import { Insights } from "./Insights";

import type { ThemeId } from "../scene/themes";
interface Props {
  readonly theme: ThemeId;
  readonly replay: Replay;
  readonly onChange: (replay: Replay) => void;
  readonly onBack: () => void;
  readonly onError: (error: string) => void;
}
export function Workspace({ replay, onChange, onBack, onError, theme }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const viewer = useRef<HTMLDivElement>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [mode, setMode] = useState<"split" | "3d" | "video">("3d");
  const [setup, setSetup] = useState(false);
  const [reset, setReset] = useState(0);
  const [overlay, setOverlay] = useState(true);
  const data = replay.analysis;
  const scale = (replay.fps_override ?? replay.fps) / replay.fps;
  const duration = replay.duration / scale;
  const running = replay.status === "queued" || replay.status === "analyzing";
  useEffect(() => {
    if (!running) {
      return () => {};
    }
    const timer = setInterval(() => {
      request(`/replays/${replay.id}`, replaySchema)
        .then(onChange)
        .catch((error: unknown) => {
          onError(String(error));
        });
    }, 2000);
    return () => {
      clearInterval(timer);
    };
  }, [running, replay.id, onChange, onError]);
  useEffect(() => {
    if (video.current !== null) {
      video.current.playbackRate = speed * scale;
    }
  }, [speed, scale]);
  useEffect(() => {
    if (!playing) {
      return () => {};
    }
    let frameId = 0;
    function tick() {
      if (video.current !== null) {
        setTime(video.current.currentTime / scale);
      }
      frameId = requestAnimationFrame(tick);
    }
    frameId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [playing, scale]);
  const frame = useMemo<Frame | undefined>(
    () => sampleFrame(data?.frames ?? [], time),
    [data, time],
  );
  const trail = useMemo(() => ballTrail(data?.frames ?? [], time), [data, time]);
  const scores = [0, 1].map(
    (player) =>
      data?.rallies.filter(
        (rally) =>
          rally.end - time <= 1 / (replay.fps_override ?? replay.fps) && rally.winner === player,
      ).length ?? 0,
  );
  const unresolved =
    data?.rallies.filter((rally) => rally.end <= time && rally.winner === null).length ?? 0;
  function seek(value: number) {
    const bounded = Math.max(0, Math.min(duration, value));
    setTime(bounded);
    if (video.current !== null) {
      video.current.currentTime = bounded * scale;
    }
  }
  function play() {
    if (video.current === null) {
      return;
    }
    if (playing) {
      video.current.pause();
    } else {
      if (time >= duration - 0.01) {
        seek(0);
      }
      video.current.play().catch((error: unknown) => {
        onError(String(error));
      });
    }
  }
  async function reprocess() {
    try {
      onChange(await request(`/replays/${replay.id}/analyze`, replaySchema, { method: "POST" }));
    } catch (error) {
      onError(String(error));
    }
  }
  return (
    <main className="workspace">
      <div className="workspace-heading">
        <div>
          <button className="back-link" type="button" onClick={onBack}>
            <ArrowLeft size={14} /> Replay library
          </button>
          <h1>{replay.title}</h1>
          <p>
            {new Date(replay.created).toLocaleDateString(undefined, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            <span>·</span>
            {replay.width} × {replay.height}
            <span>·</span>
            {(replay.fps_override ?? replay.fps).toFixed(2)} fps<span>·</span>
            <Check size={13} /> Saved on this Mac
          </p>
        </div>
        <div className="heading-actions">
          <a
            className="button secondary"
            download={`${replay.title}.json`}
            href={`/api/replays/${replay.id}/export`}
          >
            <Download size={15} /> Export data
          </a>
          <button
            className="button secondary"
            type="button"
            disabled={running || replay.corners.length !== 4}
            onClick={() => {
              void reprocess();
            }}
          >
            <RefreshCw size={15} />
            {running ? "Processing…" : "Reprocess video"}
          </button>
          <button
            type="button"
            className={data === null ? "button primary" : "button secondary"}
            disabled={running}
            onClick={() => {
              setSetup(true);
            }}
          >
            {data === null ? <Sparkles size={15} /> : <Settings2 size={15} />}
            {data === null ? "Set up & analyze" : "Replay settings"}
          </button>
        </div>
      </div>
      {running && (
        <output className="analysis-progress">
          <Sparkles size={18} />
          <div>
            <strong>
              {replay.status === "queued"
                ? "Waiting for the analysis worker"
                : "Finding the story in your game"}
            </strong>
            <span>Player pose, ball motion, and serve detection. You can keep watching.</span>
          </div>
          <b>{Math.round(replay.progress * 100)}%</b>
          <progress max={1} value={replay.progress} />
        </output>
      )}
      {replay.error !== null && (
        <div className="error-banner" role="alert">
          {replay.error}
        </div>
      )}
      <div className="workspace-grid">
        <div className="replay-main">
          <div className="viewer-toolbar">
            <div className="view-tabs">
              {(["split", "3d", "video"] as const).map((item) => (
                <button
                  type="button"
                  className={mode === item ? "selected" : ""}
                  key={item}
                  onClick={() => {
                    setMode(item);
                  }}
                >
                  {item === "video" ? <Film size={14} /> : <Box size={14} />}
                  {item === "split" ? "Compare" : item === "3d" ? "3D replay" : "Original video"}
                </button>
              ))}
            </div>
            <div className="viewer-tools">
              <button
                type="button"
                title="Reset camera"
                aria-label="Reset 3D camera"
                onClick={() => {
                  setReset(reset + 1);
                }}
              >
                <RotateCcw size={15} />
              </button>
              <button
                type="button"
                title="Fullscreen"
                aria-label="Fullscreen replay"
                onClick={() => {
                  viewer.current?.requestFullscreen().catch((error: unknown) => {
                    onError(String(error));
                  });
                }}
              >
                <Expand size={16} />
              </button>
            </div>
          </div>
          <div className={`viewer mode-${mode}`} ref={viewer}>
            <div className="scene-view" style={{ display: mode === "video" ? "none" : "block" }}>
              <Suspense fallback={<div className="no-analysis">Loading 3D view…</div>}>
                <Scene
                  frames={data?.frames ?? []}
                  theme={theme}
                  frame={frame}
                  trail={trail}
                  reset={reset}
                />
              </Suspense>
              <span className="view-label">
                <Box size={13} /> 3D RECONSTRUCTION
              </span>
              <span className="orbit-hint">Drag to rotate · Scroll to zoom</span>
              {data === null && (
                <div className="no-analysis">
                  <Sparkles size={22} />
                  <strong>A new angle awaits.</strong>
                  <span>Analyze your match to bring the replay to life.</span>
                </div>
              )}
            </div>
            <div className="video-view" style={{ display: mode === "3d" ? "none" : "flex" }}>
              <div
                className="video-aspect"
                style={{ aspectRatio: `${replay.width}/${replay.height}` }}
              >
                <video
                  ref={video}
                  src={`/api/replays/${replay.id}/video`}
                  muted
                  playsInline
                  preload="auto"
                  onPlay={() => {
                    setPlaying(true);
                  }}
                  onPause={() => {
                    setPlaying(false);
                  }}
                  onEnded={() => {
                    setPlaying(false);
                    setTime(duration);
                  }}
                  onSeeked={() => {
                    if (video.current !== null) {
                      setTime(video.current.currentTime / scale);
                    }
                  }}
                />
                {overlay && <Overlay frame={frame} />}
              </div>
              <span className="view-label">
                <Film size={13} /> ORIGINAL VIDEO
              </span>
              <button
                type="button"
                className={overlay ? "overlay-toggle enabled" : "overlay-toggle"}
                onClick={() => {
                  setOverlay(!overlay);
                }}
              >
                Tracking {overlay ? "on" : "off"}
              </button>
            </div>
          </div>
          <div className="scorebar">
            <div>
              <span className="orange-dot" />
              {replay.players[0]}
              <b>{scores[0]}</b>
            </div>
            <span className="score-label">
              POINTS IN CLIP
              <small>
                {unresolved > 0
                  ? `${unresolved} point${unresolved === 1 ? "" : "s"} need review`
                  : "Estimated · review uncertain points"}
              </small>
            </span>
            <div>
              <b>{scores[1]}</b>
              {replay.players[1]}
              <span className="teal-dot" />
            </div>
          </div>
          <Timeline
            time={time}
            duration={duration}
            playing={playing}
            speed={speed}
            rallies={data?.rallies ?? []}
            fps={replay.fps_override ?? replay.fps}
            onSeek={seek}
            onPlay={play}
            onSpeed={setSpeed}
          />
          <div className="replay-note">
            <span>LOOK CLOSER</span>
            <p>
              Compare your original video with the reconstructed movement. Use the serve markers to
              revisit a point, or step through the action one frame at a time.
            </p>
          </div>
        </div>
        <Insights replay={replay} time={time} onSeek={seek} onChange={onChange} onError={onError} />
      </div>
      <Analytics replay={replay} />
      {setup && (
        <Setup
          replay={replay}
          onClose={() => {
            setSetup(false);
          }}
          onChange={onChange}
          onError={onError}
        />
      )}
    </main>
  );
}
