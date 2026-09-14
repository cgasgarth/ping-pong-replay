# Copyright (c) 2026 Connor Gasgarth
"""Behavioral tests for replay persistence and analysis invalidation."""

from typing import TYPE_CHECKING

import pytest
from httpx import ASGITransport, AsyncClient
from replay.api import app
from replay.domain import store
from replay.domain.models import Analysis, Replay

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator
    from pathlib import Path


@pytest.fixture
def anyio_backend() -> str:
    """Use the asyncio backend for ASGI requests."""
    return "asyncio"


@pytest.fixture
async def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> AsyncGenerator[AsyncClient]:
    """Create an isolated local database for each test."""
    monkeypatch.setattr(store, "DATA", tmp_path)
    store.initialize()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as connection:
        yield connection


def record() -> Replay:
    """Construct a small, completed replay with persisted analysis."""
    return Replay(
        id="fixture",
        title="Practice",
        players=("Player 1", "Player 2"),
        created="2026-09-14T12:00:00Z",
        duration=10,
        fps=60,
        fps_override=None,
        width=1920,
        height=1080,
        status="complete",
        progress=1,
        error=None,
        corners=[],
    )


@pytest.mark.anyio
async def test_settings_preserve_names_but_invalidate_timing(client: AsyncClient) -> None:
    """Changing frame rate clears stale results; renaming preserves them."""
    replay = record()
    analysis = Analysis(
        frames=[],
        rallies=[],
        stats=[],
        ball_coverage=0,
        pose_coverage=0,
        device="test",
        elapsed=1,
        notes=[],
    )
    store.save(replay, analysis)
    value: dict[str, object] = {
        "title": "Evening match",
        "players": ["Alex", "Sam"],
        "fps_override": None,
        "corners": [],
    }
    renamed = await client.patch("/api/replays/fixture", json=value)
    assert renamed.status_code == 200
    assert renamed.json()["analysis"] is not None
    value["fps_override"] = 60
    changed = await client.patch("/api/replays/fixture", json=value)
    assert changed.status_code == 200
    assert changed.json()["status"] == "ready"
    loaded = await client.get("/api/replays/fixture")
    assert loaded.json()["analysis"] is None
    assert loaded.json()["players"] == ["Alex", "Sam"]


@pytest.mark.anyio
async def test_invalid_fps_and_missing_calibration_are_rejected(client: AsyncClient) -> None:
    """Invalid input must not start an analysis job."""
    store.save(record())
    invalid = await client.patch("/api/replays/fixture", json={"fps_override": 0})
    assert invalid.status_code == 422
    uncalibrated = await client.post("/api/replays/fixture/analyze")
    assert uncalibrated.status_code == 422
    assert (await client.get("/api/replays/missing")).status_code == 404


@pytest.mark.anyio
async def test_invalid_upload_is_rejected_without_library_record(client: AsyncClient) -> None:
    """A corrupt video must not create a saved replay."""
    response = await client.post(
        "/api/replays", files={"file": ("bad.mp4", b"not a video", "video/mp4")}
    )
    assert response.status_code == 422
    assert (await client.get("/api/replays")).json() == []
