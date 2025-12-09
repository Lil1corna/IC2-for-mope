import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
    GeothermalGenerator,
    GeothermalGeneratorConfig,
    GEOTHERMAL_CONFIG,
    isValidLavaFuel,
    getLavaEnergyValue
} from './GeothermalGenerator';
import { VoltageTier } from '../../energy/EnergyNetwork';

/**
 * Geothermal Generator Tests
 * Requirements 6.1-6.3
 */
describe('GeothermalGenerator', () => {
    describe('Configuration', () => {
        it('should have correct default configuration per Requirements 6.1-6.3', () => {
            // Req 6.2: 20 EU/t output
            expect(GEOTHERMAL_CONFIG.outputPerTick).toBe(20);
            // Req 6.3: 2400 EU buffer
            expect(GEOTHERMAL_CONFIG.maxBuffer).toBe(2400);
            // Req 6.1: 20000 EU per lava bucket
            expect(GEOTHERMAL_CONFIG.euPerLavaBucket).toBe(20000);
            // LV tier
            expect(GEOTHERMAL_CONFIG.voltageTier).toBe(VoltageTier.LV);
        });
    });

    describe('Lava Fuel Validation', () => {
        it('should accept lava bucket as valid fuel', () => {
            expect(isValidLavaFuel("minecraft:lava_bucket")).toBe(true);
            expect(getLavaEnergyValue("minecraft:lava_bucket")).toBe(20000);
        });

        it('should reject non-lava items', () => {
            fc.assert(
                fc.property(
                    fc.constantFrom(
                        "minecraft:water_bucket",
                        "minecraft:bucket",
                        "minecraft:coal",
                        "minecraft:stone",
                        "invalid:item"
                    ),
                    (invalidItem) => {
                        expect(isValidLavaFuel(invalidItem)).toBe(false);
                        expect(getLavaEnergyValue(invalidItem)).toBe(0);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });


    describe('Energy Generation - Requirements 6.1-6.3', () => {
        it('should output exactly 20 EU/t when active with lava (Req 6.2)', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 1, max: 100 }),
                    (tickCount) => {
                        const generator = new GeothermalGenerator({ x: 0, y: 0, z: 0 });
                        
                        // Add lava to activate generator
                        const consumed = generator.tryConsumeLava("minecraft:lava_bucket");
                        expect(consumed).toBe(true);
                        expect(generator.isActive()).toBe(true);
                        
                        // Track total EU generated
                        let totalEU = 0;
                        
                        // Run ticks (limited to not exceed buffer)
                        const maxTicks = Math.min(
                            tickCount,
                            Math.floor(GEOTHERMAL_CONFIG.maxBuffer / GEOTHERMAL_CONFIG.outputPerTick)
                        );
                        
                        for (let i = 0; i < maxTicks; i++) {
                            const eu = generator.tick();
                            // Each tick should generate exactly 20 EU/t
                            expect(eu).toBe(GEOTHERMAL_CONFIG.outputPerTick);
                            totalEU += eu;
                        }
                        
                        // Total should match ticks × output rate
                        expect(totalEU).toBe(maxTicks * GEOTHERMAL_CONFIG.outputPerTick);
                        
                        generator.destroy();
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should have 2400 EU max buffer (Req 6.3)', () => {
            const generator = new GeothermalGenerator({ x: 0, y: 0, z: 0 });
            
            // Verify config
            expect(generator.getConfig().maxBuffer).toBe(2400);
            
            // Add lava
            generator.tryConsumeLava("minecraft:lava_bucket");
            
            // Fill buffer completely (120 ticks at 20 EU/t = 2400 EU)
            for (let i = 0; i < 120; i++) {
                generator.tick();
            }
            
            // Buffer should be at max
            expect(generator.getEnergyStored()).toBe(2400);
            
            // One more tick should not exceed buffer
            generator.tick();
            expect(generator.getEnergyStored()).toBeLessThanOrEqual(2400);
            
            generator.destroy();
        });

        it('should produce 20000 EU total from one lava bucket (Req 6.1)', () => {
            const generator = new GeothermalGenerator({ x: 0, y: 0, z: 0 });
            
            // Add lava
            generator.tryConsumeLava("minecraft:lava_bucket");
            
            // Initial lava energy should be 20000
            expect(generator.getLavaEnergyRemaining()).toBe(20000);
            
            // Track total EU generated
            let totalEU = 0;
            
            // Run until lava is exhausted (1000 ticks at 20 EU/t = 20000 EU)
            // But buffer will fill up, so we need to simulate consumption
            // For this test, we'll just verify the lava energy value
            for (let i = 0; i < 1000 && generator.isActive(); i++) {
                const eu = generator.tick();
                totalEU += eu;
                
                // Simulate energy being consumed (drain buffer)
                const state = generator.getState();
                state.energyStored = 0;
                generator.setState(state);
            }
            
            // Total EU generated should be 20000
            expect(totalEU).toBe(20000);
            
            // Generator should be inactive after lava exhausted
            expect(generator.isActive()).toBe(false);
            expect(generator.getLavaEnergyRemaining()).toBe(0);
            
            generator.destroy();
        });

        it('should output 0 EU/t when no lava', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 1, max: 100 }),
                    (tickCount) => {
                        const generator = new GeothermalGenerator({ x: 0, y: 0, z: 0 });
                        
                        // No lava added - should not be active
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
    });

    describe('State Management', () => {
        it('should correctly save and restore state', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 0, max: 2400 }),   // energyStored
                    fc.integer({ min: 0, max: 20000 }), // lavaEnergyRemaining
                    fc.boolean(),                        // isActive
                    (energyStored, lavaEnergyRemaining, isActive) => {
                        const generator = new GeothermalGenerator({ x: 0, y: 0, z: 0 });
                        
                        const state = {
                            energyStored,
                            lavaEnergyRemaining,
                            isActive
                        };
                        
                        generator.setState(state);
                        const restored = generator.getState();
                        
                        expect(restored.energyStored).toBe(energyStored);
                        expect(restored.lavaEnergyRemaining).toBe(lavaEnergyRemaining);
                        expect(restored.isActive).toBe(isActive);
                        
                        generator.destroy();
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('Lava Consumption', () => {
        it('should not accept lava when already has lava energy', () => {
            const generator = new GeothermalGenerator({ x: 0, y: 0, z: 0 });
            
            // First lava should be accepted
            expect(generator.tryConsumeLava("minecraft:lava_bucket")).toBe(true);
            
            // Second lava should be rejected (still has energy)
            expect(generator.tryConsumeLava("minecraft:lava_bucket")).toBe(false);
            
            generator.destroy();
        });

        it('should not accept lava when buffer is full', () => {
            const generator = new GeothermalGenerator({ x: 0, y: 0, z: 0 });
            
            // Set buffer to full
            generator.setState({
                energyStored: 2400,
                lavaEnergyRemaining: 0,
                isActive: false
            });
            
            // Lava should be rejected
            expect(generator.tryConsumeLava("minecraft:lava_bucket")).toBe(false);
            
            generator.destroy();
        });

        it('should preserve lava energy when buffer is full', () => {
            const generator = new GeothermalGenerator({ x: 0, y: 0, z: 0 });
            
            // Add lava
            generator.tryConsumeLava("minecraft:lava_bucket");
            
            // Fill buffer
            for (let i = 0; i < 120; i++) {
                generator.tick();
            }
            
            const lavaBeforeTick = generator.getLavaEnergyRemaining();
            
            // Tick with full buffer - lava should be preserved
            generator.tick();
            
            expect(generator.getLavaEnergyRemaining()).toBe(lavaBeforeTick);
            
            generator.destroy();
        });
    });
});
