"""Harness adapters.

Only Pi ran in the Failure Discovery MVP, so it is the only adapter registered.
To add one: write adapters/<name>.py subclassing HarnessAdapter, call register()
at import time, and add one import line below.
"""

from .base import HarnessAdapter, get, known, register  # noqa: F401
from . import pi  # noqa: F401
