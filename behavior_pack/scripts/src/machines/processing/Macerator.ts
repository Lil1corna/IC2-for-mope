import { Vector3 } from "@minecraft/server";
import { BaseMachine, MACHINE_BASE_CONFIG, MachineConfig } from "./BaseMachine";

/**
 * Recipe definition for Macerator
 */
export interface MaceratorRecipe {
    /** Input item identifier */
    input: string;
    /** Output item identifier */
    output: string;
    /** Output count */
    outputCount: number;
}

/**
 * Macerator recipes matching IC2 Experimental
 * Requirements 10.1-10.4
 */
export const MACERATOR_RECIPES: MaceratorRecipe[] = [
    // Ore → 2× Crushed Ore (Requirement 10.1)
    { input: "ic2:iron_ore", output: "ic2:crushed_iron_ore", outputCount: 2 },
    { input: "ic2:gold_ore", output: "ic2:crushed_gold_ore", outputCount: 2 },
    { input: "ic2:copper_ore", output: "ic2:crushed_copper_ore", outputCount: 2 },
    { input: "ic2:tin_ore", output: "ic2:crushed_tin_ore", outputCount: 2 },
    { input: "ic2:lead_ore", output: "ic2:crushed_lead_ore", outputCount: 2 },
    // Vanilla ores
    { input: "minecraft:iron_ore", output: "ic2:crushed_iron_ore", outputCount: 2 },
    { input: "minecraft:gold_ore", output: "ic2:crushed_gold_ore", outputCount: 2 },
    { input: "minecraft:copper_ore", output: "ic2:crushed_copper_ore", outputCount: 2 },
    { input: "minecraft:deepslate_iron_ore", output: "ic2:crushed_iron_ore", outputCount: 2 },
    { input: "minecraft:deepslate_gold_ore", output: "ic2:crushed_gold_ore", outputCount: 2 },
    { input: "minecraft:deepslate_copper_ore", output: "ic2:crushed_copper_ore", outputCount: 2 },
    
    // Cobblestone → Sand (Requirement 10.2)
    { input: "minecraft:cobblestone", output: "minecraft:sand", outputCount: 1 },
    
    // Coal → Coal Dust (Requirement 10.3)
    { input: "minecraft:coal", output: "ic2:coal_dust", outputCount: 1 },
    
    // Gravel → Flint (Requirement 10.4)
    { input: "minecraft:gravel", output: "minecraft:flint", outputCount: 1 },
];

/**
 * Result of processing an item in the Macerator
 */
export interface MaceratorProcessResult {
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
export function findMaceratorRecipe(input: string): MaceratorRecipe | undefined {
    return MACERATOR_RECIPES.find(recipe => recipe.input === input);
}

/**
 * Check if an item can be processed by the Macerator
 * @param input Input item identifier
 * @returns true if item has a valid recipe
 */
export function canMacerate(input: string): boolean {
    return findMaceratorRecipe(input) !== undefined;
}

/**
 * Get the expected output for a given input
 * @param input Input item identifier
 * @returns Output item and count, or undefined if no recipe
 */
export function getMaceratorOutput(input: string): { output: string; count: number } | undefined {
    const recipe = findMaceratorRecipe(input);
    if (!recipe) return undefined;
    return { output: recipe.output, count: recipe.outputCount };
}

/**
 * Macerator machine - crushes ores into dust for ore doubling
 * Requirements 10.1-10.4
 */
export class Macerator extends BaseMachine {
    private currentInput: string | null = null;
    private recipes: MaceratorRecipe[];

    constructor(position: Vector3, config: MachineConfig = MACHINE_BASE_CONFIG) {
        super(position, config);
        this.recipes = MACERATOR_RECIPES;
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
    findRecipe(input: string): MaceratorRecipe | undefined {
        return this.recipes.find(r => r.input === input);
    }

    /**
     * Process the current input and return the result
     * Should be called when operation completes
     * @returns Processing result with output item and count
     */
    processComplete(): MaceratorProcessResult {
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
    getRecipes(): MaceratorRecipe[] {
        return [...this.recipes];
    }

    /**
     * Check if a specific input has a recipe
     */
    hasRecipe(input: string): boolean {
        return this.findRecipe(input) !== undefined;
    }
}
