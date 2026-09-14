# Copyright (c) 2026 Connor Gasgarth
"""Compare reconstructed visible joints with independent image-space observations."""

import math
from typing import TYPE_CHECKING

import numpy as np

from replay.analysis.geometry import Camera

if TYPE_CHECKING:
    from replay.domain.models import Replay

MIN_CONFIDENCE = 0.5
MIN_DEPTH = 0.01


def reprojection(replay: Replay, player: int) -> tuple[float, float]:
    """Report median and 95th-percentile pixel error without claiming depth accuracy."""
    if replay.analysis is None:
        return 0, 0
    camera = Camera(replay.corners, replay.width, replay.height)
    projection = camera.intrinsics @ np.column_stack((camera.rotation, camera.translation))
    errors: list[float] = []
    for frame in replay.analysis.frames:
        for pose in frame.players:
            if pose.player != player or pose.state == "held":
                continue
            for joint in pose.joints[5:]:
                if joint.confidence < MIN_CONFIDENCE:
                    continue
                pixel = projection @ np.array([joint.x, joint.y, joint.z, 1])
                if pixel[2] <= MIN_DEPTH:
                    errors.append(float(replay.height))
                    continue
                errors.append(
                    math.hypot(
                        float(pixel[0] / pixel[2] - joint.u * replay.width),
                        float(pixel[1] / pixel[2] - joint.v * replay.height),
                    )
                )
    if not errors:
        return 0, 0
    return round(float(np.median(errors)), 2), round(float(np.percentile(errors, 95)), 2)
