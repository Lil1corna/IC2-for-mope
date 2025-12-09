import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
    WindMill,
    WindMillConfig,
    WIND_MILL_CONFIG,
    calculateWindOutput,
    shouldBreak,
    generateWindStrength,
    calculateBlockedOutput
} from './WindMill';
import { VoltageTier } from '../../energy/EnergyNetwork';

/**
 * **Feature: ic2-bedrock-port, Property 5: Wind Formula Correctness**
 * **Validates: Requirements 7.1, 7.5**
 * 
 * *For any* wind mill at height Y with wind strength S, 
 * output EU/t SHALL equal (Y - 64) × S / 750, 
 * and SHALL be 0 when Y ≤ 64.
 */
describe('Property 5: Wind Formula Correctness', () => {
    // Arbitrary for Y coordinate (0-256 typical Minecraft range)
    const yCoordArb = fc.integer({ min: 0, max: 256 });
    
    // Arbitrary for wind strength (0-30 as per spec)
    const windStrengthArb = fc.integer({ min: 0, max: 30 });
    
    // Arbitrary for Y above base height (65-256)
    const yAboveBaseArb = fc.integer({ min: 65, max: 256 });
    
    // Arbitrary for Y at or below base height (0-64)
    const yAtOrBelowBaseArb = fc.integer({ min: 0, max: 64 });

    it('should calculate EU/t = (Y - 64) × S / 750 for any Y and S', () => {
        fc.assert(
            fc.property(
                yCoordArb,
                windStrengthArb,
                (y, windStrength) => {
                    const output = calculateWindOutput(y, windStrength);
                    
                    if (y <= 64) {
                        // Below or at base height should produce 0
                        expect(output).toBe(0);
                    } else {
                        // Above base height: EU/t = (Y - 64) × S / 750
                        const expected = ((y - 64) * windStrength) / 750;
                        expect(output).toBeCloseTo(expected, 10);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should produce 0 EU/t when Y <= 64 regardless of wind strength', () => {
        fc.assert(
            fc.property(
                yAtOrBelowBaseArb,
                windStrengthArb,
                (y, windStrength) => {
                    const output = calculateWindOutput(y, windStrength);
                    expect(output).toBe(0);
                }
            ),
            { numRuns: 100 }
        );
    });


    it('should produce positive EU/t when Y > 64 and S > 0', () => {
        fc.assert(
            fc.property(
                yAboveBaseArb,
                fc.integer({ min: 1, max: 30 }), // windStrength > 0
                (y, windStrength) => {
                    const output = calculateWindOutput(y, windStrength);
                    expect(output).toBeGreaterThan(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should produce 0 EU/t when wind strength is 0', () => {
        fc.assert(
            fc.property(
                yCoordArb,
                (y) => {
                    const output = calculateWindOutput(y, 0);
                    expect(output).toBe(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should increase output linearly with height above 64', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 65, max: 200 }), // y1
                fc.integer({ min: 1, max: 55 }),   // delta (y2 = y1 + delta)
                fc.integer({ min: 1, max: 30 }),   // windStrength > 0
                (y1, delta, windStrength) => {
                    const y2 = y1 + delta;
                    const output1 = calculateWindOutput(y1, windStrength);
                    const output2 = calculateWindOutput(y2, windStrength);
                    
                    // Higher Y should produce more EU
                    expect(output2).toBeGreaterThan(output1);
                    
                    // The difference should be proportional to delta
                    const expectedDiff = (delta * windStrength) / 750;
                    expect(output2 - output1).toBeCloseTo(expectedDiff, 10);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should increase output linearly with wind strength', () => {
        fc.assert(
            fc.property(
                yAboveBaseArb,
                fc.integer({ min: 0, max: 29 }), // s1
                fc.integer({ min: 1, max: 30 }), // delta
                (y, s1, delta) => {
                    const s2 = Math.min(s1 + delta, 30);
                    if (s2 <= s1) return; // Skip if no actual increase
                    
                    const output1 = calculateWindOutput(y, s1);
                    const output2 = calculateWindOutput(y, s2);
                    
                    // Higher wind strength should produce more EU
                    expect(output2).toBeGreaterThanOrEqual(output1);
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('Wind Mill Break Threshold', () => {
    it('should break when EU > 5', () => {
        fc.assert(
            fc.property(
                fc.double({ min: 5.001, max: 100, noNaN: true }),
                (euOutput) => {
                    expect(shouldBreak(euOutput)).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should not break when EU <= 5', () => {
        fc.assert(
            fc.property(
                fc.double({ min: 0, max: 5, noNaN: true }),
                (euOutput) => {
                    expect(shouldBreak(euOutput)).toBe(false);
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('Wind Mill Configuration', () => {
    it('should use correct default configuration', () => {
        expect(WIND_MILL_CONFIG.voltageTier).toBe(VoltageTier.LV);
        expect(WIND_MILL_CONFIG.baseHeight).toBe(64);
        expect(WIND_MILL_CONFIG.formulaDivisor).toBe(750);
        expect(WIND_MILL_CONFIG.breakThreshold).toBe(5);
        expect(WIND_MILL_CONFIG.windUpdateInterval).toBe(128);
        expect(WIND_MILL_CONFIG.maxWindStrength).toBe(30);
    });
});

describe('Wind Strength Generation', () => {
    it('should generate wind strength within valid range', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 100 }), // iterations
                () => {
                    const strength = generateWindStrength();
                    expect(strength).toBeGreaterThanOrEqual(0);
                    expect(strength).toBeLessThanOrEqual(30);
                    expect(Number.isInteger(strength)).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('Area Blocking', () => {
    it('should reduce output to 0 when area is blocked', () => {
        fc.assert(
            fc.property(
                fc.double({ min: 0, max: 10, noNaN: true }),
                (baseOutput) => {
                    expect(calculateBlockedOutput(baseOutput, true)).toBe(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should not reduce output when area is not blocked', () => {
        fc.assert(
            fc.property(
                fc.double({ min: 0, max: 10, noNaN: true }),
                (baseOutput) => {
                    expect(calculateBlockedOutput(baseOutput, false)).toBe(baseOutput);
                }
            ),
            { numRuns: 100 }
        );
    });
});


describe('Wind Mill Instance', () => {
    it('should update wind strength every 128 ticks', () => {
        const windMill = new WindMill({ x: 0, y: 100, z: 0 });
        
        // After 127 ticks, counter should be at 1 (128 - 127 = 1)
        for (let i = 0; i < 127; i++) {
            windMill.tick();
        }
        let state = windMill.getState();
        expect(state.ticksUntilWindChange).toBe(1);
        
        // After 128th tick, wind strength updates and counter resets to 128
        windMill.tick();
        state = windMill.getState();
        expect(state.ticksUntilWindChange).toBe(128); // Reset after update
        
        windMill.destroy();
    });

    it('should break when output exceeds threshold', () => {
        // Place at very high Y with max wind to trigger break
        // Y=256, S=30: EU = (256-64)*30/750 = 7.68 > 5
        const windMill = new WindMill({ x: 0, y: 256, z: 0 });
        
        // Force wind strength to max
        windMill.setState({
            windStrength: 30,
            ticksUntilWindChange: 128,
            isBroken: false
        });
        
        const result = windMill.tick();
        
        expect(result.broke).toBe(true);
        expect(windMill.isBroken()).toBe(true);
        
        // Subsequent ticks should produce nothing
        const result2 = windMill.tick();
        expect(result2.euGenerated).toBe(0);
        expect(result2.broke).toBe(false);
    });

    it('should produce 0 EU when Y <= 64', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 64 }),
                fc.integer({ min: 0, max: 30 }),
                (y, windStrength) => {
                    const windMill = new WindMill({ x: 0, y, z: 0 });
                    windMill.setState({
                        windStrength,
                        ticksUntilWindChange: 128,
                        isBroken: false
                    });
                    
                    const output = windMill.calculateCurrentOutput();
                    expect(output).toBe(0);
                    
                    windMill.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should reduce output to 0 when area is blocked', () => {
        const windMill = new WindMill({ x: 0, y: 100, z: 0 });
        windMill.setState({
            windStrength: 15,
            ticksUntilWindChange: 128,
            isBroken: false
        });
        
        const unblockedOutput = windMill.calculateCurrentOutput({ windStrength: 15, isAreaBlocked: false });
        const blockedOutput = windMill.calculateCurrentOutput({ windStrength: 15, isAreaBlocked: true });
        
        expect(unblockedOutput).toBeGreaterThan(0);
        expect(blockedOutput).toBe(0);
        
        windMill.destroy();
    });
});
