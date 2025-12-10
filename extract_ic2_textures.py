#!/usr/bin/env python3
"""Утилита копирования текстур IC2 в Bedrock-ресурс.

Скрипт покрывает заранее известные соответствия файлов и гарантирует, что
в каталоге Bedrock-пака появятся все ожидаемые PNG: реальные копии, либо
автоматические заглушки. Для страховки дополнительно копируются все найденные
PNG из `blocks/` и `items/` Java-ресурса.
"""

from __future__ import annotations

import argparse
import os
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple


# Корень проекта и значения по умолчанию для путей ресурсов.
PROJECT_ROOT = Path(__file__).resolve().parent
DEFAULT_IC2_JAVA_TEXTURES = Path(os.getenv("IC2_JAVA_TEXTURES", PROJECT_ROOT / "items"))
DEFAULT_BEDROCK_TEXTURES = Path(
    os.getenv("BEDROCK_TEXTURES", PROJECT_ROOT / "resource_pack" / "textures")
)


# Простая 1x1 PNG-заглушка (пурпурный цвет). Храним байты прямо в коде,
# чтобы не зависеть от внешних файлов.
PLACEHOLDER_PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
    b"\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\x0cIDATx\x9ccddbf\x00\x00\x00\x82\x00\x81"
    b"\xb8\x91\xbb\x05\x00\x00\x00\x00IEND\xaeB`\x82"
)


@dataclass(frozen=True)
class Mapping:
    """Пара исходный->целевой путь в ресурсах."""

    source: Path
    destination: Path
    label: str


@dataclass
class Counters:
    """Статистика копирования."""

    mapped: int = 0
    placeholders: int = 0
    bulk: int = 0
    skipped_existing: int = 0
    missing_no_placeholder: int = 0

    def summary(self) -> str:
        return (
            f"{self.mapped} по маппингу, "
            f"{self.bulk} прямых копий, "
            f"{self.placeholders} заглушек, "
            f"{self.skipped_existing} пропущено (уже есть), "
            f"{self.missing_no_placeholder} без источника (без заглушки)"
        )


# Маппинг текстур IC2 Java -> Bedrock. Используем список, чтобы поддерживать
# дублирование одного источника в несколько целевых файлов.
RAW_TEXTURE_MAPPING: List[Tuple[str, str]] = [
    # Генераторы
    ("blocks/generator/electric/generator_front.png", "blocks/generator/generator.png"),
    ("blocks/generator/electric/geo_generator_front.png", "blocks/generator/geo_generator.png"),
    ("blocks/generator/electric/solar_generator_top.png", "blocks/generator/solar.png"),
    ("blocks/generator/electric/wind_generator_front.png", "blocks/generator/wind.png"),
    ("blocks/generator/electric/water_generator_front.png", "blocks/generator/water.png"),

    # Машины
    ("blocks/machine/processing/basic/macerator_front_active.png", "blocks/machine/macerator_front.png"),
    ("blocks/machine/processing/basic/compressor_front_active.png", "blocks/machine/compressor_front.png"),
    ("blocks/machine/processing/basic/extractor_front_active.png", "blocks/machine/extractor_front.png"),
    ("blocks/machine/processing/basic/recycler_front.png", "blocks/machine/recycler_front.png"),

    # Общие текстуры машин
    ("blocks/machine.png", "blocks/general/machine/sides.png"),
    ("blocks/machine_top.png", "blocks/general/machine/top.png"),
    ("blocks/machine_bottom.png", "blocks/general/machine/bottom.png"),

    # Руды
    ("blocks/resource/tin_ore.png", "blocks/ore/tin_ore.png"),
    ("blocks/resource/lead_ore.png", "blocks/ore/lead_ore.png"),
    ("blocks/resource/uranium_ore.png", "blocks/ore/uranium_ore.png"),
    ("blocks/resource/copper_ore.png", "blocks/ore/copper_ore.png"),

    # Deepslate руды (используем обычные пока нет deepslate версий)
    ("blocks/resource/tin_ore.png", "blocks/ore/deepslate_tin_ore.png"),
    ("blocks/resource/lead_ore.png", "blocks/ore/deepslate_lead_ore.png"),
    ("blocks/resource/uranium_ore.png", "blocks/ore/deepslate_uranium_ore.png"),
    ("blocks/resource/copper_ore.png", "blocks/ore/deepslate_copper_ore.png"),

    # Блоки слитков
    ("blocks/resource/tin_block.png", "blocks/ore/ingot_block/tin_block.png"),
    ("blocks/resource/lead_block.png", "blocks/ore/ingot_block/lead_block.png"),
    ("blocks/resource/bronze_block.png", "blocks/ore/ingot_block/bronze_block.png"),
    ("blocks/resource/steel_block.png", "blocks/ore/ingot_block/steel_block.png"),
    ("blocks/resource/uranium_block.png", "blocks/ore/ingot_block/uranium_bottomtop.png"),
]

RAW_ITEM_MAPPING: List[Tuple[str, str]] = [
    ("tool/electric/drill.png", "items/tool/general/drill.png"),
    ("tool/electric/diamond_drill.png", "items/tool/general/diamond_drill.png"),
    ("tool/electric/chainsaw.png", "items/tool/general/chainsaw.png"),
    ("tool/electric/electric_wrench.png", "items/tool/general/electric_wrench.png"),
    ("armor/nano_helmet.png", "items/armor/nanosuit_helmet.png"),
    ("armor/nano_chestplate.png", "items/armor/nanosuit_chestplate.png"),
    ("armor/nano_leggings.png", "items/armor/nanosuit_leggings.png"),
    ("armor/nano_boots.png", "items/armor/nanosuit_boots.png"),
    ("armor/quantum_helmet.png", "items/armor/quantumsuit_helmet.png"),
    ("armor/quantum_chestplate.png", "items/armor/quantumsuit_chestplate.png"),
    ("armor/quantum_leggings.png", "items/armor/quantumsuit_leggings.png"),
    ("armor/quantum_boots.png", "items/armor/quantumsuit_boots.png"),
]


def validate_directory(path: Path, name: str) -> Path:
    """Проверяет существование директории и возвращает Path."""

    if not path.exists():
        raise SystemExit(f"❌ Директория {name} не найдена: {path}")
    if not path.is_dir():
        raise SystemExit(f"❌ {name} должна быть директорией: {path}")
    return path


def build_mappings(java_root: Path, bedrock_root: Path) -> Tuple[List[Mapping], List[Mapping]]:
    """Возвращает списки маппингов для блоков и предметов."""

    textures = [
        Mapping(java_root / src, bedrock_root / dst, src)
        for src, dst in RAW_TEXTURE_MAPPING
    ]
    items = [
        Mapping(java_root / "items" / src, bedrock_root / dst, f"items/{src}")
        for src, dst in RAW_ITEM_MAPPING
    ]
    return textures, items


def write_placeholder(target: Path, label: str) -> None:
    """Создаёт заглушку, если файл отсутствует."""

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(PLACEHOLDER_PNG_BYTES)
    print(f"⚠️ Создана заглушка: {label}")


def copy_with_placeholder(
    mapping: Mapping,
    counters: Counters,
    allow_placeholder: bool,
    bedrock_root: Path,
) -> None:
    """Копирует ресурс или создаёт заглушку при отсутствии источника."""

    destination = mapping.destination
    source = mapping.source

    if destination.exists():
        print(f"↩️ Пропущено (уже есть): {destination.relative_to(bedrock_root)}")
        counters.skipped_existing += 1
        return

    if source.exists():
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        print(f"✅ {mapping.label} -> {destination.relative_to(bedrock_root)}")
        counters.mapped += 1
        return

    if allow_placeholder:
        write_placeholder(destination, mapping.label)
        counters.placeholders += 1
    else:
        print(f"❔ Источник не найден, заглушка отключена: {mapping.label}")
        counters.missing_no_placeholder += 1


def copy_machine_variants(java_root: Path, bedrock_root: Path, counters: Counters) -> None:
    """Ищет дополнительные текстуры машин и копирует их без заглушек."""

    machine_dir = java_root / "blocks" / "machine" / "processing" / "basic"
    if not machine_dir.exists():
        return

    wanted = ("macerator", "compressor", "extractor", "recycler")
    for png_file in machine_dir.glob("*.png"):
        if not any(key in png_file.name for key in wanted):
            continue

        destination = bedrock_root / "blocks" / "machine" / png_file.name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(png_file, destination)
        counters.mapped += 1
        print(f"✅ Доп. текстура машины: {png_file.name} -> blocks/machine/{png_file.name}")


def bulk_copy_pngs(source_root: Path, target_root: Path, counters: Counters) -> None:
    """Рекурсивно копирует все PNG из source_root в target_root."""

    if not source_root.exists():
        return

    for png in source_root.rglob("*.png"):
        relative = png.relative_to(source_root)
        destination = target_root / relative
        if destination.exists():
            counters.skipped_existing += 1
            continue

        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(png, destination)
        counters.bulk += 1


def extract_textures(
    java_root: Path,
    bedrock_root: Path,
    *,
    allow_placeholders: bool,
    skip_bulk: bool,
) -> Counters:
    """Извлекает и копирует текстуры."""

    counters = Counters()
    print("🔄 Начинаю извлечение текстур IC2...")

    texture_mappings, item_mappings = build_mappings(java_root, bedrock_root)

    for mapping in texture_mappings:
        copy_with_placeholder(mapping, counters, allow_placeholders, bedrock_root)

    copy_machine_variants(java_root, bedrock_root, counters)

    for mapping in item_mappings:
        copy_with_placeholder(mapping, counters, allow_placeholders, bedrock_root)

    if not skip_bulk:
        bulk_copy_pngs(java_root / "blocks", bedrock_root / "blocks", counters)
        bulk_copy_pngs(java_root / "items", bedrock_root / "items", counters)

    print(f"\n📊 Результат: {counters.summary()}")
    return counters


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Извлечение текстур IC2 в Bedrock-ресурс")
    parser.add_argument(
        "--java-textures",
        type=Path,
        default=DEFAULT_IC2_JAVA_TEXTURES,
        help=(
            "Путь к исходным текстурам IC2 Java. Можно задать через переменную окружения "
            "IC2_JAVA_TEXTURES."
        ),
    )
    parser.add_argument(
        "--bedrock-textures",
        type=Path,
        default=DEFAULT_BEDROCK_TEXTURES,
        help=(
            "Путь к директории текстур Bedrock. Можно задать через переменную окружения "
            "BEDROCK_TEXTURES."
        ),
    )
    parser.add_argument(
        "--no-placeholders",
        action="store_true",
        help="Не создавать заглушки для отсутствующих PNG (только логировать пропуски).",
    )
    parser.add_argument(
        "--skip-bulk",
        action="store_true",
        help="Не выполнять массовое копирование всех PNG из blocks/ и items/.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    java_root = validate_directory(args.java_textures, "IC2_JAVA_TEXTURES")
    bedrock_root = validate_directory(args.bedrock_textures, "BEDROCK_TEXTURES")

    extract_textures(
        java_root,
        bedrock_root,
        allow_placeholders=not args.no_placeholders,
        skip_bulk=args.skip_bulk,
    )


if __name__ == "__main__":
    main()
