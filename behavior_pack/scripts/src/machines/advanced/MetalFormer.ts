import { Player, Block, Vector3, ItemStack } from "@minecraft/server";

declare const console: { log: (...args: unknown[]) => void; error: (...args: unknown[]) => void };

/**
 * Metal Former - advanced machine for shaping metals
 * Modes: Cutting (plates), Extruding (rods), Rolling (cables)
 */
export enum MetalFormerMode {
  CUTTING = "cutting",
  EXTRUDING = "extruding",
  ROLLING = "rolling"
}

export class MetalFormer {
  private static readonly RECIPES = {
    // Cutting mode - plates from ingots
    cutting: {
      "minecraft:iron_ingot": "ic2:steel_plate",
      "ic2:refined_iron": "ic2:steel_plate",
      "minecraft:gold_ingot": "ic2:gold_plate",
      "minecraft:copper_ingot": "ic2:copper_plate",
      "ic2:bronze_ingot": "ic2:bronze_plate",
      "ic2:tin_ingot": "ic2:tin_plate",
      "minecraft:diamond": "ic2:carbon_plate"
    },

    // Extruding mode - rods/cables from ingots
    extruding: {
      "minecraft:iron_ingot": "ic2:iron_cable",
      "minecraft:copper_ingot": "ic2:copper_cable",
      "minecraft:gold_ingot": "ic2:gold_cable",
      "ic2:tin_ingot": "ic2:tin_cable"
    },

    // Rolling mode - advanced processing
    rolling: {
      "ic2:copper_plate": "ic2:copper_cable",
      "ic2:gold_plate": "ic2:gold_cable",
      "ic2:iron_plate": "ic2:iron_cable",
      "ic2:tin_plate": "ic2:tin_cable",
      "ic2:steel_plate": "ic2:steel_plate" // Special processing
    }
  };

  private static readonly ENERGY_PER_OPERATION = 240; // 10 EU/t * 24 ticks
  private static readonly PROCESS_TIME = 240; // 24 ticks at 10 EU/t

  /**
   * Process item in Metal Former
   */
  static processItem(inputItem: ItemStack, mode: MetalFormerMode): ItemStack | null {
    const recipes = this.RECIPES[mode] as Record<string, string>;
    if (!recipes || !inputItem) return null;

    const resultId = recipes[inputItem.typeId];
    if (!resultId) return null;

    // Create output item
    const outputItem = new ItemStack(resultId, 1);
    return outputItem;
  }

  /**
   * Check if Metal Former can process the given item in the given mode
   */
  static canProcess(inputItem: ItemStack, mode: MetalFormerMode): boolean {
    const recipes = this.RECIPES[mode];
    return recipes && inputItem && inputItem.typeId in recipes;
  }

  /**
   * Get processing time for current operation
   */
  static getProcessTime(): number {
    return this.PROCESS_TIME;
  }

  /**
   * Get energy consumption per operation
   */
  static getEnergyConsumption(): number {
    return this.ENERGY_PER_OPERATION;
  }

  /**
   * Get available modes
   */
  static getModes(): MetalFormerMode[] {
    return [MetalFormerMode.CUTTING, MetalFormerMode.EXTRUDING, MetalFormerMode.ROLLING];
  }

  /**
   * Get mode display name
   */
  static getModeName(mode: MetalFormerMode): string {
    switch (mode) {
      case MetalFormerMode.CUTTING: return "Cutting";
      case MetalFormerMode.EXTRUDING: return "Extruding";
      case MetalFormerMode.ROLLING: return "Rolling";
      default: return "Unknown";
    }
  }

  /**
   * Get recipes for a specific mode
   */
  static getRecipesForMode(mode: MetalFormerMode) {
    return this.RECIPES[mode] || {};
  }
}

