import { Player, Block, Vector3, ItemStack } from "@minecraft/server";

declare const console: { log: (...args: unknown[]) => void; error: (...args: unknown[]) => void };

/**
 * Blast Furnace - for smelting steel and advanced metals
 */
export class BlastFurnace {
  private static readonly RECIPES = {
    // Iron to Steel conversion (requires coal)
    "minecraft:iron_ingot": {
      fuel: "minecraft:coal",
      output: "ic2:steel_ingot",
      time: 1200, // 60 seconds
      energy: 1200 // EU
    },

    // Refined Iron processing
    "ic2:refined_iron": {
      fuel: "minecraft:coal",
      output: "ic2:steel_ingot",
      time: 800,
      energy: 800
    },

    // Advanced alloy creation
    "ic2:steel_ingot": {
      fuel: "minecraft:coal",
      output: "ic2:advanced_alloy",
      time: 2400,
      energy: 2400
    }
  };

  /**
   * Process items in Blast Furnace
   */
  static processItems(input: ItemStack, fuel: ItemStack): { output: ItemStack | null, time: number, energy: number } | null {
    if (!input || !fuel) return null;

    const recipe = this.RECIPES[input.typeId as keyof typeof this.RECIPES];
    if (!recipe || fuel.typeId !== recipe.fuel) return null;

    return {
      output: new ItemStack(recipe.output, 1),
      time: recipe.time,
      energy: recipe.energy
    };
  }

  /**
   * Check if Blast Furnace can process the given items
   */
  static canProcess(input: ItemStack, fuel: ItemStack): boolean {
    if (!input || !fuel) return false;

    const recipe = this.RECIPES[input.typeId as keyof typeof this.RECIPES];
    return recipe && fuel.typeId === recipe.fuel;
  }

  /**
   * Get all available recipes
   */
  static getRecipes() {
    return this.RECIPES;
  }

  /**
   * Get recipe for specific input
   */
  static getRecipe(inputId: string) {
    return this.RECIPES[inputId as keyof typeof this.RECIPES];
  }
}

