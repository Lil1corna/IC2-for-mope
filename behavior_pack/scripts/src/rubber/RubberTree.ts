/**
 * Rubber Tree System
 * Requirements 4.1-4.5
 * 
 * Implements rubber tree generation, resin spot states,
 * treetap harvesting, and random tick regeneration.
 */

/**
 * Resin spot states for rubber wood blocks
 * Requirements 4.1
 */
export enum ResinSpotState {
    NONE = 'none',
    DRY = 'dry',
    WET = 'wet'
}

/**
 * Rubber tree configuration matching IC2 Experimental
 */
export const RUBBER_TREE_CONFIG = {
    /** Chance for each log to have a resin spot (25%) */
    spotChance: 0.25,
    /** Minimum resin drops from treetap */
    resinDropMin: 1,
    /** Maximum resin drops from treetap */
    resinDropMax: 3,
    /** Chance per random tick for dry spot to become wet */
    dryToWetChance: 0.1,
    /** Chance to drop resin when log is broken */
    breakDropChance: 0.5
};

/**
 * Rubber wood block state
 */
export interface RubberWoodState {
    /** Current resin spot state */
    resinSpot: ResinSpotState;
}

/**
 * Result of using treetap on a rubber wood block
 */
export interface TreetapResult {
    /** Whether the treetap action was successful */
    success: boolean;
    /** Number of sticky resin dropped (0 if unsuccessful) */
    resinDropped: number;
    /** New state of the resin spot */
    newState: ResinSpotState;
}

/**
 * Result of breaking a rubber wood block
 */
export interface BreakResult {
    /** Whether resin was dropped */
    droppedResin: boolean;
    /** Number of resin dropped (0 or 1) */
    resinCount: number;
}

/**
 * Generate a random resin spot state for a new rubber wood log
 * Requirements 4.1: 25% chance for resin spot per log
 * 
 * @param random Optional random value (0-1) for testing
 * @returns The resin spot state for the new log
 */
export function generateResinSpotState(random?: number): ResinSpotState {
    const roll = random ?? Math.random();
    
    if (roll < RUBBER_TREE_CONFIG.spotChance) {
        // 25% chance to have a resin spot, starts wet
        return ResinSpotState.WET;
    }
    
    return ResinSpotState.NONE;
}

/**
 * Calculate resin drop count for treetap use
 * Requirements 4.2: Wet spot drops 1-3 Sticky Resin
 * 
 * @param random Optional random value (0-1) for testing
 * @returns Number of resin to drop (1-3)
 */
export function calculateResinDrop(random?: number): number {
    const roll = random ?? Math.random();
    const range = RUBBER_TREE_CONFIG.resinDropMax - RUBBER_TREE_CONFIG.resinDropMin + 1;
    return RUBBER_TREE_CONFIG.resinDropMin + Math.floor(roll * range);
}

/**
 * Use treetap on a rubber wood block
 * Requirements 4.2: Wet spot → 1-3 Sticky Resin, change to dry
 * 
 * @param currentState Current resin spot state
 * @param random Optional random value for testing
 * @returns Result of the treetap action
 */
export function useTreetap(currentState: ResinSpotState, random?: number): TreetapResult {
    // Can only harvest from wet spots
    if (currentState !== ResinSpotState.WET) {
        return {
            success: false,
            resinDropped: 0,
            newState: currentState
        };
    }
    
    // Harvest resin and change to dry
    const resinCount = calculateResinDrop(random);
    
    return {
        success: true,
        resinDropped: resinCount,
        newState: ResinSpotState.DRY
    };
}

/**
 * Process random tick for dry resin spot regeneration
 * Requirements 4.3: Dry spot has chance to become wet on random tick
 * 
 * @param currentState Current resin spot state
 * @param random Optional random value for testing
 * @returns New resin spot state after random tick
 */
export function processRandomTick(currentState: ResinSpotState, random?: number): ResinSpotState {
    // Only dry spots can regenerate
    if (currentState !== ResinSpotState.DRY) {
        return currentState;
    }
    
    const roll = random ?? Math.random();
    
    if (roll < RUBBER_TREE_CONFIG.dryToWetChance) {
        return ResinSpotState.WET;
    }
    
    return ResinSpotState.DRY;
}

/**
 * Calculate drops when rubber wood is broken
 * Requirements 4.4: Chance to drop 1 Sticky Resin when broken
 * 
 * @param currentState Current resin spot state
 * @param random Optional random value for testing
 * @returns Break result with drop information
 */
export function calculateBreakDrops(currentState: ResinSpotState, random?: number): BreakResult {
    // Only spots with resin (wet or dry) can drop resin
    if (currentState === ResinSpotState.NONE) {
        return {
            droppedResin: false,
            resinCount: 0
        };
    }
    
    const roll = random ?? Math.random();
    
    // Wet spots always drop, dry spots have 50% chance
    const shouldDrop = currentState === ResinSpotState.WET || 
                       roll < RUBBER_TREE_CONFIG.breakDropChance;
    
    return {
        droppedResin: shouldDrop,
        resinCount: shouldDrop ? 1 : 0
    };
}

/**
 * RubberTreeManager class for managing rubber tree blocks in the world
 */
export class RubberTreeManager {
    private rubberWoodStates: Map<string, RubberWoodState> = new Map();
    
    /**
     * Create a position key for the map
     */
    private positionKey(x: number, y: number, z: number): string {
        return `${x},${y},${z}`;
    }
    
    /**
     * Register a new rubber wood block
     * @param x X coordinate
     * @param y Y coordinate
     * @param z Z coordinate
     * @param random Optional random value for testing
     * @returns The generated resin spot state
     */
    registerRubberWood(x: number, y: number, z: number, random?: number): ResinSpotState {
        const state = generateResinSpotState(random);
        this.rubberWoodStates.set(this.positionKey(x, y, z), {
            resinSpot: state
        });
        return state;
    }
    
    /**
     * Get the state of a rubber wood block
     */
    getState(x: number, y: number, z: number): RubberWoodState | undefined {
        return this.rubberWoodStates.get(this.positionKey(x, y, z));
    }
    
    /**
     * Set the state of a rubber wood block
     */
    setState(x: number, y: number, z: number, state: RubberWoodState): void {
        this.rubberWoodStates.set(this.positionKey(x, y, z), state);
    }
    
    /**
     * Handle treetap use on a rubber wood block
     * @returns TreetapResult or undefined if block not found
     */
    handleTreetap(x: number, y: number, z: number, random?: number): TreetapResult | undefined {
        const state = this.getState(x, y, z);
        if (!state) return undefined;
        
        const result = useTreetap(state.resinSpot, random);
        
        if (result.success) {
            this.setState(x, y, z, { resinSpot: result.newState });
        }
        
        return result;
    }
    
    /**
     * Handle random tick on a rubber wood block
     * @returns New state or undefined if block not found
     */
    handleRandomTick(x: number, y: number, z: number, random?: number): ResinSpotState | undefined {
        const state = this.getState(x, y, z);
        if (!state) return undefined;
        
        const newSpotState = processRandomTick(state.resinSpot, random);
        
        if (newSpotState !== state.resinSpot) {
            this.setState(x, y, z, { resinSpot: newSpotState });
        }
        
        return newSpotState;
    }
    
    /**
     * Handle rubber wood block being broken
     * @returns BreakResult or undefined if block not found
     */
    handleBreak(x: number, y: number, z: number, random?: number): BreakResult | undefined {
        const state = this.getState(x, y, z);
        if (!state) return undefined;
        
        const result = calculateBreakDrops(state.resinSpot, random);
        
        // Remove the block from tracking
        this.rubberWoodStates.delete(this.positionKey(x, y, z));
        
        return result;
    }
    
    /**
     * Unregister a rubber wood block (when destroyed)
     */
    unregisterRubberWood(x: number, y: number, z: number): void {
        this.rubberWoodStates.delete(this.positionKey(x, y, z));
    }
    
    /**
     * Get all registered rubber wood positions (for persistence)
     */
    getAllStates(): Map<string, RubberWoodState> {
        return new Map(this.rubberWoodStates);
    }
    
    /**
     * Restore states from persistence
     */
    restoreStates(states: Map<string, RubberWoodState>): void {
        this.rubberWoodStates = new Map(states);
    }
    
    /**
     * Clear all states (for testing)
     */
    clear(): void {
        this.rubberWoodStates.clear();
    }
}

// Singleton instance for global access
export const rubberTreeManager = new RubberTreeManager();
