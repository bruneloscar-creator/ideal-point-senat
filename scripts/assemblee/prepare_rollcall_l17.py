#!/usr/bin/env python3
"""Backward-compatible wrapper → prepare_rollcall.py --legislature 17."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

script = Path(__file__).with_name("prepare_rollcall.py")
raise SystemExit(subprocess.call([sys.executable, str(script), "--legislature", "17", *sys.argv[1:]]))
