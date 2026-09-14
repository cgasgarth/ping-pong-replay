# Copyright (c) 2026 Connor Gasgarth
"""Video decoding and browser-compatible preview generation."""

from fractions import Fraction
from itertools import pairwise
from typing import TYPE_CHECKING, cast

import av
import cv2

if TYPE_CHECKING:
    from collections.abc import Callable
    from pathlib import Path


def prepare(source: Path, preview: Path, thumbnail: Path) -> tuple[int, int, float, float]:
    """Read actual timestamps and encode a silent H.264 playback copy."""
    with av.open(str(source)) as container:
        stream = container.streams.video[0]
        rate = float(stream.average_rate or stream.guessed_rate or 30)
        width, height = stream.width, stream.height
        duration = 0.0
        with av.open(str(preview), mode="w") as output:
            encoder = output.add_stream("libx264", rate=stream.average_rate or 30)  # pyright: ignore[reportUnknownMemberType]
            scale = min(1.0, 1280 / width)
            encoder.width = int(width * scale) // 2 * 2
            encoder.height = int(height * scale) // 2 * 2
            encoder.pix_fmt = "yuv420p"
            encoder.options = {"crf": "23", "preset": "veryfast"}
            encoder.time_base = Fraction(1, 90000)
            encode = cast(
                "Callable[[av.VideoFrame | None], list[av.Packet[av.VideoStream]]]",
                encoder.encode,  # pyright: ignore[reportUnknownMemberType]
            )
            mux = cast("Callable[[av.Packet[av.VideoStream]], None]", output.mux)  # pyright: ignore[reportUnknownMemberType]
            first_time: float | None = None
            for frame in container.decode(stream):
                timestamp = float(frame.time)
                if first_time is None:
                    first_time = timestamp
                    cv2.imwrite(str(thumbnail), frame.to_ndarray(format="bgr24"))
                duration = timestamp - first_time + 1 / rate
                converted = frame.reformat(encoder.width, encoder.height, format="yuv420p")
                converted.pts = round((timestamp - first_time) * 90000)
                converted.time_base = Fraction(1, 90000)
                for packet in encode(converted):
                    mux(packet)
            for packet in encode(None):
                mux(packet)
    if duration <= 0:
        msg = "The video has no decodable frames."
        raise ValueError(msg)
    return width, height, rate, duration


MIN_FPS = 60
MIN_FRAMES = 2
MIN_SHORT_EDGE = 1080
MIN_LONG_EDGE = 1920


def validate_source(source: Path) -> None:
    """Reject sources below 1080p or 60 fps before import or analysis."""
    with av.open(str(source)) as container:
        stream = container.streams.video[0]
        fps = float(stream.average_rate or stream.guessed_rate or 0)
        width, height = stream.width, stream.height
        if min(width, height) < MIN_SHORT_EDGE or max(width, height) < MIN_LONG_EDGE:
            msg = f"Minimum resolution is 1080p (1920 x 1080). This video is {width} x {height}."
            raise ValueError(msg)
        if fps < MIN_FPS:
            msg = f"Minimum source frame rate is 60 fps. This video is {fps:.2f} fps."
            raise ValueError(msg)
        validate_timestamps([float(frame.time) for frame in container.decode(stream)])


def validate_timestamps(times: list[float]) -> float:
    """Check decoded cadence independently of the advertised stream rate."""
    if len(times) < MIN_FRAMES:
        msg = "Video must contain at least two timestamped frames."
        raise ValueError(msg)
    gaps = [second - first for first, second in pairwise(times)]
    if any(gap <= 0 for gap in gaps):
        msg = "Video timestamps must increase for every decoded frame."
        raise ValueError(msg)
    rate = (len(times) - 1) / (times[-1] - times[0])
    tolerance = 0.000001
    if rate + tolerance < MIN_FPS:
        msg = f"Minimum decoded frame rate is 60 fps. This video decodes at {rate:.2f} fps."
        raise ValueError(msg)
    return rate
