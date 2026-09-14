# Copyright (c) 2026 Connor Gasgarth
"""Confidence-aware offline smoothing without filling long occlusions."""

import math
from typing import TYPE_CHECKING

import numpy as np
from scipy.ndimage import gaussian_filter1d, median_filter

from replay.analysis.geometry import angle

if TYPE_CHECKING:
    from replay.analysis.geometry import FloatArray
    from replay.domain.models import Frame, PlayerPose

MAX_SEGMENT_GAP = 0.8
MAX_CENTER_SPEED = 3.5


def clean_segment(poses: list[PlayerPose], times: list[float]) -> None:
    """Remove isolated spikes and smooth supported 3D coordinates with zero phase lag."""
    if not poses:
        return
    values = np.array([[[joint.x, joint.y, joint.z] for joint in pose.joints] for pose in poses])
    weights = np.array([[max(joint.confidence, 0.05) for joint in pose.joints] for pose in poses])
    robust = median_filter(values, size=(3, 1, 1), mode="nearest")
    denominator = gaussian_filter1d(weights, 1.15, axis=0, mode="nearest")
    smoothed = gaussian_filter1d(robust * weights[..., None], 1.15, axis=0, mode="nearest")
    smoothed /= np.maximum(denominator[..., None], 0.01)
    for index in range(1, len(poses)):
        previous = (smoothed[index - 1, 11] + smoothed[index - 1, 12]) / 2
        center = (smoothed[index, 11] + smoothed[index, 12]) / 2
        delta = center - previous
        delta[1] = 0
        distance = math.hypot(float(delta[0]), float(delta[2]))
        maximum = MAX_CENTER_SPEED * (times[index] - times[index - 1])
        if distance > maximum > 0:
            correction = delta * (maximum / distance - 1)
            smoothed[index] += correction
    for index, pose in enumerate(poses):
        world: FloatArray = np.asarray(smoothed[index], dtype=np.float64)
        for joint_index, joint in enumerate(pose.joints):
            joint.x = float(world[joint_index, 0])
            joint.y = float(world[joint_index, 1])
            joint.z = float(world[joint_index, 2])
        pose.elbow = angle(world[6], world[8], world[10])
        pose.knee = angle(world[12], world[14], world[16])
        left, right = pose.joints[15:17]
        pose.stance = round(math.dist((left.x, left.y, left.z), (right.x, right.y, right.z)), 3)


def smooth(frames: list[Frame]) -> None:
    """Keep identities and discontinuous visibility segments separate."""
    for player in (0, 1):
        segment: list[PlayerPose] = []
        times: list[float] = []
        previous = -MAX_SEGMENT_GAP
        for frame in frames:
            pose = next((item for item in frame.players if item.player == player), None)
            if pose is None:
                continue
            if frame.time - previous > MAX_SEGMENT_GAP:
                clean_segment(segment, times)
                segment = []
                times = []
            segment.append(pose)
            times.append(frame.time)
            previous = frame.time
        clean_segment(segment, times)
