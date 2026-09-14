# Copyright (c) 2026 Connor Gasgarth
"""Camera calibration and perspective-aware world placement."""

import math

import cv2
import numpy as np
from numpy.typing import NDArray

from replay.domain.models import Point

FloatArray = NDArray[np.float64]
ImageArray = NDArray[np.uint8]


TABLE_CORNERS = 4
MIN_PIXEL_AREA = 100
EPSILON = 1e-6


def detect_table(image: ImageArray) -> list[Point]:
    """Find a large colored quadrilateral; return no guess if none is found."""
    height, width = image.shape[:2]
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, np.array([35, 35, 35]), np.array([170, 255, 255]))
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for contour in sorted(contours, key=cv2.contourArea, reverse=True):
        area = cv2.contourArea(contour)
        if not width * height * 0.035 < area < width * height * 0.65:
            continue
        polygon = cv2.approxPolyDP(
            contour,
            0.035 * cv2.arcLength(contour, closed=True),
            closed=True,
        )
        if len(polygon) != TABLE_CORNERS or not cv2.isContourConvex(polygon):
            continue
        points = polygon.reshape(4, 2)
        ordered = sorted(points.tolist(), key=lambda point: point[1])
        top = sorted(ordered[:2], key=lambda point: point[0])
        bottom = sorted(ordered[2:], key=lambda point: point[0], reverse=True)
        return [Point(x=float(x / width), y=float(y / height)) for x, y in top + bottom]
    return []


class Camera:
    """Pinhole camera calibrated to a standard 2.74 by 1.525 meter table."""

    def __init__(self, corners: list[Point], width: int, height: int) -> None:
        """Estimate extrinsics with an approximate focal length."""
        self.width = width
        self.height = height
        focal = float(max(width, height) * 1.2)
        self.intrinsics: FloatArray = np.array(
            [[focal, 0, width / 2], [0, focal, height / 2], [0, 0, 1]],
            dtype=np.float64,
        )
        world: FloatArray = np.array(
            [
                [-1.37, 0.76, -0.7625],
                [1.37, 0.76, -0.7625],
                [1.37, 0.76, 0.7625],
                [-1.37, 0.76, 0.7625],
            ],
            dtype=np.float64,
        )
        pixels: FloatArray = np.array([[p.x * width, p.y * height] for p in corners])
        if (
            len(corners) != TABLE_CORNERS
            or abs(cv2.contourArea(pixels.astype(np.float32))) < MIN_PIXEL_AREA
        ):
            msg = "Select four distinct table corners before analysis."
            raise ValueError(msg)
        ok, rotation, translation = cv2.solvePnP(world, pixels, self.intrinsics, None)
        if not ok:
            msg = "Camera calibration failed. Check the table corners."
            raise ValueError(msg)
        self.rotation = cv2.Rodrigues(rotation)[0]
        self.translation = translation.reshape(3)
        self.origin = -self.rotation.T @ self.translation
        self.inverse = np.linalg.inv(self.intrinsics)

    def on_plane(self, u: float, v: float, height: float = 0) -> FloatArray:
        """Intersect an image ray with a horizontal world plane."""
        ray = self.rotation.T @ self.inverse @ np.array([u * self.width, v * self.height, 1])
        divisor = float(ray[1])
        if abs(divisor) < EPSILON:
            return np.array([0, height, 0], dtype=np.float64)
        point = self.origin + ray * ((height - self.origin[1]) / divisor)
        return np.clip(point, -8, 8)


def angle(a: FloatArray, b: FloatArray, c: FloatArray) -> float | None:
    """Return the joint angle, or no value for a degenerate joint."""
    first, second = a - b, c - b
    denominator = float(np.linalg.norm(first) * np.linalg.norm(second))
    if denominator < EPSILON:
        return None
    cosine = float(np.clip(np.dot(first, second) / denominator, -1, 1))
    return round(math.degrees(math.acos(cosine)), 1)
