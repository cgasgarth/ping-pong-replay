# Copyright (c) 2026 Connor Gasgarth
"""Only propose points with a visible table bounce and a subsequent end-line exit."""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from replay.domain.models import Frame

END_LINE = 1.65
TABLE_END = 1.37
TABLE_SIDE = 0.7625
BOUNCE_HEIGHT = 0.86
MAX_GAP = 0.1
MIN_OBSERVATIONS = 5


def candidate_winner(group: list[Frame], duration: float) -> int | None:
    """Require bounce evidence to distinguish a successful shot from an out ball."""
    if len(group) < MIN_OBSERVATIONS or duration - group[-1].time < MAX_GAP:
        return None
    last = group[-1].ball
    if last is None or abs(last.x) <= END_LINE:
        return None
    receiver = 1 if last.x > 0 else 0
    for index in range(len(group) - 2, 0, -1):
        before, middle, after = group[index - 1 : index + 2]
        first, bounce, final = before.ball, middle.ball, after.ball
        if first is None or bounce is None or final is None:
            continue
        if max(middle.time - before.time, after.time - middle.time) > MAX_GAP:
            continue
        if bounce.mode == "table-plane" or first.mode != bounce.mode or final.mode != bounce.mode:
            continue
        if (bounce.x > 0) != (receiver == 1):
            continue
        if (
            abs(bounce.x) < TABLE_END
            and abs(bounce.z) < TABLE_SIDE
            and bounce.y < BOUNCE_HEIGHT
            and first.y > bounce.y < final.y
            and all(
                frame.ball is not None and (frame.ball.x > 0) == (receiver == 1)
                for frame in group[index:]
            )
        ):
            return 1 - receiver
    return None
