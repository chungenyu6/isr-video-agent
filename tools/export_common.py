"""Helpers shared by the V4.2 and V5.0 allowlist exporters.

Nothing here opens a file on its own; each exporter decides what it reads.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.dont_write_bytecode = True

from PIL import Image  # noqa: E402

CLASSES = {1: "bicycle", 2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}


def jl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def r1(x: float) -> float:
    return round(float(x), 1)


def jpeg(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    Image.open(src).convert("RGB").save(dst, "JPEG", quality=85, optimize=True)
