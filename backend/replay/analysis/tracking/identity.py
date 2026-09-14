# Copyright (c) 2026 Connor Gasgarth
"""Lock match participants so spectators cannot replace missing players."""

from dataclasses import dataclass
from typing import TYPE_CHECKING

import cv2
import numpy as np
import torch

if TYPE_CHECKING:
    from ultralytics.engine.results import Results

    from replay.analysis.geometry import Camera, FloatArray, ImageArray

MAX_SIDEWAYS = 1.8
MAX_END_DISTANCE = 3.5
MIN_END_POSITION = 0.8
REIDENTIFICATION_DISTANCE = 0.25
ACTIVE_APPEARANCE_DISTANCE = 0.75


@dataclass
class Detection:
    """One tracked person with a court-space anchor and appearance signature."""

    identity: int
    box: tuple[int, int, int, int]
    keypoints: FloatArray
    floor: tuple[float, float]
    appearance: FloatArray


def detections(result: Results, image: ImageArray, camera: Camera) -> list[Detection]:
    """Read typed model results and compute a torso-color signature."""
    boxes, keypoints = result.boxes, result.keypoints
    if boxes is None or boxes.id is None or keypoints is None:
        return []
    raw = boxes.xyxy
    positions = np.asarray(
        raw.cpu().numpy() if isinstance(raw, torch.Tensor) else raw, dtype=np.float64
    )
    raw_ids = boxes.id
    identities = np.asarray(raw_ids.cpu().numpy() if isinstance(raw_ids, torch.Tensor) else raw_ids)
    raw_points = keypoints.data
    points = np.asarray(
        raw_points.cpu().numpy() if isinstance(raw_points, torch.Tensor) else raw_points,
        dtype=np.float64,
    )
    found: list[Detection] = []
    for index in range(len(positions)):
        x1, y1, x2, y2 = (int(positions[index, axis]) for axis in range(4))
        anchor = camera.on_plane((x1 + x2) / 2 / camera.width, y2 / camera.height)
        crop = image[
            max(0, y1) : min(camera.height, y1 + (y2 - y1) * 2 // 3),
            max(0, x1) : min(camera.width, x2),
        ]
        if crop.size == 0:
            continue
        hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
        histogram = cv2.calcHist([hsv], [0, 1], None, [12, 8], [0, 180, 0, 256])
        signature = np.asarray(histogram.flatten(), dtype=np.float64)
        signature /= max(float(signature.sum()), 1)
        found.append(
            Detection(
                int(identities[index]),
                (x1, y1, x2, y2),
                points[index],
                (float(anchor[0]), float(anchor[2])),
                signature,
            )
        )
    return found


class PlayerLocks:
    """Keep two player identities; only appearance-matched re-entry can rebind."""

    def __init__(self) -> None:
        """Start without any selected participants."""
        self.identities: dict[int, int] = {}
        self.profiles: dict[int, FloatArray] = {}

    def current_match(
        self, candidates: list[Detection], player: int, identity: int
    ) -> Detection | None:
        """Reject appearance changes even when the underlying tracker reuses an ID."""
        match = next((item for item in candidates if item.identity == identity), None)
        if match is not None:
            distance = float(
                np.linalg.norm(np.sqrt(match.appearance) - np.sqrt(self.profiles[player]))
            )
            if distance > ACTIVE_APPEARANCE_DISTANCE:
                return None
        return match

    def select(self, candidates: list[Detection]) -> list[tuple[int, Detection]]:
        """Ignore judges and spectators even when their boxes are larger."""
        eligible = [
            candidate
            for candidate in candidates
            if abs(candidate.floor[1]) < MAX_SIDEWAYS
            and MIN_END_POSITION < abs(candidate.floor[0]) < 1.37 + MAX_END_DISTANCE
        ]
        if not self.identities:
            by_side = [
                [item for item in eligible if (item.floor[0] < 0) == (side == 0)] for side in (0, 1)
            ]
            if all(by_side):
                for player, options in enumerate(by_side):
                    chosen = min(
                        options,
                        key=lambda item: (abs(item.floor[0]) - 1.8) ** 2 + item.floor[1] ** 2,
                    )
                    self.identities[player] = chosen.identity
                    self.profiles[player] = chosen.appearance
        selected: list[tuple[int, Detection]] = []
        used: set[int] = set()
        for player, identity in list(self.identities.items()):
            match = self.current_match(candidates, player, identity)
            if match is None:
                alternatives = [
                    item
                    for item in eligible
                    if item.identity not in self.identities.values() and item.identity not in used
                ]
                for item in alternatives:
                    distance = float(
                        np.linalg.norm(np.sqrt(item.appearance) - np.sqrt(self.profiles[player]))
                    )
                    if distance < REIDENTIFICATION_DISTANCE:
                        match = item
                        self.identities[player] = item.identity
                        break
            if match is not None:
                selected.append((player, match))
                used.add(match.identity)
        return selected
