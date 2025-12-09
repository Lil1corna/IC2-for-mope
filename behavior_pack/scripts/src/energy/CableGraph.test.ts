import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
    CableGraph,
    posToKey,
    keyToPos,
    getAdjacentPositions
} from './CableGraph';
import {
    CABLE_CONFIG,
    CABLE_TYPES,
    isValidCableType,
    getCableConfig
} from './EnergyNetwork';

/**
 * **Feature: ic2-bedrock-port, Property 3: Cable Configuration Correctness**
 * **Validates: Requirements 2.1-2.5**
 * 
 * *For any* cable type, the maxEU and loss values SHALL match:
 * tin(32, 0.025), copper(128, 0.2), gold(512, 0.4), iron(2048, 0.8), glass_fibre(8192, 0.025).
 */
describe('Property 3: Cable Configuration Correctness', () => {
    // Expected cable configurations per IC2 Experimental
    const EXPECTED_CONFIG = {
        tin: { maxEU: 32, loss: 0.025 },
        copper: { maxEU: 128, loss: 0.2 },
        gold: { maxEU: 512, loss: 0.4 },
        iron_hv: { maxEU: 2048, loss: 0.8 },
        glass_fibre: { maxEU: 8192, loss: 0.025 }
    };

    // Arbitrary for cable types
    const cableTypeArb = fc.constantFrom(...CABLE_TYPES);

    it('should have correct maxEU for each cable type', () => {
        fc.assert(
            fc.property(cableTypeArb, (cableType) => {
                const config = CABLE_CONFIG[cableType];
                const expected = EXPECTED_CONFIG[cableType];
                
                expect(config).toBeDefined();
                expect(config.maxEU).toBe(expected.maxEU);
            }),
            { numRuns: 100 }
        );
    });

    it('should have correct loss for each cable type', () => {
        fc.assert(
            fc.property(cableTypeArb, (cableType) => {
                const config = CABLE_CONFIG[cableType];
                const expected = EXPECTED_CONFIG[cableType];
                
                expect(config).toBeDefined();
                expect(config.loss).toBeCloseTo(expected.loss, 10);
            }),
            { numRuns: 100 }
        );
    });


    it('should have all 5 cable types defined', () => {
        expect(CABLE_TYPES).toHaveLength(5);
        expect(CABLE_TYPES).toContain('tin');
        expect(CABLE_TYPES).toContain('copper');
        expect(CABLE_TYPES).toContain('gold');
        expect(CABLE_TYPES).toContain('iron_hv');
        expect(CABLE_TYPES).toContain('glass_fibre');
    });

    it('should validate cable types correctly', () => {
        fc.assert(
            fc.property(cableTypeArb, (cableType) => {
                expect(isValidCableType(cableType)).toBe(true);
            }),
            { numRuns: 100 }
        );
    });

    it('should reject invalid cable types', () => {
        fc.assert(
            fc.property(
                fc.string().filter(s => !CABLE_TYPES.includes(s as any)),
                (invalidType) => {
                    expect(isValidCableType(invalidType)).toBe(false);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should return config via getCableConfig for valid types', () => {
        fc.assert(
            fc.property(cableTypeArb, (cableType) => {
                const config = getCableConfig(cableType);
                expect(config).toBeDefined();
                expect(config).toEqual(CABLE_CONFIG[cableType]);
            }),
            { numRuns: 100 }
        );
    });

    it('should return undefined via getCableConfig for invalid types', () => {
        fc.assert(
            fc.property(
                fc.string().filter(s => !CABLE_TYPES.includes(s as any)),
                (invalidType) => {
                    const config = getCableConfig(invalidType);
                    expect(config).toBeUndefined();
                }
            ),
            { numRuns: 100 }
        );
    });

    // Verify specific values match requirements exactly
    it('tin cable: 32 EU/t max, 0.025 loss (Requirement 2.1)', () => {
        expect(CABLE_CONFIG.tin.maxEU).toBe(32);
        expect(CABLE_CONFIG.tin.loss).toBe(0.025);
    });

    it('copper cable: 128 EU/t max, 0.2 loss (Requirement 2.2)', () => {
        expect(CABLE_CONFIG.copper.maxEU).toBe(128);
        expect(CABLE_CONFIG.copper.loss).toBe(0.2);
    });

    it('gold cable: 512 EU/t max, 0.4 loss (Requirement 2.3)', () => {
        expect(CABLE_CONFIG.gold.maxEU).toBe(512);
        expect(CABLE_CONFIG.gold.loss).toBe(0.4);
    });

    it('iron (HV) cable: 2048 EU/t max, 0.8 loss (Requirement 2.4)', () => {
        expect(CABLE_CONFIG.iron_hv.maxEU).toBe(2048);
        expect(CABLE_CONFIG.iron_hv.loss).toBe(0.8);
    });

    it('glass fibre cable: 8192 EU/t max, 0.025 loss (Requirement 2.5)', () => {
        expect(CABLE_CONFIG.glass_fibre.maxEU).toBe(8192);
        expect(CABLE_CONFIG.glass_fibre.loss).toBe(0.025);
    });
});


/**
 * **Feature: ic2-bedrock-port, Property 18: Network Cache Invalidation**
 * **Validates: Requirements 1.5, 20.2**
 * 
 * *For any* cable place/break event, network paths SHALL be recalculated 
 * and cache SHALL be updated.
 */
describe('Property 18: Network Cache Invalidation', () => {
    let graph: CableGraph;

    beforeEach(() => {
        graph = new CableGraph();
    });

    // Arbitrary for positions
    const positionArb = fc.record({
        x: fc.integer({ min: -100, max: 100 }),
        y: fc.integer({ min: 0, max: 256 }),
        z: fc.integer({ min: -100, max: 100 })
    });

    // Arbitrary for cable types
    const cableTypeArb = fc.constantFrom(...CABLE_TYPES);

    it('should invalidate cache when cable is added', () => {
        fc.assert(
            fc.property(positionArb, cableTypeArb, (position, cableType) => {
                // Setup: add some cables and validate cache
                graph.addCable({ x: 0, y: 64, z: 0 }, 'copper');
                graph.addGenerator({ x: -1, y: 64, z: 0 }, 32);
                graph.addConsumer({ x: 1, y: 64, z: 0 }, 32);
                
                // Force cache calculation
                graph.findPaths({ x: -1, y: 64, z: 0 });
                const versionBefore = graph.getCacheVersion();
                
                // Add new cable - should invalidate cache
                graph.addCable(position, cableType);
                const versionAfter = graph.getCacheVersion();
                
                expect(versionAfter).toBeGreaterThan(versionBefore);
                expect(graph.isCacheValid()).toBe(false);
            }),
            { numRuns: 100 }
        );
    });

    it('should invalidate cache when cable is removed', () => {
        fc.assert(
            fc.property(positionArb, cableTypeArb, (position, cableType) => {
                // Setup: add cable first
                graph.addCable(position, cableType);
                graph.addGenerator({ x: position.x - 1, y: position.y, z: position.z }, 32);
                graph.addConsumer({ x: position.x + 1, y: position.y, z: position.z }, 32);
                
                // Force cache calculation
                graph.findPaths({ x: position.x - 1, y: position.y, z: position.z });
                const versionBefore = graph.getCacheVersion();
                
                // Remove cable - should invalidate cache
                graph.removeCable(position);
                const versionAfter = graph.getCacheVersion();
                
                expect(versionAfter).toBeGreaterThan(versionBefore);
                expect(graph.isCacheValid()).toBe(false);
            }),
            { numRuns: 100 }
        );
    });

    it('should recalculate paths after cache invalidation', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 10 }),
                (cableCount) => {
                    graph.clear();
                    
                    // Build a line of cables
                    for (let i = 0; i < cableCount; i++) {
                        graph.addCable({ x: i, y: 64, z: 0 }, 'copper');
                    }
                    
                    // Add generator at start and consumer at end
                    graph.addGenerator({ x: -1, y: 64, z: 0 }, 32);
                    graph.addConsumer({ x: cableCount, y: 64, z: 0 }, 32);
                    
                    // Calculate paths
                    const pathsBefore = graph.findPaths({ x: -1, y: 64, z: 0 });
                    
                    // Add another cable extending the network
                    graph.addCable({ x: cableCount, y: 64, z: 1 }, 'copper');
                    graph.addConsumer({ x: cableCount, y: 64, z: 2 }, 32);
                    
                    // Paths should be recalculated
                    const pathsAfter = graph.findPaths({ x: -1, y: 64, z: 0 });
                    
                    // Should now have more consumers reachable
                    expect(pathsAfter.length).toBeGreaterThanOrEqual(pathsBefore.length);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should not recalculate when cache is valid and no changes made', () => {
        // Setup network
        graph.addCable({ x: 0, y: 64, z: 0 }, 'copper');
        graph.addGenerator({ x: -1, y: 64, z: 0 }, 32);
        graph.addConsumer({ x: 1, y: 64, z: 0 }, 32);
        
        // First calculation
        const paths1 = graph.findPaths({ x: -1, y: 64, z: 0 });
        const version1 = graph.getCacheVersion();
        
        // Second call should use cache
        const paths2 = graph.findPaths({ x: -1, y: 64, z: 0 });
        const version2 = graph.getCacheVersion();
        
        expect(version1).toBe(version2);
        expect(paths1).toEqual(paths2);
    });

    it('should invalidate cache when consumer is added', () => {
        fc.assert(
            fc.property(positionArb, (position) => {
                graph.clear();
                graph.addCable({ x: 0, y: 64, z: 0 }, 'copper');
                graph.addGenerator({ x: -1, y: 64, z: 0 }, 32);
                
                graph.findPaths({ x: -1, y: 64, z: 0 });
                const versionBefore = graph.getCacheVersion();
                
                graph.addConsumer(position, 32);
                const versionAfter = graph.getCacheVersion();
                
                expect(versionAfter).toBeGreaterThan(versionBefore);
                expect(graph.isCacheValid()).toBe(false);
            }),
            { numRuns: 100 }
        );
    });

    it('should invalidate cache when consumer is removed', () => {
        fc.assert(
            fc.property(positionArb, (position) => {
                graph.clear();
                graph.addCable({ x: 0, y: 64, z: 0 }, 'copper');
                graph.addGenerator({ x: -1, y: 64, z: 0 }, 32);
                graph.addConsumer(position, 32);
                
                graph.findPaths({ x: -1, y: 64, z: 0 });
                const versionBefore = graph.getCacheVersion();
                
                graph.removeConsumer(position);
                const versionAfter = graph.getCacheVersion();
                
                expect(versionAfter).toBeGreaterThan(versionBefore);
                expect(graph.isCacheValid()).toBe(false);
            }),
            { numRuns: 100 }
        );
    });

    it('should invalidate cache when generator is added', () => {
        fc.assert(
            fc.property(positionArb, (position) => {
                graph.clear();
                graph.addCable({ x: 0, y: 64, z: 0 }, 'copper');
                graph.addConsumer({ x: 1, y: 64, z: 0 }, 32);
                
                const versionBefore = graph.getCacheVersion();
                
                graph.addGenerator(position, 32);
                const versionAfter = graph.getCacheVersion();
                
                expect(versionAfter).toBeGreaterThan(versionBefore);
                expect(graph.isCacheValid()).toBe(false);
            }),
            { numRuns: 100 }
        );
    });

    it('should invalidate cache when generator is removed', () => {
        fc.assert(
            fc.property(positionArb, (position) => {
                graph.clear();
                graph.addCable({ x: 0, y: 64, z: 0 }, 'copper');
                graph.addGenerator(position, 32);
                graph.addConsumer({ x: 1, y: 64, z: 0 }, 32);
                
                graph.findPaths(position);
                const versionBefore = graph.getCacheVersion();
                
                graph.removeGenerator(position);
                const versionAfter = graph.getCacheVersion();
                
                expect(versionAfter).toBeGreaterThan(versionBefore);
                expect(graph.isCacheValid()).toBe(false);
            }),
            { numRuns: 100 }
        );
    });
});


// Unit tests for CableGraph utility functions
describe('CableGraph Utility Functions', () => {
    describe('posToKey and keyToPos', () => {
        it('should convert position to key and back', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: -1000, max: 1000 }),
                    fc.integer({ min: 0, max: 256 }),
                    fc.integer({ min: -1000, max: 1000 }),
                    (x, y, z) => {
                        const pos = { x, y, z };
                        const key = posToKey(pos);
                        const restored = keyToPos(key);
                        
                        expect(restored.x).toBe(Math.floor(x));
                        expect(restored.y).toBe(Math.floor(y));
                        expect(restored.z).toBe(Math.floor(z));
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('getAdjacentPositions', () => {
        it('should return 6 adjacent positions', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: -100, max: 100 }),
                    fc.integer({ min: 0, max: 256 }),
                    fc.integer({ min: -100, max: 100 }),
                    (x, y, z) => {
                        const pos = { x, y, z };
                        const adjacent = getAdjacentPositions(pos);
                        
                        expect(adjacent).toHaveLength(6);
                        
                        // Check all 6 directions
                        const keys = adjacent.map(p => posToKey(p));
                        expect(keys).toContain(posToKey({ x: x + 1, y, z }));
                        expect(keys).toContain(posToKey({ x: x - 1, y, z }));
                        expect(keys).toContain(posToKey({ x, y: y + 1, z }));
                        expect(keys).toContain(posToKey({ x, y: y - 1, z }));
                        expect(keys).toContain(posToKey({ x, y, z: z + 1 }));
                        expect(keys).toContain(posToKey({ x, y, z: z - 1 }));
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});

// Unit tests for CableGraph pathfinding
describe('CableGraph Pathfinding', () => {
    let graph: CableGraph;

    beforeEach(() => {
        graph = new CableGraph();
    });

    it('should find path through single cable', () => {
        graph.addCable({ x: 0, y: 64, z: 0 }, 'copper');
        graph.addGenerator({ x: -1, y: 64, z: 0 }, 128);
        graph.addConsumer({ x: 1, y: 64, z: 0 }, 128);

        const paths = graph.findPaths({ x: -1, y: 64, z: 0 });
        
        expect(paths).toHaveLength(1);
        expect(paths[0].distance).toBe(2);
        expect(paths[0].totalLoss).toBeCloseTo(CABLE_CONFIG.copper.loss, 10);
    });

    it('should find path through multiple cables', () => {
        // Create a line of 5 copper cables
        for (let i = 0; i < 5; i++) {
            graph.addCable({ x: i, y: 64, z: 0 }, 'copper');
        }
        graph.addGenerator({ x: -1, y: 64, z: 0 }, 128);
        graph.addConsumer({ x: 5, y: 64, z: 0 }, 128);

        const paths = graph.findPaths({ x: -1, y: 64, z: 0 });
        
        expect(paths).toHaveLength(1);
        expect(paths[0].distance).toBe(6);
        // Total loss = 5 cables * 0.2 loss each
        expect(paths[0].totalLoss).toBeCloseTo(5 * CABLE_CONFIG.copper.loss, 10);
    });

    it('should track minimum voltage along path', () => {
        // Mix of cable types: copper (128) -> tin (32) -> copper (128)
        graph.addCable({ x: 0, y: 64, z: 0 }, 'copper');
        graph.addCable({ x: 1, y: 64, z: 0 }, 'tin');
        graph.addCable({ x: 2, y: 64, z: 0 }, 'copper');
        graph.addGenerator({ x: -1, y: 64, z: 0 }, 128);
        graph.addConsumer({ x: 3, y: 64, z: 0 }, 128);

        const paths = graph.findPaths({ x: -1, y: 64, z: 0 });
        
        expect(paths).toHaveLength(1);
        // Max voltage should be limited by tin cable (32)
        expect(paths[0].maxVoltage).toBe(32);
    });

    it('should find multiple consumers', () => {
        // T-junction: generator -> cable -> two consumers
        graph.addCable({ x: 0, y: 64, z: 0 }, 'copper');
        graph.addGenerator({ x: -1, y: 64, z: 0 }, 128);
        graph.addConsumer({ x: 1, y: 64, z: 0 }, 128);
        graph.addConsumer({ x: 0, y: 65, z: 0 }, 128);

        const paths = graph.findPaths({ x: -1, y: 64, z: 0 });
        
        expect(paths).toHaveLength(2);
    });

    it('should return empty paths when no consumers reachable', () => {
        graph.addCable({ x: 0, y: 64, z: 0 }, 'copper');
        graph.addGenerator({ x: -1, y: 64, z: 0 }, 128);
        // No consumer added

        const paths = graph.findPaths({ x: -1, y: 64, z: 0 });
        
        expect(paths).toHaveLength(0);
    });

    it('should find directly adjacent consumer without cables', () => {
        graph.addGenerator({ x: 0, y: 64, z: 0 }, 128);
        graph.addConsumer({ x: 1, y: 64, z: 0 }, 128);

        const paths = graph.findPaths({ x: 0, y: 64, z: 0 });
        
        expect(paths).toHaveLength(1);
        expect(paths[0].distance).toBe(1);
        expect(paths[0].totalLoss).toBe(0);
    });
});
