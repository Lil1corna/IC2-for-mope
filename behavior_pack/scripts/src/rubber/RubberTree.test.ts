import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
    ResinSpotState,
    RUBBER_TREE_CONFIG,
    generateResinSpotState,
    calculateResinDrop,
    useTreetap,
    processRandomTick,
    calculateBreakDrops,
    RubberTreeManager
} from './RubberTree';

/**
 * **Feature: ic2-bedrock-port, Property 16: Rubber Tree Resin Drop**
 * **Validates: Requirements 4.2**
 * 
 * *For any* treetap use on wet resin spot, drop count SHALL be 1-3 
 * and state SHALL change to dry.
 */
describe('Property 16: Rubber Tree Resin Drop', () => {
    // Arbitrary for random values (0-1 exclusive of 1)
    const randomArb = fc.double({ min: 0, max: 0.9999999, noNaN: true });

    it('should drop 1-3 resin when using treetap on wet spot', () => {
        fc.assert(
            fc.property(
                randomArb,
                (random) => {
                    const result = useTreetap(ResinSpotState.WET, random);
                    
                    // Should be successful
                    expect(result.success).toBe(true);
                    
                    // Should drop 1-3 resin
                    expect(result.resinDropped).toBeGreaterThanOrEqual(RUBBER_TREE_CONFIG.resinDropMin);
                    expect(result.resinDropped).toBeLessThanOrEqual(RUBBER_TREE_CONFIG.resinDropMax);
                    
                    // Should change state to dry
                    expect(result.newState).toBe(ResinSpotState.DRY);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should always change wet spot to dry after treetap use', () => {
        fc.assert(
            fc.property(
                randomArb,
                (random) => {
                    const result = useTreetap(ResinSpotState.WET, random);
                    expect(result.newState).toBe(ResinSpotState.DRY);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should fail when using treetap on non-wet spots', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(ResinSpotState.NONE, ResinSpotState.DRY),
                randomArb,
                (state, random) => {
                    const result = useTreetap(state, random);
                    
                    // Should fail
                    expect(result.success).toBe(false);
                    
                    // Should drop nothing
                    expect(result.resinDropped).toBe(0);
                    
                    // State should remain unchanged
                    expect(result.newState).toBe(state);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should produce integer drop counts between 1 and 3', () => {
        fc.assert(
            fc.property(
                randomArb,
                (random) => {
                    const dropCount = calculateResinDrop(random);
                    
                    expect(Number.isInteger(dropCount)).toBe(true);
                    expect(dropCount).toBeGreaterThanOrEqual(1);
                    expect(dropCount).toBeLessThanOrEqual(3);
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('Rubber Tree Generation', () => {
    it('should generate wet spots with 25% probability', () => {
        // Test boundary conditions
        // Random < 0.25 should give WET
        expect(generateResinSpotState(0)).toBe(ResinSpotState.WET);
        expect(generateResinSpotState(0.24)).toBe(ResinSpotState.WET);
        
        // Random >= 0.25 should give NONE
        expect(generateResinSpotState(0.25)).toBe(ResinSpotState.NONE);
        expect(generateResinSpotState(0.5)).toBe(ResinSpotState.NONE);
        expect(generateResinSpotState(0.99)).toBe(ResinSpotState.NONE);
    });

    it('should generate valid resin spot states', () => {
        fc.assert(
            fc.property(
                fc.double({ min: 0, max: 0.9999999, noNaN: true }),
                (random) => {
                    const state = generateResinSpotState(random);
                    expect([ResinSpotState.NONE, ResinSpotState.WET]).toContain(state);
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('Random Tick Regeneration', () => {
    it('should have 10% chance to regenerate dry to wet', () => {
        // Test boundary conditions
        // Random < 0.1 should regenerate
        expect(processRandomTick(ResinSpotState.DRY, 0)).toBe(ResinSpotState.WET);
        expect(processRandomTick(ResinSpotState.DRY, 0.09)).toBe(ResinSpotState.WET);
        
        // Random >= 0.1 should stay dry
        expect(processRandomTick(ResinSpotState.DRY, 0.1)).toBe(ResinSpotState.DRY);
        expect(processRandomTick(ResinSpotState.DRY, 0.5)).toBe(ResinSpotState.DRY);
    });

    it('should not change non-dry spots', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(ResinSpotState.NONE, ResinSpotState.WET),
                fc.double({ min: 0, max: 0.9999999, noNaN: true }),
                (state, random) => {
                    const newState = processRandomTick(state, random);
                    expect(newState).toBe(state);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should only produce valid states after random tick', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(ResinSpotState.NONE, ResinSpotState.DRY, ResinSpotState.WET),
                fc.double({ min: 0, max: 0.9999999, noNaN: true }),
                (state, random) => {
                    const newState = processRandomTick(state, random);
                    expect([ResinSpotState.NONE, ResinSpotState.DRY, ResinSpotState.WET]).toContain(newState);
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('Break Drop Chance', () => {
    it('should always drop resin from wet spots', () => {
        fc.assert(
            fc.property(
                fc.double({ min: 0, max: 0.9999999, noNaN: true }),
                (random) => {
                    const result = calculateBreakDrops(ResinSpotState.WET, random);
                    expect(result.droppedResin).toBe(true);
                    expect(result.resinCount).toBe(1);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should have 50% chance to drop from dry spots', () => {
        // Test boundary conditions
        // Random < 0.5 should drop
        expect(calculateBreakDrops(ResinSpotState.DRY, 0).droppedResin).toBe(true);
        expect(calculateBreakDrops(ResinSpotState.DRY, 0.49).droppedResin).toBe(true);
        
        // Random >= 0.5 should not drop
        expect(calculateBreakDrops(ResinSpotState.DRY, 0.5).droppedResin).toBe(false);
        expect(calculateBreakDrops(ResinSpotState.DRY, 0.99).droppedResin).toBe(false);
    });

    it('should never drop from spots with no resin', () => {
        fc.assert(
            fc.property(
                fc.double({ min: 0, max: 0.9999999, noNaN: true }),
                (random) => {
                    const result = calculateBreakDrops(ResinSpotState.NONE, random);
                    expect(result.droppedResin).toBe(false);
                    expect(result.resinCount).toBe(0);
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('RubberTreeManager', () => {
    it('should register and track rubber wood blocks', () => {
        const manager = new RubberTreeManager();
        
        // Register with forced wet state
        const state = manager.registerRubberWood(0, 64, 0, 0.1); // random < 0.25 = WET
        expect(state).toBe(ResinSpotState.WET);
        
        const retrieved = manager.getState(0, 64, 0);
        expect(retrieved?.resinSpot).toBe(ResinSpotState.WET);
        
        manager.clear();
    });

    it('should handle treetap correctly', () => {
        const manager = new RubberTreeManager();
        
        // Register with wet state
        manager.registerRubberWood(0, 64, 0, 0.1);
        
        // Use treetap
        const result = manager.handleTreetap(0, 64, 0, 0.5);
        expect(result?.success).toBe(true);
        expect(result?.resinDropped).toBeGreaterThanOrEqual(1);
        expect(result?.resinDropped).toBeLessThanOrEqual(3);
        
        // State should now be dry
        const state = manager.getState(0, 64, 0);
        expect(state?.resinSpot).toBe(ResinSpotState.DRY);
        
        manager.clear();
    });

    it('should handle random tick correctly', () => {
        const manager = new RubberTreeManager();
        
        // Register and set to dry
        manager.registerRubberWood(0, 64, 0, 0.5); // NONE state
        manager.setState(0, 64, 0, { resinSpot: ResinSpotState.DRY });
        
        // Random tick with low value should regenerate
        const newState = manager.handleRandomTick(0, 64, 0, 0.05);
        expect(newState).toBe(ResinSpotState.WET);
        
        manager.clear();
    });

    it('should handle break correctly', () => {
        const manager = new RubberTreeManager();
        
        // Register with wet state
        manager.registerRubberWood(0, 64, 0, 0.1);
        
        // Break the block
        const result = manager.handleBreak(0, 64, 0, 0.3);
        expect(result?.droppedResin).toBe(true);
        expect(result?.resinCount).toBe(1);
        
        // Block should be unregistered
        expect(manager.getState(0, 64, 0)).toBeUndefined();
        
        manager.clear();
    });

    it('should return undefined for non-existent blocks', () => {
        const manager = new RubberTreeManager();
        
        expect(manager.getState(999, 999, 999)).toBeUndefined();
        expect(manager.handleTreetap(999, 999, 999)).toBeUndefined();
        expect(manager.handleRandomTick(999, 999, 999)).toBeUndefined();
        expect(manager.handleBreak(999, 999, 999)).toBeUndefined();
    });
});
