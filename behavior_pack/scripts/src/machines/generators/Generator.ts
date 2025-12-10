import { Vector3 } from "@minecraft/server";
import { energyNetwork, VoltageTier } from "../../energy/EnergyNetwork";
import { IMachine } from "../IMachine";
import { BaseMachine, MachineConfig } from "../processing/BaseMachine";

/**
 * Fuel burn times in ticks (matching vanilla furnace)
 * 1 item smelts in 200 ticks in vanilla furnace
 */
export const FUEL_BURN_TIMES: Record<string, number> = {
    "minecraft:coal": 1600,
    "minecraft:oak_planks": 300,
    "minecraft:stick": 100,
    "minecraft:lava_bucket": 20000
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
    outputPerTick: 10,
    maxBuffer: 1000,
    packetSize: 10,
    voltageTier: VoltageTier.LV
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
export class Generator extends BaseMachine implements IMachine<GeneratorState> {
    private config: GeneratorConfig;
    private generatorState: GeneratorState;

    constructor(position: Vector3, config: GeneratorConfig = GENERATOR_CONFIG) {
        const baseConfig: MachineConfig = {
            maxInput: config.packetSize,
            consumption: 0,
            operationTime: 0,
            maxEnergy: config.maxBuffer,
            maxVoltage: config.voltageTier
        };

        super(position, baseConfig, "generator", false);

        this.config = config;
        this.generatorState = {
            energyStored: 0,
            burnTimeRemaining: 0,
            totalBurnTime: 0,
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
    getState(): GeneratorState {
        return { ...this.generatorState };
    }

    /**
     * Get generator configuration
     */
    getConfig(): GeneratorConfig {
        return this.config;
    }

    /**
     * Set generator state (for persistence restore)
     */
    setState(state: GeneratorState): void {
        this.generatorState = { ...state };
    }

    /**
     * Get generator position
     */
    get energyStored(): number {
        return this.generatorState.energyStored;
    }

    get maxEnergy(): number {
        return this.config.maxBuffer;
    }

    /**
     * Try to consume fuel item
     * @param itemId The fuel item type ID
     * @returns true if fuel was consumed
     */
    tryConsumeFuel(itemId: string): boolean {
        // Can't add fuel if already burning
        if (this.generatorState.burnTimeRemaining > 0) {
            return false;
        }

        // Can't add fuel if buffer is full
        if (this.generatorState.energyStored >= this.config.maxBuffer) {
            return false;
        }

        const burnTime = getFuelBurnTime(itemId);
        if (burnTime <= 0) {
            return false;
        }

        this.generatorState.burnTimeRemaining = burnTime;
        this.generatorState.totalBurnTime = burnTime;
        this.generatorState.isActive = true;
        return true;
    }

    /**
     * Process one tick of generator operation
     * Called every game tick when generator is loaded
     * @returns EU generated this tick
     */
    tick(delta: number = 1): number {
        let euGenerated = 0;

        // If burning fuel, generate energy
        if (this.generatorState.burnTimeRemaining > 0) {
            // Check if buffer has space
            const spaceInBuffer = this.config.maxBuffer - this.generatorState.energyStored;

            if (spaceInBuffer > 0) {
                const perTick = this.config.outputPerTick * delta;
                euGenerated = Math.min(perTick, spaceInBuffer);
                this.generatorState.energyStored += euGenerated;
                this.generatorState.burnTimeRemaining = Math.max(0, this.generatorState.burnTimeRemaining - delta);

                // Check if fuel exhausted
                if (this.generatorState.burnTimeRemaining <= 0) {
                    this.generatorState.isActive = false;
                    this.generatorState.totalBurnTime = 0;
                }
            }
            // If buffer full, fuel still burns but no EU generated
            // (IC2 behavior: fuel continues burning even if buffer full)
            else {
                this.generatorState.burnTimeRemaining = Math.max(0, this.generatorState.burnTimeRemaining - delta);
                if (this.generatorState.burnTimeRemaining <= 0) {
                    this.generatorState.isActive = false;
                    this.generatorState.totalBurnTime = 0;
                }
            }
        }

        // Try to send energy packets if we have energy
        this.trySendPackets();

        return euGenerated;
    }

    addEnergy(amount: number): number {
        if (amount <= 0) return 0;
        const space = this.config.maxBuffer - this.generatorState.energyStored;
        const accepted = Math.min(space, amount);
        this.generatorState.energyStored += accepted;
        return accepted;
    }

    removeEnergy(amount: number): number {
        if (amount <= 0) return 0;
        const removed = Math.min(this.generatorState.energyStored, amount);
        this.generatorState.energyStored -= removed;
        return removed;
    }

    /**
     * Try to send energy packets to connected consumers
     */
    private trySendPackets(): void {
        // Send packets while we have enough energy
        while (this.generatorState.energyStored >= this.config.packetSize) {
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
            this.generatorState.energyStored -= this.config.packetSize;
        }
    }

    /**
     * Get current energy stored
     */
    getEnergyStored(): number {
        return this.generatorState.energyStored;
    }

    /**
     * Get burn progress (0-1)
     */
    getBurnProgress(): number {
        if (this.generatorState.totalBurnTime <= 0) return 0;
        return 1 - (this.generatorState.burnTimeRemaining / this.generatorState.totalBurnTime);
    }

    /**
     * Check if generator is currently active (burning fuel)
     */
    isActive(): boolean {
        return this.generatorState.isActive;
    }

    /**
     * Cleanup when generator is destroyed
     */
    destroy(): void {
        energyNetwork.unregisterGenerator(this.position);
    }
}
