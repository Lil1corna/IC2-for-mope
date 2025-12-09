import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
    Extractor,
    EXTRACTOR_RECIPES,
    findExtractorRecipe,
    canExtract,
    getExtractorOutput
} from './Extractor';

/**
 * **Feature: ic2-bedrock-port, Property 8: Recipe Output Correctness** (Extractor part)
 * **Validates: Requirements 13.1-13.3**
 * 
 * *For any* valid recipe input processed to completion, 
 * output item and count SHALL match recipe definition exactly.
 */
describe('Property 8: Recipe Output Correctness (Extractor)', () => {
    // Generator for valid Extractor recipe inputs
    const validRecipeInputArb = fc.constantFrom(...EXTRACTOR_RECIPES.map(r => r.input));

    it('should produce correct output for any valid recipe input', () => {
        fc.assert(
            fc.property(
                validRecipeInputArb,
                (input) => {
                    const extractor = new Extractor({ x: 0, y: 0, z: 0 });
                    
                    // Set input
                    const canProcess = extractor.setInput(input);
                    expect(canProcess).toBe(true);
                    
                    // Get expected recipe
                    const expectedRecipe = EXTRACTOR_RECIPES.find(r => r.input === input);
                    expect(expectedRecipe).toBeDefined();
                    
                    // Process and check output
                    const result = extractor.processComplete();
                    
                    expect(result.success).toBe(true);
                    expect(result.output).toBe(expectedRecipe!.output);
                    expect(result.outputCount).toBe(expectedRecipe!.outputCount);
                    
                    extractor.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });


    it('should produce 3x Rubber from Sticky Resin (Requirement 13.1)', () => {
        const output = getExtractorOutput('ic2:sticky_resin');
        
        expect(output).toBeDefined();
        expect(output!.output).toBe('ic2:rubber');
        expect(output!.count).toBe(3);
    });

    it('should produce 1x Rubber from Rubber Wood (Requirement 13.2)', () => {
        const output = getExtractorOutput('ic2:rubber_wood');
        
        expect(output).toBeDefined();
        expect(output!.output).toBe('ic2:rubber');
        expect(output!.count).toBe(1);
    });

    it('should produce Sulfur from Gunpowder (Requirement 13.3)', () => {
        const output = getExtractorOutput('minecraft:gunpowder');
        
        expect(output).toBeDefined();
        expect(output!.output).toBe('ic2:sulfur');
        expect(output!.count).toBe(1);
    });

    it('should reject invalid inputs', () => {
        fc.assert(
            fc.property(
                fc.string().filter(s => !EXTRACTOR_RECIPES.some(r => r.input === s)),
                (invalidInput) => {
                    const extractor = new Extractor({ x: 0, y: 0, z: 0 });
                    
                    const canProcess = extractor.setInput(invalidInput);
                    expect(canProcess).toBe(false);
                    
                    const result = extractor.processComplete();
                    expect(result.success).toBe(false);
                    
                    extractor.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('Extractor Recipe Lookup Functions', () => {
    it('findExtractorRecipe should return correct recipe for valid inputs', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...EXTRACTOR_RECIPES),
                (recipe) => {
                    const found = findExtractorRecipe(recipe.input);
                    
                    expect(found).toBeDefined();
                    expect(found!.input).toBe(recipe.input);
                    expect(found!.output).toBe(recipe.output);
                    expect(found!.outputCount).toBe(recipe.outputCount);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('canExtract should return true for all valid recipe inputs', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...EXTRACTOR_RECIPES.map(r => r.input)),
                (input) => {
                    expect(canExtract(input)).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('canExtract should return false for invalid inputs', () => {
        fc.assert(
            fc.property(
                fc.string().filter(s => !EXTRACTOR_RECIPES.some(r => r.input === s)),
                (invalidInput) => {
                    expect(canExtract(invalidInput)).toBe(false);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('getExtractorOutput should match recipe definition exactly', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...EXTRACTOR_RECIPES),
                (recipe) => {
                    const output = getExtractorOutput(recipe.input);
                    
                    expect(output).toBeDefined();
                    expect(output!.output).toBe(recipe.output);
                    expect(output!.count).toBe(recipe.outputCount);
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('Extractor Machine Integration', () => {
    it('should inherit BaseMachine configuration', () => {
        const extractor = new Extractor({ x: 0, y: 0, z: 0 });
        
        // Should have default machine config
        expect(extractor.getConfig().maxInput).toBe(32);
        expect(extractor.getConfig().consumption).toBe(2);
        expect(extractor.getConfig().operationTime).toBe(400);
        
        extractor.destroy();
    });

    it('should track input state correctly', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...EXTRACTOR_RECIPES.map(r => r.input)),
                (input) => {
                    const extractor = new Extractor({ x: 0, y: 0, z: 0 });
                    
                    // Initially no input
                    expect(extractor.getCurrentInput()).toBeNull();
                    
                    // Set valid input
                    extractor.setInput(input);
                    expect(extractor.getCurrentInput()).toBe(input);
                    
                    // Clear input
                    extractor.setInput(null);
                    expect(extractor.getCurrentInput()).toBeNull();
                    
                    extractor.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should return all recipes via getRecipes()', () => {
        const extractor = new Extractor({ x: 0, y: 0, z: 0 });
        const recipes = extractor.getRecipes();
        
        expect(recipes.length).toBe(EXTRACTOR_RECIPES.length);
        
        // Verify all recipes are present
        EXTRACTOR_RECIPES.forEach(expected => {
            const found = recipes.find(r => r.input === expected.input);
            expect(found).toBeDefined();
            expect(found!.output).toBe(expected.output);
            expect(found!.outputCount).toBe(expected.outputCount);
        });
        
        extractor.destroy();
    });
});
