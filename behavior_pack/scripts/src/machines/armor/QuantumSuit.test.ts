import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
    QuantumSuit,
    QuantumHelmet,
    QuantumChestplate,
    QuantumLeggings,
    QuantumBoots,
    QUANTUMSUIT_CONFIG,
    QUANTUM_HELMET_CONFIG,
    QUANTUM_CHESTPLATE_CONFIG,
    QUANTUM_LEGGINGS_CONFIG,
    QUANTUM_BOOTS_CONFIG,
    calculateHelmetEffects,
    calculateChestplateDamage,
    calculateLeggingsSprint,
    calculateBootsEffects,
    calculateFlightCost
} from './QuantumSuit';

/**
 * **Feature: ic2-bedrock-port, Property 15: QuantumSuit Sprint Speed**
 * **Validates: Requirements 18.7**
 * 
 * *For any* player wearing Quantum Leggings while sprinting,
 * speed SHALL be multiplied by 3.5.
 */
describe('Property 15: QuantumSuit Sprint Speed', () => {
    // Arbitrary for ticks (positive integers)
    const ticksArb = fc.integer({ min: 1, max: 100 });
    
    // Arbitrary for energy (enough to sprint)
    const sufficientEnergyArb = fc.integer({
        min: 100 * QUANTUM_LEGGINGS_CONFIG.sprintCostPerTick,
        max: QUANTUMSUIT_CONFIG.capacity
    });

    it('should multiply sprint speed by 3.5 when sprinting with sufficient energy', () => {
        fc.assert(
            fc.property(
                ticksArb,
                sufficientEnergyArb,
                (ticks, energy) => {
                    const result = calculateLeggingsSprint(true, ticks, energy);
                    
                    // Speed multiplier should be exactly 3.5
                    expect(result.speedMultiplier).toBe(3.5);
                    expect(result.hadEnoughEnergy).toBe(true);
                    
                    // EU cost should be ticks × cost per tick
                    expect(result.euConsumed).toBe(ticks * QUANTUM_LEGGINGS_CONFIG.sprintCostPerTick);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should return normal speed (1.0) when not sprinting', () => {
        fc.assert(
            fc.property(
                ticksArb,
                sufficientEnergyArb,
                (ticks, energy) => {
                    const result = calculateLeggingsSprint(false, ticks, energy);
                    
                    // Normal speed when not sprinting
                    expect(result.speedMultiplier).toBe(1.0);
                    expect(result.euConsumed).toBe(0);
                    expect(result.hadEnoughEnergy).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });


    it('should return normal speed when insufficient energy for sprinting', () => {
        fc.assert(
            fc.property(
                ticksArb,
                (ticks) => {
                    // Energy less than required for sprinting
                    const insufficientEnergy = ticks * QUANTUM_LEGGINGS_CONFIG.sprintCostPerTick - 1;
                    const result = calculateLeggingsSprint(true, ticks, Math.max(0, insufficientEnergy));
                    
                    // Should fall back to normal speed
                    expect(result.speedMultiplier).toBe(1.0);
                    expect(result.euConsumed).toBe(0);
                    expect(result.hadEnoughEnergy).toBe(false);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should deduct EU from leggings when sprinting', () => {
        fc.assert(
            fc.property(
                ticksArb,
                sufficientEnergyArb,
                (ticks, initialEnergy) => {
                    const leggings = new QuantumLeggings();
                    leggings.charge(initialEnergy);
                    
                    const result = leggings.processSprint(true, ticks);
                    
                    // Energy should be deducted
                    const expectedEnergy = initialEnergy - result.euConsumed;
                    expect(leggings.getEnergyStored()).toBe(expectedEnergy);
                    expect(result.speedMultiplier).toBe(3.5);
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('QuantumSuit Configuration', () => {
    it('should have 10M EU capacity (Tier 4)', () => {
        expect(QUANTUMSUIT_CONFIG.capacity).toBe(10_000_000);
        expect(QUANTUMSUIT_CONFIG.tier).toBe(4);
    });

    it('should have correct leggings sprint multiplier', () => {
        expect(QUANTUM_LEGGINGS_CONFIG.sprintMultiplier).toBe(3.5);
    });
});

describe('Quantum Helmet Effects', () => {
    it('should provide water breathing when underwater', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: QUANTUMSUIT_CONFIG.capacity }),
                (energy) => {
                    const result = calculateHelmetEffects(energy, 20, false, false, true);
                    expect(result.waterBreathing).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should auto-feed when hunger < 20 and has energy', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 19 }),  // Hunger < 20
                fc.integer({ min: 20 * QUANTUM_HELMET_CONFIG.autoFeedCost, max: QUANTUMSUIT_CONFIG.capacity }),
                (hunger, energy) => {
                    const result = calculateHelmetEffects(energy, hunger, false, false, false);
                    
                    // Should restore hunger to 20
                    expect(result.hungerRestored).toBe(20 - hunger);
                    expect(result.euConsumed).toBe((20 - hunger) * QUANTUM_HELMET_CONFIG.autoFeedCost);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should cure poison effect when has energy', () => {
        const energy = QUANTUM_HELMET_CONFIG.curePoisonCost + 1000;
        const result = calculateHelmetEffects(energy, 20, true, false, false);
        
        expect(result.effectsCured).toContain('poison');
        expect(result.euConsumed).toBeGreaterThanOrEqual(QUANTUM_HELMET_CONFIG.curePoisonCost);
    });

    it('should cure wither effect when has energy', () => {
        const energy = QUANTUM_HELMET_CONFIG.cureWitherCost + 1000;
        const result = calculateHelmetEffects(energy, 20, false, true, false);
        
        expect(result.effectsCured).toContain('wither');
        expect(result.euConsumed).toBeGreaterThanOrEqual(QUANTUM_HELMET_CONFIG.cureWitherCost);
    });
});

describe('Quantum Chestplate Damage Absorption', () => {
    it('should absorb 100% damage when has sufficient energy', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 100 }),  // Damage
                fc.integer({ min: 100 * QUANTUM_CHESTPLATE_CONFIG.euPerDamage, max: QUANTUMSUIT_CONFIG.capacity }),
                (damage, energy) => {
                    const result = calculateChestplateDamage(damage, energy, false);
                    
                    // 100% absorption
                    expect(result.absorbed).toBe(damage);
                    expect(result.passedThrough).toBe(0);
                    expect(result.hadEnoughEnergy).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should not absorb /kill command damage', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 1000 }),
                fc.integer({ min: 0, max: QUANTUMSUIT_CONFIG.capacity }),
                (damage, energy) => {
                    const result = calculateChestplateDamage(damage, energy, true);  // isKillCommand = true
                    
                    // No absorption for /kill
                    expect(result.absorbed).toBe(0);
                    expect(result.passedThrough).toBe(damage);
                    expect(result.euConsumed).toBe(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should not absorb damage when insufficient energy', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 100 }),
                (damage) => {
                    const insufficientEnergy = damage * QUANTUM_CHESTPLATE_CONFIG.euPerDamage - 1;
                    const result = calculateChestplateDamage(damage, Math.max(0, insufficientEnergy), false);
                    
                    expect(result.absorbed).toBe(0);
                    expect(result.passedThrough).toBe(damage);
                    expect(result.hadEnoughEnergy).toBe(false);
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('Quantum Chestplate Flight', () => {
    it('should allow flight when has sufficient energy', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 100 }),  // Ticks
                fc.integer({ min: 100 * QUANTUM_CHESTPLATE_CONFIG.flightCostPerTick, max: QUANTUMSUIT_CONFIG.capacity }),
                (ticks, energy) => {
                    const result = calculateFlightCost(ticks, energy);
                    
                    expect(result.canFly).toBe(true);
                    expect(result.euCost).toBe(ticks * QUANTUM_CHESTPLATE_CONFIG.flightCostPerTick);
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('Quantum Boots Effects', () => {
    it('should negate fall damage when has sufficient energy', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 50 }),  // Fall damage
                fc.integer({ min: 50 * QUANTUM_BOOTS_CONFIG.fallDamageNegationCost, max: QUANTUMSUIT_CONFIG.capacity }),
                (fallDamage, energy) => {
                    const result = calculateBootsEffects(fallDamage, false, energy);
                    
                    expect(result.fallDamageNegated).toBe(fallDamage);
                    expect(result.euConsumed).toBe(fallDamage * QUANTUM_BOOTS_CONFIG.fallDamageNegationCost);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should provide Jump Boost V when jumping with energy', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: QUANTUM_BOOTS_CONFIG.jumpCost, max: QUANTUMSUIT_CONFIG.capacity }),
                (energy) => {
                    const result = calculateBootsEffects(0, true, energy);
                    
                    expect(result.jumpBoostLevel).toBe(5);
                    expect(result.euConsumed).toBe(QUANTUM_BOOTS_CONFIG.jumpCost);
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('QuantumSuit Full Set', () => {
    it('should have 4 pieces with total 40M EU capacity', () => {
        const suit = new QuantumSuit();
        
        expect(suit.getAllPieces().length).toBe(4);
        expect(suit.getTotalMaxEnergy()).toBe(40_000_000);
    });

    it('should handle damage using chestplate', () => {
        const suit = new QuantumSuit();
        suit.getChestplate().charge(100000);
        
        const result = suit.handleDamage(10);
        
        expect(result.absorbed).toBe(10);
        expect(result.passedThrough).toBe(0);
    });
});
