import { Vector3 } from "@minecraft/server";
import { energyNetwork, VoltageTier } from "../../energy/EnergyNetwork";
import type { IMachine } from "../IMachine";

/**
 * Wind Mill configuration
 * Requirements 7.1-7.5
 */
export interface WindMillConfig {
    /** Output voltage tier */
    voltageTier: VoltageTier;
    /** Base height for wind calculation (Y=64 produces 0 EU) */
    baseHeight: number;
    /** Divisor for wind formula */
    formulaDivisor: number;
    /** Maximum EU/t before wind mill breaks */
    breakThreshold: number;
    /** Ticks between wind strength changes */
    windUpdateInterval: number;
    /** Maximum wind strength value */
    maxWindStrength: number;
}

/**
 * Default wind mill configuration matching IC2 Experimental
 * Requirements 7.1-7.5
 */
export const WIND_MILL_CONFIG: WindMillConfig = {
    voltageTier: VoltageTier.LV,    // Low Voltage (32 EU max)
    baseHeight: 64,                  // Y=64 is base (Req 7.5)
    formulaDivisor: 750,             // Divisor in formula (Req 7.1)
    breakThreshold: 5,               // Breaks if EU > 5 (Req 7.4)
    windUpdateInterval: 128,         // Wind changes every 128 ticks (Req 7.2)
    maxWindStrength: 30              // Max wind strength S (Req 7.1)
};

/**
 * Wind conditions for wind mill operation
 */
export interface WindConditions {
    /** Current wind strength (0-30) */
    windStrength: number;
    /** Whether the 9x9x7 area around wind mill is blocked */
    isAreaBlocked: boolean;
}

/**
 * Wind Mill state for persistence
 */
export interface WindMillState {
    /** Current wind strength */
    windStrength: number;
    /** Ticks until next wind strength change */
    ticksUntilWindChange: number;
    /** Whether the wind mill is broken */
    isBroken: boolean;
}


/**
 * Calculate wind mill EU output based on height and wind strength
 * Formula: EU/t = (Y - 64) × S / 750
 * Requirements 7.1, 7.5
 * 
 * @param y The Y coordinate (height) of the wind mill
 * @param windStrength Current wind strength (0-30)
 * @param config Wind mill configuration
 * @returns EU output per tick
 */
export function calculateWindOutput(
    y: number,
    windStrength: number,
    config: WindMillConfig = WIND_MILL_CONFIG
): number {
    // Below or at base height produces 0 EU (Req 7.5)
    if (y <= config.baseHeight) {
        return 0;
    }

    // Formula: EU/t = (Y - 64) × S / 750 (Req 7.1)
    const output = ((y - config.baseHeight) * windStrength) / config.formulaDivisor;
    
    return output;
}

/**
 * Check if wind mill should break due to excessive output
 * Requirements 7.4
 * 
 * @param euOutput Current EU output per tick
 * @param config Wind mill configuration
 * @returns true if wind mill should break
 */
export function shouldBreak(
    euOutput: number,
    config: WindMillConfig = WIND_MILL_CONFIG
): boolean {
    // Breaks if EU > 5 (Req 7.4)
    return euOutput > config.breakThreshold;
}

/**
 * Generate a new random wind strength
 * Requirements 7.2
 * 
 * @param maxStrength Maximum wind strength value
 * @returns Random wind strength between 0 and maxStrength
 */
export function generateWindStrength(maxStrength: number = WIND_MILL_CONFIG.maxWindStrength): number {
    return Math.floor(Math.random() * (maxStrength + 1));
}

/**
 * Calculate reduced output when area is blocked
 * Requirements 7.3
 * 
 * @param baseOutput The base EU output
 * @param isBlocked Whether the 9x9x7 area is blocked
 * @returns Reduced output (0 if blocked, otherwise baseOutput)
 */
export function calculateBlockedOutput(baseOutput: number, isBlocked: boolean): number {
    // When blocked, reduce output to 0 (simplified - IC2 has gradual reduction)
    if (isBlocked) {
        return 0;
    }
    return baseOutput;
}


/**
 * Wind Mill class implementing height-based wind energy generation
 * Requirements 7.1-7.5
 * 
 * - EU/t = (Y-64) × S / 750 where S is wind strength (Req 7.1)
 * - Wind strength changes every 128 ticks (Req 7.2)
 * - Blocked 9x9x7 area reduces output (Req 7.3)
 * - Breaks if EU > 5 (Req 7.4)
 * - Y <= 64 produces 0 EU (Req 7.5)
 */
export class WindMill implements IMachine<WindMillState> {
    readonly position: Vector3;
    readonly type: string = "wind_mill";
    private config: WindMillConfig;
    private state: WindMillState;

    constructor(position: Vector3, config: WindMillConfig = WIND_MILL_CONFIG) {
        this.position = position;
        this.config = config;
        this.state = {
            windStrength: generateWindStrength(config.maxWindStrength),
            ticksUntilWindChange: config.windUpdateInterval,
            isBroken: false
        };

        // Register with energy network as generator
        energyNetwork.registerGenerator(this.position, {
            outputVoltage: this.config.voltageTier,
            packetSize: 1, // Variable output, send 1 EU packets
            machine: this as unknown as IMachine
        });
    }

    /**
     * Get current wind mill state
     */
    getState(): WindMillState {
        return { ...this.state };
    }

    /**
     * Set wind mill state (for persistence restore)
     */
    setState(state: WindMillState): void {
        this.state = { ...state };
    }

    /**
     * Get wind mill position
     */
    getPosition(): Vector3 {
        return this.position;
    }

    /**
     * Get wind mill configuration
     */
    getConfig(): WindMillConfig {
        return { ...this.config };
    }

    get energyStored(): number {
        return 0;
    }

    get maxEnergy(): number {
        return 0;
    }

    addEnergy(_amount: number): number {
        return 0;
    }

    removeEnergy(_amount: number): number {
        return 0;
    }

    /**
     * Get current wind strength
     */
    getWindStrength(): number {
        return this.state.windStrength;
    }

    /**
     * Check if wind mill is broken
     */
    isBroken(): boolean {
        return this.state.isBroken;
    }

    /**
     * Update wind strength (called internally every windUpdateInterval ticks)
     */
    private updateWindStrength(): void {
        this.state.windStrength = generateWindStrength(this.config.maxWindStrength);
        this.state.ticksUntilWindChange = this.config.windUpdateInterval;
    }

    /**
     * Process one tick of wind mill operation
     * Called every game tick when wind mill is loaded
     * @param conditions Current wind conditions (optional, for area blocking check)
     * @returns Object with EU generated and whether wind mill broke
     */
    tick(conditions?: WindConditions): { euGenerated: number; broke: boolean } {
        // If already broken, produce nothing
        if (this.state.isBroken) {
            return { euGenerated: 0, broke: false };
        }

        // Update wind strength timer (Req 7.2)
        this.state.ticksUntilWindChange--;
        if (this.state.ticksUntilWindChange <= 0) {
            this.updateWindStrength();
        }

        // Calculate base output (Req 7.1, 7.5)
        let output = calculateWindOutput(
            this.position.y,
            this.state.windStrength,
            this.config
        );

        // Apply area blocking reduction (Req 7.3)
        if (conditions?.isAreaBlocked) {
            output = calculateBlockedOutput(output, true);
        }

        // Check if should break (Req 7.4)
        if (shouldBreak(output, this.config)) {
            this.state.isBroken = true;
            this.destroy();
            return { euGenerated: 0, broke: true };
        }

        // Send energy to network if producing
        if (output > 0) {
            // Send energy in small packets
            const wholeEU = Math.floor(output);
            for (let i = 0; i < wholeEU; i++) {
                energyNetwork.sendPacket(
                    this.position,
                    1,
                    this.config.voltageTier
                );
            }
        }

        return { euGenerated: output, broke: false };
    }

    /**
     * Calculate current potential output without side effects
     * @param conditions Current wind conditions
     * @returns EU output per tick
     */
    calculateCurrentOutput(conditions?: WindConditions): number {
        if (this.state.isBroken) {
            return 0;
        }

        let output = calculateWindOutput(
            this.position.y,
            this.state.windStrength,
            this.config
        );

        if (conditions?.isAreaBlocked) {
            output = calculateBlockedOutput(output, true);
        }

        return output;
    }

    /**
     * Cleanup when wind mill is destroyed
     */
    destroy(): void {
        energyNetwork.unregisterGenerator(this.position);
    }
}
