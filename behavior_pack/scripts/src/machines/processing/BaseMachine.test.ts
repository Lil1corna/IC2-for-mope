import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
    BaseMachine,
    MachineConfig,
    MACHINE_BASE_CONFIG,
    shouldMachineExplode
} from './BaseMachine';
import { VoltageTier, calculateExplosionForce } from '../../energy/EnergyNetwork';

/**
 * **Feature: ic2-bedrock-port, Property 7: Machine Base Configuration**
 * **Validates: Requirements 9.1, 9.2, 9.3**
 * 
 * *For any* processing machine, maxInput SHALL be 32 EU/t, 
 * consumption SHALL be 2 EU/t, and base operation time SHALL be 400 ticks.
 */
describe('Property 7: Machine Base Configuration', () => {
    it('should have maxInput of 32 EU/t', () => {
        expect(MACHINE_BASE_CONFIG.maxInput).toBe(32);
        
        const machine = new BaseMachine({ x: 0, y: 0, z: 0 });
        expect(machine.getConfig().maxInput).toBe(32);
        machine.destroy();
    });

    it('should have consumption of 2 EU/t during operation', () => {
        expect(MACHINE_BASE_CONFIG.consumption).toBe(2);
        
        const machine = new BaseMachine({ x: 0, y: 0, z: 0 });
        expect(machine.getConfig().consumption).toBe(2);
        machine.destroy();
    });

    it('should have base operation time of 400 ticks', () => {
        expect(MACHINE_BASE_CONFIG.operationTime).toBe(400);
        
        const machine = new BaseMachine({ x: 0, y: 0, z: 0 });
        expect(machine.getConfig().operationTime).toBe(400);
        machine.destroy();
    });

    it('should consume exactly 2 EU per tick when processing', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 100 }),
                (tickCount) => {
                    const machine = new BaseMachine({ x: 0, y: 0, z: 0 });
                    
                    // Give machine enough energy
                    const initialEnergy = tickCount * MACHINE_BASE_CONFIG.consumption + 100;
                    machine.setState({
                        energyStored: initialEnergy,
                        progress: 0,
                        isProcessing: false,
                        hasInput: true,
                        hasOutputSpace: true
                    });
                    
                    let totalConsumed = 0;
                    
                    for (let i = 0; i < tickCount; i++) {
                        const result = machine.tick();
                        expect(result.euConsumed).toBe(MACHINE_BASE_CONFIG.consumption);
                        totalConsumed += result.euConsumed;
                    }
                    
                    // Total consumed should be ticks × consumption rate
                    expect(totalConsumed).toBe(tickCount * MACHINE_BASE_CONFIG.consumption);
                    
                    machine.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should complete operation after exactly 400 ticks', () => {
        const machine = new BaseMachine({ x: 0, y: 0, z: 0 });
        
        // Give machine enough energy for full operation
        const energyNeeded = MACHINE_BASE_CONFIG.operationTime * MACHINE_BASE_CONFIG.consumption;
        machine.setState({
            energyStored: energyNeeded,
            progress: 0,
            isProcessing: false,
            hasInput: true,
            hasOutputSpace: true
        });
        
        // Run for 399 ticks - should not complete
        for (let i = 0; i < 399; i++) {
            const result = machine.tick();
            expect(result.operationCompleted).toBe(false);
        }
        
        // 400th tick should complete
        const finalResult = machine.tick();
        expect(finalResult.operationCompleted).toBe(true);
        
        machine.destroy();
    });

    it('should explode when receiving voltage > 32 EU (maxInput)', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 33, max: 8192 }),
                (voltage) => {
                    const machine = new BaseMachine({ x: 0, y: 0, z: 0 });
                    
                    const result = machine.receiveEnergy(100, voltage);
                    
                    expect(result.exploded).toBe(true);
                    expect(result.accepted).toBe(false);
                    expect(result.explosionForce).toBe(calculateExplosionForce(voltage));
                    
                    machine.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should accept energy when voltage <= 32 EU', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 32 }),
                fc.integer({ min: 1, max: 32 }),
                (voltage, euAmount) => {
                    const machine = new BaseMachine({ x: 0, y: 0, z: 0 });
                    
                    const result = machine.receiveEnergy(euAmount, voltage);
                    
                    expect(result.exploded).toBe(false);
                    expect(result.accepted).toBe(true);
                    expect(result.euReceived).toBeGreaterThan(0);
                    
                    machine.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should pause operation when insufficient energy', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 1 }),
                (lowEnergy) => {
                    const machine = new BaseMachine({ x: 0, y: 0, z: 0 });
                    
                    machine.setState({
                        energyStored: lowEnergy,
                        progress: 100,
                        isProcessing: true,
                        hasInput: true,
                        hasOutputSpace: true
                    });
                    
                    const result = machine.tick();
                    
                    // Should pause due to insufficient energy
                    expect(result.isPaused).toBe(true);
                    expect(result.euConsumed).toBe(0);
                    expect(machine.isProcessing()).toBe(false);
                    
                    machine.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('Machine Overvoltage', () => {
    it('should correctly detect overvoltage conditions', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 8192 }),
                fc.integer({ min: 1, max: 8192 }),
                (receivedVoltage, maxVoltage) => {
                    const shouldExplode = shouldMachineExplode(receivedVoltage, maxVoltage);
                    expect(shouldExplode).toBe(receivedVoltage > maxVoltage);
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('Machine State Management', () => {
    it('should correctly save and restore state', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 400 }),   // energyStored
                fc.integer({ min: 0, max: 400 }),   // progress
                fc.boolean(),                        // isProcessing
                fc.boolean(),                        // hasInput
                fc.boolean(),                        // hasOutputSpace
                (energyStored, progress, isProcessing, hasInput, hasOutputSpace) => {
                    const machine = new BaseMachine({ x: 0, y: 0, z: 0 });
                    
                    const state = {
                        energyStored,
                        progress,
                        isProcessing,
                        hasInput,
                        hasOutputSpace
                    };
                    
                    machine.setState(state);
                    const restored = machine.getState();
                    
                    expect(restored.energyStored).toBe(energyStored);
                    expect(restored.progress).toBe(progress);
                    expect(restored.isProcessing).toBe(isProcessing);
                    expect(restored.hasInput).toBe(hasInput);
                    expect(restored.hasOutputSpace).toBe(hasOutputSpace);
                    
                    machine.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should track progress correctly', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 399 }),
                (tickCount) => {
                    const machine = new BaseMachine({ x: 0, y: 0, z: 0 });
                    
                    // Give enough energy
                    machine.setState({
                        energyStored: 1000,
                        progress: 0,
                        isProcessing: false,
                        hasInput: true,
                        hasOutputSpace: true
                    });
                    
                    for (let i = 0; i < tickCount; i++) {
                        machine.tick();
                    }
                    
                    // Progress should be tickCount / operationTime
                    const expectedProgress = tickCount / MACHINE_BASE_CONFIG.operationTime;
                    expect(machine.getProgress()).toBeCloseTo(expectedProgress, 5);
                    
                    machine.destroy();
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('Machine Configuration', () => {
    it('should use correct default configuration', () => {
        expect(MACHINE_BASE_CONFIG.maxInput).toBe(32);
        expect(MACHINE_BASE_CONFIG.consumption).toBe(2);
        expect(MACHINE_BASE_CONFIG.operationTime).toBe(400);
        expect(MACHINE_BASE_CONFIG.maxVoltage).toBe(VoltageTier.LV);
    });

    it('should allow custom configuration', () => {
        const customConfig: MachineConfig = {
            maxInput: 128,
            consumption: 4,
            operationTime: 200,
            maxEnergy: 800,
            maxVoltage: VoltageTier.MV
        };
        
        const machine = new BaseMachine({ x: 0, y: 0, z: 0 }, customConfig);
        
        expect(machine.getConfig().maxInput).toBe(128);
        expect(machine.getConfig().consumption).toBe(4);
        expect(machine.getConfig().operationTime).toBe(200);
        expect(machine.getConfig().maxVoltage).toBe(VoltageTier.MV);
        
        machine.destroy();
    });
});
