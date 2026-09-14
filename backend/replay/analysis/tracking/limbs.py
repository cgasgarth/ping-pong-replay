# Copyright (c) 2026 Connor Gasgarth
"""Preserve each player's limb lengths through smoothing and occlusion."""

from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    from replay.analysis.geometry import FloatArray
    from replay.domain.models import Joint, PlayerPose

BONES = ((5, 7), (7, 9), (6, 8), (8, 10), (11, 13), (13, 15), (12, 14), (14, 16))
EPSILON = 1e-6
PARENTS = {7: 5, 8: 6, 9: 7, 10: 8, 13: 11, 14: 12, 15: 13, 16: 14}


def retain_hidden(index: int, joints: list[Joint], previous: PlayerPose, shift: FloatArray) -> None:
    """Keep a hidden limb attached as its visible parent moves."""
    joint, old = joints[index], previous.joints[index]
    parent = PARENTS.get(index)
    if parent is not None:
        anchor, old_anchor = joints[parent], previous.joints[parent]
        joint.x = old.x + anchor.x - old_anchor.x
        joint.y = old.y + anchor.y - old_anchor.y
        joint.z = old.z + anchor.z - old_anchor.z
    else:
        joint.x = old.x + float(shift[0])
        joint.y = old.y
        joint.z = old.z + float(shift[2])


def stabilize(values: FloatArray) -> None:
    """Keep robust segment lengths while preserving measured joint directions."""
    for start, end in BONES:
        vectors = values[:, end] - values[:, start]
        lengths = np.linalg.norm(vectors, axis=1)
        supported = lengths > EPSILON
        if not supported.any():
            continue
        length = float(np.median(lengths[supported]))
        previous = vectors[np.argmax(supported)] / lengths[np.argmax(supported)]
        for index in range(len(values)):
            direction = vectors[index] / lengths[index] if supported[index] else previous
            values[index, end] = values[index, start] + direction * length
            previous = direction
    # At least one ankle touches the floor; this does not change horizontal roots.
    values[:, :, 1] -= np.minimum(values[:, 15, 1], values[:, 16, 1])[:, None]
