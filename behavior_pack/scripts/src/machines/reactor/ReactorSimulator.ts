import { Vector3 } from "@minecraft/server";

/**
 * Reactor grid dimensions
 * Requirements 15.1
 */
export const REACTOR_ROWS = 6;
export const REACTOR_COLS = 9;
export const REACTOR_SLOTS = REACTOR_ROWS * REACTOR_COLS; // 54 slots

/**
 * Reactor component types
 */
export enum ReactorComponentType {
    EMPTY = 'empty',
    URANIUM_CELL = 'uranium_cell',
    HEAT_VENT = 'heat_vent',
    REACTOR_HEAT_VENT = 'reactor_heat_vent',
    OVERCLOCKED_HEAT_VENT = 'overclocked_heat_vent',
    COMPONENT_HEAT_EXCHANGER = 'component_heat_exchanger'
}

/**
 * Base reactor component interface
 */
export interface ReactorComponent {
    type: ReactorComponentType;
    durability?: number;
    maxDurability?: number;
    heat?: number;
}

/**
 * Reactor state
 */
export interface ReactorState {
    /** 54 slots (6×9 grid) */
    slots: (ReactorComponent | null)[];
    /** Current hull heat */
    hullHeat: number;
    /** Maximum hull heat before meltdown */
    maxHullHeat: number;
    /** Total EU produced this tick */
    euProducedThisTick: number;
    /** Total heat produced this tick */
    heatProducedThisTick: number;
}

/**
 * Result of a reactor tick
 */
export interface ReactorTickResult {
    /** EU produced this tick */
    euProduced: number;
    /** Heat produced this tick */
    heatProduced: number;
    /** Current hull heat */
    hullHeat: number;
    /** Whether fire threshold reached (>4000) */
    fireTriggered: boolean;
    /** Whether evaporate threshold reached (>7000) */
    evaporateTriggered: boolean;
    /** Whether radiation threshold reached (>8500) */
    radiationTriggered: boolean;
    /** Whether meltdown occurred (>=10000) */
    meltdown: boolean;
    /** Explosion force if meltdown */
    explosionForce?: number;
}


/**
 * Calculate EU output for a uranium cell
 * Formula: EU = 5 × (N + 1) where N = adjacent uranium cells
 * Requirements 15.2
 * 
 * @param adjacentCells Number of adjacent uranium cells (0-4)
 * @returns EU output per tick
 */
export function calculateCellEU(adjacentCells: number): number {
    // Clamp to valid range (0-4 adjacent cells max)
    const n = Math.max(0, Math.min(4, Math.floor(adjacentCells)));
    return 5 * (n + 1);
}

/**
 * Calculate heat output for a uranium cell
 * Formula: Heat = 2 × (N + 1) × (N + 2) hU
 * Requirements 15.3
 * 
 * @param adjacentCells Number of adjacent uranium cells (0-4)
 * @returns Heat output per tick in hU
 */
export function calculateCellHeat(adjacentCells: number): number {
    // Clamp to valid range (0-4 adjacent cells max)
    const n = Math.max(0, Math.min(4, Math.floor(adjacentCells)));
    return 2 * (n + 1) * (n + 2);
}

/**
 * Convert slot index to row/col coordinates
 */
export function slotToCoords(slot: number): { row: number; col: number } {
    return {
        row: Math.floor(slot / REACTOR_COLS),
        col: slot % REACTOR_COLS
    };
}

/**
 * Convert row/col coordinates to slot index
 */
export function coordsToSlot(row: number, col: number): number {
    return row * REACTOR_COLS + col;
}

/**
 * Get adjacent slot indices for a given slot (up, down, left, right)
 */
export function getAdjacentSlots(slot: number): number[] {
    const { row, col } = slotToCoords(slot);
    const adjacent: number[] = [];
    
    // Up
    if (row > 0) adjacent.push(coordsToSlot(row - 1, col));
    // Down
    if (row < REACTOR_ROWS - 1) adjacent.push(coordsToSlot(row + 1, col));
    // Left
    if (col > 0) adjacent.push(coordsToSlot(row, col - 1));
    // Right
    if (col < REACTOR_COLS - 1) adjacent.push(coordsToSlot(row, col + 1));
    
    return adjacent;
}

/**
 * Count adjacent uranium cells for a given slot
 */
export function countAdjacentUraniumCells(slots: (ReactorComponent | null)[], slotIndex: number): number {
    const adjacentSlots = getAdjacentSlots(slotIndex);
    let count = 0;
    
    for (const adjSlot of adjacentSlots) {
        const component = slots[adjSlot];
        if (component && component.type === ReactorComponentType.URANIUM_CELL) {
            count++;
        }
    }
    
    return count;
}


/**
 * Heat thresholds for reactor effects
 * Requirements 15.5-15.8
 */
export const REACTOR_THRESHOLDS = {
    fire: 4000,       // Blocks within 5m catch fire
    evaporate: 7000,  // Water evaporates
    radiation: 8500,  // Players get Poison + Nausea (10m radius)
    meltdown: 10000   // Explosion: force = uranium_cells × 10
};

/**
 * Reactor component configurations
 * Requirements 16.1-16.4
 */
export const REACTOR_COMPONENT_CONFIG = {
    heat_vent: {
        heatRemoval: 6,      // hU/t removed from self
        durability: 1000,
        source: 'self' as const
    },
    reactor_heat_vent: {
        heatRemoval: 5,      // hU/t removed from hull
        durability: 1000,
        source: 'hull' as const
    },
    overclocked_heat_vent: {
        heatRemoval: 20,     // hU/t removed
        requiredInput: 36,   // hU required to operate
        durability: 1000,
        source: 'self' as const
    },
    component_heat_exchanger: {
        transferRate: 12,    // hU/t equalized between neighbors
        durability: 5000
    }
};

/**
 * Check heat threshold effects based on hull heat
 * Requirements 15.5-15.8
 * 
 * @param hullHeat Current hull heat value
 * @returns Object with boolean flags for each threshold effect
 */
export function checkHeatThresholdEffects(hullHeat: number): {
    fire: boolean;
    evaporate: boolean;
    radiation: boolean;
    meltdown: boolean;
} {
    return {
        fire: hullHeat > REACTOR_THRESHOLDS.fire,
        evaporate: hullHeat > REACTOR_THRESHOLDS.evaporate,
        radiation: hullHeat > REACTOR_THRESHOLDS.radiation,
        meltdown: hullHeat >= REACTOR_THRESHOLDS.meltdown
    };
}

/**
 * ReactorSimulator class for nuclear reactor simulation
 * Implements 6×9 grid (54 slots) with tick processing
 * Requirements 15.1-15.8
 */
export class ReactorSimulator {
    private position: Vector3;
    private state: ReactorState;

    constructor(position: Vector3) {
        this.position = position;
        this.state = {
            slots: new Array(REACTOR_SLOTS).fill(null),
            hullHeat: 0,
            maxHullHeat: REACTOR_THRESHOLDS.meltdown,
            euProducedThisTick: 0,
            heatProducedThisTick: 0
        };
    }

    /**
     * Get current reactor state
     */
    getState(): ReactorState {
        return {
            ...this.state,
            slots: [...this.state.slots]
        };
    }

    /**
     * Set reactor state (for persistence restore)
     */
    setState(state: ReactorState): void {
        this.state = {
            ...state,
            slots: [...state.slots]
        };
    }

    /**
     * Get reactor position
     */
    getPosition(): Vector3 {
        return this.position;
    }

    /**
     * Get component at slot
     */
    getSlot(slot: number): ReactorComponent | null {
        if (slot < 0 || slot >= REACTOR_SLOTS) return null;
        return this.state.slots[slot];
    }

    /**
     * Set component at slot
     */
    setSlot(slot: number, component: ReactorComponent | null): boolean {
        if (slot < 0 || slot >= REACTOR_SLOTS) return false;
        this.state.slots[slot] = component;
        return true;
    }

    /**
     * Get current hull heat
     */
    getHullHeat(): number {
        return this.state.hullHeat;
    }

    /**
     * Set hull heat (for testing/persistence)
     */
    setHullHeat(heat: number): void {
        this.state.hullHeat = Math.max(0, heat);
    }

    /**
     * Count total uranium cells in reactor
     */
    countUraniumCells(): number {
        return this.state.slots.filter(
            slot => slot && slot.type === ReactorComponentType.URANIUM_CELL
        ).length;
    }


    /**
     * Calculate EU and heat for all uranium cells
     * Requirements 15.2, 15.3
     */
    private calculateCellOutputs(): { totalEU: number; totalHeat: number; cellHeatMap: Map<number, number> } {
        let totalEU = 0;
        let totalHeat = 0;
        const cellHeatMap = new Map<number, number>();

        for (let slot = 0; slot < REACTOR_SLOTS; slot++) {
            const component = this.state.slots[slot];
            if (component && component.type === ReactorComponentType.URANIUM_CELL) {
                const adjacentCells = countAdjacentUraniumCells(this.state.slots, slot);
                totalEU += calculateCellEU(adjacentCells);
                const cellHeat = calculateCellHeat(adjacentCells);
                totalHeat += cellHeat;
                cellHeatMap.set(slot, cellHeat);
            }
        }

        return { totalEU, totalHeat, cellHeatMap };
    }

    /**
     * Distribute heat from cells through components to hull
     * Heat flow: Cell → Heat Vents → Heat Exchangers → Hull
     * Requirements 15.4
     * 
     * @param cellHeatMap Map of slot index to heat produced by uranium cells
     * @returns Heat that reaches the hull after component processing
     */
    private distributeHeat(cellHeatMap: Map<number, number>): number {
        // Track heat on each component
        const componentHeat = new Map<number, number>();
        
        // Initialize component heat from adjacent uranium cells
        for (const [cellSlot, heat] of cellHeatMap) {
            const adjacentSlots = getAdjacentSlots(cellSlot);
            let heatDistributed = 0;
            
            // Try to distribute heat to adjacent heat-absorbing components
            for (const adjSlot of adjacentSlots) {
                const component = this.state.slots[adjSlot];
                if (component && this.canAbsorbHeat(component.type)) {
                    const currentHeat = componentHeat.get(adjSlot) || 0;
                    const heatToAdd = heat / adjacentSlots.length;
                    componentHeat.set(adjSlot, currentHeat + heatToAdd);
                    heatDistributed += heatToAdd;
                }
            }
            
            // Remaining heat goes to hull
            const remainingHeat = heat - heatDistributed;
            if (remainingHeat > 0) {
                componentHeat.set(-1, (componentHeat.get(-1) || 0) + remainingHeat);
            }
        }

        // Process heat vents - they remove heat from themselves
        let heatRemovedByVents = 0;
        for (let slot = 0; slot < REACTOR_SLOTS; slot++) {
            const component = this.state.slots[slot];
            if (!component) continue;

            const slotHeat = componentHeat.get(slot) || 0;

            if (component.type === ReactorComponentType.HEAT_VENT) {
                // Heat vent removes heat from itself
                const removal = Math.min(slotHeat, REACTOR_COMPONENT_CONFIG.heat_vent.heatRemoval);
                heatRemovedByVents += removal;
                componentHeat.set(slot, slotHeat - removal);
                
                // Reduce durability
                if (component.durability !== undefined && slotHeat > 0) {
                    component.durability = Math.max(0, component.durability - 1);
                }
            } else if (component.type === ReactorComponentType.OVERCLOCKED_HEAT_VENT) {
                // Overclocked vent needs minimum heat input to operate
                if (slotHeat >= REACTOR_COMPONENT_CONFIG.overclocked_heat_vent.requiredInput) {
                    const removal = Math.min(slotHeat, REACTOR_COMPONENT_CONFIG.overclocked_heat_vent.heatRemoval);
                    heatRemovedByVents += removal;
                    componentHeat.set(slot, slotHeat - removal);
                    
                    if (component.durability !== undefined) {
                        component.durability = Math.max(0, component.durability - 1);
                    }
                }
            }
        }

        // Note: Reactor heat vents are processed in tick() method to actively cool hull heat
        // They remove heat from existing hull heat, not just from heat being added
        let hullHeatRemoved = 0;

        // Process component heat exchangers - equalize heat between neighbors
        for (let slot = 0; slot < REACTOR_SLOTS; slot++) {
            const component = this.state.slots[slot];
            if (component && component.type === ReactorComponentType.COMPONENT_HEAT_EXCHANGER) {
                const adjacentSlots = getAdjacentSlots(slot);
                const exchangerHeat = componentHeat.get(slot) || 0;
                
                // Calculate average heat among exchanger and neighbors
                let totalHeat = exchangerHeat;
                let componentCount = 1;
                
                for (const adjSlot of adjacentSlots) {
                    const adjComponent = this.state.slots[adjSlot];
                    if (adjComponent && this.canAbsorbHeat(adjComponent.type)) {
                        totalHeat += componentHeat.get(adjSlot) || 0;
                        componentCount++;
                    }
                }
                
                // Equalize heat (limited by transfer rate)
                const avgHeat = totalHeat / componentCount;
                const maxTransfer = REACTOR_COMPONENT_CONFIG.component_heat_exchanger.transferRate;
                
                for (const adjSlot of adjacentSlots) {
                    const adjComponent = this.state.slots[adjSlot];
                    if (adjComponent && this.canAbsorbHeat(adjComponent.type)) {
                        const adjHeat = componentHeat.get(adjSlot) || 0;
                        const diff = avgHeat - adjHeat;
                        const transfer = Math.sign(diff) * Math.min(Math.abs(diff), maxTransfer);
                        componentHeat.set(adjSlot, adjHeat + transfer);
                    }
                }
                
                if (component.durability !== undefined) {
                    component.durability = Math.max(0, component.durability - 1);
                }
            }
        }

        // Calculate total heat going to hull
        // Hull receives: direct heat from cells + remaining component heat - hull vent removal
        let hullHeat = componentHeat.get(-1) || 0;
        
        // Add any remaining heat from components that couldn't dissipate it
        for (let slot = 0; slot < REACTOR_SLOTS; slot++) {
            const remainingHeat = componentHeat.get(slot) || 0;
            if (remainingHeat > 0) {
                hullHeat += remainingHeat;
            }
        }
        
        // Apply hull heat removal from reactor heat vents
        hullHeat = Math.max(0, hullHeat - hullHeatRemoved);
        
        return hullHeat;
    }

    /**
     * Check if a component type can absorb heat
     */
    private canAbsorbHeat(type: ReactorComponentType): boolean {
        return type === ReactorComponentType.HEAT_VENT ||
               type === ReactorComponentType.REACTOR_HEAT_VENT ||
               type === ReactorComponentType.OVERCLOCKED_HEAT_VENT ||
               type === ReactorComponentType.COMPONENT_HEAT_EXCHANGER;
    }

    /**
     * Check heat thresholds and return triggered effects
     * Requirements 15.5-15.8
     */
    private checkHeatThresholds(): {
        fire: boolean;
        evaporate: boolean;
        radiation: boolean;
        meltdown: boolean;
    } {
        return checkHeatThresholdEffects(this.state.hullHeat);
    }

    /**
     * Process one reactor tick
     * Requirements 15.1-15.8
     */
    tick(): ReactorTickResult {
        // Reset tick counters
        this.state.euProducedThisTick = 0;
        this.state.heatProducedThisTick = 0;

        // Calculate outputs from all uranium cells
        const { totalEU, totalHeat, cellHeatMap } = this.calculateCellOutputs();
        
        this.state.euProducedThisTick = totalEU;
        this.state.heatProducedThisTick = totalHeat;

        // Distribute heat through components to hull (Requirements 15.4)
        const heatToHull = this.distributeHeat(cellHeatMap);
        this.state.hullHeat += heatToHull;

        // Process reactor heat vents - they actively remove heat from hull (Requirements 16.2)
        // This happens after heat distribution, so they can cool down existing hull heat
        for (let slot = 0; slot < REACTOR_SLOTS; slot++) {
            const component = this.state.slots[slot];
            if (component && component.type === ReactorComponentType.REACTOR_HEAT_VENT) {
                const removal = REACTOR_COMPONENT_CONFIG.reactor_heat_vent.heatRemoval;
                this.state.hullHeat = Math.max(0, this.state.hullHeat - removal);
            }
        }

        // Check thresholds (Requirements 15.5-15.8)
        const thresholds = this.checkHeatThresholds();

        // Calculate explosion force if meltdown
        let explosionForce: number | undefined;
        if (thresholds.meltdown) {
            const uraniumCount = this.countUraniumCells();
            explosionForce = uraniumCount * 10;
        }

        return {
            euProduced: totalEU,
            heatProduced: totalHeat,
            hullHeat: this.state.hullHeat,
            fireTriggered: thresholds.fire,
            evaporateTriggered: thresholds.evaporate,
            radiationTriggered: thresholds.radiation,
            meltdown: thresholds.meltdown,
            explosionForce
        };
    }

    /**
     * Create a uranium cell component
     */
    static createUraniumCell(): ReactorComponent {
        return {
            type: ReactorComponentType.URANIUM_CELL,
            durability: 10000,
            maxDurability: 10000
        };
    }

    /**
     * Create a heat vent component
     * Removes 6 hU/t from itself
     * Requirements 16.1
     */
    static createHeatVent(): ReactorComponent {
        return {
            type: ReactorComponentType.HEAT_VENT,
            durability: REACTOR_COMPONENT_CONFIG.heat_vent.durability,
            maxDurability: REACTOR_COMPONENT_CONFIG.heat_vent.durability,
            heat: 0
        };
    }

    /**
     * Create a reactor heat vent component
     * Removes 5 hU/t from hull
     * Requirements 16.2
     */
    static createReactorHeatVent(): ReactorComponent {
        return {
            type: ReactorComponentType.REACTOR_HEAT_VENT,
            durability: REACTOR_COMPONENT_CONFIG.reactor_heat_vent.durability,
            maxDurability: REACTOR_COMPONENT_CONFIG.reactor_heat_vent.durability,
            heat: 0
        };
    }

    /**
     * Create an overclocked heat vent component
     * Removes 20 hU/t but requires 36 hU input
     * Requirements 16.3
     */
    static createOverclockedHeatVent(): ReactorComponent {
        return {
            type: ReactorComponentType.OVERCLOCKED_HEAT_VENT,
            durability: REACTOR_COMPONENT_CONFIG.overclocked_heat_vent.durability,
            maxDurability: REACTOR_COMPONENT_CONFIG.overclocked_heat_vent.durability,
            heat: 0
        };
    }

    /**
     * Create a component heat exchanger
     * Equalizes heat between neighbors
     * Requirements 16.4
     */
    static createComponentHeatExchanger(): ReactorComponent {
        return {
            type: ReactorComponentType.COMPONENT_HEAT_EXCHANGER,
            durability: REACTOR_COMPONENT_CONFIG.component_heat_exchanger.durability,
            maxDurability: REACTOR_COMPONENT_CONFIG.component_heat_exchanger.durability,
            heat: 0
        };
    }

    /**
     * Cleanup when reactor is destroyed
     */
    destroy(): void {
        this.state.slots = new Array(REACTOR_SLOTS).fill(null);
        this.state.hullHeat = 0;
    }
}
