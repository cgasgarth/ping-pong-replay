# Copyright (c) 2026 Connor Gasgarth
"""Conservative rally segmentation and observed movement summaries."""

import math
from statistics import mean

from replay.domain.models import Frame, PlayerPose, PlayerStats, Rally
from replay.domain.outcomes import candidate_winner

RALLY_GAP = 1.4
MIN_RALLY_SAMPLES = 6
MIN_RALLY_SECONDS = 0.4
MAX_POSE_GAP = 0.3
MAX_STEP = 0.8
TRAVEL_INTERVAL = 0.25
MIN_TRAVEL = 0.03
MIN_METRIC_SAMPLES = 10


def rallies(frames: list[Frame], duration: float) -> list[Rally]:
    """Group ball tracks separated by long gaps into candidate rallies."""
    observations = [frame for frame in frames if frame.ball is not None]
    groups: list[list[Frame]] = []
    for frame in observations:
        if not groups or frame.time - groups[-1][-1].time > RALLY_GAP:
            groups.append([])
        groups[-1].append(frame)
    events: list[Rally] = []
    for group in groups:
        if len(group) < MIN_RALLY_SAMPLES or group[-1].time - group[0].time < MIN_RALLY_SECONDS:
            continue
        first, last = group[0].ball, group[-1].ball
        if first is None or last is None:
            continue
        server = 0 if first.x < 0 else 1
        winner = candidate_winner(group, duration)
        events.append(
            Rally(
                start=max(0, group[0].time - 0.3),
                end=min(duration, group[-1].time + 0.4),
                server=server,
                winner=winner,
                confidence=0.6 if winner is not None else 0.35,
            ),
        )
    return events


def statistics(frames: list[Frame]) -> list[PlayerStats]:
    """Compute summaries only from observed joints and short tracking gaps."""
    summaries: list[PlayerStats] = []
    for player in (0, 1):
        poses = [
            (frame.time, pose)
            for frame in frames
            for pose in frame.players
            if pose.player == player and pose.state != "held"
        ]
        elbows = [pose.elbow for _, pose in poses if pose.elbow is not None]
        knees = [pose.knee for _, pose in poses if pose.knee is not None]
        stances = [pose.stance for _, pose in poses if pose.stance is not None]
        distance = travel(poses)
        summaries.append(
            PlayerStats(
                samples=len(poses),
                elbow_mean=round(mean(elbows), 1) if len(elbows) >= MIN_METRIC_SAMPLES else None,
                knee_mean=round(mean(knees), 1) if len(knees) >= MIN_METRIC_SAMPLES else None,
                stance_mean=round(mean(stances), 2) if len(stances) >= MIN_METRIC_SAMPLES else None,
                distance=round(distance, 2),
            ),
        )
    return summaries


def travel(poses: list[tuple[float, PlayerPose]]) -> float:
    """Reduce landmark jitter before accumulating court movement."""
    filtered: tuple[float, float] | None = None
    anchor: tuple[float, float] | None = None
    anchor_time = 0.0
    previous_time = 0.0
    total = 0.0
    for time, pose in poses:
        left, right = pose.joints[15:17]
        point = ((left.x + right.x) / 2, (left.z + right.z) / 2)
        if filtered is None or time - previous_time > MAX_POSE_GAP:
            filtered, anchor, anchor_time = point, point, time
        else:
            filtered = (0.75 * filtered[0] + 0.25 * point[0], 0.75 * filtered[1] + 0.25 * point[1])
        if anchor is not None and time - anchor_time >= TRAVEL_INTERVAL:
            distance = math.dist(filtered, anchor)
            if MIN_TRAVEL < distance < MAX_STEP:
                total += distance
            anchor, anchor_time = filtered, time
        previous_time = time
    return total
