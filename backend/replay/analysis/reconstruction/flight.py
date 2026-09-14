# Copyright (c) 2026 Connor Gasgarth
"""Physics-constrained monocular ball lifting with reprojection checks."""

from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    from replay.analysis.geometry import Camera, FloatArray
    from replay.domain.models import Frame

MIN_SAMPLES = 6
MAX_ERROR_PIXELS = 4
MAX_WINDOW_SECONDS = 0.35
MAX_CONDITION = 1e6
MIN_HEIGHT = 0.76
MAX_HEIGHT = 2.5
MAX_SPEED = 35
MAX_LENGTH = 4
MAX_DEPTH = 2.5
EPSILON = 1e-6
GRAVITY: FloatArray = np.array([0, -9.81, 0])


def fit(window: list[Frame], time: float, projection: FloatArray, camera: Camera) -> FloatArray:
    """Solve ballistic initial position and velocity from image rays."""
    equations: list[FloatArray] = []
    targets: list[float] = []
    for sample in window:
        ball = sample.ball
        if ball is None:
            continue
        delta = sample.time - time
        gravity = 0.5 * GRAVITY * delta**2
        for axis, pixel in ((0, ball.u * camera.width), (1, ball.v * camera.height)):
            row = projection[axis] - pixel * projection[2]
            equations.append(np.concatenate((row[:3], row[:3] * delta)))
            targets.append(float(-row[3] - np.dot(row[:3], gravity)))
    matrix = np.array(equations)
    if np.linalg.cond(matrix) > MAX_CONDITION:
        return np.zeros(6)
    return np.linalg.lstsq(matrix, np.array(targets), rcond=None)[0]


def error_pixels(
    window: list[Frame], time: float, solution: FloatArray, projection: FloatArray, camera: Camera
) -> float:
    """Measure the worst reprojection residual for a flight fit."""
    errors: list[float] = []
    for sample in window:
        ball = sample.ball
        if ball is None:
            continue
        delta = sample.time - time
        estimated = solution[:3] + solution[3:] * delta + 0.5 * GRAVITY * delta**2
        projected = projection @ np.append(estimated, 1)
        if abs(projected[2]) < EPSILON:
            return float("inf")
        pixel: FloatArray = projected[:2] / projected[2]
        errors.append(
            float(np.linalg.norm(pixel - np.array([ball.u * camera.width, ball.v * camera.height])))
        )
    return max(errors, default=float("inf"))


def reconstruct(frames: list[Frame], camera: Camera) -> float:
    """Fit short ballistic arcs; rejected fits retain labeled plane projections."""
    observations = [frame for frame in frames if frame.ball is not None]
    fitted = 0
    projection = camera.intrinsics @ np.column_stack((camera.rotation, camera.translation))
    for index, frame in enumerate(observations):
        window = observations[max(0, index - 3) : index + 4]
        if len(window) < MIN_SAMPLES or window[-1].time - window[0].time > MAX_WINDOW_SECONDS:
            continue
        solution = fit(window, frame.time, projection, camera)
        point, velocity = solution[:3], solution[3:]
        if not MIN_HEIGHT <= point[1] <= MAX_HEIGHT or np.linalg.norm(velocity) > MAX_SPEED:
            continue
        if abs(point[0]) > MAX_LENGTH or abs(point[2]) > MAX_DEPTH:
            continue
        error = error_pixels(window, frame.time, solution, projection, camera)
        if error > MAX_ERROR_PIXELS or frame.ball is None:
            continue
        frame.ball.x = float(point[0])
        frame.ball.y = float(point[1])
        frame.ball.z = float(point[2])
        frame.ball.mode = "flight-fit"
        fitted += 1
    return fitted / max(1, len(observations))
