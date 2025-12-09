import { Block, Vector3, world } from "@minecraft/server";

declare const console: { log: (...args: unknown[]) => void; error: (...args: unknown[]) => void };

/**
 * Nuclear Reactor - Core component of IC2
 * Simulates nuclear fission reactions
 */
export class NuclearReactor {
  private static readonly REACTOR_SIZE = 6; // 6x6 internal grid
  private static readonly MAX_HEAT = 10000;

  /**
   * Process reactor tick
   */
  static onReactorTick(block: Block): void {
    try {
      const location = block.location;
      const dimension = block.dimension;

      // Check if reactor is properly formed
      if (!this.isValidReactorStructure(location, dimension)) {
        this.setReactorActive(block, false);
        return;
      }

      // Get reactor components
      const components = this.getReactorComponents(location, dimension);

      // Calculate heat and EU generation
      const { heat, euOutput } = this.simulateReactorCycle(components);

      // Update reactor state
      this.updateReactorState(block, heat, euOutput);

      // Handle overheating
      if (heat > this.MAX_HEAT * 0.9) {
        this.handleOverheating(block, heat);
      }

    } catch (error) {
      console.error("Nuclear reactor tick error:", error);
    }
  }

  /**
   * Check if reactor structure is valid
   */
  private static isValidReactorStructure(center: Vector3, dimension: any): boolean {
    // Check for reactor chamber blocks forming a 3x3x3 structure
    // This is simplified - in real IC2 it's more complex
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const block = dimension.getBlock({
            x: center.x + x,
            y: center.y + y,
            z: center.z + z
          });

          // Center must be reactor, others must be chambers
          if (x === 0 && y === 0 && z === 0) {
            if (block.typeId !== "ic2:nuclear_reactor") return false;
          } else {
            if (block.typeId !== "ic2:reactor_chamber") return false;
          }
        }
      }
    }
    return true;
  }

  /**
   * Get reactor components from inventory
   */
  private static getReactorComponents(center: Vector3, dimension: any): any[] {
    const reactorBlock = dimension.getBlock(center);
    const inventory = reactorBlock.getComponent("minecraft:inventory");

    if (!inventory) return [];

    const components: any[] = [];
    for (let i = 0; i < inventory.inventorySize; i++) {
      const item = inventory.container.getItem(i);
      if (item) {
        components.push({
          type: item.typeId,
          durability: item.getComponent("minecraft:durability")?.damage || 0,
          maxDurability: item.getComponent("minecraft:durability")?.maxDurability || 1
        });
      } else {
        components.push(null);
      }
    }

    return components;
  }

  /**
   * Simulate one reactor cycle
   */
  private static simulateReactorCycle(components: any[]): { heat: number, euOutput: number } {
    let totalHeat = 0;
    let totalEU = 0;

    components.forEach(component => {
      if (component && component.type === "ic2:uranium_fuel_rod") {
        // Simulate fuel rod behavior
        const depletion = component.durability / component.maxDurability;
        const efficiency = 1 - depletion;

        // Heat generation
        totalHeat += 100 * efficiency;

        // EU generation (simplified)
        totalEU += 5 * efficiency;
      }
    });

    return { heat: totalHeat, euOutput: totalEU };
  }

  /**
   * Update reactor block state
   */
  private static updateReactorState(block: Block, heat: number, euOutput: number): void {
    const isActive = euOutput > 0;
    const heatLevel = Math.min(10, Math.floor((heat / this.MAX_HEAT) * 10));

    // Update block states
    let permutation = block.permutation
      .withState("ic2:active" as any, isActive)
      .withState("ic2:heat" as any, heatLevel);

    block.setPermutation(permutation);
  }

  /**
   * Handle reactor overheating
   */
  private static handleOverheating(block: Block, heat: number): void {
    if (heat > this.MAX_HEAT) {
      // Reactor meltdown - explosion!
      const location = block.location;
      const dimension = block.dimension;

      dimension.createExplosion(location, 10, {
        breaksBlocks: true,
        causesFire: true
      });

      console.error("NUCLEAR MELTDOWN at", location);
    }
  }

  /**
   * Set reactor active state
   */
  private static setReactorActive(block: Block, active: boolean): void {
    const permutation = block.permutation.withState("ic2:active" as any, active);
    block.setPermutation(permutation);
  }
}

