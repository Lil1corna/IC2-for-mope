#!/usr/bin/env python3
"""
Скрипт для извлечения и конвертации текстур IC2 из Java в Bedrock формат
"""
import os
import shutil
from pathlib import Path

# Пути
IC2_JAVA_TEXTURES = Path("/Users/h2oco303/Documents/kiro/industrialcraft-2-2.8.222-ex112.zip /assets/ic2/textures")
BEDROCK_TEXTURES = Path("/Users/h2oco303/Documents/kiro/IC2_Bedrock/resource_pack/textures")

# Маппинг текстур IC2 Java -> Bedrock
TEXTURE_MAPPING = {
    # Генераторы
    "blocks/generator/electric/generator_front.png": "blocks/generator/generator.png",
    "blocks/generator/electric/geo_generator_front.png": "blocks/generator/geo_generator.png",
    "blocks/generator/electric/solar_generator_top.png": "blocks/generator/solar.png",
    "blocks/generator/electric/wind_generator_front.png": "blocks/generator/wind.png",
    "blocks/generator/electric/water_generator_front.png": "blocks/generator/water.png",

    # Машины
    "blocks/machine/processing/basic/macerator_front_active.png": "blocks/machine/macerator_front.png",
    "blocks/machine/processing/basic/compressor_front_active.png": "blocks/machine/compressor_front.png",
    "blocks/machine/processing/basic/extractor_front_active.png": "blocks/machine/extractor_front.png",
    "blocks/machine/processing/basic/recycler_front.png": "blocks/machine/recycler_front.png",

    # Общие текстуры машин
    "blocks/machine.png": "blocks/general/machine/sides.png",
    "blocks/machine_top.png": "blocks/general/machine/top.png",
    "blocks/machine_bottom.png": "blocks/general/machine/bottom.png",

    # Руды
    "blocks/resource/tin_ore.png": "blocks/ore/tin_ore.png",
    "blocks/resource/lead_ore.png": "blocks/ore/lead_ore.png",
    "blocks/resource/uranium_ore.png": "blocks/ore/uranium_ore.png",
    "blocks/resource/copper_ore.png": "blocks/ore/copper_ore.png",

    # Deepslate руды (используем обычные пока нет deepslate версий)
    "blocks/resource/tin_ore.png": "blocks/ore/deepslate_tin_ore.png",
    "blocks/resource/lead_ore.png": "blocks/ore/deepslate_lead_ore.png",
    "blocks/resource/uranium_ore.png": "blocks/ore/deepslate_uranium_ore.png",

    # Блоки слитков
    "blocks/resource/tin_block.png": "blocks/ore/ingot_block/tin_block.png",
    "blocks/resource/lead_block.png": "blocks/ore/ingot_block/lead_block.png",
    "blocks/resource/bronze_block.png": "blocks/ore/ingot_block/bronze_block.png",
    "blocks/resource/steel_block.png": "blocks/ore/ingot_block/steel_block.png",
    "blocks/resource/uranium_block.png": "blocks/ore/ingot_block/uranium_bottomtop.png",
}

def extract_textures():
    """Извлекает и копирует текстуры"""
    copied = 0
    skipped = 0

    print("🔄 Начинаю извлечение текстур IC2...")

    for java_path, bedrock_path in TEXTURE_MAPPING.items():
        java_full_path = IC2_JAVA_TEXTURES / java_path
        bedrock_full_path = BEDROCK_TEXTURES / bedrock_path

        if java_full_path.exists():
            # Создаем директорию если не существует
            bedrock_full_path.parent.mkdir(parents=True, exist_ok=True)

            # Копируем файл
            shutil.copy2(java_full_path, bedrock_full_path)
            print(f"✅ {java_path} -> {bedrock_path}")
            copied += 1
        else:
            print(f"❌ Файл не найден: {java_path}")
            skipped += 1

    # Ищем дополнительные текстуры машин
    machine_dir = IC2_JAVA_TEXTURES / "blocks" / "machine" / "processing" / "basic"
    if machine_dir.exists():
        for png_file in machine_dir.glob("*.png"):
            filename = png_file.name
            if any(machine in filename for machine in ["macerator", "compressor", "extractor", "recycler"]):
                bedrock_machine_path = BEDROCK_TEXTURES / "blocks" / "machine" / filename
                bedrock_machine_path.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(png_file, bedrock_machine_path)
                print(f"✅ Дополнительная текстура машины: {filename}")
                copied += 1

    # Копируем текстуры предметов
    item_mapping = {
        "tool/electric/drill.png": "items/tool/general/drill.png",
        "tool/electric/diamond_drill.png": "items/tool/general/diamond_drill.png",
        "tool/electric/chainsaw.png": "items/tool/general/chainsaw.png",
        "tool/electric/electric_wrench.png": "items/tool/general/electric_wrench.png",
        "armor/nano_helmet.png": "items/armor/nanosuit_helmet.png",
        "armor/nano_chestplate.png": "items/armor/nanosuit_chestplate.png",
        "armor/nano_leggings.png": "items/armor/nanosuit_leggings.png",
        "armor/nano_boots.png": "items/armor/nanosuit_boots.png",
        "armor/quantum_helmet.png": "items/armor/quantumsuit_helmet.png",
        "armor/quantum_chestplate.png": "items/armor/quantumsuit_chestplate.png",
        "armor/quantum_leggings.png": "items/armor/quantumsuit_leggings.png",
        "armor/quantum_boots.png": "items/armor/quantumsuit_boots.png",
    }

    for java_item_path, bedrock_item_path in item_mapping.items():
        java_full_path = IC2_JAVA_TEXTURES / "items" / java_item_path
        bedrock_full_path = BEDROCK_TEXTURES / bedrock_item_path

        if java_full_path.exists():
            bedrock_full_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(java_full_path, bedrock_full_path)
            print(f"✅ Текстура предмета: {java_item_path} -> {bedrock_item_path}")
            copied += 1
        else:
            print(f"❌ Текстура предмета не найдена: {java_item_path}")
            skipped += 1

    print(f"\n📊 Результат: {copied} файлов скопировано, {skipped} пропущено")
    return copied, skipped

if __name__ == "__main__":
    extract_textures()
