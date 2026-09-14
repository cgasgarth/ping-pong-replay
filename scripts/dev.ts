const api = Bun.spawn(
    [
      "uv",
      "run",
      "uvicorn", "--reload", "--reload-dir", "backend",
      "replay.api:app",
      "--app-dir",
      "backend",
      "--host",
      "127.0.0.1",
      "--port",
      "8765",
    ],
    { stderr: "inherit", stdout: "inherit" },
  ),
  ui = Bun.spawn(["bun", "--bun", "vite", "--config", "config/vite.ts"], {
    stderr: "inherit",
    stdout: "inherit",
  });
function stop(): void {
  api.kill();
  ui.kill();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
await Promise.race([api.exited, ui.exited]);
stop();
