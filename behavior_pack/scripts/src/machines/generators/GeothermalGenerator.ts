import { Vector3 } from "@minecraft/server";
import { energyNetwork, VoltageTier } from "../../energy/EnergyNetwork";
import { IMachine } from "../IMachine";

/**
 * Geothermal Generator configuration
 * Requirements 6.1-6.3
 */
export interface GeothermalGeneratorConfig {
    /** EU output per tick when active */
    outputPerTick: number;
    /** Maximum internal energy buffer */
    maxBuffer: number;
    /** EU per packet sent to network */
    packetSize: number;
    /** Output voltage tier */
    voltageTier: VoltageTier;
    /** EU produced per lava bucket */
    euPerLavaBucket: number;
}

/**
 * Default geothermal generator configuration matching IC2 Experimental
 * Requirements 6.1-6.3
 */
export const GEOTHERMAL_CONFIG: GeothermalGeneratorConfig = {
    outputPerTick: 20,          // 20 EU/t output (Req 6.2)
    maxBuffer: 2400,            // 2400 EU buffer (Req 6.3)
    packetSize: 20,             // 20 EU per packet (matches output)
    voltageTier: VoltageTier.LV, // Low Voltage (32 EU max)
    euPerLavaBucket: 20000      // 20000 EU per lava bucket (Req 6.1)
};

/**
 * Geothermal Generator state for persistence
 */
export interface GeothermalGeneratorState {
    /** Current energy stored in buffer */
    energyStored: number;
    /** Remaining EU to generate from current lava */
    lavaEnergyRemaining: number;
    /** Whether generator is currently active (has lava) */
    isActive: boolean;
}

/**
 * Check if an item is valid lava fuel for geothermal generator
 * @param itemId The item type ID
 * @returns true if item is lava bucket
 */
export function isValidLavaFuel(itemId: string): boolean {
    return itemId === "minecraft:lava_bucket";
}


/**
 * Get EU value for lava bucket
 * @param itemId The item type ID
 * @returns EU value, or 0 if not valid lava fuel
 */
export function getLavaEnergyValue(itemId: string): number {
    if (isValidLavaFuel(itemId)) {
        return GEOTHERMAL_CONFIG.euPerLavaBucket;
    }
    return 0;
}

/**
 * Geothermal Generator class implementing lava-powered generator
 * Requirements 6.1-6.3
 * 
 * - 20 EU/t output when active (Req 6.2)
 * - 2400 EU internal buffer (Req 6.3)
 * - 20000 EU per lava bucket (Req 6.1)
 */
export class GeothermalGenerator implements IMachine<GeothermalGeneratorState> {
    readonly position: Vector3;
    readonly type: string = "geothermal_generator";
    private config: GeothermalGeneratorConfig;
    private state: GeothermalGeneratorState;

    constructor(position: Vector3, config: GeothermalGeneratorConfig = GEOTHERMAL_CONFIG) {
        this.position = position;
        this.config = config;
        this.state = {
            energyStored: 0,
            lavaEnergyRemaining: 0,
            isActive: false
        };

        // Register with energy network as generator
        energyNetwork.registerGenerator(this.position, {
            outputVoltage: this.config.voltageTier,
            packetSize: this.config.packetSize,
            machine: this
        });
    }

    /**
     * Get current generator state
     */
    getState(): GeothermalGeneratorState {
        return { ...this.state };
    }

    /**
     * Set generator state (for persistence restore)
     */
    setState(state: GeothermalGeneratorState): void {
        this.state = { ...state };
    }

    /**
     * Get generator position
     */
    getPosition(): Vector3 {
        return this.position;
    }

    /**
     * Get generator configuration
     */
    getConfig(): GeothermalGeneratorConfig {
        return { ...this.config };
    }

    get energyStored(): number {
        return this.state.energyStored;
    }

    get maxEnergy(): number {
        return this.config.maxBuffer;
    }

    /**
     * Try to consume lava bucket
     * @param itemId The fuel item type ID (should be lava_bucket)
     * @returns true if lava was consumed, also returns empty bucket
     */
    tryConsumeLava(itemId: string): boolean {
        // Only accept lava buckets
        if (!isValidLavaFuel(itemId)) {
            return false;
        }

        // Can't add lava if already has lava energy remaining
        if (this.state.lavaEnergyRemaining > 0) {
            return false;
        }

        // Can't add lava if buffer is full
        if (this.state.energyStored >= this.config.maxBuffer) {
            return false;
        }

        this.state.lavaEnergyRemaining = this.config.euPerLavaBucket;
        this.state.isActive = true;
        return true;
    }

    /**
     * Process one tick of geothermal generator operation
     * Called every game tick when generator is loaded
     * @returns EU generated this tick
     */
    tick(): number {
        let euGenerated = 0;

        // If has lava energy, generate energy
        if (this.state.lavaEnergyRemaining > 0) {
            // Check if buffer has space
            const spaceInBuffer = this.config.maxBuffer - this.state.energyStored;
            
            if (spaceInBuffer > 0) {
                // Generate energy (up to available space and remaining lava energy)
                euGenerated = Math.min(
                    this.config.outputPerTick,
                    spaceInBuffer,
                    this.state.lavaEnergyRemaining
                );
                this.state.energyStored += euGenerated;
                this.state.lavaEnergyRemaining -= euGenerated;
                
                // Check if lava exhausted
                if (this.state.lavaEnergyRemaining <= 0) {
                    this.state.isActive = false;
                }
            }
            // If buffer full, lava energy is preserved (unlike fuel burning)
        }

        // Try to send energy packets if we have energy
        this.trySendPackets();

        return euGenerated;
    }

    addEnergy(amount: number): number {
        if (amount <= 0) return 0;
        const space = this.config.maxBuffer - this.state.energyStored;
        const accepted = Math.min(space, amount);
        this.state.energyStored += accepted;
        return accepted;
    }

    removeEnergy(amount: number): number {
        if (amount <= 0) return 0;
        const removed = Math.min(this.state.energyStored, amount);
        this.state.energyStored -= removed;
        return removed;
    }

    /**
     * Try to send energy packets to connected consumers
     */
    private trySendPackets(): void {
        // Send packets while we have enough energy
        while (this.state.energyStored >= this.config.packetSize) {
            const results = energyNetwork.sendPacket(
                this.position,
                this.config.packetSize,
                this.config.voltageTier
            );

            // If no consumers accepted energy, stop sending
            const anyAccepted = results.some(r => r.accepted);
            if (!anyAccepted && results.length > 0) {
                break;
            }

            // If no consumers at all, stop
            if (results.length === 0) {
                break;
            }

            // Deduct sent energy
            this.state.energyStored -= this.config.packetSize;
        }
    }

    /**
     * Get current energy stored
     */
    getEnergyStored(): number {
        return this.state.energyStored;
    }

    /**
     * Get remaining lava energy
     */
    getLavaEnergyRemaining(): number {
        return this.state.lavaEnergyRemaining;
    }

    /**
     * Get lava consumption progress (0-1)
     */
    getLavaProgress(): number {
        if (this.state.lavaEnergyRemaining <= 0) return 0;
        return 1 - (this.state.lavaEnergyRemaining / this.config.euPerLavaBucket);
    }

    /**
     * Check if generator is currently active (has lava)
     */
    isActive(): boolean {
        return this.state.isActive;
    }

    /**
     * Cleanup when generator is destroyed
     */
    destroy(): void {
        energyNetwork.unregisterGenerator(this.position);
    }
}
