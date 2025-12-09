#!/usr/bin/env python3
"""
Генератор placeholder-текстур для IC2 Bedrock
Создаёт цветные 16x16 PNG с буквами для идентификации
"""

import os
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Установите Pillow: pip install Pillow")
    exit(1)

# Базовый путь
BASE_PATH = Path(__file__).parent / "resource_pack" / "textures"

# Цвета для разных категорий
COLORS = {
    "generator": (100, 100, 100),      # Серый
    "machine": (120, 120, 120),        # Светло-серый
    "cable": (180, 120, 60),           # Медный
    "ore": (139, 119, 101),            # Каменный
    "rubber": (80, 60, 40),            # Коричневый
    "dust": (200, 180, 150),           # Песочный
    "ingot": (220, 150, 50),           # Золотистый
    "circuit": (50, 150, 50),          # Зелёный
    "armor_nano": (50, 50, 80),        # Тёмно-синий
    "armor_quantum": (100, 200, 255),  # Голубой
    "reactor": (50, 200, 50),          # Ярко-зелёный
    "ui": (60, 60, 60),                # Тёмно-серый
}

# Специфичные цвета для материалов
MATERIAL_COLORS = {
    "copper": (184, 115, 51),
    "tin": (180, 180, 180),
    "lead": (70, 70, 90),
    "uranium": (50, 200, 50),
    "gold": (255, 215, 0),
    "iron": (200, 200, 200),
    "bronze": (205, 127, 50),
    "coal": (40, 40, 40),
    "rubber": (30, 30, 30),
}

def get_color(name: str) -> tuple:
    """Определяет цвет по имени текстуры"""
    name_lower = name.lower()
    
    # Проверяем материалы
    for material, color in MATERIAL_COLORS.items():
        if material in name_lower:
            return color
    
    # Проверяем категории
    if "generator" in name_lower or "solar" in name_lower or "wind" in name_lower:
        return COLORS["generator"]
    if "macerator" in name_lower or "furnace" in name_lower or "compressor" in name_lower or "extractor" in name_lower or "recycler" in name_lower:
        return COLORS["machine"]
    if "cable" in name_lower:
        return COLORS["cable"]
    if "ore" in name_lower:
        return COLORS["ore"]
    if "rubber" in name_lower or "resin" in name_lower:
        return COLORS["rubber"]
    if "dust" in name_lower:
        return COLORS["dust"]
    if "ingot" in name_lower or "plate" in name_lower:
        return COLORS["ingot"]
    if "circuit" in name_lower:
        return COLORS["circuit"]
    if "nano" in name_lower:
        return COLORS["armor_nano"]
    if "quantum" in name_lower:
        return COLORS["armor_quantum"]
    if "reactor" in name_lower or "uranium_cell" in name_lower or "heat" in name_lower or "coolant" in name_lower:
        return COLORS["reactor"]
    
    return (128, 128, 128)  # Серый по умолчанию

def create_texture(name: str, size: int = 16) -> Image.Image:
    """Создаёт placeholder-текстуру"""
    color = get_color(name)
    img = Image.new("RGBA", (size, size), color + (255,))
    draw = ImageDraw.Draw(img)
    
    # Добавляем рамку
    border_color = tuple(max(0, c - 40) for c in color) + (255,)
    draw.rectangle([0, 0, size-1, size-1], outline=border_color)
    
    # Добавляем букву в центр
    letter = name[0].upper()
    try:
        # Пытаемся использовать системный шрифт
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 10)
    except:
        font = ImageFont.load_default()
    
    # Центрируем букву
    bbox = draw.textbbox((0, 0), letter, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (size - text_width) // 2
    y = (size - text_height) // 2 - 1
    
    # Цвет текста - контрастный
    brightness = sum(color) / 3
    text_color = (255, 255, 255, 255) if brightness < 128 else (0, 0, 0, 255)
    draw.text((x, y), letter, fill=text_color, font=font)
    
    return img

def create_active_texture(name: str, size: int = 16) -> Image.Image:
    """Создаёт активную версию текстуры (с оранжевым свечением)"""
    img = create_texture(name, size)
    draw = ImageDraw.Draw(img)
    
    # Добавляем оранжевую точку в центре (индикатор активности)
    center = size // 2
    draw.ellipse([center-2, center-2, center+2, center+2], fill=(255, 150, 0, 255))
    
    return img

# Текстуры блоков
BLOCK_TEXTURES = [
    # Генераторы
    "generator_front", "generator_front_active", "generator_side", "generator_top",
    "geothermal_generator_front", "geothermal_generator_front_active", "geothermal_generator_side", "geothermal_generator_top",
    "solar_panel_top", "solar_panel_side", "solar_panel_bottom",
    "wind_mill_rotor", "wind_mill_side", "wind_mill_top",
    
    # Машины
    "macerator_front", "macerator_front_active", "macerator_side", "macerator_top",
    "electric_furnace_front", "electric_furnace_front_active", "electric_furnace_side", "electric_furnace_top",
    "compressor_front", "compressor_front_active", "compressor_side", "compressor_top",
    "extractor_front", "extractor_front_active", "extractor_side", "extractor_top",
    "recycler_front", "recycler_front_active", "recycler_side", "recycler_top",
    "nuclear_reactor_front", "nuclear_reactor_front_active", "nuclear_reactor_side", "nuclear_reactor_top",
    "machine_case",
    
    # Кабели
    "tin_cable", "tin_cable_insulated",
    "copper_cable", "copper_cable_insulated",
    "gold_cable", "gold_cable_insulated_1x", "gold_cable_insulated_2x",
    "iron_cable", "iron_cable_insulated_1x", "iron_cable_insulated_2x", "iron_cable_insulated_3x",
    "glass_fibre_cable",
    
    # Руды
    "copper_ore", "tin_ore", "lead_ore", "uranium_ore",
    
    # Каучуковое дерево
    "rubber_wood", "rubber_wood_top", "rubber_wood_resin_wet", "rubber_wood_resin_dry",
    "rubber_leaves", "rubber_sapling",
]

# Текстуры предметов
ITEM_TEXTURES = [
    # Пыль
    "copper_dust", "tin_dust", "lead_dust", "uranium_dust", "coal_dust",
    
    # Слитки
    "copper_ingot", "tin_ingot", "lead_ingot", "bronze_ingot",
    
    # Дроблёные руды
    "crushed_copper_ore", "crushed_tin_ore", "crushed_lead_ore", "crushed_iron_ore", "crushed_gold_ore",
    
    # Компоненты
    "rubber", "sticky_resin", "electronic_circuit", "advanced_circuit",
    "battery", "machine_case", "iron_plate", "copper_plate", "tin_plate", "scrap",
    
    # Инструменты
    "treetap", "wrench",
    
    # Реактор
    "uranium_cell", "depleted_uranium_cell",
    "heat_vent", "reactor_heat_vent", "overclocked_heat_vent",
    "component_heat_exchanger", "coolant_cell",
    
    # Броня
    "nanosuit_helmet", "nanosuit_chestplate", "nanosuit_leggings", "nanosuit_boots",
    "quantumsuit_helmet", "quantumsuit_chestplate", "quantumsuit_leggings", "quantumsuit_boots",
]

# UI текстуры
UI_TEXTURES = [
    "energy_bar_empty", "energy_bar_full",
    "progress_arrow_empty", "progress_arrow_full",
    "slot_input", "slot_output", "slot_fuel", "slot_battery", "slot_reactor",
]

def main():
    print("Генерация placeholder-текстур для IC2 Bedrock...")
    
    # Создаём директории
    blocks_dir = BASE_PATH / "blocks"
    items_dir = BASE_PATH / "items"
    ui_dir = BASE_PATH / "ui"
    
    blocks_dir.mkdir(parents=True, exist_ok=True)
    items_dir.mkdir(parents=True, exist_ok=True)
    ui_dir.mkdir(parents=True, exist_ok=True)
    
    # Генерируем текстуры блоков
    print(f"\nБлоки ({len(BLOCK_TEXTURES)}):")
    for name in BLOCK_TEXTURES:
        filepath = blocks_dir / f"{name}.png"
        if "active" in name:
            img = create_active_texture(name)
        else:
            img = create_texture(name)
        img.save(filepath)
        print(f"  ✓ {name}.png")
    
    # Генерируем текстуры предметов
    print(f"\nПредметы ({len(ITEM_TEXTURES)}):")
    for name in ITEM_TEXTURES:
        filepath = items_dir / f"{name}.png"
        img = create_texture(name)
        img.save(filepath)
        print(f"  ✓ {name}.png")
    
    # Генерируем UI текстуры
    print(f"\nUI ({len(UI_TEXTURES)}):")
    for name in UI_TEXTURES:
        filepath = ui_dir / f"{name}.png"
        img = create_texture(name)
        img.save(filepath)
        print(f"  ✓ {name}.png")
    
    total = len(BLOCK_TEXTURES) + len(ITEM_TEXTURES) + len(UI_TEXTURES)
    print(f"\n✅ Готово! Создано {total} текстур.")
    print("\nТеперь можно тестировать аддон в Minecraft Bedrock!")

if __name__ == "__main__":
    main()
