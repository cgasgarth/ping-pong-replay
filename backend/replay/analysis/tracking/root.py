# Copyright (c) 2026 Connor Gasgarth
"""Estimate a stable ground anchor from visible ankles or persistent hip height."""

from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    from replay.analysis.geometry import Camera, FloatArray
    from replay.analysis.tracking.identity import Detection
    from replay.domain.models import PlayerPose

MIN_CONFIDENCE = 0.5
MAX_GROUND_SPEED = 4.5


def root_position(
    detection: Detection, camera: Camera, previous: PlayerPose | None, elapsed: float
) -> FloatArray:
    """Avoid jumping to extrapolated feet when the lower body leaves the picture."""
    points = detection.keypoints
    visible_feet = float(points[15, 2]) > MIN_CONFIDENCE and float(points[16, 2]) > MIN_CONFIDENCE
    if previous is None or visible_feet:
        u = float((points[15, 0] + points[16, 0]) / 2 / camera.width)
        v = float((points[15, 1] + points[16, 1]) / 2 / camera.height)
        estimated = camera.on_plane(u, v)
    else:
        left, right = previous.joints[15:17]
        estimated = np.array([(left.x + right.x) / 2, 0, (left.z + right.z) / 2])
        if float(points[11, 2]) > MIN_CONFIDENCE and float(points[12, 2]) > MIN_CONFIDENCE:
            hip_left, hip_right = previous.joints[11:13]
            height = (hip_left.y + hip_right.y) / 2
            hip = camera.on_plane(
                float((points[11, 0] + points[12, 0]) / 2 / camera.width),
                float((points[11, 1] + points[12, 1]) / 2 / camera.height),
                height,
            )
            estimated[0] += hip[0] - (hip_left.x + hip_right.x) / 2
            estimated[2] += hip[2] - (hip_left.z + hip_right.z) / 2
    if previous is not None:
        left, right = previous.joints[15:17]
        old = np.array([(left.x + right.x) / 2, 0, (left.z + right.z) / 2])
        delta = estimated - old
        distance = float(np.linalg.norm(delta))
        maximum = MAX_GROUND_SPEED * min(elapsed, 0.1) + 0.04
        if distance > maximum:
            estimated = old + delta * maximum / distance
    return estimated


def fit_root(
    detection: Detection, camera: Camera, relative: FloatArray, initial: FloatArray
) -> FloatArray:
    """Fit floor translation from visible upper-body joints when feet are occluded."""
    projection = camera.intrinsics @ np.column_stack((camera.rotation, camera.translation))
    equations: list[list[float]] = []
    targets: list[float] = []
    for index in range(5, 17):
        confidence = float(detection.keypoints[index, 2])
        if confidence < MIN_CONFIDENCE:
            continue
        for axis in (0, 1):
            pixel = float(detection.keypoints[index, axis])
            row = projection[axis] - pixel * projection[2]
            equations.append([float(row[0] * confidence), float(row[2] * confidence)])
            targets.append(float(-np.dot(row, np.append(relative[index], 1)) * confidence))
    minimum_equations = 8
    if len(equations) < minimum_equations:
        return initial
    solution = np.linalg.lstsq(np.array(equations), np.array(targets), rcond=None)[0]
    limit = 5.0
    if np.isfinite(solution).all() and np.abs(solution).max() < limit:
        return np.array([solution[0], 0, solution[1]], dtype=np.float64)
    return initial
