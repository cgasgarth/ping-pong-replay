# Copyright (c) 2026 Connor Gasgarth
"""Reproducible structural and kinematic checks for saved replay data."""

import json
import math
import sys
from collections import Counter
from itertools import pairwise
from pathlib import Path
from statistics import median
from typing import TYPE_CHECKING

from replay.domain import store
from replay.quality.projection import reprojection

if TYPE_CHECKING:
    from replay.domain.models import Replay

BONES = ((5, 7), (7, 9), (6, 8), (8, 10), (11, 13), (13, 15), (12, 14), (14, 16))
MAX_SPEED = 3.51
MIN_BONE = 0.08
MAX_BONE = 0.8
MAX_GAP = 0.8
RATE_TOLERANCE = 0.1
JOINT_COUNT = 17
MAX_COURT_LENGTH = 8
MAX_COURT_WIDTH = 5
MAX_MEDIAN_REPROJECTION = 0.12


def audit(replay: Replay) -> dict[str, object]:
    """Separate deterministic failures from uncertainty requiring visual review."""
    analysis = replay.analysis
    if analysis is None:
        return {"id": replay.id, "errors": ["No completed analysis"]}
    errors: list[str] = []
    times = [frame.time for frame in analysis.frames]
    if any(second <= first for first, second in pairwise(times)):
        errors.append("Frame timestamps are not strictly increasing")
    effective_fps = replay.fps_override or replay.fps
    if (
        len(times) > 1
        and times[-1] > times[0]
        and abs((len(times) - 1) / (times[-1] - times[0]) - effective_fps) > RATE_TOLERANCE
    ):
        errors.append("Decoded timestamps disagree with the replay frame rate")
    for frame in analysis.frames:
        if len({pose.player for pose in frame.players}) != len(frame.players):
            errors.append("Duplicate player identity within a frame")
        errors.extend(
            "Pose does not contain 17 joints"
            for pose in frame.players
            if len(pose.joints) != JOINT_COUNT
        )
    players = player_audits(replay, errors)
    modes = Counter(frame.ball.mode for frame in analysis.frames if frame.ball is not None)
    return {
        "id": replay.id,
        "title": replay.title,
        "frames": len(times),
        "errors": sorted(set(errors)),
        "players": players,
        "ball_modes": dict(modes),
        "limits": "Kinematic consistency is not ground-truth 3D accuracy. Review source overlays.",
    }


def player_audits(replay: Replay, errors: list[str]) -> list[dict[str, object]]:
    """Check physical consistency for each persistent participant."""
    analysis = replay.analysis
    if analysis is None:
        return []
    players: list[dict[str, object]] = []
    for player in (0, 1):
        samples = [
            (frame.time, pose)
            for frame in analysis.frames
            for pose in frame.players
            if pose.player == player
        ]
        if not samples:
            errors.append(f"Player {player + 1} has no tracked observations")
        speeds: list[float] = []
        lengths: list[list[float]] = [[] for _ in BONES]
        centers: list[tuple[float, float]] = []
        states: Counter[str] = Counter()
        for index, (time, pose) in enumerate(samples):
            states[pose.state] += 1
            left, right = pose.joints[11:13]
            center = ((left.x + right.x) / 2, (left.z + right.z) / 2)
            centers.append(center)
            if index > 0 and 0 < time - samples[index - 1][0] <= MAX_GAP:
                speeds.append(
                    math.dist(center, centers[index - 1]) / (time - samples[index - 1][0])
                )
            for bone, (start, end) in enumerate(BONES):
                a, b = pose.joints[start], pose.joints[end]
                lengths[bone].append(math.dist((a.x, a.y, a.z), (b.x, b.y, b.z)))
        if speeds and max(speeds) > MAX_SPEED:
            errors.append(f"Player {player + 1} exceeds the root-motion speed limit")
        if any(abs(x) > MAX_COURT_LENGTH or abs(z) > MAX_COURT_WIDTH for x, z in centers):
            errors.append(f"Player {player + 1} leaves the supported court bounds")
        invalid_bones = sum(not MIN_BONE <= value <= MAX_BONE for bone in lengths for value in bone)
        if invalid_bones:
            errors.append(f"Player {player + 1}: {invalid_bones} implausible limb lengths")
        median_error, tail_error = reprojection(replay, player)
        errors.extend(
            [f"Player {player + 1} has excessive 3D-to-image projection error"]
            if median_error > replay.height * MAX_MEDIAN_REPROJECTION
            else []
        )
        players.append(
            {
                "player": player + 1,
                "median_reprojection_px": median_error,
                "p95_reprojection_px": tail_error,
                "samples": len(samples),
                "states": dict(states),
                "max_root_speed_mps": round(max(speeds, default=0), 4),
                "longitudinal_range_m": [
                    round(min((p[0] for p in centers), default=0), 3),
                    round(max((p[0] for p in centers), default=0), 3),
                ],
                "limb_median_lengths_m": [
                    round(median(bone), 3) if bone else None for bone in lengths
                ],
                "supported_elbow_samples": sum(pose.elbow is not None for _, pose in samples),
                "supported_knee_samples": sum(pose.knee is not None for _, pose in samples),
            }
        )
    return players


def require_clean(replay: Replay) -> None:
    """Prevent inconsistent data from becoming a completed replay."""
    report = audit(replay)
    if report["errors"]:
        msg = f"Analysis quality checks failed: {report['errors']}"
        raise ValueError(msg)


def main() -> None:
    """Write one report covering every completed replay in the local library."""
    reports = [
        audit(replay)
        for item in store.list_replays()
        if (replay := store.get(item.id)) is not None and replay.status == "complete"
    ]
    target = Path(".data/verification/audit.json")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(reports, indent=2))
    sys.stdout.write(json.dumps(reports, indent=2) + "\n")
    if not reports or any(report["errors"] for report in reports):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
