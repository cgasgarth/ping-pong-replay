# Copyright (c) 2026 Connor Gasgarth
"""Single-worker analysis queue with persisted progress."""

import logging
import platform
import time
from concurrent.futures import ThreadPoolExecutor

import av
import numpy as np

from replay.analysis.geometry import Camera
from replay.analysis.media import validate_source
from replay.analysis.reconstruction.flight import reconstruct
from replay.analysis.reconstruction.learned import Uplifter
from replay.analysis.tracking.temporal import smooth
from replay.analysis.vision import Vision
from replay.domain import store
from replay.domain.metrics import rallies, statistics
from replay.domain.models import Analysis, Frame
from replay.quality.audit import require_clean

POOL = ThreadPoolExecutor(max_workers=1, thread_name_prefix="rallylab")
LOGGER = logging.getLogger(__name__)


def require_mac() -> None:
    """Restrict analysis to macOS."""
    if platform.system() != "Darwin":
        msg = "Video analysis requires macOS."
        raise RuntimeError(msg)


def analyze(replay_id: str) -> None:
    """Decode every source frame and persist the measured replay."""
    replay = store.get(replay_id, include_analysis=False)
    if replay is None:
        return
    vision: Vision | None = None
    try:
        require_mac()
        validate_source(store.DATA / "videos" / replay_id / "source")
        replay.status, replay.progress, replay.error = "analyzing", 0, None
        store.save(replay)
        start = time.monotonic()
        camera = Camera(replay.corners, replay.width, replay.height)
        vision = Vision(store.DATA / "models")
        frames: list[Frame] = []
        pose_interval = max(1, round((replay.fps_override or replay.fps) / 30))
        with av.open(str(store.DATA / "videos" / replay_id / "source")) as container:
            stream = container.streams.video[0]
            first_time: float | None = None
            for index, frame in enumerate(container.decode(stream)):
                source_time = float(frame.time)
                if first_time is None:
                    first_time = source_time
                timestamp = (
                    index / replay.fps_override if replay.fps_override else source_time - first_time
                )
                image = np.asarray(frame.to_ndarray(format="bgr24"), dtype=np.uint8)
                players = (
                    vision.players(image, camera, timestamp) if index % pose_interval == 0 else []
                )
                ball = vision.ball(image, camera)
                frames.append(Frame(time=timestamp, players=players, ball=ball))
                if index % 15 == 0:
                    replay.progress = min(0.99, index / max(1, stream.frames))
                    store.save(replay)
        duration = frames[-1].time + 1 / (replay.fps_override or replay.fps) if frames else 0
        smooth(frames)
        flight_coverage = reconstruct(frames, camera)
        learned_coverage = Uplifter(store.DATA, vision.device).reconstruct(frames, camera)
        result = Analysis(
            frames=frames,
            rallies=rallies(frames, duration),
            stats=statistics(frames),
            ball_coverage=sum(frame.ball is not None for frame in frames) / max(1, len(frames)),
            pose_coverage=sum(pose.state != "held" for frame in frames for pose in frame.players)
            / max(1, len(frames) / pose_interval * 2),
            device=f"YOLO26 + BlurBall: {vision.device.upper()} · Apple Vision: native",
            elapsed=round(time.monotonic() - start, 1),
            notes=[
                "Visible joints follow image rays. Depth and hidden limbs are inferred.",
                "Table calibration uses an approximate camera focal length.",
                (
                    "BoT-SORT identity locks and confidence-weighted smoothing are applied. "
                    "Short occlusions retain a fading track."
                ),
                f"Learned 3D ball positions accepted for {learned_coverage:.0%} of detections.",
                (
                    f"Ball height: {flight_coverage:.0%} of detections fit ballistic flight; "
                    "remaining points project to the table plane."
                ),
                "Serve markers and winners are estimates. Unsupported outcomes stay uncertain.",
                "Joint metrics exclude low-confidence or table-occluded joints and held poses.",
                "The original video is retained. The playback copy has no audio.",
            ],
        )
        replay.analysis = result
        require_clean(replay)
        replay.status, replay.progress = "complete", 1
        store.save(replay, result)
    except Exception as error:
        LOGGER.exception("Analysis failed for %s", replay_id)
        replay.status, replay.error = "failed", str(error)
        store.save(replay)
    finally:
        if vision is not None:
            vision.close()
