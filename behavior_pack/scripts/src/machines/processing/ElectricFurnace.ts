import { Vector3 } from "@minecraft/server";
import { BaseMachine, MachineConfig } from "./BaseMachine";
import { VoltageTier } from "../../energy/EnergyNetwork";

/**
 * Recipe definition for Electric Furnace (vanilla smelting recipes)
 */
export interface FurnaceRecipe {
    /** Input item identifier */
    input: string;
    /** Output item identifier */
    output: string;
    /** Output count */
    outputCount: number;
}

/**
 * Electric Furnace operation time - 12.5% faster than vanilla
 * Vanilla furnace: 200 ticks (10 seconds) for smelting
 * Base machine: 400 ticks (20 seconds)
 * Electric Furnace: 350 ticks (17.5 seconds) - 12.5% faster than base
 * Requirements 11.2
 */
export const ELECTRIC_FURNACE_OPERATION_TIME = 150;

/**
 * Electric Furnace configuration
 * Requirements 11.1-11.2
 */
export const ELECTRIC_FURNACE_CONFIG: MachineConfig = {
    maxInput: 32,
    consumption: 3,
    operationTime: ELECTRIC_FURNACE_OPERATION_TIME,
    maxEnergy: 1200,
    maxVoltage: VoltageTier.LV
};

/**
 * Vanilla furnace recipes supported by Electric Furnace
 * Requirements 11.1
 */
export const FURNACE_RECIPES: FurnaceRecipe[] = [
    // Ores to ingots
    { input: "minecraft:iron_ore", output: "minecraft:iron_ingot", outputCount: 1 },
    { input: "minecraft:gold_ore", output: "minecraft:gold_ingot", outputCount: 1 },
    { input: "minecraft:copper_ore", output: "minecraft:copper_ingot", outputCount: 1 },
    { input: "minecraft:deepslate_iron_ore", output: "minecraft:iron_ingot", outputCount: 1 },
    { input: "minecraft:deepslate_gold_ore", output: "minecraft:gold_ingot", outputCount: 1 },
    { input: "minecraft:deepslate_copper_ore", output: "minecraft:copper_ingot", outputCount: 1 },
    { input: "minecraft:raw_iron", output: "minecraft:iron_ingot", outputCount: 1 },
    { input: "minecraft:raw_gold", output: "minecraft:gold_ingot", outputCount: 1 },
    { input: "minecraft:raw_copper", output: "minecraft:copper_ingot", outputCount: 1 },
    
    // IC2 ores and dusts
    { input: "ic2:copper_ore", output: "ic2:copper_ingot", outputCount: 1 },
    { input: "ic2:tin_ore", output: "ic2:tin_ingot", outputCount: 1 },
    { input: "ic2:lead_ore", output: "ic2:lead_ingot", outputCount: 1 },
    { input: "ic2:copper_dust", output: "ic2:copper_ingot", outputCount: 1 },
    { input: "ic2:tin_dust", output: "ic2:tin_ingot", outputCount: 1 },
    { input: "ic2:lead_dust", output: "ic2:lead_ingot", outputCount: 1 },
    { input: "ic2:iron_dust", output: "minecraft:iron_ingot", outputCount: 1 },
    { input: "ic2:gold_dust", output: "minecraft:gold_ingot", outputCount: 1 },
    { input: "ic2:crushed_iron_ore", output: "minecraft:iron_ingot", outputCount: 1 },
    { input: "ic2:crushed_gold_ore", output: "minecraft:gold_ingot", outputCount: 1 },
    { input: "ic2:crushed_copper_ore", output: "ic2:copper_ingot", outputCount: 1 },
    { input: "ic2:crushed_tin_ore", output: "ic2:tin_ingot", outputCount: 1 },
    { input: "ic2:crushed_lead_ore", output: "ic2:lead_ingot", outputCount: 1 },

    // Food items
    { input: "minecraft:beef", output: "minecraft:cooked_beef", outputCount: 1 },
    { input: "minecraft:porkchop", output: "minecraft:cooked_porkchop", outputCount: 1 },
    { input: "minecraft:chicken", output: "minecraft:cooked_chicken", outputCount: 1 },
    { input: "minecraft:mutton", output: "minecraft:cooked_mutton", outputCount: 1 },
    { input: "minecraft:rabbit", output: "minecraft:cooked_rabbit", outputCount: 1 },
    { input: "minecraft:cod", output: "minecraft:cooked_cod", outputCount: 1 },
    { input: "minecraft:salmon", output: "minecraft:cooked_salmon", outputCount: 1 },
    { input: "minecraft:potato", output: "minecraft:baked_potato", outputCount: 1 },
    { input: "minecraft:kelp", output: "minecraft:dried_kelp", outputCount: 1 },
    
    // Building materials
    { input: "minecraft:cobblestone", output: "minecraft:stone", outputCount: 1 },
    { input: "minecraft:sand", output: "minecraft:glass", outputCount: 1 },
    { input: "minecraft:clay_ball", output: "minecraft:brick", outputCount: 1 },
    { input: "minecraft:clay", output: "minecraft:terracotta", outputCount: 1 },
    { input: "minecraft:netherrack", output: "minecraft:nether_brick", outputCount: 1 },
    { input: "minecraft:stone_bricks", output: "minecraft:cracked_stone_bricks", outputCount: 1 },
    { input: "minecraft:cobbled_deepslate", output: "minecraft:deepslate", outputCount: 1 },
    
    // Misc items
    { input: "minecraft:ancient_debris", output: "minecraft:netherite_scrap", outputCount: 1 },
    { input: "minecraft:wet_sponge", output: "minecraft:sponge", outputCount: 1 },
    { input: "minecraft:cactus", output: "minecraft:green_dye", outputCount: 1 },
    { input: "minecraft:sea_pickle", output: "minecraft:lime_dye", outputCount: 1 },
    
    // Logs to charcoal
    { input: "minecraft:oak_log", output: "minecraft:charcoal", outputCount: 1 },
    { input: "minecraft:spruce_log", output: "minecraft:charcoal", outputCount: 1 },
    { input: "minecraft:birch_log", output: "minecraft:charcoal", outputCount: 1 },
    { input: "minecraft:jungle_log", output: "minecraft:charcoal", outputCount: 1 },
    { input: "minecraft:acacia_log", output: "minecraft:charcoal", outputCount: 1 },
    { input: "minecraft:dark_oak_log", output: "minecraft:charcoal", outputCount: 1 },
    { input: "minecraft:mangrove_log", output: "minecraft:charcoal", outputCount: 1 },
    { input: "minecraft:cherry_log", output: "minecraft:charcoal", outputCount: 1 },
];

/**
 * Result of processing an item in the Electric Furnace
 */
export interface FurnaceProcessResult {
    /** Whether the item was processed successfully */
    success: boolean;
    /** Output item identifier (if successful) */
    output?: string;
    /** Output count (if successful) */
    outputCount?: number;
    /** Error message (if failed) */
    error?: string;
}

/**
 * Find a recipe for the given input item
 * @param input Input item identifier
 * @returns Recipe if found, undefined otherwise
 */
export function findFurnaceRecipe(input: string): FurnaceRecipe | undefined {
    return FURNACE_RECIPES.find(recipe => recipe.input === input);
}

/**
 * Check if an item can be smelted by the Electric Furnace
 * @param input Input item identifier
 * @returns true if item has a valid recipe
 */
export function canSmelt(input: string): boolean {
    return findFurnaceRecipe(input) !== undefined;
}

/**
 * Get the expected output for a given input
 * @param input Input item identifier
 * @returns Output item and count, or undefined if no recipe
 */
export function getFurnaceOutput(input: string): { output: string; count: number } | undefined {
    const recipe = findFurnaceRecipe(input);
    if (!recipe) return undefined;
    return { output: recipe.output, count: recipe.outputCount };
}

/**
 * Electric Furnace machine - smelts items using EU power
 * 12.5% faster than vanilla furnace
 * Requirements 11.1-11.2
 */
export class ElectricFurnace extends BaseMachine {
    private currentInput: string | null = null;
    private recipes: FurnaceRecipe[];

    constructor(position: Vector3, config: MachineConfig = ELECTRIC_FURNACE_CONFIG) {
        super(position, config, "electric_furnace");
        this.recipes = FURNACE_RECIPES;
    }

    /**
     * Set the current input item for processing
     * @param itemId Item identifier to process
     * @returns true if item can be processed
     */
    setInput(itemId: string | null): boolean {
        if (itemId === null) {
            this.currentInput = null;
            this.setHasInput(false);
            return true;
        }

        const recipe = this.findRecipe(itemId);
        if (recipe) {
            this.currentInput = itemId;
            this.setHasInput(true);
            return true;
        }

        this.currentInput = null;
        this.setHasInput(false);
        return false;
    }

    /**
     * Get the current input item
     */
    getCurrentInput(): string | null {
        return this.currentInput;
    }

    /**
     * Find recipe for given input
     */
    findRecipe(input: string): FurnaceRecipe | undefined {
        return this.recipes.find(r => r.input === input);
    }

    /**
     * Process the current input and return the result
     * Should be called when operation completes
     * @returns Processing result with output item and count
     */
    processComplete(): FurnaceProcessResult {
        if (!this.currentInput) {
            return { success: false, error: "No input item" };
        }

        const recipe = this.findRecipe(this.currentInput);
        if (!recipe) {
            return { success: false, error: "No recipe for input" };
        }

        return {
            success: true,
            output: recipe.output,
            outputCount: recipe.outputCount
        };
    }

    /**
     * Get all available recipes
     */
    getRecipes(): FurnaceRecipe[] {
        return [...this.recipes];
    }

    /**
     * Check if a specific input has a recipe
     */
    hasRecipe(input: string): boolean {
        return this.findRecipe(input) !== undefined;
    }
}
