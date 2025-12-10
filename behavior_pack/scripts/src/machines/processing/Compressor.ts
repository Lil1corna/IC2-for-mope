import { Vector3 } from "@minecraft/server";
import { BaseMachine, MachineConfig } from "./BaseMachine";
import { VoltageTier } from "../../energy/EnergyNetwork";

/**
 * Recipe definition for Compressor
 */
export interface CompressorRecipe {
    /** Input item identifier */
    input: string;
    /** Output item identifier */
    output: string;
    /** Output count */
    outputCount: number;
}

/**
 * Compressor recipes matching IC2 Experimental
 * Requirements 12.1-12.4
 */
export const COMPRESSOR_RECIPES: CompressorRecipe[] = [
    // Plant Ball → Bio Chaff (Requirement 12.1)
    { input: "ic2:plant_ball", output: "ic2:bio_chaff", outputCount: 1 },
    
    // Mixed Metal Ingot → Advanced Alloy (Requirement 12.2)
    { input: "ic2:mixed_metal_ingot", output: "ic2:advanced_alloy", outputCount: 1 },
    
    // Carbon Mesh → Carbon Plate (Requirement 12.3)
    { input: "ic2:carbon_mesh", output: "ic2:carbon_plate", outputCount: 1 },
    
    // Coal Chunk → Industrial Diamond (Requirement 12.4)
    // Note: In IC2, this requires coal chunk which is made from coal + obsidian
    { input: "ic2:coal_chunk", output: "ic2:industrial_diamond", outputCount: 1 },
    
    // Additional common compressor recipes from IC2
    { input: "minecraft:snowball", output: "minecraft:snow_block", outputCount: 1 },
    { input: "ic2:copper_dust", output: "ic2:copper_plate", outputCount: 1 },
    { input: "ic2:tin_dust", output: "ic2:tin_plate", outputCount: 1 },
    { input: "ic2:iron_dust", output: "ic2:iron_plate", outputCount: 1 },
];

/**
 * Result of processing an item in the Compressor
 */
export interface CompressorProcessResult {
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
export function findCompressorRecipe(input: string): CompressorRecipe | undefined {
    return COMPRESSOR_RECIPES.find(recipe => recipe.input === input);
}

/**
 * Check if an item can be processed by the Compressor
 * @param input Input item identifier
 * @returns true if item has a valid recipe
 */
export function canCompress(input: string): boolean {
    return findCompressorRecipe(input) !== undefined;
}

/**
 * Get the expected output for a given input
 * @param input Input item identifier
 * @returns Output item and count, or undefined if no recipe
 */
export function getCompressorOutput(input: string): { output: string; count: number } | undefined {
    const recipe = findCompressorRecipe(input);
    if (!recipe) return undefined;
    return { output: recipe.output, count: recipe.outputCount };
}

/**
 * Compressor machine - compresses materials into advanced components
 * Requirements 12.1-12.4
 */
const COMPRESSOR_CONFIG: MachineConfig = {
    maxInput: 32,
    consumption: 3,
    operationTime: 200,
    maxEnergy: 1000,
    maxVoltage: VoltageTier.LV
};

export class Compressor extends BaseMachine {
    private currentInput: string | null = null;
    private recipes: CompressorRecipe[];

    constructor(position: Vector3, config: MachineConfig = COMPRESSOR_CONFIG) {
        super(position, config, "compressor");
        this.recipes = COMPRESSOR_RECIPES;
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
    findRecipe(input: string): CompressorRecipe | undefined {
        return this.recipes.find(r => r.input === input);
    }

    /**
     * Process the current input and return the result
     * Should be called when operation completes
     * @returns Processing result with output item and count
     */
    processComplete(): CompressorProcessResult {
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
    getRecipes(): CompressorRecipe[] {
        return [...this.recipes];
    }

    /**
     * Check if a specific input has a recipe
     */
    hasRecipe(input: string): boolean {
        return this.findRecipe(input) !== undefined;
    }
}
