# Copyright (c) 2026 Connor Gasgarth
"""Ground anchoring must not invent depth when ankles are hidden."""

import numpy as np
import pytest
from replay.analysis.geometry import Camera
from replay.analysis.tracking.identity import Detection
from replay.analysis.tracking.root import root_position, table_occludes
from replay.domain.models import Joint, PlayerPose, Point


def test_hidden_feet_preserve_depth_while_hips_move_sideways() -> None:
    """Upper-body image motion can update lateral position, but not hidden depth."""
    camera = Camera(
        [
            Point(x=x / 1920, y=y / 1080)
            for x, y in [(735, 620), (786, 403), (1130, 405), (1178, 620)]
        ],
        1920,
        1080,
    )
    previous = PlayerPose(
        player=1,
        joints=[
            Joint(x=2, y=0 if index >= 15 else 1, z=0, u=0.5, v=0.5, confidence=1)
            for index in range(17)
        ],
    )
    projection = camera.intrinsics @ np.column_stack((camera.rotation, camera.translation))
    pixel = projection @ np.array([3.0, 1.0, 0.2, 1.0])
    keypoints = np.zeros((17, 3))
    keypoints[11:13] = [pixel[0] / pixel[2], pixel[1] / pixel[2], 1]
    detection = Detection(1, (0, 0, 100, 200), keypoints, (2, 0), np.ones(96))
    root = root_position(detection, camera, previous, 1 / 30)
    forward = camera.rotation.T[:, 2].copy()
    forward[1] = 0
    forward /= np.linalg.norm(forward)
    displacement = root - np.array([2, 0, 0])
    assert float(np.dot(displacement, forward)) == pytest.approx(0, abs=0.002)
    assert float(np.linalg.norm(displacement)) > 0.01


def test_table_masks_confident_ankle_pixels() -> None:
    """A detector confidence score cannot make an opaque table transparent."""
    camera = Camera(
        [
            Point(x=x / 1920, y=y / 1080)
            for x, y in [(735, 620), (786, 403), (1130, 405), (1178, 620)]
        ],
        1920,
        1080,
    )
    projection = camera.intrinsics @ np.column_stack((camera.rotation, camera.translation))
    for point, expected in [([0, 0.76, 0, 1], True), ([-2, 0, 0, 1], False)]:
        pixel = projection @ np.array(point)
        assert (
            table_occludes(camera, float(pixel[0] / pixel[2]), float(pixel[1] / pixel[2]))
            is expected
        )
