# Copyright (c) 2026 Connor Gasgarth
"""The body reconstruction must agree with supported image observations."""

import numpy as np
import pytest
from replay.analysis.geometry import Camera
from replay.analysis.reconstruction.body import world_pose
from replay.analysis.tracking.ground import ground_legs
from replay.analysis.tracking.identity import Detection
from replay.domain.models import Joint, Point


def test_image_rays_correct_a_mirrored_native_pose() -> None:
    """Preserve inferred depth while correcting a wrong native horizontal orientation."""
    camera = Camera(
        [
            Point(x=x / 1920, y=y / 1080)
            for x, y in [(735, 620), (786, 403), (1130, 405), (1178, 620)]
        ],
        1920,
        1080,
    )
    world = np.array([[-2.0, 1.0, (index % 2 - 0.5) * 0.4] for index in range(17)])
    world[11:13, 1] = 0.9
    world[15:17, 1] = 0
    world[15:17, 2] = [-0.2, 0.2]
    native = world @ camera.rotation.T + camera.translation
    pixels = native @ camera.intrinsics.T
    pixels = pixels[:, :2] / pixels[:, 2:3]
    keypoints = np.column_stack((pixels, np.ones(17)))
    joints = [
        Joint(
            x=-float(point[0]),
            y=float(point[1]) + 0.2,
            z=float(point[2]),
            u=0.5,
            v=0.5,
            confidence=1,
        )
        for point in native
    ]
    detection = Detection(1, (0, 0, 100, 200), keypoints, (-2, 0), np.ones(96))
    result = world_pose(joints, camera, detection, np.array([-2.0, 0, 0]))
    assert result == pytest.approx(world)


def test_hidden_leg_grounding_preserves_the_visible_hip() -> None:
    """A hidden leg can meet the floor without shifting the measured upper body."""
    values = np.zeros((3, 17, 3))
    values[:, :, 0] = -2
    values[:, 11:13, 1] = 0.9
    values[:, 13:15, 1] = 0.45
    weights = np.ones((3, 17))
    weights[:, 13:17] = 0
    ground_legs(values, weights)
    assert values[:, 11:13, 1] == pytest.approx(np.full((3, 2), 0.9))
    assert values[:, 15:17, 1] == pytest.approx(np.zeros((3, 2)))
    assert float(values[0, 13, 0]) > -2
    assert float(values[0, 13, 1]) == pytest.approx(0.45)
