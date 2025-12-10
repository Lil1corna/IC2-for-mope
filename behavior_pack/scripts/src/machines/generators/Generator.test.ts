import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
    Generator,
    GeneratorConfig,
    GENERATOR_CONFIG,
    getFuelBurnTime,
    isValidFuel,
    calculateOutputPerTick,
    FUEL_BURN_TIMES
} from './Generator';
import { VoltageTier } from '../../energy/EnergyNetwork';

/**
 * **Feature: ic2-bedrock-port, Property 4: Generator Output Rates** (generator part)
 * **Validates: Requirements 5.1**
 * 
 * *For any* active generator with fuel/conditions met, 
 * output SHALL match: generator(10 EU/t)
 */
describe('Property 4: Generator Output Rates (Generator)', () => {
    // Arbitrary for valid fuel items
    const validFuelArb = fc.constantFrom(...Object.keys(FUEL_BURN_TIMES));
    
    // Arbitrary for number of ticks to simulate
    const tickCountArb = fc.integer({ min: 1, max: 100 });

    it('should output exactly 10 EU/t when active with fuel', () => {
        fc.assert(
            fc.property(
                validFuelArb,
                tickCountArb,
                (fuelItem, tickCount) => {
                    const generator = new Generator({ x: 0, y: 0, z: 0 });
                    
                    // Add fuel to activate generator
                    const consumed = generator.tryConsumeFuel(fuelItem);
                    expect(consumed).toBe(true);
                    expect(generator.isActive()).toBe(true);
                    
                    // Track total EU generated
                    let totalEU = 0;
                    
                    // Run ticks (limited to not exceed buffer or burn time)
                    const maxTicks = Math.min(
                        tickCount,
                        Math.floor(GENERATOR_CONFIG.maxBuffer / GENERATOR_CONFIG.outputPerTick),
                        getFuelBurnTime(fuelItem)
                    );
                    
                    for (let i = 0; i < maxTicks; i++) {
                        const eu = generator.tick();
                        // Each tick should generate exactly 10 EU/t
                        expect(eu).toBe(GENERATOR_CONFIG.outputPerTick);
                        totalEU += eu;
                    }
                    
                    // Total should match ticks × output rate
                    expect(totalEU).toBe(maxTicks * GENERATOR_CONFIG.outputPerTick);
                    
                    generator.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should have 4000 EU max buffer', () => {
        const generator = new Generator({ x: 0, y: 0, z: 0 });
        
        // Verify config
        expect(generator.maxEnergy).toBe(4000);
        
        // Use coal which has 1600 ticks burn time (enough to fill buffer)
        generator.tryConsumeFuel("minecraft:coal");
        
        // Fill buffer completely (400 ticks at 10 EU/t = 4000 EU)
        for (let i = 0; i < 400; i++) {
            generator.tick();
        }
        
        // Buffer should be at max
        expect(generator.getEnergyStored()).toBe(4000);
        
        // One more tick should not exceed buffer
        generator.tick();
        expect(generator.getEnergyStored()).toBeLessThanOrEqual(4000);
        
        generator.destroy();
    });

    it('should not exceed max buffer regardless of fuel type', () => {
        fc.assert(
            fc.property(
                validFuelArb,
                (fuelItem) => {
                    const generator = new Generator({ x: 0, y: 0, z: 0 });
                    const burnTime = getFuelBurnTime(fuelItem);
                    
                    // Add fuel
                    generator.tryConsumeFuel(fuelItem);
                    
                    // Run for entire burn time
                    for (let i = 0; i < burnTime; i++) {
                        generator.tick();
                    }
                    
                    // Energy should never exceed max buffer
                    expect(generator.getEnergyStored()).toBeLessThanOrEqual(4000);
                    
                    generator.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should send 10 EU packets', () => {
        // Verify packet size configuration
        expect(GENERATOR_CONFIG.packetSize).toBe(10);
    });

    it('should output 0 EU/t when no fuel', () => {
        fc.assert(
            fc.property(
                tickCountArb,
                (tickCount) => {
                    const generator = new Generator({ x: 0, y: 0, z: 0 });
                    
                    // No fuel added - should not be active
                    expect(generator.isActive()).toBe(false);
                    
                    // Run ticks
                    for (let i = 0; i < tickCount; i++) {
                        const eu = generator.tick();
                        expect(eu).toBe(0);
                    }
                    
                    // No energy should be stored
                    expect(generator.getEnergyStored()).toBe(0);
                    
                    generator.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should consume fuel at vanilla furnace burn rates', () => {
        fc.assert(
            fc.property(
                validFuelArb,
                (fuelItem) => {
                    const expectedBurnTime = FUEL_BURN_TIMES[fuelItem];
                    const actualBurnTime = getFuelBurnTime(fuelItem);
                    
                    // Burn time should match vanilla furnace rates
                    expect(actualBurnTime).toBe(expectedBurnTime);
                    expect(actualBurnTime).toBeGreaterThan(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should become inactive when fuel is exhausted', () => {
        // Use stick which has short burn time (100 ticks)
        const generator = new Generator({ x: 0, y: 0, z: 0 });
        
        generator.tryConsumeFuel("minecraft:stick");
        expect(generator.isActive()).toBe(true);
        
        // Burn through all fuel (100 ticks)
        for (let i = 0; i < 100; i++) {
            generator.tick();
        }
        
        // Should now be inactive
        expect(generator.isActive()).toBe(false);
        
        generator.destroy();
    });
});

describe('Generator Fuel Validation', () => {
    it('should accept valid fuels', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...Object.keys(FUEL_BURN_TIMES)),
                (fuelItem) => {
                    expect(isValidFuel(fuelItem)).toBe(true);
                    expect(getFuelBurnTime(fuelItem)).toBeGreaterThan(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should reject invalid fuels', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(
                    "minecraft:stone",
                    "minecraft:dirt",
                    "minecraft:diamond",
                    "minecraft:iron_ingot",
                    "invalid:item"
                ),
                (invalidItem) => {
                    expect(isValidFuel(invalidItem)).toBe(false);
                    expect(getFuelBurnTime(invalidItem)).toBe(0);
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('Generator State Management', () => {
    it('should correctly save and restore state', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 4000 }),  // energyStored
                fc.integer({ min: 0, max: 2000 }), // burnTimeRemaining
                fc.integer({ min: 0, max: 2000 }), // totalBurnTime
                fc.boolean(),                       // isActive
                (energyStored, burnTimeRemaining, totalBurnTime, isActive) => {
                    const generator = new Generator({ x: 0, y: 0, z: 0 });
                    
                    const state = {
                        energyStored,
                        burnTimeRemaining,
                        totalBurnTime,
                        isActive
                    };
                    
                    generator.setState(state);
                    const restored = generator.getState();
                    
                    expect(restored.energyStored).toBe(energyStored);
                    expect(restored.burnTimeRemaining).toBe(burnTimeRemaining);
                    expect(restored.totalBurnTime).toBe(totalBurnTime);
                    expect(restored.isActive).toBe(isActive);
                    
                    generator.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('Generator Configuration', () => {
    it('should use correct default configuration', () => {
        expect(GENERATOR_CONFIG.outputPerTick).toBe(10);
        expect(GENERATOR_CONFIG.maxBuffer).toBe(4000);
        expect(GENERATOR_CONFIG.packetSize).toBe(10);
        expect(GENERATOR_CONFIG.voltageTier).toBe(VoltageTier.LV);
    });

    it('should calculate output per tick correctly', () => {
        expect(calculateOutputPerTick()).toBe(10);
        expect(calculateOutputPerTick(GENERATOR_CONFIG)).toBe(10);
        
        const customConfig: GeneratorConfig = {
            outputPerTick: 20,
            maxBuffer: 8000,
            packetSize: 20,
            voltageTier: VoltageTier.MV
        };
        expect(calculateOutputPerTick(customConfig)).toBe(20);
    });
});
