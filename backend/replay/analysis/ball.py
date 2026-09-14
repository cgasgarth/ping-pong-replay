# Copyright (c) 2026 Connor Gasgarth
"""Temporal ball detection using the published BlurBall model."""

from collections import deque
from typing import TYPE_CHECKING, cast

import cv2
import numpy as np
import torch

from replay.domain.models import Ball

if TYPE_CHECKING:
    from pathlib import Path

    from replay.analysis.geometry import Camera, ImageArray


FRAME_WINDOW = 3
MIN_CONFIDENCE = 0.55


class BallDetector:
    """Three-frame neural inference; no synthetic replacement detections."""

    def __init__(self, path: Path, device: str) -> None:
        """Load the locally exported TorchScript model."""
        self.device = device
        self.model = torch.export.load(path).module().to(device)
        self.history: deque[torch.Tensor] = deque(maxlen=3)

    def detect(self, image: ImageArray, camera: Camera) -> Ball | None:
        """Return the latest-frame heatmap peak when confidence is sufficient."""
        resized = cv2.resize(cv2.cvtColor(image, cv2.COLOR_BGR2RGB), (512, 288))
        pixels = resized.astype(np.float32) / 255
        normalized = (pixels - np.array([0.485, 0.456, 0.406], dtype=np.float32)) / np.array(
            [0.229, 0.224, 0.225],
            dtype=np.float32,
        )
        self.history.append(torch.tensor(normalized.transpose(2, 0, 1)))
        if len(self.history) < FRAME_WINDOW:
            return None
        tensor = torch.cat(list(self.history)).unsqueeze(0).to(self.device)
        with torch.inference_mode():
            result = cast("torch.Tensor", self.model(tensor))
        heatmap = result[0, -1].sigmoid().cpu().numpy()
        confidence = float(heatmap.max())
        if confidence < MIN_CONFIDENCE:
            return None
        row, column = np.unravel_index(heatmap.argmax(), heatmap.shape)
        u, v = float(column / 512), float(row / 288)
        world = camera.on_plane(u, v, 0.8)
        return Ball(u=u, v=v, x=float(world[0]), y=0.8, z=float(world[2]), confidence=confidence)
