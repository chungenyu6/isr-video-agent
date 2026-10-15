"""Leak guard shared by the exporter (at write time) and the validator (on disk).

A bundle is published to a public site. These strings must never reach it:
host paths, credential-shaped keys, loopback service URLs, and any reference to
the private label directory.
"""

from __future__ import annotations

import re

HARD_FORBIDDEN = (
    "/home/", "/workspace/", "/root/", "/tmp/", "auth.json", "apiKey", "api_key",
    "Authorization", "Bearer ", "token-file", "127.0.0.1", "localhost",
)
#: Oracle paths may appear only inside a refusal message.
SOFT_FORBIDDEN = ("data/labels", "oracle.json", "data/source")
DENIED_RE = re.compile(r"Permission denied|EACCES|Operation not permitted", re.IGNORECASE)


def leaks(blob: str) -> list[str]:
    found = []
    for needle in HARD_FORBIDDEN:
        if (i := blob.find(needle)) != -1:
            found.append(f"contains {needle!r} near {blob[max(0, i - 60): i + 60]!r}")
    for needle in SOFT_FORBIDDEN:
        start = 0
        while (i := blob.find(needle, start)) != -1:
            start = i + len(needle)
            if not DENIED_RE.search(blob[max(0, i - 160): i + 240]):
                found.append(f"unrefused reference to {needle!r}")
                break
    return found
