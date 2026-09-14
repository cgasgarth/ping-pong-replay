# Copyright (c) 2026 Connor Gasgarth
"""Estimate a stable ground anchor from visible ankles or persistent hip height."""

from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    from replay.analysis.geometry import Camera, FloatArray
    from replay.analysis.tracking.identity import Detection
    from replay.domain.models import PlayerPose

MIN_CONFIDENCE = 0.5
HIP_REFERENCE_HEIGHT = 0.9
MAX_GROUND_SPEED = 4.5
TABLE_HALF_LENGTH = 1.37
TABLE_HALF_WIDTH = 0.7625


def table_occludes(camera: Camera, u: float, v: float) -> bool:
    """Reject inferred ankles whose image rays cross the opaque tabletop."""
    point = camera.on_plane(u / camera.width, v / camera.height, 0.76)
    return abs(float(point[0])) < TABLE_HALF_LENGTH and abs(float(point[2])) < TABLE_HALF_WIDTH


def root_position(
    detection: Detection,
    camera: Camera,
    previous: PlayerPose | None,
    elapsed: float,
    anchor: FloatArray | None,
) -> FloatArray:
    """Avoid jumping to extrapolated feet when the lower body leaves the picture."""
    points = detection.keypoints
    visible_feet = all(
        float(points[index, 2]) > MIN_CONFIDENCE
        and not table_occludes(camera, float(points[index, 0]), float(points[index, 1]))
        for index in (15, 16)
    )
    if visible_feet:
        u = float((points[15, 0] + points[16, 0]) / 2 / camera.width)
        v = float((points[15, 1] + points[16, 1]) / 2 / camera.height)
        estimated = camera.on_plane(u, v)
    elif previous is None or anchor is None:
        estimated = camera.on_plane(
            float((points[11, 0] + points[12, 0]) / 2 / camera.width),
            float((points[11, 1] + points[12, 1]) / 2 / camera.height),
            HIP_REFERENCE_HEIGHT,
        )
        estimated[1] = 0
    else:
        estimated = anchor.copy()
        if float(points[11, 2]) > MIN_CONFIDENCE and float(points[12, 2]) > MIN_CONFIDENCE:
            hip_left, hip_right = previous.joints[11:13]
            height = (hip_left.y + hip_right.y) / 2
            hip = camera.on_plane(
                float((points[11, 0] + points[12, 0]) / 2 / camera.width),
                float((points[11, 1] + points[12, 1]) / 2 / camera.height),
                height,
            )
            lateral = camera.rotation.T[:, 0].copy()
            lateral[1] = 0
            lateral /= np.linalg.norm(lateral)
            previous_projection = camera.on_plane(
                (hip_left.u + hip_right.u) / 2,
                (hip_left.v + hip_right.v) / 2,
                height,
            )
            displacement = hip - previous_projection
            estimated += lateral * float(np.dot(displacement, lateral))
    if anchor is not None:
        old = anchor
        delta = estimated - old
        distance = float(np.linalg.norm(delta))
        maximum = MAX_GROUND_SPEED * min(elapsed, 0.1) + 0.04
        if distance > maximum:
            estimated = old + delta * maximum / distance
    return estimated
