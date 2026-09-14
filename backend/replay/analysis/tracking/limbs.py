# Copyright (c) 2026 Connor Gasgarth
"""Preserve each player's limb lengths through smoothing and occlusion."""

from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    from replay.analysis.geometry import FloatArray

BONES = ((5, 7), (7, 9), (6, 8), (8, 10), (11, 13), (13, 15), (12, 14), (14, 16))
EPSILON = 1e-6


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
