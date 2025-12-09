import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
    Macerator,
    MaceratorRecipe,
    MACERATOR_RECIPES,
    findMaceratorRecipe,
    canMacerate,
    getMaceratorOutput
} from './Macerator';

/**
 * **Feature: ic2-bedrock-port, Property 8: Recipe Output Correctness** (Macerator part)
 * **Validates: Requirements 10.1-10.4**
 * 
 * *For any* valid recipe input processed to completion, 
 * output item and count SHALL match recipe definition exactly.
 */
describe('Property 8: Recipe Output Correctness (Macerator)', () => {
    // Generator for valid Macerator recipe inputs
    const validRecipeInputArb = fc.constantFrom(...MACERATOR_RECIPES.map(r => r.input));

    it('should produce correct output for any valid recipe input', () => {
        fc.assert(
            fc.property(
                validRecipeInputArb,
                (input) => {
                    const macerator = new Macerator({ x: 0, y: 0, z: 0 });
                    
                    // Set input
                    const canProcess = macerator.setInput(input);
                    expect(canProcess).toBe(true);
                    
                    // Get expected recipe
                    const expectedRecipe = MACERATOR_RECIPES.find(r => r.input === input);
                    expect(expectedRecipe).toBeDefined();
                    
                    // Process and check output
                    const result = macerator.processComplete();
                    
                    expect(result.success).toBe(true);
                    expect(result.output).toBe(expectedRecipe!.output);
                    expect(result.outputCount).toBe(expectedRecipe!.outputCount);
                    
                    macerator.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should produce 2x Crushed Ore for any ore input (Requirement 10.1)', () => {
        const oreInputs = MACERATOR_RECIPES
            .filter(r => r.output.includes('crushed'))
            .map(r => r.input);
        
        const oreInputArb = fc.constantFrom(...oreInputs);

        fc.assert(
            fc.property(
                oreInputArb,
                (oreInput) => {
                    const output = getMaceratorOutput(oreInput);
                    
                    expect(output).toBeDefined();
                    expect(output!.output).toContain('crushed');
                    expect(output!.count).toBe(2);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should produce Sand from Cobblestone (Requirement 10.2)', () => {
        const output = getMaceratorOutput('minecraft:cobblestone');
        
        expect(output).toBeDefined();
        expect(output!.output).toBe('minecraft:sand');
        expect(output!.count).toBe(1);
    });

    it('should produce Coal Dust from Coal (Requirement 10.3)', () => {
        const output = getMaceratorOutput('minecraft:coal');
        
        expect(output).toBeDefined();
        expect(output!.output).toBe('ic2:coal_dust');
        expect(output!.count).toBe(1);
    });

    it('should produce Flint from Gravel (Requirement 10.4)', () => {
        const output = getMaceratorOutput('minecraft:gravel');
        
        expect(output).toBeDefined();
        expect(output!.output).toBe('minecraft:flint');
        expect(output!.count).toBe(1);
    });

    it('should reject invalid inputs', () => {
        fc.assert(
            fc.property(
                fc.string().filter(s => !MACERATOR_RECIPES.some(r => r.input === s)),
                (invalidInput) => {
                    const macerator = new Macerator({ x: 0, y: 0, z: 0 });
                    
                    const canProcess = macerator.setInput(invalidInput);
                    expect(canProcess).toBe(false);
                    
                    const result = macerator.processComplete();
                    expect(result.success).toBe(false);
                    
                    macerator.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should have consistent output for same input across multiple calls', () => {
        fc.assert(
            fc.property(
                validRecipeInputArb,
                fc.integer({ min: 2, max: 10 }),
                (input, callCount) => {
                    const outputs: { output: string; count: number }[] = [];
                    
                    for (let i = 0; i < callCount; i++) {
                        const macerator = new Macerator({ x: 0, y: 0, z: 0 });
                        macerator.setInput(input);
                        const result = macerator.processComplete();
                        
                        if (result.success) {
                            outputs.push({ output: result.output!, count: result.outputCount! });
                        }
                        
                        macerator.destroy();
                    }
                    
                    // All outputs should be identical
                    expect(outputs.length).toBe(callCount);
                    const firstOutput = outputs[0];
                    outputs.forEach(o => {
                        expect(o.output).toBe(firstOutput.output);
                        expect(o.count).toBe(firstOutput.count);
                    });
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('Macerator Recipe Lookup Functions', () => {
    it('findMaceratorRecipe should return correct recipe for valid inputs', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...MACERATOR_RECIPES),
                (recipe) => {
                    const found = findMaceratorRecipe(recipe.input);
                    
                    expect(found).toBeDefined();
                    expect(found!.input).toBe(recipe.input);
                    expect(found!.output).toBe(recipe.output);
                    expect(found!.outputCount).toBe(recipe.outputCount);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('canMacerate should return true for all valid recipe inputs', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...MACERATOR_RECIPES.map(r => r.input)),
                (input) => {
                    expect(canMacerate(input)).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('canMacerate should return false for invalid inputs', () => {
        fc.assert(
            fc.property(
                fc.string().filter(s => !MACERATOR_RECIPES.some(r => r.input === s)),
                (invalidInput) => {
                    expect(canMacerate(invalidInput)).toBe(false);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('getMaceratorOutput should match recipe definition exactly', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...MACERATOR_RECIPES),
                (recipe) => {
                    const output = getMaceratorOutput(recipe.input);
                    
                    expect(output).toBeDefined();
                    expect(output!.output).toBe(recipe.output);
                    expect(output!.count).toBe(recipe.outputCount);
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('Macerator Machine Integration', () => {
    it('should inherit BaseMachine configuration', () => {
        const macerator = new Macerator({ x: 0, y: 0, z: 0 });
        
        // Should have default machine config
        expect(macerator.getConfig().maxInput).toBe(32);
        expect(macerator.getConfig().consumption).toBe(2);
        expect(macerator.getConfig().operationTime).toBe(400);
        
        macerator.destroy();
    });

    it('should track input state correctly', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...MACERATOR_RECIPES.map(r => r.input)),
                (input) => {
                    const macerator = new Macerator({ x: 0, y: 0, z: 0 });
                    
                    // Initially no input
                    expect(macerator.getCurrentInput()).toBeNull();
                    
                    // Set valid input
                    macerator.setInput(input);
                    expect(macerator.getCurrentInput()).toBe(input);
                    
                    // Clear input
                    macerator.setInput(null);
                    expect(macerator.getCurrentInput()).toBeNull();
                    
                    macerator.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should return all recipes via getRecipes()', () => {
        const macerator = new Macerator({ x: 0, y: 0, z: 0 });
        const recipes = macerator.getRecipes();
        
        expect(recipes.length).toBe(MACERATOR_RECIPES.length);
        
        // Verify all recipes are present
        MACERATOR_RECIPES.forEach(expected => {
            const found = recipes.find(r => r.input === expected.input);
            expect(found).toBeDefined();
            expect(found!.output).toBe(expected.output);
            expect(found!.outputCount).toBe(expected.outputCount);
        });
        
        macerator.destroy();
    });
});
