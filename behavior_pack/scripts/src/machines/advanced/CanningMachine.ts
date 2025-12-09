import { Player, Block, Vector3, ItemStack } from "@minecraft/server";

declare const console: { log: (...args: unknown[]) => void; error: (...args: unknown[]) => void };

/**
 * Canning Machine - for filling containers with fluids and upgrading batteries
 */
export class CanningMachine {
  private static readonly RECIPES = {
    // Empty cell + fluid source = filled cell
    filling: {
      "minecraft:water_bucket": "ic2:hydration_cell",
      "minecraft:lava_bucket": "ic2:lava_cell",
      "ic2:empty_cell": {
        "minecraft:water_bucket": "ic2:water_cell",
        "minecraft:lava_bucket": "ic2:lava_cell"
      }
    },

    // Battery upgrades
    upgrading: {
      "ic2:energy_crystal": "ic2:lapotron_crystal",
      "ic2:batbox": "ic2:cesu",
      "ic2:cesu": "ic2:mfe",
      "ic2:mfe": "ic2:mfsu"
    }
  };

  private static readonly ENERGY_PER_OPERATION = 400; // EU per operation
  private static readonly PROCESS_TIME = 400; // ticks

  /**
   * Process items in Canning Machine
   */
  static processItems(input1: ItemStack, input2: ItemStack): { output: ItemStack | null, mode: string } {
    // Try filling mode
    if (this.canFill(input1, input2)) {
      return {
        output: this.fillItem(input1, input2),
        mode: "filling"
      };
    }

    // Try upgrading mode
    if (this.canUpgrade(input1, input2)) {
      return {
        output: this.upgradeItem(input1, input2),
        mode: "upgrading"
      };
    }

    return { output: null, mode: "none" };
  }

  /**
   * Check if can fill container
   */
  private static canFill(container: ItemStack, fluid: ItemStack): boolean {
    if (!container || !fluid) return false;

    const fillingRecipes = this.RECIPES.filling as Record<string, any>;
    if (container.typeId in fillingRecipes) {
      const containerRecipes = fillingRecipes[container.typeId];
      if (typeof containerRecipes === 'string') {
        return fluid.typeId === containerRecipes;
      } else {
        return fluid.typeId in containerRecipes;
      }
    }

    return false;
  }

  /**
   * Check if can upgrade item
   */
  private static canUpgrade(item: ItemStack, upgrade: ItemStack): boolean {
    if (!item || !upgrade) return false;

    // For now, upgrading doesn't require a second item
    // Could be extended to require specific upgrade materials
    return item.typeId in this.RECIPES.upgrading;
  }

  /**
   * Fill container with fluid
   */
  private static fillItem(container: ItemStack, fluid: ItemStack): ItemStack | null {
    const fillingRecipes = this.RECIPES.filling as Record<string, any>;

    if (container.typeId in fillingRecipes) {
      const containerRecipes = fillingRecipes[container.typeId];
      if (typeof containerRecipes === 'string') {
        return new ItemStack(containerRecipes, 1);
      } else {
        const result = containerRecipes[fluid.typeId];
        if (result) {
          return new ItemStack(result, 1);
        }
      }
    }

    return null;
  }

  /**
   * Upgrade item
   */
  private static upgradeItem(item: ItemStack, upgrade: ItemStack): ItemStack | null {
    const upgradeRecipes = this.RECIPES.upgrading;
    const resultId = upgradeRecipes[item.typeId as keyof typeof upgradeRecipes];

    if (resultId) {
      return new ItemStack(resultId, 1);
    }

    return null;
  }

  /**
   * Get energy consumption
   */
  static getEnergyConsumption(): number {
    return this.ENERGY_PER_OPERATION;
  }

  /**
   * Get process time
   */
  static getProcessTime(): number {
    return this.PROCESS_TIME;
  }
}

