import { Player, ItemStack, Block, Vector3, world } from "@minecraft/server";

declare const console: { log: (...args: unknown[]) => void; error: (...args: unknown[]) => void };

/**
 * Electric Tools System for IC2 Bedrock
 * Handles electric tool functionality, durability, and energy consumption
 */
export class ElectricTools {
  private static readonly TOOLS = {
    electric_drill: { energyPerUse: 50, maxEnergy: 30000 },
    diamond_drill: { energyPerUse: 80, maxEnergy: 60000 },
    chainsaw: { energyPerUse: 100, maxEnergy: 30000 },
    electric_treetap: { energyPerUse: 50, maxEnergy: 10000 },
    electric_wrench: { energyPerUse: 20, maxEnergy: 10000 },
    mining_laser: { energyPerUse: 500, maxEnergy: 200000 }
  };

  /**
   * Check if item is an electric tool
   */
  static isElectricTool(item: ItemStack): boolean {
    if (!item) return false;
    const toolId = item.typeId;
    return toolId in this.TOOLS;
  }

  /**
   * Get tool energy data
   */
  static getToolData(toolId: string) {
    return this.TOOLS[toolId as keyof typeof this.TOOLS];
  }

  /**
   * Handle tool usage - consume energy and damage tool
   */
  static onToolUse(player: Player, item: ItemStack): boolean {
    const toolData = this.getToolData(item.typeId);
    if (!toolData) return true; // Allow normal usage

    // Check if tool has energy (using durability as energy storage)
    const currentEnergy = item.getComponent("minecraft:durability")?.damage || 0;
    const maxEnergy = toolData.maxEnergy;

    if (currentEnergy >= maxEnergy) {
      // Tool is out of energy - don't allow usage
      console.log(`Tool ${item.typeId} is out of energy`);
      return false;
    }

    // Consume energy
    const newDamage = Math.min(currentEnergy + toolData.energyPerUse, maxEnergy);
    const durabilityComponent = item.getComponent("minecraft:durability");
    if (durabilityComponent) {
      (durabilityComponent as any).damage = newDamage;
    }

    // Update player's inventory
    const inventory = player.getComponent("minecraft:inventory");
    const container = inventory?.container;
    if (container) {
      // Find and update the item in inventory
      for (let i = 0; i < container.size; i++) {
        const invItem = container.getItem(i);
        if (invItem?.typeId === item.typeId) {
          container.setItem(i, item);
          break;
        }
      }
    }

    console.log(`Tool ${item.typeId} used: ${toolData.energyPerUse} energy consumed`);
    return true;
  }

  /**
   * Handle mining laser special functionality
   */
  static onMiningLaserUse(player: Player, block: Block): void {
    // Mining laser can break multiple blocks at once
    const laserRange = 5;
    const center = block.location;

    for (let x = -laserRange; x <= laserRange; x++) {
      for (let y = -laserRange; y <= laserRange; y++) {
        for (let z = -laserRange; z <= laserRange; z++) {
          if (x === 0 && y === 0 && z === 0) continue; // Skip center block

          const targetPos = {
            x: center.x + x,
            y: center.y + y,
            z: center.z + z
          };

          const distance = Math.sqrt(x*x + y*y + z*z);
          if (distance <= laserRange) {
            const targetBlock = player.dimension.getBlock(targetPos);
            if (targetBlock && targetBlock.typeId !== "minecraft:bedrock" && targetBlock.typeId !== "minecraft:air") {
              player.dimension.runCommand(`setblock ${targetPos.x} ${targetPos.y} ${targetPos.z} air`);
            }
          }
        }
      }
    }
  }

  /**
   * Charge electric tools (placeholder for future charging station)
   */
  static chargeTool(item: ItemStack, energyAmount: number): void {
    const toolData = this.getToolData(item.typeId);
    if (!toolData) return;

    const durability = item.getComponent("minecraft:durability");
    if (durability) {
      const currentDamage = durability.damage || 0;
      const newDamage = Math.max(currentDamage - energyAmount, 0);
      durability.damage = newDamage;
    }
  }
}

