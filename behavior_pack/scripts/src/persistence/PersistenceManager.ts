import { Block, Entity, World, world } from "@minecraft/server";

/**
 * Machine state data structure for persistence
 * Contains all data that needs to be saved/restored for a machine
 */
export interface MachineState {
    /** Current energy stored in EU */
    energyStored: number;
    /** Current operation progress (0-1 or tick count) */
    progress: number;
    /** Machine type identifier */
    machineType: string;
    /** Position as string key */
    positionKey: string;
}

/**
 * Serialized format for storage in dynamic properties
 */
export interface SerializedMachineState {
    e: number;  // energyStored
    p: number;  // progress
    t: string;  // machineType
    k: string;  // positionKey
}

/**
 * Convert MachineState to serialized format
 */
export function serializeMachineState(state: MachineState): SerializedMachineState {
    return {
        e: state.energyStored,
        p: state.progress,
        t: state.machineType,
        k: state.positionKey
    };
}

/**
 * Convert serialized format back to MachineState
 */
export function deserializeMachineState(serialized: SerializedMachineState): MachineState {
    return {
        energyStored: serialized.e,
        progress: serialized.p,
        machineType: serialized.t,
        positionKey: serialized.k
    };
}

/**
 * Validate that a serialized state has all required fields
 */
export function isValidSerializedState(obj: unknown): obj is SerializedMachineState {
    if (typeof obj !== 'object' || obj === null) return false;
    const s = obj as Record<string, unknown>;
    return (
        typeof s.e === 'number' &&
        typeof s.p === 'number' &&
        typeof s.t === 'string' &&
        typeof s.k === 'string'
    );
}

/**
 * Convert Vector3-like position to string key
 */
export function positionToKey(x: number, y: number, z: number): string {
    return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
}

/**
 * Parse position key back to coordinates
 */
export function keyToPosition(key: string): { x: number; y: number; z: number } | null {
    const parts = key.split(',');
    if (parts.length !== 3) return null;
    const x = parseInt(parts[0], 10);
    const y = parseInt(parts[1], 10);
    const z = parseInt(parts[2], 10);
    if (isNaN(x) || isNaN(y) || isNaN(z)) return null;
    return { x, y, z };
}

/**
 * Dynamic property key prefix for IC2 machine states
 */
const PROPERTY_PREFIX = 'ic2:machine:';

/**
 * Dynamic property key for the machine registry (list of all machine position keys)
 */
const REGISTRY_KEY = 'ic2:machine_registry';

/**
 * PersistenceManager handles saving and loading machine states
 * using Minecraft Bedrock's dynamicProperties API
 * 
 * Requirements: 20.1, 20.3, 20.4, 20.5
 */
export class PersistenceManager {
    private machineStates: Map<string, MachineState> = new Map();
    private dirty: boolean = false;

    /**
     * Save a machine state to memory and mark for persistence
     * @param state The machine state to save
     */
    saveMachineState(state: MachineState): void {
        this.machineStates.set(state.positionKey, { ...state });
        this.dirty = true;
    }

    /**
     * Load a machine state from memory
     * @param positionKey The position key of the machine
     * @returns The machine state or undefined if not found
     */
    loadMachineState(positionKey: string): MachineState | undefined {
        const state = this.machineStates.get(positionKey);
        return state ? { ...state } : undefined;
    }

    /**
     * Clear a machine state (when block is broken)
     * Requirements: 20.5
     * @param positionKey The position key of the machine to clear
     */
    clearMachineState(positionKey: string): void {
        this.machineStates.delete(positionKey);
        this.dirty = true;
    }

    /**
     * Check if a machine state exists
     * @param positionKey The position key to check
     */
    hasMachineState(positionKey: string): boolean {
        return this.machineStates.has(positionKey);
    }

    /**
     * Get all machine states
     * @returns Array of all stored machine states
     */
    getAllMachineStates(): MachineState[] {
        return Array.from(this.machineStates.values()).map(s => ({ ...s }));
    }

    /**
     * Get the number of stored machine states
     */
    getMachineCount(): number {
        return this.machineStates.size;
    }

    /**
     * Check if there are unsaved changes
     */
    isDirty(): boolean {
        return this.dirty;
    }

    /**
     * Serialize all machine states to a JSON string for storage
     * @returns JSON string of all machine states
     */
    serializeAll(): string {
        const states: SerializedMachineState[] = [];
        for (const state of this.machineStates.values()) {
            states.push(serializeMachineState(state));
        }
        return JSON.stringify(states);
    }

    /**
     * Deserialize and load machine states from a JSON string
     * @param json The JSON string to parse
     * @returns Number of states loaded, or -1 if parsing failed
     */
    deserializeAll(json: string): number {
        try {
            const parsed = JSON.parse(json);
            if (!Array.isArray(parsed)) return -1;

            this.machineStates.clear();
            let count = 0;

            for (const item of parsed) {
                if (isValidSerializedState(item)) {
                    const state = deserializeMachineState(item);
                    this.machineStates.set(state.positionKey, state);
                    count++;
                }
            }

            this.dirty = false;
            return count;
        } catch {
            return -1;
        }
    }

    /**
     * Clear all machine states
     */
    clearAll(): void {
        this.machineStates.clear();
        this.dirty = true;
    }

    /**
     * Mark as saved (dirty = false)
     */
    markSaved(): void {
        this.dirty = false;
    }
}

// Singleton instance for global access
export const persistenceManager = new PersistenceManager();
