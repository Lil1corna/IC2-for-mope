import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
    PersistenceManager,
    MachineState,
    serializeMachineState,
    deserializeMachineState,
    isValidSerializedState,
    positionToKey,
    keyToPosition
} from './PersistenceManager';

/**
 * **Feature: ic2-bedrock-port, Property 17: Persistence Round-Trip**
 * **Validates: Requirements 20.3, 20.4**
 * 
 * *For any* machine state (energy, progress), saving then loading 
 * SHALL produce equivalent state.
 */
describe('Property 17: Persistence Round-Trip', () => {
    // Arbitrary for machine types
    const machineTypeArb = fc.constantFrom(
        'generator',
        'geothermal',
        'solar_panel',
        'wind_mill',
        'macerator',
        'electric_furnace',
        'compressor',
        'extractor',
        'recycler'
    );

    // Arbitrary for energy stored (0 to 10M EU for quantum suit tier)
    const energyArb = fc.integer({ min: 0, max: 10_000_000 });

    // Arbitrary for progress (0 to max operation ticks)
    const progressArb = fc.integer({ min: 0, max: 400 });

    // Arbitrary for position coordinates
    const coordArb = fc.integer({ min: -30_000_000, max: 30_000_000 });

    // Arbitrary for a complete machine state
    const machineStateArb = fc.record({
        energyStored: energyArb,
        progress: progressArb,
        machineType: machineTypeArb,
        positionKey: fc.tuple(coordArb, coordArb, coordArb).map(
            ([x, y, z]) => positionToKey(x, y, z)
        )
    });

    it('should round-trip serialize/deserialize a single machine state', () => {
        fc.assert(
            fc.property(
                machineStateArb,
                (state: MachineState) => {
                    const serialized = serializeMachineState(state);
                    const deserialized = deserializeMachineState(serialized);

                    expect(deserialized.energyStored).toBe(state.energyStored);
                    expect(deserialized.progress).toBe(state.progress);
                    expect(deserialized.machineType).toBe(state.machineType);
                    expect(deserialized.positionKey).toBe(state.positionKey);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should round-trip save/load through PersistenceManager', () => {
        fc.assert(
            fc.property(
                machineStateArb,
                (state: MachineState) => {
                    const manager = new PersistenceManager();
                    
                    // Save the state
                    manager.saveMachineState(state);
                    
                    // Load it back
                    const loaded = manager.loadMachineState(state.positionKey);
                    
                    expect(loaded).toBeDefined();
                    expect(loaded!.energyStored).toBe(state.energyStored);
                    expect(loaded!.progress).toBe(state.progress);
                    expect(loaded!.machineType).toBe(state.machineType);
                    expect(loaded!.positionKey).toBe(state.positionKey);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should round-trip multiple machine states through serializeAll/deserializeAll', () => {
        fc.assert(
            fc.property(
                fc.array(machineStateArb, { minLength: 1, maxLength: 50 }),
                (states: MachineState[]) => {
                    // Ensure unique position keys
                    const uniqueStates = new Map<string, MachineState>();
                    for (const state of states) {
                        uniqueStates.set(state.positionKey, state);
                    }
                    const stateArray = Array.from(uniqueStates.values());

                    const manager1 = new PersistenceManager();
                    
                    // Save all states
                    for (const state of stateArray) {
                        manager1.saveMachineState(state);
                    }
                    
                    // Serialize to JSON
                    const json = manager1.serializeAll();
                    
                    // Create new manager and deserialize
                    const manager2 = new PersistenceManager();
                    const loadedCount = manager2.deserializeAll(json);
                    
                    // Verify count matches
                    expect(loadedCount).toBe(stateArray.length);
                    expect(manager2.getMachineCount()).toBe(stateArray.length);
                    
                    // Verify each state was restored correctly
                    for (const originalState of stateArray) {
                        const loaded = manager2.loadMachineState(originalState.positionKey);
                        expect(loaded).toBeDefined();
                        expect(loaded!.energyStored).toBe(originalState.energyStored);
                        expect(loaded!.progress).toBe(originalState.progress);
                        expect(loaded!.machineType).toBe(originalState.machineType);
                        expect(loaded!.positionKey).toBe(originalState.positionKey);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should preserve state after clear and re-save', () => {
        fc.assert(
            fc.property(
                machineStateArb,
                machineStateArb,
                (state1: MachineState, state2: MachineState) => {
                    // Ensure different positions
                    fc.pre(state1.positionKey !== state2.positionKey);

                    const manager = new PersistenceManager();
                    
                    // Save both states
                    manager.saveMachineState(state1);
                    manager.saveMachineState(state2);
                    
                    // Clear state1
                    manager.clearMachineState(state1.positionKey);
                    
                    // Verify state1 is gone
                    expect(manager.loadMachineState(state1.positionKey)).toBeUndefined();
                    
                    // Verify state2 is still there
                    const loaded2 = manager.loadMachineState(state2.positionKey);
                    expect(loaded2).toBeDefined();
                    expect(loaded2!.energyStored).toBe(state2.energyStored);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should handle position key round-trip correctly', () => {
        fc.assert(
            fc.property(
                coordArb,
                coordArb,
                coordArb,
                (x: number, y: number, z: number) => {
                    const key = positionToKey(x, y, z);
                    const parsed = keyToPosition(key);
                    
                    expect(parsed).not.toBeNull();
                    expect(parsed!.x).toBe(Math.floor(x));
                    expect(parsed!.y).toBe(Math.floor(y));
                    expect(parsed!.z).toBe(Math.floor(z));
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should validate serialized state structure correctly', () => {
        fc.assert(
            fc.property(
                machineStateArb,
                (state: MachineState) => {
                    const serialized = serializeMachineState(state);
                    
                    // Valid serialized state should pass validation
                    expect(isValidSerializedState(serialized)).toBe(true);
                    
                    // Invalid objects should fail
                    expect(isValidSerializedState(null)).toBe(false);
                    expect(isValidSerializedState(undefined)).toBe(false);
                    expect(isValidSerializedState({})).toBe(false);
                    expect(isValidSerializedState({ e: 'string' })).toBe(false);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should mark dirty flag correctly on save/clear operations', () => {
        fc.assert(
            fc.property(
                machineStateArb,
                (state: MachineState) => {
                    const manager = new PersistenceManager();
                    
                    // Initially not dirty
                    expect(manager.isDirty()).toBe(false);
                    
                    // After save, should be dirty
                    manager.saveMachineState(state);
                    expect(manager.isDirty()).toBe(true);
                    
                    // After markSaved, should not be dirty
                    manager.markSaved();
                    expect(manager.isDirty()).toBe(false);
                    
                    // After clear, should be dirty again
                    manager.clearMachineState(state.positionKey);
                    expect(manager.isDirty()).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });
});
