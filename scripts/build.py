#!/usr/bin/env python3
"""
DataScope build script.
Copies the static assets into a self-contained `dist/` folder that can be
served by any static file server or opened directly. Zero runtime dependencies.
"""
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
DIST = os.path.join(ROOT, "dist")

FILES = ["index.html", "src/css/style.css", "src/js/parser.js", "src/js/utils.js", "src/js/app.js"]


def main():
    if os.path.exists(DIST):
        shutil.rmtree(DIST)
    for f in FILES:
        src_path = os.path.join(ROOT, f)
        dst_path = os.path.join(DIST, f)
        os.makedirs(os.path.dirname(dst_path), exist_ok=True)
        shutil.copy2(src_path, dst_path)
        print(f"  ✓ {f}")
    print(f"\nBuild complete → {DIST}")
    print("Serve with:  python3 -m http.server 8000 --directory dist")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)