# Copyright (c) 2026 Connor Gasgarth
"""Use tracked image rays and inferred depth to constrain the 3D body pose."""

from typing import TYPE_CHECKING

import numpy as np

from replay.analysis.tracking.limbs import PARENTS
from replay.analysis.tracking.root import HIP_REFERENCE_HEIGHT, table_occludes

if TYPE_CHECKING:
    from replay.analysis.geometry import Camera, FloatArray
    from replay.analysis.tracking.identity import Detection
    from replay.domain.models import Joint

MIN_CONFIDENCE = 0.5


def world_pose(
    joints: list[Joint],
    camera: Camera,
    detection: Detection,
    root: FloatArray,
) -> FloatArray:
    """Keep supported joints on their image rays; use native relative depth only."""
    coordinates = np.array([[joint.x, joint.y, joint.z] for joint in joints])
    rotated = coordinates @ camera.rotation
    world = rotated - (rotated[15] + rotated[16]) / 2 + root
    native = world.copy()
    hip_anchor = root + np.array([0.0, HIP_REFERENCE_HEIGHT, 0.0])
    anchor_depth = float((camera.rotation @ hip_anchor + camera.translation)[2])
    depth_offsets = coordinates[:, 2] - (coordinates[11, 2] + coordinates[12, 2]) / 2
    for index, (u, v, confidence) in enumerate(detection.keypoints):
        if confidence < MIN_CONFIDENCE or (
            index in (13, 14, 15, 16) and table_occludes(camera, float(u), float(v))
        ):
            parent = PARENTS.get(index)
            if parent is not None:
                world[index] = world[parent] + native[index] - native[parent]
            continue
        ray = camera.inverse @ np.array([u, v, 1])
        point = ray * (anchor_depth + depth_offsets[index])
        world[index] = camera.rotation.T @ (point - camera.translation)
    return np.asarray(world, dtype=np.float64)
