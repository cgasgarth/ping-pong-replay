# Copyright (c) 2026 Connor Gasgarth
"""Regression coverage for participant locks, occlusion and pose cleanup."""

import numpy as np
from replay.analysis.tracking.identity import Detection, PlayerLocks
from replay.analysis.tracking.temporal import clean_segment
from replay.domain.models import Joint, PlayerPose


def person(identity: int, x: float, z: float, color: int) -> Detection:
    """Create a deterministic appearance and court position."""
    signature = np.zeros(96)
    signature[color] = 1
    return Detection(identity, (0, 0, 100, 200), np.ones((17, 3)), (x, z), signature)


def test_judge_never_replaces_missing_player() -> None:
    """A larger judge stays excluded when a participant disappears."""
    locks = PlayerLocks()
    near, far, judge = person(11, -2, 0, 0), person(22, 2, 0, 1), person(33, 0, -2.5, 2)
    assert [item[0] for item in locks.select([judge, near, far])] == [0, 1]
    assert [item[1].identity for item in locks.select([judge, near])] == [11]
    assert locks.identities == {0: 11, 1: 22}
    assert [item[1].identity for item in locks.select([judge, near, far])] == [11, 22]


def test_reentry_requires_matching_appearance() -> None:
    """A new tracker ID can rejoin only with the original player's appearance."""
    locks = PlayerLocks()
    locks.select([person(1, -2, 0, 0), person(2, 2, 0, 1)])
    assert locks.select([person(9, 2, 0, 5)]) == []
    returned = locks.select([person(10, 2, 0, 1)])
    assert len(returned) == 1
    assert returned[0][0] == 1
    assert locks.identities[1] == 10


def test_isolated_pose_spike_is_removed() -> None:
    """A single bad pose frame must not produce a large render jump."""
    poses = [
        PlayerPose(
            player=0,
            joints=[
                Joint(x=4 if index == 4 else 1, y=0.5, z=0, u=0.5, v=0.5, confidence=1)
                for _ in range(17)
            ],
        )
        for index in range(9)
    ]
    clean_segment(poses, [index / 30 for index in range(len(poses))])
    assert max(pose.joints[0].x for pose in poses) < 1.5


def test_reused_id_with_judge_appearance_is_rejected() -> None:
    """A tracker-ID switch must not bypass the appearance lock."""
    locks = PlayerLocks()
    locks.select([person(1, -2, 0, 0), person(2, 2, 0, 1)])
    assert locks.select([person(2, 2, 0, 5)]) == []


def test_center_motion_is_bounded_after_cleanup() -> None:
    """Sustained bad depth estimates cannot teleport a player across the court."""
    poses = [
        PlayerPose(
            player=0,
            joints=[
                Joint(x=1 if index < 4 else 4, y=0.5, z=0, u=0.5, v=0.5, confidence=1)
                for _ in range(17)
            ],
        )
        for index in range(9)
    ]
    clean_segment(poses, [index / 30 for index in range(len(poses))])
    steps = [
        abs(poses[index].joints[11].x - poses[index - 1].joints[11].x)
        for index in range(1, len(poses))
    ]
    assert max(steps) <= 3.5 / 30 + 1e-6
