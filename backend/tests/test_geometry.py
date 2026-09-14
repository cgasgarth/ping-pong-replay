# Copyright (c) 2026 Connor Gasgarth
"""Geometry and event tests with known synthetic observations."""

import numpy as np
import pytest
from replay.analysis.geometry import Camera, angle
from replay.analysis.reconstruction.flight import reconstruct
from replay.domain.metrics import rallies
from replay.domain.models import Ball, Frame, Point


def camera() -> Camera:
    """Calibrate a fixed test camera to a valid four-corner table."""
    return Camera(
        [Point(x=x, y=y) for x, y in [(0.35, 0.45), (0.65, 0.45), (0.7, 0.6), (0.3, 0.6)]],
        1280,
        720,
    )


def test_joint_angle() -> None:
    """A known right angle must measure 90 degrees."""
    result = angle(np.array([1.0, 0, 0]), np.zeros(3), np.array([0.0, 1, 0]))
    assert result == pytest.approx(90)


def test_flight_reconstructs_known_ballistic_arc() -> None:
    """Recover height from a projected physical trajectory, not an invented arc."""
    calibrated = camera()
    projection = calibrated.intrinsics @ np.column_stack(
        (calibrated.rotation, calibrated.translation)
    )
    frames: list[Frame] = []
    for index in range(18):
        time = index / 60
        point = np.array([-0.8 + 5 * time, 1.0 + 2 * time - 4.905 * time**2, 0.1])
        pixel = projection @ np.append(point, 1)
        u, v = float(pixel[0] / pixel[2] / 1280), float(pixel[1] / pixel[2] / 720)
        frames.append(
            Frame(time=time, players=[], ball=Ball(u=u, v=v, x=0, y=0.8, z=0, confidence=1))
        )
    coverage = reconstruct(frames, calibrated)
    assert coverage > 0.5
    ball = frames[8].ball
    assert ball is not None
    assert ball.y == pytest.approx(1.0 + 2 * (8 / 60) - 4.905 * (8 / 60) ** 2, abs=0.02)


def test_rally_gaps_make_two_serve_markers() -> None:
    """Separate observed rallies across a long gap without guessing winners."""
    frames = [
        Frame(
            time=start + index / 10,
            players=[],
            ball=Ball(u=0.5, v=0.5, x=-0.5, y=0.8, z=0, confidence=0.9),
        )
        for start in [0, 5]
        for index in range(10)
    ]
    events = rallies(frames, 7)
    assert len(events) == 2
    assert events[0].winner is None
    assert events[1].start > events[0].end
