# Copyright (c) 2026 Connor Gasgarth
"""Persistent YOLO/BoT-SORT identities with native Apple Vision 3D pose."""

import base64
import math
import subprocess
from typing import TYPE_CHECKING

import cv2
import numpy as np
import torch
from ultralytics import YOLO

from replay.analysis.ball import BallDetector
from replay.analysis.geometry import Camera, FloatArray, ImageArray, angle
from replay.analysis.reconstruction.body import world_pose
from replay.analysis.tracking.identity import PlayerLocks, detections
from replay.analysis.tracking.limbs import retain_hidden
from replay.analysis.tracking.root import root_position, table_occludes
from replay.domain.models import Ball, Contract, Joint, PlayerPose

if TYPE_CHECKING:
    from pathlib import Path

    from replay.analysis.tracking.identity import Detection

PERSIST_SECONDS = 0.65
VISIBLE_JOINT = 0.45


class NativeResult(Contract):
    """Validated JSON at the native process boundary."""

    joints: list[Joint]
    error: str | None = None


class Vision:
    """Reuse models, player locks, and per-player state for the full recording."""

    def __init__(self, models: Path) -> None:
        """Start local GPU tracking and the native pose worker."""
        self.device = "mps" if torch.backends.mps.is_available() else "cpu"
        self.pose_model = YOLO(str(models / "yolo26s-pose.pt"))
        self.tracker = str(models.parents[1] / "config" / "tracking" / "botsort.yaml")
        self.ball_model = BallDetector(models / "blurball.pt2", self.device)
        self.native = subprocess.Popen(  # noqa: S603 - Fixed app-built binary; images use stdin.
            [str(models / "pose-native")],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
        self.locks = PlayerLocks()
        self.previous: dict[int, PlayerPose] = {}
        self.roots: dict[int, FloatArray] = {}
        self.seen: dict[int, float] = {}

    def close(self) -> None:
        """Release the native process after the final frame."""
        if self.native.stdin is not None:
            self.native.stdin.close()
        self.native.wait(timeout=10)
        if self.native.stdout is not None:
            self.native.stdout.close()

    def ball(self, image: ImageArray, camera: Camera) -> Ball | None:
        """Detect the ball from consecutive source frames."""
        return self.ball_model.detect(image, camera)

    def infer(self, crop: ImageArray) -> NativeResult:
        """Exchange one crop with Apple's native pose detector."""
        ok, encoded = cv2.imencode(".jpg", crop)
        if not ok or self.native.stdin is None or self.native.stdout is None:
            msg = "Cannot encode player crop."
            raise RuntimeError(msg)
        self.native.stdin.write(base64.b64encode(encoded).decode("ascii") + "\n")
        self.native.stdin.flush()
        output = self.native.stdout.readline()
        if not output:
            msg = "The Apple Vision worker stopped unexpectedly."
            raise RuntimeError(msg)
        result = NativeResult.model_validate_json(output)
        if result.error is not None:
            raise RuntimeError(result.error)
        return result

    def pose(
        self, player: int, detection: Detection, image: ImageArray, camera: Camera, time: float
    ) -> PlayerPose | None:
        """Keep hidden limbs anchored to the last supported pose."""
        x1, y1, x2, y2 = detection.box
        padding = int((y2 - y1) * 0.2)
        x1, y1 = max(0, x1 - padding), max(0, y1 - padding)
        x2, y2 = min(camera.width, x2 + padding), min(camera.height, y2 + padding)
        if x2 <= x1 or y2 <= y1:
            return None
        previous = self.previous.get(player)
        result = self.infer(image[y1:y2, x1:x2])
        previous_root = self.roots[player] if previous is not None else None
        root = root_position(
            detection, camera, previous, time - self.seen.get(player, time), previous_root
        )
        if not result.joints:
            if previous is None:
                return None
            pose = previous.model_copy(deep=True)
            shift = root - self.roots[player]
            for joint in pose.joints:
                joint.x += float(shift[0])
                joint.z += float(shift[2])
            pose.state = "partial"
        else:
            world = world_pose(result.joints, camera, detection, root)
            for index, joint in enumerate(result.joints):
                joint.x, joint.y, joint.z = (
                    float(world[index, 0]),
                    float(world[index, 1]),
                    float(world[index, 2]),
                )
                joint.u = float(detection.keypoints[index, 0] / camera.width)
                joint.v = float(detection.keypoints[index, 1] / camera.height)
                joint.confidence = float(np.clip(detection.keypoints[index, 2], 0, 1))
                if index in (13, 14, 15, 16) and table_occludes(
                    camera,
                    float(detection.keypoints[index, 0]),
                    float(detection.keypoints[index, 1]),
                ):
                    joint.confidence = 0
                if previous is not None and joint.confidence < VISIBLE_JOINT:
                    retain_hidden(index, result.joints, previous, root - self.roots[player])
            left, right = result.joints[15:17]
            pose = PlayerPose(
                player=player,
                joints=result.joints,
                elbow=angle(world[6], world[8], world[10]),
                knee=angle(world[12], world[14], world[16]),
                stance=math.dist((left.x, left.y, left.z), (right.x, right.y, right.z)),
                state="partial"
                if any(joint.confidence < VISIBLE_JOINT for joint in result.joints[5:])
                else "observed",
            )
        self.previous[player] = pose.model_copy(deep=True)
        self.roots[player] = root.copy()
        self.seen[player] = time
        return pose

    def players(self, image: ImageArray, camera: Camera, time: float) -> list[PlayerPose]:
        """Never substitute a spectator for a temporarily missing participant."""
        results = self.pose_model.track(  # pyright: ignore[reportUnknownMemberType]
            image,
            device=self.device,
            conf=0.2,
            verbose=False,
            imgsz=960,
            persist=True,
            tracker=self.tracker,
        )
        selected = self.locks.select(detections(results[0], image, camera))
        poses = [
            pose
            for player, detection in selected
            if (pose := self.pose(player, detection, image, camera, time)) is not None
        ]
        present = {pose.player for pose in poses}
        for player, previous in self.previous.items():
            elapsed = time - self.seen[player]
            if player not in present and elapsed <= PERSIST_SECONDS:
                held = previous.model_copy(deep=True)
                held.state = "held"
                for joint in held.joints:
                    joint.confidence *= max(0, 1 - elapsed / PERSIST_SECONDS)
                poses.append(held)
        return poses
