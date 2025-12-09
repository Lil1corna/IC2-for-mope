import { describe, it, expect, beforeEach } from 'vitest';
import {
    ElectricFurnace,
    ELECTRIC_FURNACE_CONFIG,
    ELECTRIC_FURNACE_OPERATION_TIME,
    FURNACE_RECIPES,
    findFurnaceRecipe,
    canSmelt,
    getFurnaceOutput
} from './ElectricFurnace';
import { MACHINE_BASE_CONFIG } from './BaseMachine';

describe('ElectricFurnace', () => {
    /**
     * Test: Electric Furnace operates 12.5% faster than base machine
     * Requirements 11.2
     */
    describe('Operation Time - 12.5% faster', () => {
        it('should have operation time of 350 ticks (12.5% faster than 400)', () => {
            expect(ELECTRIC_FURNACE_OPERATION_TIME).toBe(350);
            expect(ELECTRIC_FURNACE_CONFIG.operationTime).toBe(350);
        });

        it('should be 12.5% faster than base machine config', () => {
            const baseTicks = MACHINE_BASE_CONFIG.operationTime; // 400
            const expectedFasterTicks = baseTicks * 0.875; // 350
            expect(ELECTRIC_FURNACE_OPERATION_TIME).toBe(expectedFasterTicks);
        });

        it('should use correct operation time in machine instance', () => {
            const furnace = new ElectricFurnace({ x: 0, y: 0, z: 0 });
            expect(furnace.getConfig().operationTime).toBe(350);
        });
    });

    /**
     * Test: Electric Furnace uses vanilla furnace recipes
     * Requirements 11.1
     */
    describe('Vanilla Recipes', () => {
        it('should have ore smelting recipes', () => {
            expect(canSmelt('minecraft:iron_ore')).toBe(true);
            expect(canSmelt('minecraft:gold_ore')).toBe(true);
            expect(canSmelt('minecraft:copper_ore')).toBe(true);
        });

        it('should produce correct outputs for ores', () => {
            const ironOutput = getFurnaceOutput('minecraft:iron_ore');
            expect(ironOutput).toEqual({ output: 'minecraft:iron_ingot', count: 1 });

            const goldOutput = getFurnaceOutput('minecraft:gold_ore');
            expect(goldOutput).toEqual({ output: 'minecraft:gold_ingot', count: 1 });
        });

        it('should have food cooking recipes', () => {
            expect(canSmelt('minecraft:beef')).toBe(true);
            expect(canSmelt('minecraft:porkchop')).toBe(true);
            expect(canSmelt('minecraft:chicken')).toBe(true);
            expect(canSmelt('minecraft:potato')).toBe(true);
        });

        it('should produce correct outputs for food', () => {
            const beefOutput = getFurnaceOutput('minecraft:beef');
            expect(beefOutput).toEqual({ output: 'minecraft:cooked_beef', count: 1 });

            const potatoOutput = getFurnaceOutput('minecraft:potato');
            expect(potatoOutput).toEqual({ output: 'minecraft:baked_potato', count: 1 });
        });

        it('should have building material recipes', () => {
            expect(canSmelt('minecraft:cobblestone')).toBe(true);
            expect(canSmelt('minecraft:sand')).toBe(true);
            expect(canSmelt('minecraft:clay_ball')).toBe(true);
        });

        it('should produce correct outputs for building materials', () => {
            const stoneOutput = getFurnaceOutput('minecraft:cobblestone');
            expect(stoneOutput).toEqual({ output: 'minecraft:stone', count: 1 });

            const glassOutput = getFurnaceOutput('minecraft:sand');
            expect(glassOutput).toEqual({ output: 'minecraft:glass', count: 1 });
        });

        it('should have log to charcoal recipes', () => {
            expect(canSmelt('minecraft:oak_log')).toBe(true);
            expect(canSmelt('minecraft:spruce_log')).toBe(true);
            expect(canSmelt('minecraft:birch_log')).toBe(true);
        });

        it('should produce charcoal from logs', () => {
            const charcoalOutput = getFurnaceOutput('minecraft:oak_log');
            expect(charcoalOutput).toEqual({ output: 'minecraft:charcoal', count: 1 });
        });
    });

    /**
     * Test: Electric Furnace machine functionality
     */
    describe('Machine Functionality', () => {
        let furnace: ElectricFurnace;

        beforeEach(() => {
            furnace = new ElectricFurnace({ x: 0, y: 64, z: 0 });
        });

        it('should accept valid input items', () => {
            expect(furnace.setInput('minecraft:iron_ore')).toBe(true);
            expect(furnace.getCurrentInput()).toBe('minecraft:iron_ore');
        });

        it('should reject invalid input items', () => {
            expect(furnace.setInput('minecraft:dirt')).toBe(false);
            expect(furnace.getCurrentInput()).toBeNull();
        });

        it('should clear input when set to null', () => {
            furnace.setInput('minecraft:iron_ore');
            expect(furnace.setInput(null)).toBe(true);
            expect(furnace.getCurrentInput()).toBeNull();
        });

        it('should return correct process result', () => {
            furnace.setInput('minecraft:iron_ore');
            const result = furnace.processComplete();
            expect(result.success).toBe(true);
            expect(result.output).toBe('minecraft:iron_ingot');
            expect(result.outputCount).toBe(1);
        });

        it('should fail process when no input', () => {
            const result = furnace.processComplete();
            expect(result.success).toBe(false);
            expect(result.error).toBe('No input item');
        });

        it('should have all recipes accessible', () => {
            const recipes = furnace.getRecipes();
            expect(recipes.length).toBeGreaterThan(0);
            expect(recipes).toEqual(FURNACE_RECIPES);
        });

        it('should check recipe existence correctly', () => {
            expect(furnace.hasRecipe('minecraft:iron_ore')).toBe(true);
            expect(furnace.hasRecipe('minecraft:dirt')).toBe(false);
        });
    });

    /**
     * Test: Electric Furnace inherits base machine properties
     */
    describe('Base Machine Properties', () => {
        let furnace: ElectricFurnace;

        beforeEach(() => {
            furnace = new ElectricFurnace({ x: 0, y: 64, z: 0 });
        });

        it('should have correct max input (32 EU/t)', () => {
            expect(furnace.getConfig().maxInput).toBe(32);
        });

        it('should have correct consumption (2 EU/t)', () => {
            expect(furnace.getConfig().consumption).toBe(2);
        });

        it('should complete operation in 350 ticks', () => {
            furnace.setInput('minecraft:iron_ore');
            furnace.setHasOutputSpace(true);

            // Run for 349 ticks - should not complete
            // Refill energy periodically since buffer is limited
            for (let i = 0; i < 349; i++) {
                if (furnace.getEnergyStored() < 100) {
                    furnace.receiveEnergy(400, 32);
                }
                const result = furnace.tick();
                expect(result.operationCompleted).toBe(false);
            }

            // Ensure energy for final tick
            if (furnace.getEnergyStored() < 2) {
                furnace.receiveEnergy(100, 32);
            }

            // 350th tick should complete
            const finalResult = furnace.tick();
            expect(finalResult.operationCompleted).toBe(true);
        });
    });

    /**
     * Test: Recipe helper functions
     */
    describe('Recipe Helper Functions', () => {
        it('findFurnaceRecipe should return recipe for valid input', () => {
            const recipe = findFurnaceRecipe('minecraft:iron_ore');
            expect(recipe).toBeDefined();
            expect(recipe?.output).toBe('minecraft:iron_ingot');
        });

        it('findFurnaceRecipe should return undefined for invalid input', () => {
            const recipe = findFurnaceRecipe('minecraft:dirt');
            expect(recipe).toBeUndefined();
        });

        it('canSmelt should return true for valid inputs', () => {
            expect(canSmelt('minecraft:iron_ore')).toBe(true);
            expect(canSmelt('minecraft:beef')).toBe(true);
        });

        it('canSmelt should return false for invalid inputs', () => {
            expect(canSmelt('minecraft:dirt')).toBe(false);
            expect(canSmelt('minecraft:stone')).toBe(false);
        });

        it('getFurnaceOutput should return output for valid input', () => {
            const output = getFurnaceOutput('minecraft:beef');
            expect(output).toEqual({ output: 'minecraft:cooked_beef', count: 1 });
        });

        it('getFurnaceOutput should return undefined for invalid input', () => {
            const output = getFurnaceOutput('minecraft:dirt');
            expect(output).toBeUndefined();
        });
    });
});
