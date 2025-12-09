import { Block, Dimension, Vector3, world } from "@minecraft/server";

/**
 * Voltage Tiers for IC2 energy system
 */
export enum VoltageTier {
    LV = 32,    // Low Voltage
    MV = 128,   // Medium Voltage
    HV = 512,   // High Voltage
    EV = 2048,  // Extreme Voltage
    IV = 8192   // Insane Voltage
}

/**
 * Cable configuration with max EU and loss per block
 */
export interface CableConfig {
    maxEU: number;
    loss: number;
}

/**
 * Cable configurations matching IC2 Experimental values
 * Requirements 2.1-2.5
 */
export const CABLE_CONFIG: Record<string, CableConfig> = {
    tin: { maxEU: 32, loss: 0.025 },
    copper: { maxEU: 128, loss: 0.2 },
    gold: { maxEU: 512, loss: 0.4 },
    iron_hv: { maxEU: 2048, loss: 0.8 },
    glass_fibre: { maxEU: 8192, loss: 0.025 }
};

/**
 * Valid cable type names
 */
export const CABLE_TYPES = ['tin', 'copper', 'gold', 'iron_hv', 'glass_fibre'] as const;
export type CableType = typeof CABLE_TYPES[number];

/**
 * Check if a string is a valid cable type
 */
export function isValidCableType(type: string): type is CableType {
    return CABLE_TYPES.includes(type as CableType);
}

/**
 * Get cable configuration by type
 * Returns undefined if type is invalid
 */
export function getCableConfig(type: string): CableConfig | undefined {
    if (!isValidCableType(type)) {
        return undefined;
    }
    return CABLE_CONFIG[type];
}

/**
 * Cached path to a consumer
 */
export interface CachedPath {
    target: Vector3;
    distance: number;
    totalLoss: number;
    maxVoltage: number;
}

/**
 * Energy packet for transmission
 */
export interface EnergyPacket {
    euAmount: number;
    voltage: number;
    source: Vector3;
}

/**
 * Result of receiving an energy packet
 */
export interface PacketResult {
    accepted: boolean;
    euDelivered: number;
    exploded: boolean;
    explosionForce?: number;
}


/**
 * Machine/consumer registration info
 */
export interface EnergyConsumer {
    position: Vector3;
    maxVoltage: number;
    maxInput: number;
    currentEnergy: number;
    maxEnergy: number;
}

/**
 * Generator registration info
 */
export interface EnergyGenerator {
    position: Vector3;
    outputVoltage: number;
    packetSize: number;
}

/**
 * Calculate explosion force from overvoltage
 * Formula: force = Voltage / 20
 */
export function calculateExplosionForce(voltage: number): number {
    return voltage / 20;
}

/**
 * Calculate delivered energy after cable loss
 * Formula: E_final = E_start - (loss × distance)
 */
export function calculateDeliveredEnergy(startEnergy: number, lossPerBlock: number, distance: number): number {
    const delivered = startEnergy - (lossPerBlock * distance);
    return Math.max(0, delivered);
}

/**
 * Check if voltage exceeds maximum and should cause explosion
 */
export function shouldExplode(receivedVoltage: number, maxVoltage: number): boolean {
    return receivedVoltage > maxVoltage;
}

/**
 * EnergyNetwork class manages packet-based energy transmission
 * Implements IC2's packet system with voltage tiers and cable losses
 */
export class EnergyNetwork {
    private consumers: Map<string, EnergyConsumer> = new Map();
    private generators: Map<string, EnergyGenerator> = new Map();
    private cables: Map<string, CableConfig> = new Map();
    private pathCache: Map<string, CachedPath[]> = new Map();
    private cacheValid: boolean = false;

    /**
     * Convert Vector3 to string key for maps
     */
    private posToKey(pos: Vector3): string {
        return `${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`;
    }

    /**
     * Register a consumer (machine) in the network
     */
    registerConsumer(consumer: EnergyConsumer): void {
        const key = this.posToKey(consumer.position);
        this.consumers.set(key, consumer);
        this.invalidateCache();
    }

    /**
     * Unregister a consumer from the network
     */
    unregisterConsumer(position: Vector3): void {
        const key = this.posToKey(position);
        this.consumers.delete(key);
        this.invalidateCache();
    }

    /**
     * Register a generator in the network
     */
    registerGenerator(generator: EnergyGenerator): void {
        const key = this.posToKey(generator.position);
        this.generators.set(key, generator);
        this.invalidateCache();
    }

    /**
     * Unregister a generator from the network
     */
    unregisterGenerator(position: Vector3): void {
        const key = this.posToKey(position);
        this.generators.delete(key);
        this.invalidateCache();
    }

    /**
     * Register a cable in the network
     */
    registerCable(position: Vector3, cableType: string): void {
        const key = this.posToKey(position);
        const config = CABLE_CONFIG[cableType];
        if (config) {
            this.cables.set(key, config);
            this.invalidateCache();
        }
    }

    /**
     * Unregister a cable from the network
     */
    unregisterCable(position: Vector3): void {
        const key = this.posToKey(position);
        this.cables.delete(key);
        this.invalidateCache();
    }

    /**
     * Invalidate the path cache (called when network changes)
     */
    invalidateCache(): void {
        this.cacheValid = false;
        this.pathCache.clear();
    }

    /**
     * Check if cache is valid
     */
    isCacheValid(): boolean {
        return this.cacheValid;
    }


    /**
     * Send an energy packet from a source
     * Returns results for each consumer that received energy
     */
    sendPacket(source: Vector3, euAmount: number, voltage: number): PacketResult[] {
        const results: PacketResult[] = [];
        const paths = this.getConsumerPaths(source);

        for (const path of paths) {
            const consumerKey = this.posToKey(path.target);
            const consumer = this.consumers.get(consumerKey);
            
            if (!consumer) continue;

            // Check cable voltage limits along path
            if (voltage > path.maxVoltage) {
                // Cable burns - handled by caller
                results.push({
                    accepted: false,
                    euDelivered: 0,
                    exploded: true,
                    explosionForce: calculateExplosionForce(voltage)
                });
                continue;
            }

            // Receive packet at consumer
            const result = this.receivePacket(consumer, euAmount, voltage, path.totalLoss, path.distance);
            results.push(result);
        }

        return results;
    }

    /**
     * Receive an energy packet at a consumer
     * Handles overvoltage explosion and energy loss
     */
    receivePacket(
        consumer: EnergyConsumer,
        euAmount: number,
        voltage: number,
        totalLoss: number,
        distance: number
    ): PacketResult {
        // Check for overvoltage - machine explodes
        if (shouldExplode(voltage, consumer.maxVoltage)) {
            const force = calculateExplosionForce(voltage);
            return {
                accepted: false,
                euDelivered: 0,
                exploded: true,
                explosionForce: force
            };
        }

        // Calculate energy after cable loss
        const deliveredEU = calculateDeliveredEnergy(euAmount, totalLoss, distance);

        // Check if consumer can accept energy
        const spaceAvailable = consumer.maxEnergy - consumer.currentEnergy;
        const actualDelivered = Math.min(deliveredEU, spaceAvailable, consumer.maxInput);

        if (actualDelivered > 0) {
            consumer.currentEnergy += actualDelivered;
        }

        return {
            accepted: actualDelivered > 0,
            euDelivered: actualDelivered,
            exploded: false
        };
    }

    /**
     * Get cached paths to consumers from a source
     * Recalculates if cache is invalid
     */
    getConsumerPaths(source: Vector3): CachedPath[] {
        const sourceKey = this.posToKey(source);
        
        if (this.cacheValid && this.pathCache.has(sourceKey)) {
            return this.pathCache.get(sourceKey)!;
        }

        // Recalculate paths (simplified - actual pathfinding in CableGraph)
        const paths = this.calculatePaths(source);
        this.pathCache.set(sourceKey, paths);
        this.cacheValid = true;

        return paths;
    }

    /**
     * Calculate paths from source to all reachable consumers
     * This is a simplified version - full pathfinding in CableGraph
     */
    private calculatePaths(source: Vector3): CachedPath[] {
        const paths: CachedPath[] = [];
        
        // For each consumer, find path through cables
        for (const [key, consumer] of this.consumers) {
            // Simplified: direct distance calculation
            // Full implementation uses BFS through cable network
            const dx = Math.abs(consumer.position.x - source.x);
            const dy = Math.abs(consumer.position.y - source.y);
            const dz = Math.abs(consumer.position.z - source.z);
            const distance = dx + dy + dz; // Manhattan distance

            // Find minimum voltage along path (simplified)
            let minVoltage = VoltageTier.IV;
            let totalLoss = 0;

            // In full implementation, trace through actual cables
            // For now, assume average cable loss
            const avgLoss = 0.2; // Default to copper loss
            totalLoss = avgLoss;

            paths.push({
                target: consumer.position,
                distance,
                totalLoss,
                maxVoltage: minVoltage
            });
        }

        return paths;
    }

    /**
     * Get all registered consumers
     */
    getConsumers(): EnergyConsumer[] {
        return Array.from(this.consumers.values());
    }

    /**
     * Get all registered generators
     */
    getGenerators(): EnergyGenerator[] {
        return Array.from(this.generators.values());
    }

    /**
     * Get consumer at position
     */
    getConsumer(position: Vector3): EnergyConsumer | undefined {
        return this.consumers.get(this.posToKey(position));
    }
}

// Singleton instance
export const energyNetwork = new EnergyNetwork();
