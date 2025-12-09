import { Block, Vector3, world, ItemStack } from "@minecraft/server";

declare const console: { log: (...args: unknown[]) => void; error: (...args: unknown[]) => void };

/**
 * Crop Growth System for IC2
 * Handles crop growth, harvesting, and automation
 */
export class CropSystem {
  private static readonly CROPS = {
    "ic2:crop_wheat": {
      maxStage: 7,
      growthTime: 1800, // 1.5 minutes
      drops: ["minecraft:wheat"],
      seedDrop: "ic2:wheat_seeds"
    },
    "ic2:crop_carrot": {
      maxStage: 7,
      growthTime: 1800,
      drops: ["minecraft:carrot"],
      seedDrop: "ic2:carrot_seeds"
    },
    "ic2:crop_potato": {
      maxStage: 7,
      growthTime: 1800,
      drops: ["minecraft:potato"],
      seedDrop: "minecraft:potato"
    },
    "ic2:crop_beetroot": {
      maxStage: 7,
      growthTime: 1800,
      drops: ["minecraft:beetroot"],
      seedDrop: "minecraft:beetroot_seeds"
    },
    "ic2:crop_melon": {
      maxStage: 7,
      growthTime: 1800,
      drops: ["minecraft:melon_slice"],
      seedDrop: "minecraft:melon_seeds"
    },
    "ic2:crop_pumpkin": {
      maxStage: 7,
      growthTime: 1800,
      drops: ["minecraft:pumpkin"],
      seedDrop: "minecraft:pumpkin_seeds"
    },
    "ic2:crop_coffee": {
      maxStage: 7,
      growthTime: 2400, // 2 minutes (coffee grows slower)
      drops: ["ic2:coffee_powder"],
      seedDrop: "ic2:coffee_beans"
    },
    "ic2:crop_cocoa": {
      maxStage: 7,
      growthTime: 1800,
      drops: ["minecraft:cocoa_beans"],
      seedDrop: "minecraft:cocoa_beans"
    },
    "ic2:crop_nether_wart": {
      maxStage: 7,
      growthTime: 1800,
      drops: ["minecraft:nether_wart"],
      seedDrop: "minecraft:nether_wart"
    },
    "ic2:crop_brown_mushroom": {
      maxStage: 7,
      growthTime: 1800,
      drops: ["minecraft:brown_mushroom"],
      seedDrop: "minecraft:brown_mushroom"
    },
    "ic2:crop_red_mushroom": {
      maxStage: 7,
      growthTime: 1800,
      drops: ["minecraft:red_mushroom"],
      seedDrop: "minecraft:red_mushroom"
    },
    "ic2:crop_reed": {
      maxStage: 7,
      growthTime: 1800,
      drops: ["minecraft:sugar_cane"],
      seedDrop: "minecraft:sugar_cane"
    },
    "ic2:crop_dandelion": {
      maxStage: 7,
      growthTime: 1800,
      drops: ["minecraft:dandelion"],
      seedDrop: "minecraft:dandelion"
    },
    "ic2:crop_poppy": {
      maxStage: 7,
      growthTime: 1800,
      drops: ["minecraft:poppy"],
      seedDrop: "minecraft:poppy"
    },
    "ic2:crop_tulip": {
      maxStage: 7,
      growthTime: 1800,
      drops: ["minecraft:red_tulip"],
      seedDrop: "minecraft:red_tulip"
    },
    "ic2:crop_hops": {
      maxStage: 7,
      growthTime: 1800,
      drops: ["minecraft:string"],
      seedDrop: "minecraft:string"
    },
    "ic2:crop_cactus": {
      maxStage: 7,
      growthTime: 1800,
      drops: ["minecraft:cactus"],
      seedDrop: "minecraft:cactus"
    },
    "ic2:crop_malachite": {
      maxStage: 7,
      growthTime: 1800,
      drops: ["ic2:malachite"],
      seedDrop: "ic2:malachite"
    }
  };

  /**
   * Handle crop growth tick
   */
  static onCropTick(block: Block): void {
    const cropId = block.typeId;
    const cropData = this.CROPS[cropId as keyof typeof this.CROPS];

    if (!cropData) return;

    const currentStage = (block.permutation.getState("ic2:growth_stage" as any) as number) || 0;

    // Optimized growth chance (reduced frequency for better performance)
    if (Math.random() < 0.05 && currentStage < cropData.maxStage) { // Reduced from 0.1 to 0.05
      const newStage = currentStage + 1;
      const newPermutation = block.permutation.withState("ic2:growth_stage" as any, newStage);
      block.setPermutation(newPermutation);

      // Remove console.log for performance
      // console.log(`Crop ${cropId} grew to stage ${newStage}`);
    }
  }

  /**
   * Handle crop harvesting
   */
  static harvestCrop(block: Block, player?: any): boolean {
    const cropId = block.typeId;
    const cropData = this.CROPS[cropId as keyof typeof this.CROPS];

    if (!cropData) return false;

    const currentStage = (block.permutation.getState("ic2:growth_stage" as any) as number) || 0;

    // Only harvest when fully grown
    if (currentStage < cropData.maxStage) return false;

    // Drop items
    const location = block.location;
    const dimension = block.dimension;

    // Drop main crop items
    cropData.drops.forEach(dropId => {
      const itemStack = new ItemStack(dropId, 1);
      dimension.spawnItem(itemStack, location);
    });

    // Chance to drop seeds
    if (Math.random() < 0.3) { // 30% chance
      const seedStack = new ItemStack(cropData.seedDrop, 1);
      dimension.spawnItem(seedStack, location);
    }

    // Reset to stage 0 (can regrow)
    const resetPermutation = block.permutation.withState("ic2:growth_stage" as any, 0);
    block.setPermutation(resetPermutation);

    console.log(`Harvested ${cropId} at stage ${currentStage}`);
    return true;
  }

  /**
   * Plant crop from seed
   */
  static plantCrop(seedId: string, location: Vector3, dimension: any): boolean {
    const cropMap: { [key: string]: string } = {
      "ic2:wheat_seeds": "ic2:crop_wheat",
      "ic2:carrot_seeds": "ic2:crop_carrot",
      "minecraft:potato": "ic2:crop_potato",
      "minecraft:beetroot_seeds": "ic2:crop_beetroot",
      "minecraft:melon_seeds": "ic2:crop_melon",
      "minecraft:pumpkin_seeds": "ic2:crop_pumpkin",
      "ic2:coffee_beans": "ic2:crop_coffee",
      "minecraft:cocoa_beans": "ic2:crop_cocoa",
      "minecraft:nether_wart": "ic2:crop_nether_wart",
      "minecraft:brown_mushroom": "ic2:crop_brown_mushroom",
      "minecraft:red_mushroom": "ic2:crop_red_mushroom",
      "minecraft:sugar_cane": "ic2:crop_reed",
      "minecraft:dandelion": "ic2:crop_dandelion",
      "minecraft:poppy": "ic2:crop_poppy",
      "minecraft:red_tulip": "ic2:crop_tulip",
      "minecraft:string": "ic2:crop_hops",
      "minecraft:cactus": "ic2:crop_cactus",
      "ic2:malachite": "ic2:crop_malachite"
    };

    const cropId = cropMap[seedId];
    if (!cropId) return false;

    // Check if location is valid for planting
    const blockBelow = dimension.getBlock({ x: location.x, y: location.y - 1, z: location.z });
    const validSoils = ["minecraft:farmland", "minecraft:grass", "minecraft:dirt"];

    // Special soils for specific crops
    const cropSoilRequirements: { [key: string]: string[] } = {
      "ic2:crop_coffee": ["minecraft:farmland", "minecraft:grass", "minecraft:dirt", "minecraft:soul_sand"],
      "ic2:crop_cocoa": ["minecraft:jungle_log", "minecraft:jungle_wood"],
      "ic2:crop_nether_wart": ["minecraft:soul_sand"],
      "ic2:crop_brown_mushroom": ["minecraft:mycelium", "minecraft:podzol", "minecraft:grass", "minecraft:dirt"],
      "ic2:crop_red_mushroom": ["minecraft:mycelium", "minecraft:podzol", "minecraft:grass", "minecraft:dirt"],
      "ic2:crop_reed": ["minecraft:sand", "minecraft:red_sand", "minecraft:gravel", "minecraft:dirt"],
      "ic2:crop_dandelion": ["minecraft:grass", "minecraft:dirt", "minecraft:podzol"],
      "ic2:crop_poppy": ["minecraft:grass", "minecraft:dirt", "minecraft:podzol"],
      "ic2:crop_tulip": ["minecraft:grass", "minecraft:dirt", "minecraft:podzol"],
      "ic2:crop_hops": ["minecraft:farmland", "minecraft:grass", "minecraft:dirt"],
      "ic2:crop_cactus": ["minecraft:sand", "minecraft:red_sand"],
      "ic2:crop_malachite": ["minecraft:farmland", "minecraft:grass", "minecraft:dirt"]
    };

    const requiredSoils = cropSoilRequirements[cropId] || validSoils;

    if (!requiredSoils.includes(blockBelow.typeId)) return false;

    // Plant the crop
    dimension.runCommand(`setblock ${location.x} ${location.y} ${location.z} ${cropId}`);
    console.log(`Planted ${cropId} from ${seedId}`);

    return true;
  }

  /**
   * Get crop info
   */
  static getCropInfo(cropId: string) {
    return this.CROPS[cropId as keyof typeof this.CROPS];
  }

  /**
   * Check if block is a crop
   */
  static isCrop(block: Block): boolean {
    return block.typeId in this.CROPS;
  }
}
