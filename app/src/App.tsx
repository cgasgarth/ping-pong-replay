import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { ArrowUpRight, CircleDot, FolderOpen, ShieldCheck } from "lucide-react";
import { replaySchema, request } from "./api";
import type { Replay } from "./api";
import { ThemePicker } from "./components/ThemePicker";
import { readTheme } from "./scene/themes";
import type { ThemeId } from "./scene/themes";
import { Library } from "./library/Library";
import { Workspace } from "./replay/Workspace";

export function App() {
  const [theme, setTheme] = useState<ThemeId>(readTheme);
  function changeTheme(value: ThemeId) {
    setTheme(value);
    localStorage.setItem("rallylab-theme", value);
  }
  const [replays, setReplays] = useState<Replay[]>([]);
  const [selected, setSelected] = useState<Replay | null>(null);
  const [failure, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setReplays(await request("/replays", z.array(replaySchema)));
  }, []);
  useEffect(() => {
    request("/replays", z.array(replaySchema))
      .then(setReplays)
      .catch((error: unknown) => {
        setError(String(error));
      });
  }, []);
  const pending = replays.some(
    (replay) => replay.status === "queued" || replay.status === "analyzing",
  );
  useEffect(() => {
    if (selected !== null || !pending) return () => {};
    const timer = setInterval(() => {
      void load().catch((error: unknown) => {
        setError(String(error));
      });
    }, 2000);
    return () => {
      clearInterval(timer);
    };
  }, [selected, pending, load]);
  async function open(id: string) {
    setError("");
    try {
      setSelected(await request(`/replays/${id}`, replaySchema));
      window.scrollTo(0, 0);
    } catch (error) {
      setError(String(error));
    }
  }
  async function importVideo(file?: File, sample = "rally-one") {
    setBusy(true);
    setError("");
    try {
      const data = new FormData();
      if (file !== undefined) {
        data.append("file", file);
      }
      const replay = await request(
        file === undefined ? `/sample?sample_id=${encodeURIComponent(sample)}` : "/replays",
        replaySchema,
        file === undefined ? { method: "POST" } : { body: data, method: "POST" },
      );
      setSelected(replay);
      window.scrollTo(0, 0);
      await load();
    } catch (error) {
      setError(String(error));
    } finally {
      setBusy(false);
    }
  }
  function home() {
    setSelected(null);
    load().catch((error: unknown) => {
      setError(String(error));
    });
  }
  return (
    <div className="app-shell" data-theme={theme}>
      <header className="topbar">
        <button className="brand" onClick={home} type="button">
          <span className="brand-mark">
            <CircleDot size={22} />
          </span>
          rally<span className="brand-light">lab</span>
          <span className="beta">LOCAL BETA</span>
        </button>
        <nav>
          <button
            className={selected === null ? "nav-item active" : "nav-item"}
            onClick={home}
            type="button"
          >
            <FolderOpen size={16} /> Replay library
          </button>
          <a
            className="nav-item"
            href="https://github.com/cgasgarth/ping-pong-replay"
            target="_blank"
            rel="noreferrer"
          >
            About the project <ArrowUpRight size={14} />
          </a>
        </nav>
        <ThemePicker theme={theme} onChange={changeTheme} />
        <span className="local-status">
          <i /> On your Mac
        </span>
      </header>
      {failure !== "" && (
        <div className="error-banner" role="alert">
          {failure}
          <button
            type="button"
            onClick={() => {
              setError("");
            }}
          >
            Dismiss
          </button>
        </div>
      )}
      {selected === null ? (
        <Library theme={theme} replays={replays} busy={busy} onImport={importVideo} onOpen={open} />
      ) : (
        <Workspace
          theme={theme}
          replay={selected}
          onChange={setSelected}
          onBack={home}
          onError={setError}
        />
      )}
      <footer>
        <span>
          <ShieldCheck size={14} /> Your videos stay on this Mac.
        </span>
        <span>
          Made for the next rally. <span className="footer-dot">●</span> RallyLab / 01
        </span>
      </footer>
    </div>
  );
}
