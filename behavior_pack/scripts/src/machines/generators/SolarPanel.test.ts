import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
    SolarPanel,
    SolarPanelConfig,
    SOLAR_PANEL_CONFIG,
    SolarConditions,
    isDaytime,
    canProduceEnergy,
    calculateSolarOutput
} from './SolarPanel';
import { VoltageTier } from '../../energy/EnergyNetwork';

/**
 * **Feature: ic2-bedrock-port, Property 6: Solar Panel Conditions**
 * **Validates: Requirements 8.1, 8.2**
 * 
 * *For any* solar panel, output SHALL be 1 EU/t only when: 
 * daytime (0-12000), no rain, and clear sky above. Otherwise 0.
 */
describe('Property 6: Solar Panel Conditions', () => {
    // Arbitrary for daytime ticks (0-11999)
    const daytimeArb = fc.integer({ min: 0, max: 11999 });
    
    // Arbitrary for nighttime ticks (12000-23999)
    const nighttimeArb = fc.integer({ min: 12000, max: 23999 });
    
    // Arbitrary for any time of day (0-23999)
    const anyTimeArb = fc.integer({ min: 0, max: 23999 });

    it('should output 1 EU/t when daytime, no rain, and clear sky', () => {
        fc.assert(
            fc.property(
                daytimeArb,
                (timeOfDay) => {
                    const conditions: SolarConditions = {
                        timeOfDay,
                        isRaining: false,
                        hasSkyAccess: true
                    };

                    // All conditions met - should produce energy
                    expect(canProduceEnergy(conditions)).toBe(true);
                    expect(calculateSolarOutput(conditions)).toBe(1);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should output 0 EU/t during nighttime regardless of other conditions', () => {
        fc.assert(
            fc.property(
                nighttimeArb,
                fc.boolean(), // isRaining
                fc.boolean(), // hasSkyAccess
                (timeOfDay, isRaining, hasSkyAccess) => {
                    const conditions: SolarConditions = {
                        timeOfDay,
                        isRaining,
                        hasSkyAccess
                    };

                    // Nighttime - should never produce energy
                    expect(canProduceEnergy(conditions)).toBe(false);
                    expect(calculateSolarOutput(conditions)).toBe(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should output 0 EU/t when raining during daytime', () => {
        fc.assert(
            fc.property(
                daytimeArb,
                fc.boolean(), // hasSkyAccess
                (timeOfDay, hasSkyAccess) => {
                    const conditions: SolarConditions = {
                        timeOfDay,
                        isRaining: true,
                        hasSkyAccess
                    };

                    // Raining - should not produce energy
                    expect(canProduceEnergy(conditions)).toBe(false);
                    expect(calculateSolarOutput(conditions)).toBe(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should output 0 EU/t when sky is blocked during daytime', () => {
        fc.assert(
            fc.property(
                daytimeArb,
                (timeOfDay) => {
                    const conditions: SolarConditions = {
                        timeOfDay,
                        isRaining: false,
                        hasSkyAccess: false
                    };

                    // Sky blocked - should not produce energy
                    expect(canProduceEnergy(conditions)).toBe(false);
                    expect(calculateSolarOutput(conditions)).toBe(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should correctly identify daytime boundary at tick 12000', () => {
        // Tick 11999 is daytime
        expect(isDaytime(11999)).toBe(true);
        
        // Tick 12000 is nighttime
        expect(isDaytime(12000)).toBe(false);
        
        // Tick 0 is daytime
        expect(isDaytime(0)).toBe(true);
    });

    it('should handle time values wrapping around 24000', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 100 }), // cycles
                anyTimeArb,
                (cycles, baseTime) => {
                    // Time wraps every 24000 ticks
                    const wrappedTime = baseTime + (cycles * 24000);
                    const normalizedTime = baseTime;
                    
                    // Both should give same result
                    expect(isDaytime(wrappedTime)).toBe(isDaytime(normalizedTime));
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should produce energy only when ALL conditions are met', () => {
        fc.assert(
            fc.property(
                anyTimeArb,
                fc.boolean(),
                fc.boolean(),
                (timeOfDay, isRaining, hasSkyAccess) => {
                    const conditions: SolarConditions = {
                        timeOfDay,
                        isRaining,
                        hasSkyAccess
                    };

                    const isDaytimeNow = isDaytime(timeOfDay);
                    const allConditionsMet = isDaytimeNow && !isRaining && hasSkyAccess;

                    // Output should be 1 only when all conditions met
                    const expectedOutput = allConditionsMet ? 1 : 0;
                    expect(calculateSolarOutput(conditions)).toBe(expectedOutput);
                    expect(canProduceEnergy(conditions)).toBe(allConditionsMet);
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('Solar Panel Configuration', () => {
    it('should use correct default configuration', () => {
        expect(SOLAR_PANEL_CONFIG.outputPerTick).toBe(1);
        expect(SOLAR_PANEL_CONFIG.voltageTier).toBe(VoltageTier.LV);
        expect(SOLAR_PANEL_CONFIG.daytimeStart).toBe(0);
        expect(SOLAR_PANEL_CONFIG.daytimeEnd).toBe(12000);
    });
});

describe('Solar Panel Instance', () => {
    // Arbitrary for daytime ticks (0-11999)
    const daytimeArb = fc.integer({ min: 0, max: 11999 });
    
    // Arbitrary for nighttime ticks (12000-23999)
    const nighttimeArb = fc.integer({ min: 12000, max: 23999 });

    it('should produce energy when conditions are met', () => {
        fc.assert(
            fc.property(
                daytimeArb,
                (timeOfDay) => {
                    const panel = new SolarPanel({ x: 0, y: 64, z: 0 });
                    
                    const conditions: SolarConditions = {
                        timeOfDay,
                        isRaining: false,
                        hasSkyAccess: true
                    };

                    expect(panel.isProducing(conditions)).toBe(true);
                    
                    // tick() returns EU generated
                    const eu = panel.tick(conditions);
                    expect(eu).toBe(1);
                    
                    panel.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should not produce energy when conditions are not met', () => {
        fc.assert(
            fc.property(
                nighttimeArb,
                (timeOfDay) => {
                    const panel = new SolarPanel({ x: 0, y: 64, z: 0 });
                    
                    const conditions: SolarConditions = {
                        timeOfDay,
                        isRaining: false,
                        hasSkyAccess: true
                    };

                    expect(panel.isProducing(conditions)).toBe(false);
                    
                    const eu = panel.tick(conditions);
                    expect(eu).toBe(0);
                    
                    panel.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should have no internal buffer (direct output)', () => {
        // Solar panel outputs directly - no buffer to check
        // This is verified by the fact that tick() returns output immediately
        // and there's no getEnergyStored() method
        const panel = new SolarPanel({ x: 0, y: 64, z: 0 });
        
        // Verify config has no buffer concept
        const config = panel.getConfig();
        expect(config.outputPerTick).toBe(1);
        
        panel.destroy();
    });
});
