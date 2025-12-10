import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
    calculateExplosionForce,
    calculateDeliveredEnergy,
    shouldExplode,
    VoltageTier,
    CABLE_CONFIG,
    EnergyNetwork,
    EnergyConsumer
} from './EnergyNetwork';
import { IMachine } from '../machines/IMachine';

function createMockMachine(maxEnergy: number, startingEnergy = 0): IMachine<{ energyStored: number }> {
    return {
        position: { x: 0, y: 0, z: 0 },
        type: "mock",
        energyStored: startingEnergy,
        maxEnergy,
        tick: () => { /* no-op */ },
        addEnergy(amount: number): number {
            const accepted = Math.min(amount, this.maxEnergy - this.energyStored);
            this.energyStored += accepted;
            return accepted;
        },
        removeEnergy(amount: number): number {
            const removed = Math.min(amount, this.energyStored);
            this.energyStored -= removed;
            return removed;
        },
        getState() { return { energyStored: this.energyStored }; },
        setState(state) { this.energyStored = state.energyStored; }
    };
}

/**
 * **Feature: ic2-bedrock-port, Property 2: Overvoltage Explosion**
 * **Validates: Requirements 1.2, 1.4**
 * 
 * *For any* machine or cable receiving voltage V > maxVoltage, 
 * the block SHALL explode with force = V / 20.
 */
describe('Property 2: Overvoltage Explosion', () => {
    // Arbitrary for voltage values (positive integers representing EU)
    const voltageArb = fc.integer({ min: 1, max: 100000 });
    
    // Arbitrary for max voltage (standard IC2 tiers)
    const maxVoltageArb = fc.constantFrom(
        VoltageTier.LV,
        VoltageTier.MV,
        VoltageTier.HV,
        VoltageTier.EV,
        VoltageTier.IV
    );

    it('should explode when voltage exceeds max voltage', () => {
        fc.assert(
            fc.property(
                voltageArb,
                maxVoltageArb,
                (voltage, maxVoltage) => {
                    const result = shouldExplode(voltage, maxVoltage);
                    
                    if (voltage > maxVoltage) {
                        expect(result).toBe(true);
                    } else {
                        expect(result).toBe(false);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should calculate explosion force as voltage / 20', () => {
        fc.assert(
            fc.property(
                voltageArb,
                (voltage) => {
                    const force = calculateExplosionForce(voltage);
                    expect(force).toBe(voltage / 20);
                }
            ),
            { numRuns: 100 }
        );
    });


    it('should trigger explosion in receivePacket when voltage > maxVoltage', () => {
        fc.assert(
            fc.property(
                voltageArb,
                maxVoltageArb,
                fc.integer({ min: 1, max: 10000 }), // euAmount
                (voltage, maxVoltage, euAmount) => {
                    // Only test cases where voltage exceeds max
                    fc.pre(voltage > maxVoltage);
                    
                    const network = new EnergyNetwork();
                    const consumer: EnergyConsumer = {
                        position: { x: 0, y: 0, z: 0 },
                        maxVoltage: maxVoltage,
                        maxInput: 32,
                        machine: createMockMachine(10000)
                    };

                    const result = network.receivePacket(consumer, euAmount, voltage, 0, 0);
                    
                    expect(result.exploded).toBe(true);
                    expect(result.accepted).toBe(false);
                    expect(result.euDelivered).toBe(0);
                    expect(result.explosionForce).toBe(voltage / 20);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should NOT explode when voltage <= maxVoltage', () => {
        fc.assert(
            fc.property(
                maxVoltageArb,
                fc.integer({ min: 1, max: 10000 }), // euAmount
                (maxVoltage, euAmount) => {
                    // Generate voltage that is <= maxVoltage
                    const voltage = fc.sample(fc.integer({ min: 1, max: maxVoltage }), 1)[0];
                    
                    const network = new EnergyNetwork();
                    const consumer: EnergyConsumer = {
                        position: { x: 0, y: 0, z: 0 },
                        maxVoltage: maxVoltage,
                        maxInput: euAmount,
                        machine: createMockMachine(10000)
                    };

                    const result = network.receivePacket(consumer, euAmount, voltage, 0, 0);
                    
                    expect(result.exploded).toBe(false);
                }
            ),
            { numRuns: 100 }
        );
    });
});


/**
 * **Feature: ic2-bedrock-port, Property 1: Energy Loss Formula**
 * **Validates: Requirements 1.3**
 * 
 * *For any* energy transfer of E_start EU over D blocks through cable with loss L,
 * the delivered energy SHALL equal max(0, E_start - L × D).
 */
describe('Property 1: Energy Loss Formula', () => {
    // Arbitrary for starting energy (positive EU values)
    const startEnergyArb = fc.integer({ min: 1, max: 100000 });
    
    // Arbitrary for distance in blocks (1-100 blocks)
    const distanceArb = fc.integer({ min: 1, max: 100 });
    
    // Arbitrary for loss per block (IC2 cable loss values)
    const lossArb = fc.constantFrom(
        CABLE_CONFIG.tin.loss,
        CABLE_CONFIG.copper.loss,
        CABLE_CONFIG.gold.loss,
        CABLE_CONFIG.iron_hv.loss,
        CABLE_CONFIG.glass_fibre.loss
    );

    it('should calculate delivered energy as E_start - (loss × distance)', () => {
        fc.assert(
            fc.property(
                startEnergyArb,
                lossArb,
                distanceArb,
                (startEnergy, loss, distance) => {
                    const delivered = calculateDeliveredEnergy(startEnergy, loss, distance);
                    const expected = Math.max(0, startEnergy - (loss * distance));
                    
                    expect(delivered).toBeCloseTo(expected, 10);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should never return negative energy', () => {
        fc.assert(
            fc.property(
                startEnergyArb,
                lossArb,
                distanceArb,
                (startEnergy, loss, distance) => {
                    const delivered = calculateDeliveredEnergy(startEnergy, loss, distance);
                    expect(delivered).toBeGreaterThanOrEqual(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should return 0 when loss exceeds starting energy', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 100 }), // small starting energy
                fc.double({ min: 1, max: 10 }),   // high loss
                fc.integer({ min: 100, max: 1000 }), // long distance
                (startEnergy, loss, distance) => {
                    // Ensure loss * distance > startEnergy
                    fc.pre(loss * distance > startEnergy);
                    
                    const delivered = calculateDeliveredEnergy(startEnergy, loss, distance);
                    expect(delivered).toBe(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should return full energy when distance is 0', () => {
        fc.assert(
            fc.property(
                startEnergyArb,
                lossArb,
                (startEnergy, loss) => {
                    const delivered = calculateDeliveredEnergy(startEnergy, loss, 0);
                    expect(delivered).toBe(startEnergy);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should return full energy when loss is 0', () => {
        fc.assert(
            fc.property(
                startEnergyArb,
                distanceArb,
                (startEnergy, distance) => {
                    const delivered = calculateDeliveredEnergy(startEnergy, 0, distance);
                    expect(delivered).toBe(startEnergy);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should apply correct loss for each cable type', () => {
        fc.assert(
            fc.property(
                startEnergyArb,
                distanceArb,
                fc.constantFrom('tin', 'copper', 'gold', 'iron_hv', 'glass_fibre'),
                (startEnergy, distance, cableType) => {
                    const config = CABLE_CONFIG[cableType];
                    const delivered = calculateDeliveredEnergy(startEnergy, config.loss, distance);
                    const expected = Math.max(0, startEnergy - (config.loss * distance));
                    
                    expect(delivered).toBeCloseTo(expected, 10);
                }
            ),
            { numRuns: 100 }
        );
    });
});
