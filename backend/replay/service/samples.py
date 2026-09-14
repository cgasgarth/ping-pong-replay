# Copyright (c) 2026 Connor Gasgarth
"""Published 1080p, 30 fps research sample metadata."""

from pydantic import TypeAdapter

from replay.domain.models import Contract, Point
from replay.domain.store import ROOT


class Sample(Contract):
    """Source provenance and local fixture settings."""

    id: str
    title: str
    file: str
    source: str
    start: int
    end: int
    corners: list[Point]


def samples() -> list[Sample]:
    """Read the shared setup and API sample manifest."""
    return TypeAdapter(list[Sample]).validate_json((ROOT / "config" / "samples.json").read_text())
