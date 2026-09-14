import type { ThemeId } from "../scene/themes";
import { useRef, useState } from "react";
import { ArrowRight, Box, Film, Plus, Search, Upload, Zap } from "lucide-react";
import { clock } from "../api";
import type { Replay } from "../api";

interface Props {
  readonly theme: ThemeId;
  readonly replays: readonly Replay[];
  readonly busy: boolean;
  readonly onImport: (file?: File, sample?: string) => Promise<void>;
  readonly onOpen: (id: string) => Promise<void>;
}
export function Library({ replays, busy, onImport, onOpen, theme }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const filtered = replays.filter((replay) =>
    `${replay.title} ${replay.players.join(" ")}`.toLowerCase().includes(query.toLowerCase()),
  );
  const total = replays.reduce((sum, replay) => sum + replay.duration, 0);
  return (
    <main className="library">
      <section className="hero">
        <img
          className="hero-art"
          src={theme === "mishka" ? "/mishka.png" : "/court.png"}
          alt={
            theme === "mishka"
              ? "Mishka, a fluffy gray cat with green eyes, beside a table tennis court"
              : "Teal table tennis court with an orange ball"
          }
        />
        <div className="hero-copy">
          <div className="eyebrow">
            <span /> A NEW PERSPECTIVE ON YOUR GAME
          </div>
          <h1>
            Every rally.
            <br />
            Every angle.
            <br />
            <em>All yours.</em>
          </h1>
          <p>
            Turn your match video into a 3D replay.
            <br />
            See your movement. Find your next improvement.
          </p>
          <div className="hero-actions">
            <button
              className="button primary"
              type="button"
              disabled={busy}
              onClick={() => {
                input.current?.click();
              }}
            >
              <Upload size={17} />
              {busy ? "Preparing video…" : "Import a match"}
            </button>
            <button
              className="text-button"
              type="button"
              disabled={busy}
              onClick={() => {
                void onImport();
              }}
            >
              Try a sample <ArrowRight size={17} />
            </button>
          </div>
          <div className="hero-caption">
            <Zap size={13} /> Analyzed locally. Built for Apple silicon.
          </div>
        </div>
        <span className="hero-coordinate">REPLAY YOUR POTENTIAL ↗</span>
      </section>
      <input
        ref={input}
        className="visually-hidden"
        type="file"
        aria-label="Import match video"
        accept="video/*,.mov,.mp4"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file !== undefined) {
            void onImport(file);
          }
          event.currentTarget.value = "";
        }}
      />
      <section className="library-summary">
        <div>
          <span className="summary-label">YOUR PLAYBOOK</span>
          <h2>
            A little practice.
            <br />A different perspective.
          </h2>
        </div>
        <div className="summary-stat">
          <span>{replays.length.toString().padStart(2, "0")}</span>
          <small>Saved sessions</small>
        </div>
        <div className="summary-stat">
          <span>
            {Math.round(total / 60)}
            <em> min</em>
          </span>
          <small>Time on the table</small>
        </div>
        <div className="summary-stat">
          <span>
            {replays
              .filter((replay) => replay.status === "complete")
              .length.toString()
              .padStart(2, "0")}
          </span>
          <small>Analyzed replays</small>
        </div>
      </section>
      <section className="sessions">
        <div className="section-heading">
          <div>
            <h2>
              Your replay library <span>{replays.length}</span>
            </h2>
            <p>Pick up where you left off.</p>
          </div>
          <div className="library-actions">
            <label className="search">
              <Search size={16} />
              <input
                placeholder="Find a session…"
                value={query}
                onChange={(event) => {
                  setQuery(event.currentTarget.value);
                }}
              />
            </label>
            <button
              className="library-add"
              type="button"
              aria-label="Add a match"
              title="Add a match"
              disabled={busy}
              onClick={() => {
                input.current?.click();
              }}
            >
              <Plus size={21} />
            </button>
          </div>
        </div>
        <div className="session-grid">
          {filtered.map((replay) => (
            <button
              type="button"
              className="session-card"
              key={replay.id}
              onClick={() => {
                void onOpen(replay.id);
              }}
            >
              <div className="card-image">
                <img src={`/api/replays/${replay.id}/thumbnail`} alt={replay.title} />
                <span className="card-type">
                  <Box size={12} />
                  {replay.status === "complete" ? "3D REPLAY" : replay.status.toUpperCase()}
                </span>
                <span className="duration">
                  {clock((replay.duration * replay.fps) / (replay.fps_override ?? replay.fps))}
                </span>
                <span className="card-arrow">
                  <ArrowRight size={22} />
                </span>
              </div>
              <div className="card-body">
                <small>
                  {new Date(replay.created).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </small>
                <h3>{replay.title}</h3>
                <div>
                  <span>
                    {replay.players[0]} <em>vs</em> {replay.players[1]}
                  </span>
                  <span>{(replay.fps_override ?? replay.fps).toFixed(0)} fps</span>
                </div>
              </div>
            </button>
          ))}
        </div>
        {query !== "" && filtered.length === 0 && (
          <p className="muted">No sessions match your search.</p>
        )}
      </section>
      <section className="capture-tip">
        <div className="tip-icon">
          <Film size={24} />
        </div>
        <div>
          <h3>One phone. The whole game.</h3>
          <p>
            Keep the camera still, with the table and both players in view. Bright light and a
            higher frame rate help track the ball. Minimum: 1080p at 60 fps.
          </p>
        </div>
        <button
          className="text-button"
          type="button"
          disabled={busy}
          onClick={() => {
            void onImport(undefined, "rally-two");
          }}
        >
          Try a second sample <ArrowRight size={15} />
        </button>
      </section>
    </main>
  );
}
