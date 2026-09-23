# Tarkov Atlas — original offline desktop companion.
# Application code Copyright (c) 2026 Tarkov Atlas contributors. MIT License.
from __future__ import annotations

import argparse
import json
import logging
import math
import os
import re
import sys
import threading
import time
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

APP_NAME = "Tarkov Atlas"
VERSION = "0.1.0"
PATTERN = re.compile(
    r"^[\d-]+\[[\d-]+\]_(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)_"
    r"(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)_",
    re.I,
)


def resources() -> Path:
    return Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))


def profile_dir() -> Path:
    folder = os.environ.get("LOCALAPPDATA", str(Path.home() / ".local" / "share"))
    result = Path(folder) / "Tarkov Atlas"
    result.mkdir(exist_ok=True, parents=True)
    return result


def profile_path() -> Path:
    return profile_dir() / "profile.json"


def screenshot_path() -> Path:
    settings_file = profile_dir() / "settings.json"
    try:
        settings = json.loads(settings_file.read_text(encoding="utf-8"))
        if settings.get("screenshots_dir"):
            return Path(settings["screenshots_dir"])
    except (OSError, ValueError, TypeError):
        pass
    return Path.home() / "Documents" / "Escape from Tarkov" / "Screenshots"


def parse_screenshot(name: str) -> dict | None:
    match = PATTERN.search(name)
    if not match:
        return None
    x, y, z, qx, qy, qz, qw = (float(v) for v in match.groups())
    if not all(math.isfinite(v) for v in (x, y, z, qx, qy, qz, qw)):
        return None
    sin_yaw = 2.0 * (qw * qy + qx * qz)
    cos_yaw = 1.0 - 2.0 * (qy * qy + qz * qz)
    yaw = math.degrees(math.atan2(sin_yaw, cos_yaw))
    return {"x": x, "y": y, "z": z, "yaw": round(yaw, 1), "file": name}


def self_test() -> None:
    base = resources() / "web"
    maps = json.loads((base / "data" / "maps.json").read_text(encoding="utf-8"))
    quests = json.loads((base / "data" / "quests.json").read_text(encoding="utf-8"))
    assert len(maps) == 11, f"Expected 11 offline maps, received {len(maps)}"
    assert len(quests) >= 500, f"Quest snapshot incomplete: {len(quests)}"
    for info in maps:
        path = base / "maps" / (info["key"] + ".svg")
        assert path.is_file() and path.stat().st_size > 10000, f"Map missing: {path}"
        assert info["width"] > 0 and info["height"] > 0
    sample = parse_screenshot(
        "2026-05-27[22-51]_-44.40, 25.75, 28.54_0.06418, 0.40166, -0.02823, 0.91310_6.76 (0).png"
    )
    assert sample is not None and sample["x"] == -44.4
    assert parse_screenshot("random.png") is None
    print(f"PASS: {len(maps)} SVG maps, {len(quests)} quests, screenshot coordinate parser")


class AtlasHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(resources() / "web"), **kwargs)

    def list_directory(self, path):
        self.send_error(403, "Directory listing disabled")
        return None

    def log_message(self, format, *args):
        logging.debug(format, *args)


WINDOW = None


class Bridge:
    def __init__(self):
        self.last_screenshot_signature = None

    def get_settings(self):
        return {"version": VERSION, "screenshots_dir": str(screenshot_path())}

    def set_screenshots_dir(self, directory: str):
        p = Path(directory).expanduser()
        if not p.is_dir():
            return {"ok": False, "error": "Эта папка не существует"}
        dest = profile_dir() / "settings.json"
        dest.write_text(json.dumps({"screenshots_dir": str(p)}, ensure_ascii=False), encoding="utf-8")
        self.last_screenshot_signature = None
        return {"ok": True, "screenshots_dir": str(p)}

    def choose_screenshots_dir(self):
        try:
            import webview
            selected = WINDOW.create_file_dialog(webview.FOLDER_DIALOG)
            if selected:
                return self.set_screenshots_dir(selected[0])
            return {"ok": False, "cancelled": True}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def poll_screenshot(self):
        directory = screenshot_path()
        if not directory.is_dir():
            return {"ok": False, "error": f"Не найдена папка: {directory}"}
        try:
            recent = sorted(
                (p for p in directory.glob("*.png") if p.is_file()),
                key=lambda p: p.stat().st_mtime_ns, reverse=True,
            )[:25]
            for file in recent:
                result = parse_screenshot(file.name)
                if result is None:
                    continue
                signature = (str(file), file.stat().st_mtime_ns)
                if signature == self.last_screenshot_signature:
                    return {"ok": True, "changed": False}
                self.last_screenshot_signature = signature
                result["timestamp"] = file.stat().st_mtime
                # The user's screenshots are never deleted or modified.
                return {"ok": True, "changed": True, "position": result}
            return {"ok": False, "error": "В папке пока нет позиционных скриншотов"}
        except OSError as exc:
            return {"ok": False, "error": str(exc)}

    def load_profile(self):
        try:
            data = json.loads(profile_path().read_text(encoding="utf-8"))
            return data if isinstance(data, dict) else {}
        except (OSError, ValueError, TypeError):
            return {}

    def save_profile(self, payload: dict):
        if not isinstance(payload, dict):
            return {"ok": False, "error": "Некорректный профиль"}
        raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        if len(raw.encode("utf-8")) > 4_000_000:
            return {"ok": False, "error": "Слишком большой профиль"}
        tmp = profile_path().with_suffix(".tmp")
        tmp.write_text(raw, encoding="utf-8")
        tmp.replace(profile_path())
        return {"ok": True}

    def export_profile(self, payload: dict):
        try:
            import webview
            selected = WINDOW.create_file_dialog(
                webview.SAVE_DIALOG,
                save_filename="tarkov-atlas-progress.json",
                file_types=("JSON (*.json)",),
            )
            if not selected:
                return {"ok": False, "cancelled": True}
            Path(selected).write_text(
                json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            return {"ok": True}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def import_profile(self):
        try:
            import webview
            selected = WINDOW.create_file_dialog(
                webview.OPEN_DIALOG, file_types=("JSON (*.json)",)
            )
            if not selected:
                return {"ok": False, "cancelled": True}
            data = json.loads(Path(selected[0]).read_text(encoding="utf-8"))
            if not isinstance(data, dict) or data.get("format") != "tarkov-atlas-1":
                return {"ok": False, "error": "Это не профиль Tarkov Atlas"}
            return {"ok": True, "profile": data}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}


def main():
    parser = argparse.ArgumentParser(description=APP_NAME)
    parser.add_argument("--self-test", action="store_true", help="Validate offline data assets")
    parser.add_argument("--browser", action="store_true", help="Open the app in a web browser")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    server = ThreadingHTTPServer(("127.0.0.1", 0), AtlasHandler)
    url = f"http://127.0.0.1:{server.server_port}/"
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try:
        if args.browser:
            webbrowser.open(url)
            print(f"Tarkov Atlas: {url}")
            try:
                while True:
                    time.sleep(10)
            except KeyboardInterrupt:
                return
        else:
            import webview
            global WINDOW
            WINDOW = webview.create_window(
                APP_NAME, url, js_api=Bridge(),
                width=1480, height=900, min_size=(1024, 680),
                background_color="#101419",
            )
            webview.start(gui="edgechromium", debug=False)
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
