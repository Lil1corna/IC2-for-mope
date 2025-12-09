import { Vector3 } from "@minecraft/server";
import { energyNetwork, VoltageTier } from "../../energy/EnergyNetwork";

/**
 * Solar Panel configuration
 * Requirements 8.1-8.3
 */
export interface SolarPanelConfig {
    /** EU output per tick when conditions are met */
    outputPerTick: number;
    /** Output voltage tier */
    voltageTier: VoltageTier;
    /** Daytime start tick (inclusive) */
    daytimeStart: number;
    /** Daytime end tick (exclusive) */
    daytimeEnd: number;
}

/**
 * Default solar panel configuration matching IC2 Experimental
 * Requirements 8.1-8.3
 */
export const SOLAR_PANEL_CONFIG: SolarPanelConfig = {
    outputPerTick: 1,           // 1 EU/t output (Req 8.1)
    voltageTier: VoltageTier.LV, // Low Voltage (32 EU max)
    daytimeStart: 0,            // Daytime starts at tick 0
    daytimeEnd: 12000           // Daytime ends at tick 12000
};

/**
 * World conditions for solar panel operation
 */
export interface SolarConditions {
    /** Current time of day in ticks (0-24000) */
    timeOfDay: number;
    /** Whether it's currently raining */
    isRaining: boolean;
    /** Whether sky is visible above the panel */
    hasSkyAccess: boolean;
}

/**
 * Check if time is during daytime (0-12000 ticks)
 * Requirements 8.1
 * @param timeOfDay Current time in ticks (0-24000)
 * @param config Solar panel configuration
 * @returns true if daytime
 */
export function isDaytime(timeOfDay: number, config: SolarPanelConfig = SOLAR_PANEL_CONFIG): boolean {
    // Normalize time to 0-24000 range
    const normalizedTime = ((timeOfDay % 24000) + 24000) % 24000;
    return normalizedTime >= config.daytimeStart && normalizedTime < config.daytimeEnd;
}

/**
 * Check if solar panel can produce energy based on conditions
 * Requirements 8.1, 8.2
 * @param conditions Current world conditions
 * @param config Solar panel configuration
 * @returns true if all conditions are met for energy production
 */
export function canProduceEnergy(
    conditions: SolarConditions,
    config: SolarPanelConfig = SOLAR_PANEL_CONFIG
): boolean {
    // Must be daytime (Req 8.1)
    if (!isDaytime(conditions.timeOfDay, config)) {
        return false;
    }

    // Must not be raining (Req 8.1)
    if (conditions.isRaining) {
        return false;
    }

    // Must have clear sky above (Req 8.1)
    if (!conditions.hasSkyAccess) {
        return false;
    }

    return true;
}

/**
 * Calculate solar panel output based on conditions
 * Requirements 8.1, 8.2
 * @param conditions Current world conditions
 * @param config Solar panel configuration
 * @returns EU output per tick (0 or outputPerTick)
 */
export function calculateSolarOutput(
    conditions: SolarConditions,
    config: SolarPanelConfig = SOLAR_PANEL_CONFIG
): number {
    if (canProduceEnergy(conditions, config)) {
        return config.outputPerTick;
    }
    return 0;
}

/**
 * Solar Panel class implementing passive solar energy generation
 * Requirements 8.1-8.3
 * 
 * - 1 EU/t output when daytime, no rain, clear sky (Req 8.1)
 * - 0 EU/t when nighttime, rain, or blocked sky (Req 8.2)
 * - Direct output, no buffer (Req 8.3)
 */
export class SolarPanel {
    private position: Vector3;
    private config: SolarPanelConfig;

    constructor(position: Vector3, config: SolarPanelConfig = SOLAR_PANEL_CONFIG) {
        this.position = position;
        this.config = config;

        // Register with energy network as generator
        energyNetwork.registerGenerator({
            position: this.position,
            outputVoltage: this.config.voltageTier,
            packetSize: this.config.outputPerTick
        });
    }

    /**
     * Get solar panel position
     */
    getPosition(): Vector3 {
        return this.position;
    }

    /**
     * Get solar panel configuration
     */
    getConfig(): SolarPanelConfig {
        return this.config;
    }

    /**
     * Process one tick of solar panel operation
     * Called every game tick when solar panel is loaded
     * @param conditions Current world conditions
     * @returns EU generated this tick
     */
    tick(conditions: SolarConditions): number {
        const output = calculateSolarOutput(conditions, this.config);

        if (output > 0) {
            // Send energy directly to network (no buffer - Req 8.3)
            energyNetwork.sendPacket(
                this.position,
                output,
                this.config.voltageTier
            );
        }

        return output;
    }

    /**
     * Check if solar panel is currently producing energy
     * @param conditions Current world conditions
     */
    isProducing(conditions: SolarConditions): boolean {
        return canProduceEnergy(conditions, this.config);
    }

    /**
     * Cleanup when solar panel is destroyed
     */
    destroy(): void {
        energyNetwork.unregisterGenerator(this.position);
    }
}
