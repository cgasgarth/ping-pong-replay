# Copyright (c) 2026 Connor Gasgarth
"""Loopback-only HTTP service for the local replay application."""

import shutil
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.responses import FileResponse

from replay.analysis.geometry import detect_table
from replay.analysis.media import MIN_FPS, MIN_LONG_EDGE, MIN_SHORT_EDGE, prepare, validate_source
from replay.domain import store
from replay.domain.models import Rally, Replay, Settings
from replay.service.jobs import POOL, analyze
from replay.service.samples import samples

TABLE_CORNERS = 4


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None]:
    """Initialize the local database."""
    store.initialize()
    yield
    POOL.shutdown(wait=False, cancel_futures=True)


app = FastAPI(title="RallyLab", lifespan=lifespan)


def required(replay_id: str) -> Replay:
    """Require an existing record before any filesystem access."""
    replay = store.get(replay_id)
    if replay is None:
        raise HTTPException(404, "Replay not found")
    if (
        replay.fps < MIN_FPS
        or min(replay.width, replay.height) < MIN_SHORT_EDGE
        or max(replay.width, replay.height) < MIN_LONG_EDGE
    ):
        raise HTTPException(422, "This replay does not meet the minimum: 1080p at 60 fps.")
    return replay


def imported(source: Path, title: str) -> Replay:
    """Create a browser-ready replay from a local uploaded source."""
    try:
        validate_source(source)
    except (ValueError, OSError, IndexError) as error:
        raise HTTPException(422, str(error)) from error
    replay_id = str(uuid4())
    folder = store.DATA / "videos" / replay_id
    folder.mkdir(parents=True)
    shutil.move(str(source), folder / "source")
    try:
        width, height, fps, duration = prepare(
            folder / "source",
            folder / "preview.mp4",
            folder / "thumb.jpg",
        )
    except (ValueError, OSError, IndexError) as error:
        shutil.rmtree(folder)
        raise HTTPException(422, "Cannot decode this video. Use MP4 or MOV.") from error
    thumbnail = cv2.imread(str(folder / "thumb.jpg"))
    corners = detect_table(np.asarray(thumbnail, dtype=np.uint8)) if thumbnail is not None else []
    replay = Replay(
        id=replay_id,
        title=title[:100],
        players=("Player 1", "Player 2"),
        created=datetime.now(UTC).isoformat(),
        duration=duration,
        fps=fps,
        fps_override=None,
        width=width,
        height=height,
        status="ready",
        progress=0,
        error=None,
        corners=corners,
    )
    store.save(replay)
    return replay


@app.get("/api/health")
def health() -> dict[str, str]:
    """Identify this local service."""
    return {"status": "ok", "storage": "sqlite", "analysis": "macOS local"}


@app.get("/api/replays")
def library() -> list[Replay]:
    """Return saved replay cards."""
    return store.list_replays()


@app.post("/api/replays", status_code=201)
def upload(file: UploadFile) -> Replay:
    """Stream a video to disk, with a two-gigabyte input limit."""
    temporary = store.DATA / f"upload-{uuid4()}"
    size = 0
    try:
        with temporary.open("wb") as output:
            while chunk := file.file.read(1024 * 1024):
                size += len(chunk)
                if size > 2 * 1024**3:
                    raise HTTPException(413, "Maximum video size is 2 GB.")
                output.write(chunk)
        return imported(temporary, Path(file.filename or "Untitled session").stem)
    finally:
        temporary.unlink(missing_ok=True)
        file.file.close()


@app.post("/api/sample", status_code=201)
def sample(sample_id: str = "rally-one") -> Replay:
    """Import a verified 1080p, 30 fps example from the local sample cache."""
    selected = next((item for item in samples() if item.id == sample_id), None)
    if selected is None:
        raise HTTPException(404, "Unknown sample.")
    source = store.DATA / "samples" / selected.file
    if not source.exists():
        raise HTTPException(404, "Run bun run samples to download the examples.")
    temporary = store.DATA / f"sample-{uuid4()}"
    shutil.copyfile(source, temporary)
    try:
        replay = imported(temporary, selected.title)
    finally:
        temporary.unlink(missing_ok=True)
    replay.corners = selected.corners
    store.save(replay)
    return replay


@app.get("/api/replays/{replay_id}")
def detail(replay_id: str) -> Replay:
    """Load metadata and all saved 3D data."""
    return required(replay_id)


@app.patch("/api/replays/{replay_id}")
def settings(replay_id: str, value: Settings) -> Replay:
    """Save player names, calibration and frame-rate override."""
    replay = required(replay_id)
    if replay.status in {"queued", "analyzing"}:
        raise HTTPException(409, "Wait for analysis to finish.")
    changed = value.fps_override != replay.fps_override or value.corners != replay.corners
    if changed:
        replay.status, replay.progress, replay.analysis = "ready", 0, None
    for field in ("title", "players", "fps_override", "corners"):
        setattr(replay, field, getattr(value, field))
    store.save(replay, clear_analysis=changed)
    return replay


@app.post("/api/replays/{replay_id}/analyze", status_code=202)
def start(replay_id: str) -> Replay:
    """Queue one analysis job; reject duplicate submissions."""
    replay = required(replay_id)
    if replay.status in {"queued", "analyzing"}:
        raise HTTPException(409, "Analysis is already running.")
    if len(replay.corners) != TABLE_CORNERS:
        raise HTTPException(422, "Select the four table corners first.")
    replay.status, replay.progress, replay.analysis = "queued", 0, None
    store.save(replay, clear_analysis=True)
    POOL.submit(analyze, replay_id)
    return replay


@app.put("/api/replays/{replay_id}/rallies")
def update_rallies(replay_id: str, events: list[Rally]) -> Replay:
    """Persist reviewed serve markers and scores."""
    replay = required(replay_id)
    if replay.analysis is None or replay.status != "complete":
        raise HTTPException(409, "Complete analysis first.")
    replay.analysis.rallies = events
    store.save(replay, replay.analysis)
    return replay


@app.get("/api/replays/{replay_id}/video")
def video(replay_id: str) -> FileResponse:
    """Serve an MP4 with native range-request support."""
    replay = required(replay_id)
    return FileResponse(store.DATA / "videos" / replay.id / "preview.mp4", media_type="video/mp4")


@app.get("/api/replays/{replay_id}/thumbnail")
def thumbnail(replay_id: str) -> FileResponse:
    """Serve the first decoded frame."""
    replay = required(replay_id)
    return FileResponse(store.DATA / "videos" / replay.id / "thumb.jpg", media_type="image/jpeg")


@app.get("/api/replays/{replay_id}/export")
def export(replay_id: str) -> Replay:
    """Export all settings, stats and 3D tracks as JSON."""
    return required(replay_id)
