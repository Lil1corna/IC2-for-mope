import { Vector3 } from "@minecraft/server";
import { energyNetwork, VoltageTier } from "../../energy/EnergyNetwork";

/**
 * Fuel burn times in ticks (matching vanilla furnace)
 * 1 item smelts in 200 ticks in vanilla furnace
 */
export const FUEL_BURN_TIMES: Record<string, number> = {
    "minecraft:coal": 1600,           // 80 seconds, smelts 8 items
    "minecraft:charcoal": 1600,       // 80 seconds, smelts 8 items
    "minecraft:coal_block": 16000,    // 800 seconds, smelts 80 items
    "minecraft:oak_log": 300,         // 15 seconds, smelts 1.5 items
    "minecraft:spruce_log": 300,
    "minecraft:birch_log": 300,
    "minecraft:jungle_log": 300,
    "minecraft:acacia_log": 300,
    "minecraft:dark_oak_log": 300,
    "minecraft:mangrove_log": 300,
    "minecraft:cherry_log": 300,
    "minecraft:oak_planks": 300,      // 15 seconds
    "minecraft:spruce_planks": 300,
    "minecraft:birch_planks": 300,
    "minecraft:jungle_planks": 300,
    "minecraft:acacia_planks": 300,
    "minecraft:dark_oak_planks": 300,
    "minecraft:mangrove_planks": 300,
    "minecraft:cherry_planks": 300,
    "minecraft:stick": 100,           // 5 seconds, smelts 0.5 items
    "minecraft:wooden_slab": 150,     // 7.5 seconds
    "minecraft:blaze_rod": 2400,      // 120 seconds, smelts 12 items
    "minecraft:lava_bucket": 20000,   // 1000 seconds, smelts 100 items
};

/**
 * Generator configuration
 * Requirements 5.1-5.4
 */
export interface GeneratorConfig {
    /** EU output per tick when active */
    outputPerTick: number;
    /** Maximum internal energy buffer */
    maxBuffer: number;
    /** EU per packet sent to network */
    packetSize: number;
    /** Output voltage tier */
    voltageTier: VoltageTier;
}

/**
 * Default generator configuration matching IC2 Experimental
 */
export const GENERATOR_CONFIG: GeneratorConfig = {
    outputPerTick: 10,      // 10 EU/t output
    maxBuffer: 4000,        // 4000 EU buffer
    packetSize: 10,         // 10 EU per packet
    voltageTier: VoltageTier.LV  // Low Voltage (32 EU max)
};

/**
 * Generator state for persistence
 */
export interface GeneratorState {
    /** Current energy stored in buffer */
    energyStored: number;
    /** Remaining burn time in ticks for current fuel */
    burnTimeRemaining: number;
    /** Total burn time of current fuel (for progress display) */
    totalBurnTime: number;
    /** Whether generator is currently active (burning fuel) */
    isActive: boolean;
}

/**
 * Get fuel burn time for an item
 * @param itemId The item type ID
 * @returns Burn time in ticks, or 0 if not a valid fuel
 */
export function getFuelBurnTime(itemId: string): number {
    return FUEL_BURN_TIMES[itemId] ?? 0;
}

/**
 * Check if an item is valid fuel
 * @param itemId The item type ID
 * @returns true if item can be used as fuel
 */
export function isValidFuel(itemId: string): boolean {
    return getFuelBurnTime(itemId) > 0;
}

/**
 * Calculate EU generated per tick based on generator config
 * @param config Generator configuration
 * @returns EU generated per tick when active
 */
export function calculateOutputPerTick(config: GeneratorConfig = GENERATOR_CONFIG): number {
    return config.outputPerTick;
}

/**
 * Generator class implementing basic coal/wood generator
 * Requirements 5.1-5.4
 */
export class Generator {
    private position: Vector3;
    private config: GeneratorConfig;
    private state: GeneratorState;

    constructor(position: Vector3, config: GeneratorConfig = GENERATOR_CONFIG) {
        this.position = position;
        this.config = config;
        this.state = {
            energyStored: 0,
            burnTimeRemaining: 0,
            totalBurnTime: 0,
            isActive: false
        };

        // Register with energy network as generator
        energyNetwork.registerGenerator({
            position: this.position,
            outputVoltage: this.config.voltageTier,
            packetSize: this.config.packetSize
        });
    }

    /**
     * Get current generator state
     */
    getState(): GeneratorState {
        return { ...this.state };
    }

    /**
     * Set generator state (for persistence restore)
     */
    setState(state: GeneratorState): void {
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
    getConfig(): GeneratorConfig {
        return this.config;
    }

    /**
     * Try to consume fuel item
     * @param itemId The fuel item type ID
     * @returns true if fuel was consumed
     */
    tryConsumeFuel(itemId: string): boolean {
        // Can't add fuel if already burning
        if (this.state.burnTimeRemaining > 0) {
            return false;
        }

        // Can't add fuel if buffer is full
        if (this.state.energyStored >= this.config.maxBuffer) {
            return false;
        }

        const burnTime = getFuelBurnTime(itemId);
        if (burnTime <= 0) {
            return false;
        }

        this.state.burnTimeRemaining = burnTime;
        this.state.totalBurnTime = burnTime;
        this.state.isActive = true;
        return true;
    }

    /**
     * Process one tick of generator operation
     * Called every game tick when generator is loaded
     * @returns EU generated this tick
     */
    tick(): number {
        let euGenerated = 0;

        // If burning fuel, generate energy
        if (this.state.burnTimeRemaining > 0) {
            // Check if buffer has space
            const spaceInBuffer = this.config.maxBuffer - this.state.energyStored;
            
            if (spaceInBuffer > 0) {
                // Generate energy (up to available space)
                euGenerated = Math.min(this.config.outputPerTick, spaceInBuffer);
                this.state.energyStored += euGenerated;
                this.state.burnTimeRemaining--;
                
                // Check if fuel exhausted
                if (this.state.burnTimeRemaining <= 0) {
                    this.state.isActive = false;
                    this.state.totalBurnTime = 0;
                }
            }
            // If buffer full, fuel still burns but no EU generated
            // (IC2 behavior: fuel continues burning even if buffer full)
            else {
                this.state.burnTimeRemaining--;
                if (this.state.burnTimeRemaining <= 0) {
                    this.state.isActive = false;
                    this.state.totalBurnTime = 0;
                }
            }
        }

        // Try to send energy packets if we have energy
        this.trySendPackets();

        return euGenerated;
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
     * Get burn progress (0-1)
     */
    getBurnProgress(): number {
        if (this.state.totalBurnTime <= 0) return 0;
        return 1 - (this.state.burnTimeRemaining / this.state.totalBurnTime);
    }

    /**
     * Check if generator is currently active (burning fuel)
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
