# Copyright (c) 2026 Connor Gasgarth
"""Compute mechanics only where the required joints have direct support."""

import math
from typing import TYPE_CHECKING

import numpy as np

from replay.analysis.geometry import angle

if TYPE_CHECKING:
    from replay.domain.models import PlayerPose

MIN_CONFIDENCE = 0.5


def supported(pose: PlayerPose, indices: tuple[int, ...]) -> bool:
    """Exclude held poses and low-confidence joints from quantitative metrics."""
    return pose.state != "held" and all(
        pose.joints[index].confidence >= MIN_CONFIDENCE for index in indices
    )


def measure(pose: PlayerPose) -> None:
    """Recalculate supported joint angles and horizontal ankle separation."""
    world = np.array([[joint.x, joint.y, joint.z] for joint in pose.joints])
    pose.elbow = angle(world[6], world[8], world[10]) if supported(pose, (6, 8, 10)) else None
    pose.knee = angle(world[12], world[14], world[16]) if supported(pose, (12, 14, 16)) else None
    left, right = pose.joints[15:17]
    pose.stance = (
        round(math.hypot(left.x - right.x, left.z - right.z), 3)
        if supported(pose, (15, 16))
        else None
    )
