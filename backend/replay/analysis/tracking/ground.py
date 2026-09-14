# Copyright (c) 2026 Connor Gasgarth
"""Keep unobserved legs anatomically connected without moving visible torso measurements."""

from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    from replay.analysis.geometry import FloatArray

VISIBLE = 0.5
EPSILON = 1e-6


def ground_legs(values: FloatArray, weights: FloatArray) -> None:
    """Fit hidden legs to the floor with a constant two-segment length prior."""
    for index in range(len(values)):
        if min(weights[index, 15], weights[index, 16]) >= VISIBLE:
            values[index, :, 1] -= min(values[index, 15, 1], values[index, 16, 1])
    for hip_index, knee_index, ankle_index in ((11, 13, 15), (12, 14, 16)):
        upper = float(
            np.median(np.linalg.norm(values[:, knee_index] - values[:, hip_index], axis=1))
        )
        lower = float(
            np.median(np.linalg.norm(values[:, ankle_index] - values[:, knee_index], axis=1))
        )
        if upper + lower < EPSILON:
            continue
        reach = max(upper + lower, float(np.percentile(values[:, hip_index, 1], 95)) + 0.02)
        scale = reach / (upper + lower)
        for index in range(len(values)):
            if max(weights[index, knee_index], weights[index, ankle_index]) >= VISIBLE:
                continue
            hip = values[index, hip_index]
            foot = values[index, ankle_index].copy()
            foot[1] = max(0, float(hip[1]) - reach + 0.001)
            horizontal: FloatArray = np.asarray(foot - hip, dtype=np.float64)
            horizontal[1] = 0
            radius = float(np.sqrt(max(0, reach**2 - float(hip[1] - foot[1]) ** 2))) * 0.99
            length = float(np.linalg.norm(horizontal))
            if length > radius:
                foot[[0, 2]] = hip[[0, 2]] + horizontal[[0, 2]] * radius / length
            knee = knee_position(hip, foot, upper * scale, lower * scale)
            values[index, knee_index], values[index, ankle_index] = knee, foot


def knee_position(hip: FloatArray, foot: FloatArray, upper: float, lower: float) -> FloatArray:
    """Solve the two-bone triangle with a knee bend toward the table."""
    delta = foot - hip
    distance = max(float(np.linalg.norm(delta)), EPSILON)
    axis = delta / distance
    forward = np.array([-1.0 if hip[0] > 0 else 1.0, 0, 0])
    bend = forward - axis * float(np.dot(forward, axis))
    bend /= max(float(np.linalg.norm(bend)), EPSILON)
    along = (upper**2 - lower**2 + distance**2) / (2 * distance)
    height = float(np.sqrt(max(0, upper**2 - along**2)))
    return np.asarray(hip + axis * along + bend * height, dtype=np.float64)
