# Copyright (c) 2026 Connor Gasgarth
"""Validated API and analysis data."""

from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Contract(BaseModel):
    """Reject unknown fields and non-finite measurements."""

    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Point(Contract):
    """Normalized image point."""

    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)


class Joint(Contract):
    """Image and estimated world coordinates, in meters."""

    x: float
    y: float
    z: float
    u: float
    v: float
    confidence: float = Field(ge=0, le=1)


class PlayerPose(Contract):
    """A tracked player at one time sample."""

    player: int = Field(ge=0, le=1)
    state: Literal["observed", "partial", "held"] = "observed"
    joints: list[Joint] = Field(min_length=17, max_length=17)
    elbow: float | None = Field(default=None, ge=0, le=180)
    knee: float | None = Field(default=None, ge=0, le=180)
    stance: float | None = Field(default=None, ge=0)


class Ball(Contract):
    """A ball observation with an estimated world position."""

    mode: Literal["learned-3d", "flight-fit", "table-plane"] = "table-plane"
    u: float
    v: float
    x: float
    y: float
    z: float
    confidence: float = Field(ge=0, le=1)


class Frame(Contract):
    """Time-aligned detections; missing observations remain missing."""

    time: float = Field(ge=0)
    players: list[PlayerPose] = Field(max_length=2)
    ball: Ball | None = None


class Rally(Contract):
    """A candidate rally and its estimated outcome."""

    start: float = Field(ge=0)
    end: float = Field(ge=0)
    server: int | None = Field(default=None, ge=0, le=1)
    winner: int | None = Field(default=None, ge=0, le=1)
    confidence: float = Field(ge=0, le=1)
    source: Literal["estimated", "reviewed"] = "estimated"

    @model_validator(mode="after")
    def ordered(self) -> Self:
        """Require a positive rally duration."""
        if self.end <= self.start:
            msg = "Rally end must be after its start."
            raise ValueError(msg)
        return self


class PlayerStats(Contract):
    """Observed movement summary."""

    samples: int
    elbow_mean: float | None = None
    knee_mean: float | None = None
    stance_mean: float | None = None
    distance: float = 0


class Analysis(Contract):
    """Persisted data required to reconstruct a replay."""

    frames: list[Frame]
    rallies: list[Rally]
    stats: list[PlayerStats]
    ball_coverage: float
    pose_coverage: float
    device: str
    elapsed: float
    notes: list[str]


class Settings(Contract):
    """User-controlled replay settings."""

    title: str = Field(default="Untitled session", min_length=1, max_length=100)
    players: tuple[str, str] = ("Player 1", "Player 2")
    fps_override: float | None = Field(default=None, ge=60, le=240)
    corners: list[Point] = Field(default_factory=list[Point], max_length=4)


class Replay(Contract):
    """Library record with analysis status."""

    id: str
    title: str
    players: tuple[str, str]
    created: str
    duration: float
    fps: float
    fps_override: float | None
    width: int
    height: int
    status: Literal["ready", "queued", "analyzing", "complete", "failed"]
    progress: float
    error: str | None
    corners: list[Point]
    analysis: Analysis | None = None
