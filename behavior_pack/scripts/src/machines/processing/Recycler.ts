import { Vector3 } from "@minecraft/server";
import { BaseMachine, MachineConfig, MACHINE_BASE_CONFIG, TickResult } from "./BaseMachine";
import { VoltageTier } from "../../energy/EnergyNetwork";

/**
 * Recycler configuration matching IC2 Experimental
 * Requirements 14.1-14.3
 */
export const RECYCLER_CONFIG: MachineConfig = {
    maxInput: 32,           // EU/t (same as base machines)
    consumption: 2,         // EU/t during operation
    operationTime: 45,      // ticks (2.25 seconds) - Requirement 14.1
    maxEnergy: 400,         // Buffer
    maxVoltage: VoltageTier.LV
};

/**
 * Scrap production chance (12.5%)
 * Requirements 14.2, 14.3
 */
export const SCRAP_CHANCE = 0.125;

/**
 * Result of recycler operation
 */
export interface RecyclerResult {
    /** Whether operation completed */
    completed: boolean;
    /** Whether scrap was produced */
    producedScrap: boolean;
    /** Output item (scrap or nothing) */
    output?: string;
}

/**
 * Calculate if scrap should be produced based on random value
 * @param randomValue Random value between 0 and 1
 * @returns true if scrap should be produced (12.5% chance)
 */
export function shouldProduceScrap(randomValue: number): boolean {
    return randomValue < SCRAP_CHANCE;
}

/**
 * Recycler machine - converts any item into Scrap with 12.5% chance
 * Requirements 14.1-14.3
 */
export class Recycler extends BaseMachine {
    private currentInput: string | null = null;
    private randomSource: () => number;

    constructor(
        position: Vector3, 
        config: MachineConfig = RECYCLER_CONFIG,
        randomSource: () => number = Math.random
    ) {
        super(position, config);
        this.randomSource = randomSource;
    }

    /**
     * Set the current input item for recycling
     * Any item can be recycled
     * @param itemId Item identifier to recycle
     * @returns true (any item can be recycled)
     */
    setInput(itemId: string | null): boolean {
        this.currentInput = itemId;
        this.setHasInput(itemId !== null);
        return true;
    }

    /**
     * Get the current input item
     */
    getCurrentInput(): string | null {
        return this.currentInput;
    }

    /**
     * Check if an item can be recycled (any item can)
     * @param _itemId Item identifier (unused, any item works)
     * @returns true always
     */
    canRecycle(_itemId: string): boolean {
        return true;
    }

    /**
     * Process the current input and determine if scrap is produced
     * Should be called when operation completes
     * Requirements 14.2, 14.3
     * @returns Recycler result with scrap production info
     */
    processComplete(): RecyclerResult {
        if (!this.currentInput) {
            return { completed: false, producedScrap: false };
        }

        // 12.5% chance to produce scrap (Requirement 14.2)
        // 87.5% chance to produce nothing (Requirement 14.3)
        const producedScrap = shouldProduceScrap(this.randomSource());

        return {
            completed: true,
            producedScrap,
            output: producedScrap ? "ic2:scrap" : undefined
        };
    }

    /**
     * Process complete with explicit random value (for testing)
     * @param randomValue Random value between 0 and 1
     * @returns Recycler result
     */
    processCompleteWithRandom(randomValue: number): RecyclerResult {
        if (!this.currentInput) {
            return { completed: false, producedScrap: false };
        }

        const producedScrap = shouldProduceScrap(randomValue);

        return {
            completed: true,
            producedScrap,
            output: producedScrap ? "ic2:scrap" : undefined
        };
    }

    /**
     * Get the scrap production chance
     */
    getScrapChance(): number {
        return SCRAP_CHANCE;
    }

    /**
     * Get operation time in ticks
     */
    getOperationTime(): number {
        return this.machineConfig.operationTime;
    }
}
