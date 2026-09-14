# Copyright (c) 2026 Connor Gasgarth
"""SQLite persistence with one connection per operation."""

import sqlite3
from pathlib import Path

from replay.domain.models import Analysis, Replay

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / ".data"


def initialize() -> None:
    """Create local storage and recover interrupted analysis jobs."""
    DATA.mkdir(exist_ok=True)
    with sqlite3.connect(DATA / "replays.sqlite3") as connection:
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute(
            "CREATE TABLE IF NOT EXISTS replays "
            "(id TEXT PRIMARY KEY, record TEXT NOT NULL, analysis TEXT)",
        )
    for replay in list_replays():
        if replay.status in {"queued", "analyzing"}:
            replay.status = "failed"
            replay.error = "Analysis was interrupted. Run analysis again."
            save(replay)


def save(replay: Replay, analysis: Analysis | None = None, *, clear_analysis: bool = False) -> None:
    """Save metadata and optionally replace analysis atomically."""
    record = replay.model_dump_json(exclude={"analysis"})
    with sqlite3.connect(DATA / "replays.sqlite3", timeout=30) as connection:
        connection.execute(
            "INSERT INTO replays (id, record, analysis) VALUES (?, ?, ?) "
            "ON CONFLICT(id) DO UPDATE SET record=excluded.record, "
            "analysis=CASE WHEN ? THEN NULL ELSE COALESCE(excluded.analysis,replays.analysis) END",
            (replay.id, record, analysis.model_dump_json() if analysis else None, clear_analysis),
        )


def get(replay_id: str, *, include_analysis: bool = True) -> Replay | None:
    """Fetch one replay using a bound identifier."""
    with sqlite3.connect(DATA / "replays.sqlite3", timeout=30) as connection:
        row = connection.execute(
            "SELECT record, analysis FROM replays WHERE id = ?",
            (replay_id,),
        ).fetchone()
    if row is None:
        return None
    replay = Replay.model_validate_json(row[0])
    if include_analysis and row[1] is not None:
        replay.analysis = Analysis.model_validate_json(row[1])
    return replay


def list_replays() -> list[Replay]:
    """Read library metadata without loading frame data."""
    with sqlite3.connect(DATA / "replays.sqlite3", timeout=30) as connection:
        rows = connection.execute("SELECT record FROM replays ORDER BY rowid DESC").fetchall()
    return [Replay.model_validate_json(row[0]) for row in rows]
