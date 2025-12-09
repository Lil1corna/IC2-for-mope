import { Vector3 } from "@minecraft/server";
import { energyNetwork, VoltageTier, calculateExplosionForce } from "../../energy/EnergyNetwork";

/**
 * Base machine configuration
 * Requirements 9.1-9.4
 */
export interface MachineConfig {
    /** Maximum EU input per tick (explodes if exceeded) */
    maxInput: number;
    /** EU consumed per tick during operation */
    consumption: number;
    /** Ticks required to complete one operation */
    operationTime: number;
    /** Maximum energy buffer */
    maxEnergy: number;
    /** Maximum voltage tier accepted */
    maxVoltage: VoltageTier;
}

/**
 * Default machine configuration matching IC2 Experimental
 * Requirements 9.1-9.3
 */
export const MACHINE_BASE_CONFIG: MachineConfig = {
    maxInput: 32,           // EU/t (explodes at 33+)
    consumption: 2,         // EU/t during operation
    operationTime: 400,     // ticks (20 seconds)
    maxEnergy: 400,         // Buffer for ~200 ticks of operation
    maxVoltage: VoltageTier.LV
};

/**
 * Machine state for persistence
 */
export interface MachineState {
    /** Current energy stored */
    energyStored: number;
    /** Current operation progress in ticks */
    progress: number;
    /** Whether machine is currently processing */
    isProcessing: boolean;
    /** Whether machine has valid input to process */
    hasInput: boolean;
    /** Whether output slot has space */
    hasOutputSpace: boolean;
}

/**
 * Result of receiving energy packet
 */
export interface EnergyReceiveResult {
    /** Whether energy was accepted */
    accepted: boolean;
    /** Amount of EU actually received */
    euReceived: number;
    /** Whether machine exploded from overvoltage */
    exploded: boolean;
    /** Explosion force if exploded */
    explosionForce?: number;
}

/**
 * Result of a tick operation
 */
export interface TickResult {
    /** EU consumed this tick */
    euConsumed: number;
    /** Whether operation completed this tick */
    operationCompleted: boolean;
    /** Whether machine is paused (insufficient energy) */
    isPaused: boolean;
}


/**
 * Check if voltage exceeds machine's maximum and should cause explosion
 * @param receivedVoltage The voltage of the incoming packet
 * @param maxVoltage The machine's maximum voltage
 * @returns true if machine should explode
 */
export function shouldMachineExplode(receivedVoltage: number, maxVoltage: number): boolean {
    return receivedVoltage > maxVoltage;
}

/**
 * BaseMachine class for processing machines (Macerator, Compressor, etc.)
 * Implements common functionality for all processing machines
 * Requirements 9.1-9.4
 */
export class BaseMachine {
    protected position: Vector3;
    protected config: MachineConfig;
    protected state: MachineState;

    constructor(position: Vector3, config: MachineConfig = MACHINE_BASE_CONFIG) {
        this.position = position;
        this.config = config;
        this.state = {
            energyStored: 0,
            progress: 0,
            isProcessing: false,
            hasInput: false,
            hasOutputSpace: true
        };

        // Register with energy network as consumer
        energyNetwork.registerConsumer({
            position: this.position,
            maxVoltage: this.config.maxVoltage,
            maxInput: this.config.maxInput,
            currentEnergy: this.state.energyStored,
            maxEnergy: this.config.maxEnergy
        });
    }

    /**
     * Get current machine state
     */
    getState(): MachineState {
        return { ...this.state };
    }

    /**
     * Set machine state (for persistence restore)
     */
    setState(state: MachineState): void {
        this.state = { ...state };
        this.updateNetworkConsumer();
    }

    /**
     * Get machine position
     */
    getPosition(): Vector3 {
        return this.position;
    }

    /**
     * Get machine configuration
     */
    getConfig(): MachineConfig {
        return this.config;
    }

    /**
     * Receive energy packet from network
     * Handles overvoltage explosion
     * @param euAmount Amount of EU in packet
     * @param voltage Voltage of packet
     * @returns Result of receiving energy
     */
    receiveEnergy(euAmount: number, voltage: number): EnergyReceiveResult {
        // Check for overvoltage - machine explodes (Requirement 9.1)
        if (shouldMachineExplode(voltage, this.config.maxVoltage)) {
            const force = calculateExplosionForce(voltage);
            return {
                accepted: false,
                euReceived: 0,
                exploded: true,
                explosionForce: force
            };
        }

        // Check if we can accept energy
        const spaceAvailable = this.config.maxEnergy - this.state.energyStored;
        const actualReceived = Math.min(euAmount, spaceAvailable, this.config.maxInput);

        if (actualReceived > 0) {
            this.state.energyStored += actualReceived;
            this.updateNetworkConsumer();
        }

        return {
            accepted: actualReceived > 0,
            euReceived: actualReceived,
            exploded: false
        };
    }

    /**
     * Set whether machine has valid input to process
     */
    setHasInput(hasInput: boolean): void {
        this.state.hasInput = hasInput;
    }

    /**
     * Set whether output slot has space
     */
    setHasOutputSpace(hasSpace: boolean): void {
        this.state.hasOutputSpace = hasSpace;
    }

    /**
     * Process one tick of machine operation
     * Requirements 9.2-9.4
     * @returns Result of tick operation
     */
    tick(): TickResult {
        const result: TickResult = {
            euConsumed: 0,
            operationCompleted: false,
            isPaused: false
        };

        // Check if we can process
        if (!this.state.hasInput || !this.state.hasOutputSpace) {
            // No input or output full - reset progress
            if (this.state.progress > 0) {
                this.state.progress = 0;
                this.state.isProcessing = false;
            }
            return result;
        }

        // Check if we have enough energy (Requirement 9.4)
        if (this.state.energyStored < this.config.consumption) {
            // Insufficient energy - pause operation
            result.isPaused = true;
            this.state.isProcessing = false;
            return result;
        }

        // Consume energy and progress (Requirement 9.2)
        this.state.energyStored -= this.config.consumption;
        result.euConsumed = this.config.consumption;
        this.state.progress++;
        this.state.isProcessing = true;

        // Check if operation complete (Requirement 9.3)
        if (this.state.progress >= this.config.operationTime) {
            result.operationCompleted = true;
            this.state.progress = 0;
            this.state.isProcessing = false;
        }

        this.updateNetworkConsumer();
        return result;
    }

    /**
     * Get current energy stored
     */
    getEnergyStored(): number {
        return this.state.energyStored;
    }

    /**
     * Get operation progress (0-1)
     */
    getProgress(): number {
        if (this.config.operationTime <= 0) return 0;
        return this.state.progress / this.config.operationTime;
    }

    /**
     * Check if machine is currently processing
     */
    isProcessing(): boolean {
        return this.state.isProcessing;
    }

    /**
     * Update energy network consumer info
     */
    protected updateNetworkConsumer(): void {
        energyNetwork.registerConsumer({
            position: this.position,
            maxVoltage: this.config.maxVoltage,
            maxInput: this.config.maxInput,
            currentEnergy: this.state.energyStored,
            maxEnergy: this.config.maxEnergy
        });
    }

    /**
     * Cleanup when machine is destroyed
     */
    destroy(): void {
        energyNetwork.unregisterConsumer(this.position);
    }
}
