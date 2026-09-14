# Copyright (c) 2026 Connor Gasgarth
"""Download one verified model from a large upstream ZIP using HTTP ranges."""

import hashlib
import sys
from pathlib import Path

from remotezip import RemoteZip  # pyright: ignore[reportMissingTypeStubs]


def download(url: str, member: str, destination: Path, expected: str) -> None:
    """Fetch only the selected member and check its SHA-256 digest."""
    with RemoteZip(url) as archive:
        data = archive.read(member)
    if hashlib.sha256(data).hexdigest() != expected:
        msg = "Archive member checksum mismatch."
        raise ValueError(msg)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)


if __name__ == "__main__":
    download(sys.argv[1], sys.argv[2], Path(sys.argv[3]), sys.argv[4])
