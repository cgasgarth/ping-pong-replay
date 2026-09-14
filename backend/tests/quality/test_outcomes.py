# Copyright (c) 2026 Connor Gasgarth
"""Conservative automatic point evidence."""

from replay.domain.models import Ball, Frame
from replay.domain.outcomes import candidate_winner


def flight(heights: list[float]) -> list[Frame]:
    """Construct a tracked flight from near the net through the far end line."""
    return [
        Frame(
            time=index / 60,
            players=[],
            ball=Ball(
                x=0.3 + index * 0.4,
                y=height,
                z=0,
                u=0.5,
                v=0.5,
                confidence=1,
                mode="learned-3d",
            ),
        )
        for index, height in enumerate(heights)
    ]


def test_exit_without_bounce_does_not_award_a_point() -> None:
    """A ball can leave the table after a missed shot or a successful shot."""
    assert candidate_winner(flight([1.2, 1.1, 1.0, 0.9, 0.8]), 1) is None


def test_visible_bounce_and_exit_can_propose_a_point() -> None:
    """Require a supported receiving-side bounce followed by an end-line exit."""
    frames = flight([0.95, 0.77, 0.94, 1.1, 1.2])
    assert candidate_winner(frames, 1) == 0
    assert candidate_winner(frames, frames[-1].time) is None
