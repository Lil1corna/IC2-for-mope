import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { Recycler, RECYCLER_CONFIG, SCRAP_CHANCE, shouldProduceScrap } from './Recycler';

describe('Recycler', () => {
    let recycler: Recycler;

    beforeEach(() => {
        recycler = new Recycler({ x: 0, y: 0, z: 0 });
    });

    describe('Configuration - Requirements 14.1', () => {
        it('should have 45 ticks operation time', () => {
            expect(RECYCLER_CONFIG.operationTime).toBe(45);
        });

        it('should have correct base machine settings', () => {
            expect(RECYCLER_CONFIG.maxInput).toBe(32);
            expect(RECYCLER_CONFIG.consumption).toBe(2);
        });
    });

    describe('Scrap Chance - Requirements 14.2, 14.3', () => {
        it('should have 12.5% scrap chance', () => {
            expect(SCRAP_CHANCE).toBe(0.125);
        });

        it('should produce scrap when random < 0.125', () => {
            expect(shouldProduceScrap(0)).toBe(true);
            expect(shouldProduceScrap(0.1)).toBe(true);
            expect(shouldProduceScrap(0.124)).toBe(true);
        });

        it('should not produce scrap when random >= 0.125', () => {
            expect(shouldProduceScrap(0.125)).toBe(false);
            expect(shouldProduceScrap(0.5)).toBe(false);
            expect(shouldProduceScrap(0.999)).toBe(false);
        });
    });

    describe('Input Handling', () => {
        it('should accept any item as input', () => {
            expect(recycler.setInput('minecraft:dirt')).toBe(true);
            expect(recycler.setInput('minecraft:diamond')).toBe(true);
            expect(recycler.setInput('ic2:copper_ingot')).toBe(true);
        });

        it('should track current input', () => {
            recycler.setInput('minecraft:cobblestone');
            expect(recycler.getCurrentInput()).toBe('minecraft:cobblestone');
        });

        it('should clear input when set to null', () => {
            recycler.setInput('minecraft:dirt');
            recycler.setInput(null);
            expect(recycler.getCurrentInput()).toBeNull();
        });

        it('should report canRecycle true for any item', () => {
            expect(recycler.canRecycle('minecraft:dirt')).toBe(true);
            expect(recycler.canRecycle('anything')).toBe(true);
        });
    });

    describe('Process Complete', () => {
        it('should return not completed when no input', () => {
            const result = recycler.processComplete();
            expect(result.completed).toBe(false);
            expect(result.producedScrap).toBe(false);
        });

        it('should produce scrap with deterministic random (low value)', () => {
            const deterministicRecycler = new Recycler(
                { x: 0, y: 0, z: 0 },
                RECYCLER_CONFIG,
                () => 0.05 // Always produces scrap
            );
            deterministicRecycler.setInput('minecraft:dirt');
            const result = deterministicRecycler.processComplete();
            expect(result.completed).toBe(true);
            expect(result.producedScrap).toBe(true);
            expect(result.output).toBe('ic2:scrap');
        });

        it('should not produce scrap with deterministic random (high value)', () => {
            const deterministicRecycler = new Recycler(
                { x: 0, y: 0, z: 0 },
                RECYCLER_CONFIG,
                () => 0.5 // Never produces scrap
            );
            deterministicRecycler.setInput('minecraft:dirt');
            const result = deterministicRecycler.processComplete();
            expect(result.completed).toBe(true);
            expect(result.producedScrap).toBe(false);
            expect(result.output).toBeUndefined();
        });

        it('should work with processCompleteWithRandom', () => {
            recycler.setInput('minecraft:dirt');
            
            const scrapResult = recycler.processCompleteWithRandom(0.05);
            expect(scrapResult.producedScrap).toBe(true);
            
            const noScrapResult = recycler.processCompleteWithRandom(0.5);
            expect(noScrapResult.producedScrap).toBe(false);
        });
    });

    describe('Getters', () => {
        it('should return scrap chance', () => {
            expect(recycler.getScrapChance()).toBe(0.125);
        });

        it('should return operation time', () => {
            expect(recycler.getOperationTime()).toBe(45);
        });
    });

    /**
     * Property-Based Test: Recycler Probability
     * **Feature: ic2-bedrock-port, Property 9: Recycler Probability**
     * **Validates: Requirements 14.2, 14.3**
     * 
     * For any random value in [0,1), scrap is produced if and only if value < 0.125.
     * This ensures the 12.5% threshold is correctly implemented.
     */
    describe('Property 9: Recycler Probability', () => {
        it('should produce scrap if and only if random value < 0.125', () => {
            fc.assert(
                fc.property(
                    fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
                    (randomValue) => {
                        const producesScrap = shouldProduceScrap(randomValue);
                        const expectedResult = randomValue < SCRAP_CHANCE;
                        
                        return producesScrap === expectedResult;
                    }
                ),
                { numRuns: 1000 }
            );
        });

        it('should have exactly 12.5% threshold boundary', () => {
            // Values just below threshold should produce scrap
            expect(shouldProduceScrap(0.124999)).toBe(true);
            // Values at or above threshold should not produce scrap
            expect(shouldProduceScrap(0.125)).toBe(false);
            expect(shouldProduceScrap(0.125001)).toBe(false);
        });
    });
});
