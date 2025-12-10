from __future__ import annotations

import re
import shutil
from pathlib import Path
from typing import Iterable, Tuple

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "items"
RESOURCE_DIR = ROOT / "resource_pack" / "textures"
DEST_ITEMS = RESOURCE_DIR / "items"
DEST_BLOCKS = RESOURCE_DIR / "blocks"


def camel_to_snake(name: str) -> str:
    name = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", name)
    name = name.replace("__", "_")
    return name.lower()


def normalize_name(stem: str) -> Tuple[str, str]:
    cleaned = re.sub(r"[^A-Za-z0-9]+", "_", stem)
    cleaned = re.sub(r"^(item|block)_", "", cleaned, flags=re.IGNORECASE)
    cleaned = camel_to_snake(cleaned).strip("_")
    normalized = f"ic2_{cleaned}" if not cleaned.startswith("ic2_") else cleaned
    return normalized, cleaned


def discover_textures(base: Path) -> Iterable[Path]:
    return base.rglob("*.png")


def resolve_destination(stem: str, source_path: Path) -> Path:
    normalized, _ = normalize_name(stem)
    target_root = DEST_BLOCKS if "block" in stem.lower() or "blocks" in source_path.parts else DEST_ITEMS
    return target_root / f"{normalized}.png"


def copy_textures() -> None:
    copied = 0
    skipped = 0
    for texture in discover_textures(SOURCE_DIR):
        stem = texture.stem
        destination = resolve_destination(stem, texture)
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists():
            skipped += 1
            continue
        shutil.copy2(texture, destination)
        copied += 1
    print(f"Copied {copied} textures; skipped {skipped} existing files.")
    print(f"Sources scanned: {SOURCE_DIR}")
    print(f"Items output: {DEST_ITEMS}")
    print(f"Blocks output: {DEST_BLOCKS}")


if __name__ == "__main__":
    if not SOURCE_DIR.exists():
        raise SystemExit(f"Source texture folder not found: {SOURCE_DIR}")
    copy_textures()
