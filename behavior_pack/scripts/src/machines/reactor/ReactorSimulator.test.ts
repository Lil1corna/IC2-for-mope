import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
    ReactorSimulator,
    ReactorComponentType,
    REACTOR_SLOTS,
    REACTOR_ROWS,
    REACTOR_COLS,
    REACTOR_THRESHOLDS,
    REACTOR_COMPONENT_CONFIG,
    calculateCellEU,
    calculateCellHeat,
    slotToCoords,
    coordsToSlot,
    getAdjacentSlots,
    countAdjacentUraniumCells
} from './ReactorSimulator';

/**
 * **Feature: ic2-bedrock-port, Property 10: Reactor EU Formula**
 * **Validates: Requirements 15.2**
 * 
 * *For any* uranium cell with N adjacent cells, EU output SHALL equal 5 × (N + 1).
 */
describe('Property 10: Reactor EU Formula', () => {
    it('should calculate EU = 5 × (N + 1) for any number of adjacent cells', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 4 }),
                (adjacentCells) => {
                    const eu = calculateCellEU(adjacentCells);
                    const expected = 5 * (adjacentCells + 1);
                    expect(eu).toBe(expected);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should produce correct EU values for all valid adjacent counts', () => {
        // N=0: EU = 5 × 1 = 5
        expect(calculateCellEU(0)).toBe(5);
        // N=1: EU = 5 × 2 = 10
        expect(calculateCellEU(1)).toBe(10);
        // N=2: EU = 5 × 3 = 15
        expect(calculateCellEU(2)).toBe(15);
        // N=3: EU = 5 × 4 = 20
        expect(calculateCellEU(3)).toBe(20);
        // N=4: EU = 5 × 5 = 25
        expect(calculateCellEU(4)).toBe(25);
    });


    it('should clamp negative adjacent cells to 0', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: -100, max: -1 }),
                (negativeCount) => {
                    const eu = calculateCellEU(negativeCount);
                    // Should clamp to 0, so EU = 5 × (0 + 1) = 5
                    expect(eu).toBe(5);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should clamp adjacent cells > 4 to 4', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 5, max: 100 }),
                (highCount) => {
                    const eu = calculateCellEU(highCount);
                    // Should clamp to 4, so EU = 5 × (4 + 1) = 25
                    expect(eu).toBe(25);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should calculate correct total EU for reactor with multiple cells', () => {
        fc.assert(
            fc.property(
                // Generate a list of slot indices for uranium cells (0-53)
                fc.array(fc.integer({ min: 0, max: REACTOR_SLOTS - 1 }), { minLength: 1, maxLength: 10 }),
                (cellSlots) => {
                    // Remove duplicates
                    const uniqueSlots = [...new Set(cellSlots)];
                    
                    const reactor = new ReactorSimulator({ x: 0, y: 0, z: 0 });
                    
                    // Place uranium cells
                    for (const slot of uniqueSlots) {
                        reactor.setSlot(slot, ReactorSimulator.createUraniumCell());
                    }
                    
                    // Calculate expected EU
                    let expectedEU = 0;
                    for (const slot of uniqueSlots) {
                        const adjacentCount = countAdjacentUraniumCells(reactor.getState().slots, slot);
                        expectedEU += calculateCellEU(adjacentCount);
                    }
                    
                    // Tick and verify
                    const result = reactor.tick();
                    expect(result.euProduced).toBe(expectedEU);
                    
                    reactor.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });
});


/**
 * **Feature: ic2-bedrock-port, Property 11: Reactor Heat Formula**
 * **Validates: Requirements 15.3**
 * 
 * *For any* uranium cell with N adjacent cells, heat output SHALL equal 2 × (N + 1) × (N + 2).
 */
describe('Property 11: Reactor Heat Formula', () => {
    it('should calculate Heat = 2 × (N + 1) × (N + 2) for any number of adjacent cells', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 4 }),
                (adjacentCells) => {
                    const heat = calculateCellHeat(adjacentCells);
                    const expected = 2 * (adjacentCells + 1) * (adjacentCells + 2);
                    expect(heat).toBe(expected);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should produce correct heat values for all valid adjacent counts', () => {
        // N=0: Heat = 2 × 1 × 2 = 4
        expect(calculateCellHeat(0)).toBe(4);
        // N=1: Heat = 2 × 2 × 3 = 12
        expect(calculateCellHeat(1)).toBe(12);
        // N=2: Heat = 2 × 3 × 4 = 24
        expect(calculateCellHeat(2)).toBe(24);
        // N=3: Heat = 2 × 4 × 5 = 40
        expect(calculateCellHeat(3)).toBe(40);
        // N=4: Heat = 2 × 5 × 6 = 60
        expect(calculateCellHeat(4)).toBe(60);
    });

    it('should clamp negative adjacent cells to 0', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: -100, max: -1 }),
                (negativeCount) => {
                    const heat = calculateCellHeat(negativeCount);
                    // Should clamp to 0, so Heat = 2 × 1 × 2 = 4
                    expect(heat).toBe(4);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should clamp adjacent cells > 4 to 4', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 5, max: 100 }),
                (highCount) => {
                    const heat = calculateCellHeat(highCount);
                    // Should clamp to 4, so Heat = 2 × 5 × 6 = 60
                    expect(heat).toBe(60);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should calculate correct total heat for reactor with multiple cells', () => {
        fc.assert(
            fc.property(
                // Generate a list of slot indices for uranium cells (0-53)
                fc.array(fc.integer({ min: 0, max: REACTOR_SLOTS - 1 }), { minLength: 1, maxLength: 10 }),
                (cellSlots) => {
                    // Remove duplicates
                    const uniqueSlots = [...new Set(cellSlots)];
                    
                    const reactor = new ReactorSimulator({ x: 0, y: 0, z: 0 });
                    
                    // Place uranium cells
                    for (const slot of uniqueSlots) {
                        reactor.setSlot(slot, ReactorSimulator.createUraniumCell());
                    }
                    
                    // Calculate expected heat
                    let expectedHeat = 0;
                    for (const slot of uniqueSlots) {
                        const adjacentCount = countAdjacentUraniumCells(reactor.getState().slots, slot);
                        expectedHeat += calculateCellHeat(adjacentCount);
                    }
                    
                    // Tick and verify
                    const result = reactor.tick();
                    expect(result.heatProduced).toBe(expectedHeat);
                    
                    reactor.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });
});


describe('Reactor Grid Structure', () => {
    it('should have 54 slots (6×9 grid)', () => {
        expect(REACTOR_SLOTS).toBe(54);
        expect(REACTOR_ROWS).toBe(6);
        expect(REACTOR_COLS).toBe(9);
        expect(REACTOR_ROWS * REACTOR_COLS).toBe(REACTOR_SLOTS);
    });

    it('should correctly convert slot to coordinates', () => {
        // First slot (0) = row 0, col 0
        expect(slotToCoords(0)).toEqual({ row: 0, col: 0 });
        // Slot 8 = row 0, col 8 (end of first row)
        expect(slotToCoords(8)).toEqual({ row: 0, col: 8 });
        // Slot 9 = row 1, col 0 (start of second row)
        expect(slotToCoords(9)).toEqual({ row: 1, col: 0 });
        // Last slot (53) = row 5, col 8
        expect(slotToCoords(53)).toEqual({ row: 5, col: 8 });
    });

    it('should correctly convert coordinates to slot', () => {
        expect(coordsToSlot(0, 0)).toBe(0);
        expect(coordsToSlot(0, 8)).toBe(8);
        expect(coordsToSlot(1, 0)).toBe(9);
        expect(coordsToSlot(5, 8)).toBe(53);
    });

    it('should round-trip slot to coords and back', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: REACTOR_SLOTS - 1 }),
                (slot) => {
                    const coords = slotToCoords(slot);
                    const backToSlot = coordsToSlot(coords.row, coords.col);
                    expect(backToSlot).toBe(slot);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should get correct adjacent slots for corner positions', () => {
        // Top-left corner (slot 0) - only right and down
        const topLeft = getAdjacentSlots(0);
        expect(topLeft).toContain(1);  // right
        expect(topLeft).toContain(9);  // down
        expect(topLeft.length).toBe(2);

        // Top-right corner (slot 8) - only left and down
        const topRight = getAdjacentSlots(8);
        expect(topRight).toContain(7);  // left
        expect(topRight).toContain(17); // down
        expect(topRight.length).toBe(2);

        // Bottom-left corner (slot 45) - only right and up
        const bottomLeft = getAdjacentSlots(45);
        expect(bottomLeft).toContain(36); // up
        expect(bottomLeft).toContain(46); // right
        expect(bottomLeft.length).toBe(2);

        // Bottom-right corner (slot 53) - only left and up
        const bottomRight = getAdjacentSlots(53);
        expect(bottomRight).toContain(44); // up
        expect(bottomRight).toContain(52); // left
        expect(bottomRight.length).toBe(2);
    });

    it('should get 4 adjacent slots for center positions', () => {
        // Center slot (e.g., slot 22 = row 2, col 4)
        const center = getAdjacentSlots(22);
        expect(center).toContain(13); // up
        expect(center).toContain(31); // down
        expect(center).toContain(21); // left
        expect(center).toContain(23); // right
        expect(center.length).toBe(4);
    });
});

describe('Reactor State Management', () => {
    it('should initialize with empty slots and zero heat', () => {
        const reactor = new ReactorSimulator({ x: 0, y: 0, z: 0 });
        const state = reactor.getState();
        
        expect(state.slots.length).toBe(REACTOR_SLOTS);
        expect(state.slots.every(s => s === null)).toBe(true);
        expect(state.hullHeat).toBe(0);
        
        reactor.destroy();
    });

    it('should correctly set and get slot components', () => {
        const reactor = new ReactorSimulator({ x: 0, y: 0, z: 0 });
        
        const cell = ReactorSimulator.createUraniumCell();
        reactor.setSlot(0, cell);
        
        const retrieved = reactor.getSlot(0);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.type).toBe(ReactorComponentType.URANIUM_CELL);
        
        reactor.destroy();
    });

    it('should count uranium cells correctly', () => {
        fc.assert(
            fc.property(
                fc.array(fc.integer({ min: 0, max: REACTOR_SLOTS - 1 }), { minLength: 0, maxLength: 20 }),
                (cellSlots) => {
                    const uniqueSlots = [...new Set(cellSlots)];
                    
                    const reactor = new ReactorSimulator({ x: 0, y: 0, z: 0 });
                    
                    for (const slot of uniqueSlots) {
                        reactor.setSlot(slot, ReactorSimulator.createUraniumCell());
                    }
                    
                    expect(reactor.countUraniumCells()).toBe(uniqueSlots.length);
                    
                    reactor.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });
});


/**
 * **Feature: ic2-bedrock-port, Property 12: Reactor Heat Thresholds**
 * **Validates: Requirements 15.5, 15.6, 15.7, 15.8**
 * 
 * *For any* reactor with hull heat H: fire at H>4000, evaporate at H>7000, radiation at H>8500, meltdown at H≥10000.
 */
describe('Property 12: Reactor Heat Thresholds', () => {
    it('should trigger fire effect when hull heat > 4000', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 4001, max: 15000 }),
                (hullHeat) => {
                    const reactor = new ReactorSimulator({ x: 0, y: 0, z: 0 });
                    reactor.setHullHeat(hullHeat);
                    
                    // Place a uranium cell to trigger a tick
                    reactor.setSlot(0, ReactorSimulator.createUraniumCell());
                    const result = reactor.tick();
                    
                    // Fire should be triggered when heat > 4000
                    expect(result.fireTriggered).toBe(true);
                    
                    reactor.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should NOT trigger fire effect when hull heat <= 4000', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 4000 }),
                (hullHeat) => {
                    const reactor = new ReactorSimulator({ x: 0, y: 0, z: 0 });
                    reactor.setHullHeat(hullHeat);
                    
                    // Tick without uranium cells to avoid adding heat
                    const result = reactor.tick();
                    
                    // Fire should NOT be triggered when heat <= 4000
                    expect(result.fireTriggered).toBe(false);
                    
                    reactor.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should trigger evaporate effect when hull heat > 7000', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 7001, max: 15000 }),
                (hullHeat) => {
                    const reactor = new ReactorSimulator({ x: 0, y: 0, z: 0 });
                    reactor.setHullHeat(hullHeat);
                    
                    reactor.setSlot(0, ReactorSimulator.createUraniumCell());
                    const result = reactor.tick();
                    
                    // Evaporate should be triggered when heat > 7000
                    expect(result.evaporateTriggered).toBe(true);
                    
                    reactor.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should NOT trigger evaporate effect when hull heat <= 7000', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 7000 }),
                (hullHeat) => {
                    const reactor = new ReactorSimulator({ x: 0, y: 0, z: 0 });
                    reactor.setHullHeat(hullHeat);
                    
                    const result = reactor.tick();
                    
                    // Evaporate should NOT be triggered when heat <= 7000
                    expect(result.evaporateTriggered).toBe(false);
                    
                    reactor.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should trigger radiation effect when hull heat > 8500', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 8501, max: 15000 }),
                (hullHeat) => {
                    const reactor = new ReactorSimulator({ x: 0, y: 0, z: 0 });
                    reactor.setHullHeat(hullHeat);
                    
                    reactor.setSlot(0, ReactorSimulator.createUraniumCell());
                    const result = reactor.tick();
                    
                    // Radiation should be triggered when heat > 8500
                    expect(result.radiationTriggered).toBe(true);
                    
                    reactor.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should NOT trigger radiation effect when hull heat <= 8500', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 8500 }),
                (hullHeat) => {
                    const reactor = new ReactorSimulator({ x: 0, y: 0, z: 0 });
                    reactor.setHullHeat(hullHeat);
                    
                    const result = reactor.tick();
                    
                    // Radiation should NOT be triggered when heat <= 8500
                    expect(result.radiationTriggered).toBe(false);
                    
                    reactor.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should trigger meltdown when hull heat >= 10000', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 10000, max: 20000 }),
                (hullHeat) => {
                    const reactor = new ReactorSimulator({ x: 0, y: 0, z: 0 });
                    reactor.setHullHeat(hullHeat);
                    
                    reactor.setSlot(0, ReactorSimulator.createUraniumCell());
                    const result = reactor.tick();
                    
                    // Meltdown should be triggered when heat >= 10000
                    expect(result.meltdown).toBe(true);
                    
                    reactor.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should NOT trigger meltdown when hull heat < 10000', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 9999 }),
                (hullHeat) => {
                    const reactor = new ReactorSimulator({ x: 0, y: 0, z: 0 });
                    reactor.setHullHeat(hullHeat);
                    
                    const result = reactor.tick();
                    
                    // Meltdown should NOT be triggered when heat < 10000
                    expect(result.meltdown).toBe(false);
                    
                    reactor.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should calculate correct explosion force on meltdown', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 10000, max: 20000 }),
                fc.array(fc.integer({ min: 0, max: REACTOR_SLOTS - 1 }), { minLength: 1, maxLength: 10 }),
                (hullHeat, cellSlots) => {
                    const uniqueSlots = [...new Set(cellSlots)];
                    
                    const reactor = new ReactorSimulator({ x: 0, y: 0, z: 0 });
                    reactor.setHullHeat(hullHeat);
                    
                    // Place uranium cells
                    for (const slot of uniqueSlots) {
                        reactor.setSlot(slot, ReactorSimulator.createUraniumCell());
                    }
                    
                    const result = reactor.tick();
                    
                    // Explosion force = uranium_cells × 10
                    expect(result.meltdown).toBe(true);
                    expect(result.explosionForce).toBe(uniqueSlots.length * 10);
                    
                    reactor.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should have correct threshold hierarchy (fire < evaporate < radiation < meltdown)', () => {
        // Verify threshold values are in correct order
        expect(REACTOR_THRESHOLDS.fire).toBeLessThan(REACTOR_THRESHOLDS.evaporate);
        expect(REACTOR_THRESHOLDS.evaporate).toBeLessThan(REACTOR_THRESHOLDS.radiation);
        expect(REACTOR_THRESHOLDS.radiation).toBeLessThan(REACTOR_THRESHOLDS.meltdown);
        
        // Verify exact values
        expect(REACTOR_THRESHOLDS.fire).toBe(4000);
        expect(REACTOR_THRESHOLDS.evaporate).toBe(7000);
        expect(REACTOR_THRESHOLDS.radiation).toBe(8500);
        expect(REACTOR_THRESHOLDS.meltdown).toBe(10000);
    });

    it('should trigger all lower thresholds when higher threshold is reached', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 10000, max: 20000 }),
                (hullHeat) => {
                    const reactor = new ReactorSimulator({ x: 0, y: 0, z: 0 });
                    reactor.setHullHeat(hullHeat);
                    
                    reactor.setSlot(0, ReactorSimulator.createUraniumCell());
                    const result = reactor.tick();
                    
                    // At meltdown level, all thresholds should be triggered
                    expect(result.fireTriggered).toBe(true);
                    expect(result.evaporateTriggered).toBe(true);
                    expect(result.radiationTriggered).toBe(true);
                    expect(result.meltdown).toBe(true);
                    
                    reactor.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });
});


/**
 * **Feature: ic2-bedrock-port, Property 13: Reactor Component Heat Removal**
 * **Validates: Requirements 16.1, 16.2, 16.3**
 * 
 * *For any* heat vent, removal rate SHALL match: basic(6 hU), reactor(5 hU from hull), overclocked(20 hU).
 */
describe('Property 13: Reactor Component Heat Removal', () => {
    it('should have Heat Vent configured to remove 6 hU/t with durability 1000', () => {
        fc.assert(
            fc.property(
                fc.constant(null), // No random input needed, testing configuration
                () => {
                    const heatVent = ReactorSimulator.createHeatVent();
                    
                    expect(heatVent.type).toBe(ReactorComponentType.HEAT_VENT);
                    expect(heatVent.durability).toBe(1000);
                    expect(heatVent.maxDurability).toBe(1000);
                    
                    // Verify config values
                    const config = REACTOR_COMPONENT_CONFIG.heat_vent;
                    expect(config.heatRemoval).toBe(6);
                    expect(config.durability).toBe(1000);
                    expect(config.source).toBe('self');
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should have Reactor Heat Vent configured to remove 5 hU/t from hull', () => {
        fc.assert(
            fc.property(
                fc.constant(null),
                () => {
                    const reactorHeatVent = ReactorSimulator.createReactorHeatVent();
                    
                    expect(reactorHeatVent.type).toBe(ReactorComponentType.REACTOR_HEAT_VENT);
                    expect(reactorHeatVent.durability).toBe(1000);
                    
                    // Verify config values
                    const config = REACTOR_COMPONENT_CONFIG.reactor_heat_vent;
                    expect(config.heatRemoval).toBe(5);
                    expect(config.source).toBe('hull');
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should have Overclocked Heat Vent configured to remove 20 hU/t with 36 hU required input', () => {
        fc.assert(
            fc.property(
                fc.constant(null),
                () => {
                    const overclockedVent = ReactorSimulator.createOverclockedHeatVent();
                    
                    expect(overclockedVent.type).toBe(ReactorComponentType.OVERCLOCKED_HEAT_VENT);
                    expect(overclockedVent.durability).toBe(1000);
                    
                    // Verify config values
                    const config = REACTOR_COMPONENT_CONFIG.overclocked_heat_vent;
                    expect(config.heatRemoval).toBe(20);
                    expect(config.requiredInput).toBe(36);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should reduce hull heat when Reactor Heat Vent is present', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 10 }), // Number of reactor heat vents
                (ventCount) => {
                    const reactor = new ReactorSimulator({ x: 0, y: 0, z: 0 });
                    
                    // Set initial hull heat
                    const initialHullHeat = 1000;
                    reactor.setHullHeat(initialHullHeat);
                    
                    // Place reactor heat vents (they remove heat from hull)
                    for (let i = 0; i < ventCount && i < REACTOR_SLOTS; i++) {
                        reactor.setSlot(i, ReactorSimulator.createReactorHeatVent());
                    }
                    
                    // Tick the reactor (no uranium cells, so no new heat generated)
                    const result = reactor.tick();
                    
                    // Each reactor heat vent removes 5 hU/t from hull
                    const expectedHeatRemoval = ventCount * 5;
                    const expectedHullHeat = Math.max(0, initialHullHeat - expectedHeatRemoval);
                    
                    expect(result.hullHeat).toBe(expectedHullHeat);
                    
                    reactor.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should verify heat removal rates match specification for all vent types', () => {
        // Property: For any vent type, the configured heat removal rate must match spec
        const expectedRates: Record<'heat_vent' | 'reactor_heat_vent' | 'overclocked_heat_vent', number> = {
            heat_vent: 6,
            reactor_heat_vent: 5,
            overclocked_heat_vent: 20
        };

        const ventTypes: ('heat_vent' | 'reactor_heat_vent' | 'overclocked_heat_vent')[] = ['heat_vent', 'reactor_heat_vent', 'overclocked_heat_vent'];

        fc.assert(
            fc.property(
                fc.constantFrom(...ventTypes),
                (ventType) => {
                    const config = REACTOR_COMPONENT_CONFIG[ventType];
                    expect(config.heatRemoval).toBe(expectedRates[ventType]);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should create components with correct initial state', () => {
        const componentTypes: ('heat_vent' | 'reactor_heat_vent' | 'overclocked_heat_vent' | 'component_heat_exchanger')[] = 
            ['heat_vent', 'reactor_heat_vent', 'overclocked_heat_vent', 'component_heat_exchanger'];

        fc.assert(
            fc.property(
                fc.constantFrom(...componentTypes),
                (componentType) => {
                    let component;
                    let expectedType: ReactorComponentType;
                    
                    switch (componentType) {
                        case 'heat_vent':
                            component = ReactorSimulator.createHeatVent();
                            expectedType = ReactorComponentType.HEAT_VENT;
                            break;
                        case 'reactor_heat_vent':
                            component = ReactorSimulator.createReactorHeatVent();
                            expectedType = ReactorComponentType.REACTOR_HEAT_VENT;
                            break;
                        case 'overclocked_heat_vent':
                            component = ReactorSimulator.createOverclockedHeatVent();
                            expectedType = ReactorComponentType.OVERCLOCKED_HEAT_VENT;
                            break;
                        case 'component_heat_exchanger':
                            component = ReactorSimulator.createComponentHeatExchanger();
                            expectedType = ReactorComponentType.COMPONENT_HEAT_EXCHANGER;
                            break;
                        default:
                            throw new Error(`Unknown component type: ${componentType}`);
                    }
                    
                    expect(component.type).toBe(expectedType);
                    expect(component.heat).toBe(0); // Initial heat should be 0
                    expect(component.durability).toBeGreaterThan(0);
                    expect(component.maxDurability).toBe(component.durability);
                }
            ),
            { numRuns: 100 }
        );
    });
});
