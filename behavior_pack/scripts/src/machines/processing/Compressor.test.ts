import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
    Compressor,
    CompressorRecipe,
    COMPRESSOR_RECIPES,
    findCompressorRecipe,
    canCompress,
    getCompressorOutput
} from './Compressor';

/**
 * **Feature: ic2-bedrock-port, Property 8: Recipe Output Correctness** (Compressor part)
 * **Validates: Requirements 12.1-12.4**
 * 
 * *For any* valid recipe input processed to completion, 
 * output item and count SHALL match recipe definition exactly.
 */
describe('Property 8: Recipe Output Correctness (Compressor)', () => {
    // Generator for valid Compressor recipe inputs
    const validRecipeInputArb = fc.constantFrom(...COMPRESSOR_RECIPES.map(r => r.input));

    it('should produce correct output for any valid recipe input', () => {
        fc.assert(
            fc.property(
                validRecipeInputArb,
                (input) => {
                    const compressor = new Compressor({ x: 0, y: 0, z: 0 });
                    
                    // Set input
                    const canProcess = compressor.setInput(input);
                    expect(canProcess).toBe(true);
                    
                    // Get expected recipe
                    const expectedRecipe = COMPRESSOR_RECIPES.find(r => r.input === input);
                    expect(expectedRecipe).toBeDefined();
                    
                    // Process and check output
                    const result = compressor.processComplete();
                    
                    expect(result.success).toBe(true);
                    expect(result.output).toBe(expectedRecipe!.output);
                    expect(result.outputCount).toBe(expectedRecipe!.outputCount);
                    
                    compressor.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should produce Bio Chaff from Plant Ball (Requirement 12.1)', () => {
        const output = getCompressorOutput('ic2:plant_ball');
        
        expect(output).toBeDefined();
        expect(output!.output).toBe('ic2:bio_chaff');
        expect(output!.count).toBe(1);
    });

    it('should produce Advanced Alloy from Mixed Metal Ingot (Requirement 12.2)', () => {
        const output = getCompressorOutput('ic2:mixed_metal_ingot');
        
        expect(output).toBeDefined();
        expect(output!.output).toBe('ic2:advanced_alloy');
        expect(output!.count).toBe(1);
    });

    it('should produce Carbon Plate from Carbon Mesh (Requirement 12.3)', () => {
        const output = getCompressorOutput('ic2:carbon_mesh');
        
        expect(output).toBeDefined();
        expect(output!.output).toBe('ic2:carbon_plate');
        expect(output!.count).toBe(1);
    });

    it('should produce Industrial Diamond from Coal Chunk (Requirement 12.4)', () => {
        const output = getCompressorOutput('ic2:coal_chunk');
        
        expect(output).toBeDefined();
        expect(output!.output).toBe('ic2:industrial_diamond');
        expect(output!.count).toBe(1);
    });

    it('should reject invalid inputs', () => {
        fc.assert(
            fc.property(
                fc.string().filter(s => !COMPRESSOR_RECIPES.some(r => r.input === s)),
                (invalidInput) => {
                    const compressor = new Compressor({ x: 0, y: 0, z: 0 });
                    
                    const canProcess = compressor.setInput(invalidInput);
                    expect(canProcess).toBe(false);
                    
                    const result = compressor.processComplete();
                    expect(result.success).toBe(false);
                    
                    compressor.destroy();
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
                        const compressor = new Compressor({ x: 0, y: 0, z: 0 });
                        compressor.setInput(input);
                        const result = compressor.processComplete();
                        
                        if (result.success) {
                            outputs.push({ output: result.output!, count: result.outputCount! });
                        }
                        
                        compressor.destroy();
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

describe('Compressor Recipe Lookup Functions', () => {
    it('findCompressorRecipe should return correct recipe for valid inputs', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...COMPRESSOR_RECIPES),
                (recipe) => {
                    const found = findCompressorRecipe(recipe.input);
                    
                    expect(found).toBeDefined();
                    expect(found!.input).toBe(recipe.input);
                    expect(found!.output).toBe(recipe.output);
                    expect(found!.outputCount).toBe(recipe.outputCount);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('canCompress should return true for all valid recipe inputs', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...COMPRESSOR_RECIPES.map(r => r.input)),
                (input) => {
                    expect(canCompress(input)).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('canCompress should return false for invalid inputs', () => {
        fc.assert(
            fc.property(
                fc.string().filter(s => !COMPRESSOR_RECIPES.some(r => r.input === s)),
                (invalidInput) => {
                    expect(canCompress(invalidInput)).toBe(false);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('getCompressorOutput should match recipe definition exactly', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...COMPRESSOR_RECIPES),
                (recipe) => {
                    const output = getCompressorOutput(recipe.input);
                    
                    expect(output).toBeDefined();
                    expect(output!.output).toBe(recipe.output);
                    expect(output!.count).toBe(recipe.outputCount);
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('Compressor Machine Integration', () => {
    it('should inherit BaseMachine configuration', () => {
        const compressor = new Compressor({ x: 0, y: 0, z: 0 });
        
        // Should have default machine config
        expect(compressor.getConfig().maxInput).toBe(32);
        expect(compressor.getConfig().consumption).toBe(2);
        expect(compressor.getConfig().operationTime).toBe(400);
        
        compressor.destroy();
    });

    it('should track input state correctly', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...COMPRESSOR_RECIPES.map(r => r.input)),
                (input) => {
                    const compressor = new Compressor({ x: 0, y: 0, z: 0 });
                    
                    // Initially no input
                    expect(compressor.getCurrentInput()).toBeNull();
                    
                    // Set valid input
                    compressor.setInput(input);
                    expect(compressor.getCurrentInput()).toBe(input);
                    
                    // Clear input
                    compressor.setInput(null);
                    expect(compressor.getCurrentInput()).toBeNull();
                    
                    compressor.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should return all recipes via getRecipes()', () => {
        const compressor = new Compressor({ x: 0, y: 0, z: 0 });
        const recipes = compressor.getRecipes();
        
        expect(recipes.length).toBe(COMPRESSOR_RECIPES.length);
        
        // Verify all recipes are present
        COMPRESSOR_RECIPES.forEach(expected => {
            const found = recipes.find(r => r.input === expected.input);
            expect(found).toBeDefined();
            expect(found!.output).toBe(expected.output);
            expect(found!.outputCount).toBe(expected.outputCount);
        });
        
        compressor.destroy();
    });
});
