import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
    NanoSuitPiece,
    NanoSuit,
    NANOSUIT_CONFIG,
    calculateDamageAbsorption,
    ArmorSlot
} from './NanoSuit';

/**
 * **Feature: ic2-bedrock-port, Property 14: NanoSuit Damage Absorption**
 * **Validates: Requirements 17.2, 17.3**
 * 
 * *For any* damage D with NanoSuit equipped:
 * - if D < 4: absorb 100%
 * - if D >= 4: absorb 90%
 * - Cost = D × 800 EU
 */
describe('Property 14: NanoSuit Damage Absorption', () => {
    // Arbitrary for damage values (positive integers)
    const damageArb = fc.integer({ min: 1, max: 20 });
    
    // Arbitrary for energy stored (enough to absorb damage)
    const sufficientEnergyArb = fc.integer({ 
        min: 20 * NANOSUIT_CONFIG.euPerDamage, // Enough for max damage
        max: NANOSUIT_CONFIG.capacity 
    });

    it('should absorb 100% damage when damage < 4 and has sufficient energy', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 3 }),  // Damage < 4
                sufficientEnergyArb,
                (damage, energy) => {
                    const result = calculateDamageAbsorption(damage, energy);
                    
                    // 100% absorption for damage < 4
                    expect(result.absorptionRatio).toBe(1.0);
                    expect(result.absorbed).toBe(damage);
                    expect(result.passedThrough).toBe(0);
                    expect(result.hadEnoughEnergy).toBe(true);
                    
                    // EU cost = damage × 800
                    expect(result.euCost).toBe(damage * NANOSUIT_CONFIG.euPerDamage);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should absorb 90% damage when damage >= 4 and has sufficient energy', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 4, max: 20 }),  // Damage >= 4
                sufficientEnergyArb,
                (damage, energy) => {
                    const result = calculateDamageAbsorption(damage, energy);
                    
                    // 90% absorption for damage >= 4
                    expect(result.absorptionRatio).toBe(0.9);
                    expect(result.absorbed).toBeCloseTo(damage * 0.9, 10);
                    expect(result.passedThrough).toBeCloseTo(damage * 0.1, 10);
                    expect(result.hadEnoughEnergy).toBe(true);
                    
                    // EU cost = damage × 800
                    expect(result.euCost).toBe(damage * NANOSUIT_CONFIG.euPerDamage);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should have EU cost = damage × 800 for any damage', () => {
        fc.assert(
            fc.property(
                damageArb,
                sufficientEnergyArb,
                (damage, energy) => {
                    const result = calculateDamageAbsorption(damage, energy);
                    
                    // EU cost formula: D × 800
                    expect(result.euCost).toBe(damage * 800);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should not absorb damage when insufficient energy', () => {
        fc.assert(
            fc.property(
                damageArb,
                (damage) => {
                    // Energy less than required
                    const insufficientEnergy = damage * NANOSUIT_CONFIG.euPerDamage - 1;
                    const result = calculateDamageAbsorption(damage, insufficientEnergy);
                    
                    // No absorption when insufficient energy
                    expect(result.absorbed).toBe(0);
                    expect(result.passedThrough).toBe(damage);
                    expect(result.euCost).toBe(0);
                    expect(result.hadEnoughEnergy).toBe(false);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should deduct EU from armor piece when handling damage', () => {
        fc.assert(
            fc.property(
                damageArb,
                fc.constantFrom(...Object.values(ArmorSlot)),
                (damage, slot) => {
                    const piece = new NanoSuitPiece(slot);
                    const initialEnergy = damage * NANOSUIT_CONFIG.euPerDamage + 1000;
                    piece.charge(initialEnergy);
                    
                    const result = piece.handleDamage(damage);
                    
                    // Energy should be deducted
                    const expectedEnergy = initialEnergy - result.euCost;
                    expect(piece.getEnergyStored()).toBe(expectedEnergy);
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('NanoSuit Configuration', () => {
    it('should have 1M EU capacity (Tier 3)', () => {
        expect(NANOSUIT_CONFIG.capacity).toBe(1_000_000);
        expect(NANOSUIT_CONFIG.tier).toBe(3);
    });

    it('should have 800 EU per damage point cost', () => {
        expect(NANOSUIT_CONFIG.euPerDamage).toBe(800);
    });
});

describe('NanoSuitPiece', () => {
    it('should correctly charge and discharge energy', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: NANOSUIT_CONFIG.capacity }),
                fc.constantFrom(...Object.values(ArmorSlot)),
                (chargeAmount, slot) => {
                    const piece = new NanoSuitPiece(slot);
                    
                    // Charge
                    const charged = piece.charge(chargeAmount);
                    expect(charged).toBe(chargeAmount);
                    expect(piece.getEnergyStored()).toBe(chargeAmount);
                    
                    // Discharge
                    const discharged = piece.discharge(chargeAmount);
                    expect(discharged).toBe(chargeAmount);
                    expect(piece.getEnergyStored()).toBe(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should not exceed max capacity when charging', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: NANOSUIT_CONFIG.capacity, max: NANOSUIT_CONFIG.capacity * 2 }),
                fc.constantFrom(...Object.values(ArmorSlot)),
                (overchargeAmount, slot) => {
                    const piece = new NanoSuitPiece(slot);
                    
                    const charged = piece.charge(overchargeAmount);
                    
                    // Should only charge up to capacity
                    expect(charged).toBe(NANOSUIT_CONFIG.capacity);
                    expect(piece.getEnergyStored()).toBe(NANOSUIT_CONFIG.capacity);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should correctly report energy percentage', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: NANOSUIT_CONFIG.capacity }),
                fc.constantFrom(...Object.values(ArmorSlot)),
                (energy, slot) => {
                    const piece = new NanoSuitPiece(slot);
                    piece.charge(energy);
                    
                    const percentage = piece.getEnergyPercentage();
                    const expected = energy / NANOSUIT_CONFIG.capacity;
                    
                    expect(percentage).toBeCloseTo(expected, 10);
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('NanoSuit Full Set', () => {
    it('should have 4 pieces with total 4M EU capacity', () => {
        const suit = new NanoSuit();
        
        expect(suit.getAllPieces().length).toBe(4);
        expect(suit.getTotalMaxEnergy()).toBe(4_000_000);
    });

    it('should handle damage using first piece with energy', () => {
        const suit = new NanoSuit();
        const helmet = suit.getPiece(ArmorSlot.HELMET)!;
        
        // Charge only helmet
        helmet.charge(10000);
        
        const result = suit.handleDamage(5);
        
        // Should use helmet's energy
        expect(result.hadEnoughEnergy).toBe(true);
        expect(helmet.getEnergyStored()).toBeLessThan(10000);
    });

    it('should not absorb damage when no piece has energy', () => {
        const suit = new NanoSuit();
        
        // No pieces charged
        const result = suit.handleDamage(5);
        
        expect(result.hadEnoughEnergy).toBe(false);
        expect(result.absorbed).toBe(0);
        expect(result.passedThrough).toBe(5);
    });
});

describe('Edge Cases', () => {
    it('should handle zero damage', () => {
        const result = calculateDamageAbsorption(0, 1000);
        
        expect(result.absorbed).toBe(0);
        expect(result.passedThrough).toBe(0);
        expect(result.euCost).toBe(0);
        expect(result.hadEnoughEnergy).toBe(true);
    });

    it('should handle exactly 4 damage (boundary)', () => {
        const result = calculateDamageAbsorption(4, 10000);
        
        // Damage >= 4 should have 90% absorption
        expect(result.absorptionRatio).toBe(0.9);
        expect(result.absorbed).toBeCloseTo(3.6, 10);  // 4 * 0.9
        expect(result.passedThrough).toBeCloseTo(0.4, 10);  // 4 * 0.1
    });

    it('should handle exactly 3 damage (boundary)', () => {
        const result = calculateDamageAbsorption(3, 10000);
        
        // Damage < 4 should have 100% absorption
        expect(result.absorptionRatio).toBe(1.0);
        expect(result.absorbed).toBe(3);
        expect(result.passedThrough).toBe(0);
    });
});
