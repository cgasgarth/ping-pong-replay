# Copyright (c) 2026 Connor Gasgarth
"""Published UpliftingTableTennis inference with geometric rejection checks."""

import importlib
import sys
from typing import TYPE_CHECKING, cast

import numpy as np
import torch
from torch import nn

if TYPE_CHECKING:
    from collections.abc import Callable
    from pathlib import Path

    from replay.analysis.geometry import Camera, FloatArray
    from replay.domain.models import Frame

REVERSAL_PRODUCT = -0.00002
MIN_DIRECTION = 0.002
SEQUENCE = 50
MIN_POINTS = 6
MAX_GAP = 0.2
MAX_REPROJECTION = 0.035
MIN_HEIGHT = 0.6
MAX_HEIGHT = 3.0
MAX_EXTENT = 6
TABLE: FloatArray = np.array(
    [
        [-1.37, 0.76, 0.7625],
        [-1.37, 0.76, -0.7625],
        [0, 0.76, 0.7625],
        [0, 0.76, -0.7625],
        [1.37, 0.76, 0.7625],
        [1.37, 0.76, -0.7625],
        [0, 0.76, 0.915],
        [0, 0.76, -0.915],
        [0, 0.76, 0],
        [0, 0.9125, 0.915],
        [0, 0.9125, -0.915],
        [-1.37, 0.76, 0],
        [1.37, 0.76, 0],
    ],
    dtype=np.float64,
)


class Uplifter:
    """Load the authors' network without their detection or training pipeline."""

    def __init__(self, data: Path, device: str) -> None:
        """Load source and weights whose checksums are verified during setup."""
        sys.path.insert(0, str(data / "vendor"))
        try:
            module = importlib.import_module("uplifting.model")
        finally:
            sys.path.pop(0)
        factory = cast("Callable[..., nn.Module]", module.get_model)
        self.model = factory("connectstage", "large", mode="dynamic", time_rotation="new")
        checkpoint = cast(
            "dict[str, object]",
            torch.load(
                data / "models" / "uplift.pt",
                weights_only=True,
                map_location="cpu",
            ),
        )
        self.model.load_state_dict(cast("dict[str, torch.Tensor]", checkpoint["model_state_dict"]))
        self.model.eval().to(device)
        self.device = device

    def predict(self, samples: list[Frame], table: torch.Tensor) -> FloatArray:
        """Lift a single shot, keeping padding separate from observations."""
        points = torch.zeros(1, SEQUENCE, 2, device=self.device)
        times = torch.zeros(1, SEQUENCE, device=self.device)
        mask = torch.zeros(1, SEQUENCE, device=self.device)
        for index, frame in enumerate(samples):
            if frame.ball is not None:
                points[0, index, 0] = frame.ball.u
                points[0, index, 1] = frame.ball.v
                times[0, index] = frame.time - samples[0].time
                mask[0, index] = 1
        with torch.inference_mode():
            _, result = cast(
                "tuple[torch.Tensor, torch.Tensor]", self.model(points, table, mask, times)
            )
        return np.asarray(result[0, : len(samples)].cpu().numpy(), dtype=np.float64)

    def reconstruct(self, frames: list[Frame], camera: Camera) -> float:
        """Keep learned positions only when they agree with visible detections."""
        projection = camera.intrinsics @ np.column_stack((camera.rotation, camera.translation))
        pixels = np.column_stack((TABLE, np.ones(len(TABLE)))) @ projection.T
        table = np.ones((1, 13, 3), dtype=np.float32)
        table[0, :, :2] = pixels[:, :2] / pixels[:, 2:3] / [camera.width, camera.height]
        table_tensor = torch.tensor(table, device=self.device)
        fitted = 0
        observations = [frame for frame in frames if frame.ball is not None]
        for group in shots(observations):
            if len(group) < MIN_POINTS:
                continue
            predicted = self.predict(group, table_tensor)
            for frame, estimate in zip(group, predicted, strict=True):
                point = np.array([estimate[0], estimate[2], estimate[1]])
                pixel = projection @ np.append(point, 1)
                if not np.isfinite(point).all() or not MIN_HEIGHT < point[1] < MAX_HEIGHT:
                    continue
                if np.abs(point).max() > MAX_EXTENT or pixel[2] <= 0 or frame.ball is None:
                    continue
                observed = np.array([frame.ball.u, frame.ball.v])
                projected = pixel[:2] / pixel[2] / [camera.width, camera.height]
                if np.linalg.norm(projected - observed) > MAX_REPROJECTION:
                    continue
                frame.ball.x = float(point[0])
                frame.ball.y = float(point[1])
                frame.ball.z = float(point[2])
                frame.ball.mode = "learned-3d"
                fitted += 1
        return fitted / max(1, len(observations))


def shots(observations: list[Frame]) -> list[list[Frame]]:
    """Split on gaps and clear horizontal reversals near player contact."""
    groups: list[list[Frame]] = []
    previous_direction = 0.0
    for index, frame in enumerate(observations):
        direction = 0.0
        if index > 0 and frame.ball is not None and observations[index - 1].ball is not None:
            previous_ball = observations[index - 1].ball
            if previous_ball is not None:
                direction = frame.ball.u - previous_ball.u
        reversal = direction * previous_direction < REVERSAL_PRODUCT
        if (
            not groups
            or len(groups[-1]) >= SEQUENCE - 1
            or frame.time - groups[-1][-1].time > MAX_GAP
        ):
            groups.append([])
        elif reversal and len(groups[-1]) >= MIN_POINTS:
            groups.append([groups[-1][-1]])
        groups[-1].append(frame)
        if abs(direction) > MIN_DIRECTION:
            previous_direction = direction
    return groups
