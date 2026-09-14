# Copyright (c) 2026 Connor Gasgarth
"""Verify frame timestamps survive video preparation."""

from fractions import Fraction
from typing import TYPE_CHECKING

import av
import numpy as np
import pytest
from replay.analysis.media import prepare, validate_source

if TYPE_CHECKING:
    from pathlib import Path


def test_video_preparation_preserves_duration(tmp_path: Path) -> None:
    """Decode a real encoded fixture and retain its frame rate and duration."""
    source = tmp_path / "source.mp4"
    with av.open(str(source), "w") as output:
        stream = output.add_stream("libx264", rate=25)  # pyright: ignore[reportUnknownMemberType]
        stream.width, stream.height, stream.pix_fmt = 320, 180, "yuv420p"
        for index in range(10):
            image = np.full((180, 320, 3), index * 20, dtype=np.uint8)
            frame = av.VideoFrame.from_ndarray(image, format="rgb24")
            frame.pts, frame.time_base = index, Fraction(1, 25)
            for packet in stream.encode(frame):  # pyright: ignore[reportUnknownMemberType, reportUnknownVariableType]
                output.mux(packet)  # pyright: ignore[reportUnknownMemberType]
        for packet in stream.encode():  # pyright: ignore[reportUnknownMemberType, reportUnknownVariableType]
            output.mux(packet)  # pyright: ignore[reportUnknownMemberType]
    width, height, fps, duration = prepare(source, tmp_path / "preview.mp4", tmp_path / "thumb.jpg")
    assert (width, height) == (320, 180)
    assert fps == 25
    assert duration == pytest.approx(0.4)
    with av.open(str(tmp_path / "preview.mp4")) as video:
        timestamps = [frame.time for frame in video.decode(video=0)]
    assert timestamps == pytest.approx([index / 25 for index in range(10)])


@pytest.mark.parametrize(
    ("width", "height", "fps", "valid"),
    [(1920, 1080, 60, True), (1280, 720, 60, False), (1920, 1080, 30, False)],
)
def test_minimum_source_specs(
    tmp_path: Path, width: int, height: int, fps: int, *, valid: bool
) -> None:
    """Check source metadata without allowing an override to bypass the minimum."""
    source = tmp_path / "specs.mp4"
    with av.open(str(source), "w") as output:
        stream = output.add_stream("libx264", rate=fps)  # pyright: ignore[reportUnknownMemberType]
        stream.width, stream.height, stream.pix_fmt = width, height, "yuv420p"
        for index in range(3):
            frame = av.VideoFrame.from_ndarray(
                np.zeros((height, width, 3), dtype=np.uint8), format="rgb24"
            )
            frame.pts, frame.time_base = index, Fraction(1, fps)
            for packet in stream.encode(frame):  # pyright: ignore[reportUnknownMemberType, reportUnknownVariableType]
                output.mux(packet)  # pyright: ignore[reportUnknownMemberType]
        for packet in stream.encode():  # pyright: ignore[reportUnknownMemberType, reportUnknownVariableType]
            output.mux(packet)  # pyright: ignore[reportUnknownMemberType]
    if valid:
        validate_source(source)
    else:
        with pytest.raises(ValueError, match="Minimum"):
            validate_source(source)
