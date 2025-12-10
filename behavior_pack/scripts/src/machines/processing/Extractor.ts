import { Vector3 } from "@minecraft/server";
import { BaseMachine, MachineConfig } from "./BaseMachine";
import { VoltageTier } from "../../energy/EnergyNetwork";

/**
 * Recipe definition for Extractor
 */
export interface ExtractorRecipe {
    /** Input item identifier */
    input: string;
    /** Output item identifier */
    output: string;
    /** Output count */
    outputCount: number;
}

/**
 * Extractor recipes matching IC2 Experimental
 * Requirements 13.1-13.3
 */
export const EXTRACTOR_RECIPES: ExtractorRecipe[] = [
    // Sticky Resin → 3× Rubber (Requirement 13.1)
    { input: "ic2:sticky_resin", output: "ic2:rubber", outputCount: 3 },
    
    // Rubber Wood → 1× Rubber (Requirement 13.2)
    { input: "ic2:rubber_wood", output: "ic2:rubber", outputCount: 1 },
    
    // Gunpowder → Sulfur (Requirement 13.3)
    { input: "minecraft:gunpowder", output: "ic2:sulfur", outputCount: 1 },
];

/**
 * Result of processing an item in the Extractor
 */
export interface ExtractorProcessResult {
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
export function findExtractorRecipe(input: string): ExtractorRecipe | undefined {
    return EXTRACTOR_RECIPES.find(recipe => recipe.input === input);
}

/**
 * Check if an item can be processed by the Extractor
 * @param input Input item identifier
 * @returns true if item has a valid recipe
 */
export function canExtract(input: string): boolean {
    return findExtractorRecipe(input) !== undefined;
}

/**
 * Get the expected output for a given input
 * @param input Input item identifier
 * @returns Output item and count, or undefined if no recipe
 */
export function getExtractorOutput(input: string): { output: string; count: number } | undefined {
    const recipe = findExtractorRecipe(input);
    if (!recipe) return undefined;
    return { output: recipe.output, count: recipe.outputCount };
}

/**
 * Extractor machine - extracts rubber and other materials
 * Requirements 13.1-13.3
 */
const EXTRACTOR_CONFIG: MachineConfig = {
    maxInput: 32,
    consumption: 2,
    operationTime: 150,
    maxEnergy: 1000,
    maxVoltage: VoltageTier.LV
};

export class Extractor extends BaseMachine {
    private currentInput: string | null = null;
    private recipes: ExtractorRecipe[];

    constructor(position: Vector3, config: MachineConfig = EXTRACTOR_CONFIG) {
        super(position, config, "extractor");
        this.recipes = EXTRACTOR_RECIPES;
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
    findRecipe(input: string): ExtractorRecipe | undefined {
        return this.recipes.find(r => r.input === input);
    }

    /**
     * Process the current input and return the result
     * Should be called when operation completes
     * @returns Processing result with output item and count
     */
    processComplete(): ExtractorProcessResult {
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
    getRecipes(): ExtractorRecipe[] {
        return [...this.recipes];
    }

    /**
     * Check if a specific input has a recipe
     */
    hasRecipe(input: string): boolean {
        return this.findRecipe(input) !== undefined;
    }
}
