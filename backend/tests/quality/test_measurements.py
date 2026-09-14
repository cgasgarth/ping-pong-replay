# Copyright (c) 2026 Connor Gasgarth
"""Confidence and physical input checks for reported measurements."""

import numpy as np
import pytest
from replay.analysis.media import validate_timestamps
from replay.analysis.tracking.limbs import retain_hidden, stabilize
from replay.domain.models import Joint, PlayerPose
from replay.quality.measurements import measure


def test_hidden_knee_does_not_produce_a_measurement() -> None:
    """An inferred ankle may animate, but must not become a knee or stance statistic."""
    pose = PlayerPose(
        player=0,
        joints=[
            Joint(x=index / 20, y=1, z=0, u=0.5, v=0.5, confidence=0 if index == 16 else 1)
            for index in range(17)
        ],
    )
    measure(pose)
    assert pose.knee is None
    assert pose.stance is None
    assert pose.elbow == pytest.approx(180)
    pose.state = "held"
    measure(pose)
    assert pose.elbow is None


@pytest.mark.parametrize("times", [[0, 1 / 30, 2 / 30], [0, 0, 1 / 60], [0]])
def test_bad_decoded_cadence_is_rejected(times: list[float]) -> None:
    """Incorrect metadata cannot bypass the actual decoded-frame cadence check."""
    with pytest.raises(ValueError, match=r"Minimum|timestamps|two timestamped"):
        validate_timestamps(times)


def test_true_sixty_fps_cadence_is_accepted() -> None:
    """Timestamp checks accept real 60 fps without floating point boundary errors."""
    assert validate_timestamps([index / 60 for index in range(720)]) == pytest.approx(60)


def test_stabilization_keeps_limb_length_during_a_pose_spike() -> None:
    """An isolated bad wrist position must not stretch the forearm."""
    values = np.zeros((9, 17, 3))
    values[:, 5, 1] = 1.4
    values[:, 7, 1] = 1.1
    values[:, 9, 1] = 0.85
    values[4, 9, 1] = 0.2
    stabilize(values)
    lengths = np.linalg.norm(values[:, 9] - values[:, 7], axis=1)
    assert lengths == pytest.approx([0.25] * 9)


def test_hidden_ankle_stays_attached_to_its_moving_knee() -> None:
    """Occlusion must not stretch or fold a limb when its parent moves."""
    previous = PlayerPose(
        player=0,
        joints=[
            Joint(x=0, y=0.5 if index == 14 else 0, z=0, u=0.5, v=0.5, confidence=1)
            for index in range(17)
        ],
    )
    joints = [joint.model_copy() for joint in previous.joints]
    joints[14].x, joints[14].y = 0.3, 0.8
    retain_hidden(16, joints, previous, np.zeros(3))
    assert joints[16].x == pytest.approx(0.3)
    assert joints[16].y == pytest.approx(0.3)
    assert joints[14].y - joints[16].y == pytest.approx(0.5)
