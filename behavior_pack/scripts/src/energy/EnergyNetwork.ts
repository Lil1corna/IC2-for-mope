import { Vector3 } from "@minecraft/server";
import { IMachine } from "../machines/IMachine";
import { getAdjacentPositions, posToKey } from "./CableGraph";

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
    machine: IMachine;
}

/**
 * Generator registration info
 */
export interface EnergyGenerator {
    position: Vector3;
    outputVoltage: number;
    packetSize: number;
    machine: IMachine;
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

    private key(pos: Vector3): string {
        return posToKey(pos);
    }

    registerConsumer(position: Vector3, data: Omit<EnergyConsumer, "position">): void {
        const key = this.key(position);
        this.consumers.set(key, { position: { ...position }, ...data });
    }

    updateConsumer(position: Vector3, data: Partial<Omit<EnergyConsumer, "position">>): void {
        const key = this.key(position);
        const existing = this.consumers.get(key);
        if (!existing) return;
        this.consumers.set(key, { ...existing, ...data, position: existing.position });
    }

    unregisterConsumer(position: Vector3): void {
        this.consumers.delete(this.key(position));
    }

    registerGenerator(position: Vector3, data: Omit<EnergyGenerator, "position">): void {
        const key = this.key(position);
        this.generators.set(key, { position: { ...position }, ...data });
    }

    updateGenerator(position: Vector3, data: Partial<Omit<EnergyGenerator, "position">>): void {
        const key = this.key(position);
        const existing = this.generators.get(key);
        if (!existing) return;
        this.generators.set(key, { ...existing, ...data, position: existing.position });
    }

    unregisterGenerator(position: Vector3): void {
        this.generators.delete(this.key(position));
    }

    registerCable(position: Vector3, cableType: string): void {
        const config = CABLE_CONFIG[cableType];
        if (!config) return;
        this.cables.set(this.key(position), config);
    }

    unregisterCable(position: Vector3): void {
        this.cables.delete(this.key(position));
    }

    sendPacket(source: Vector3, euAmount: number, voltage: number): PacketResult[] {
        const results: PacketResult[] = [];
        if (euAmount <= 0) return results;

        const neighbors = getAdjacentPositions(source);
        for (const neighbor of neighbors) {
            const consumer = this.consumers.get(this.key(neighbor));
            if (consumer) {
                results.push(this.handlePacketToConsumer(consumer, euAmount, voltage, 0, 1));
                continue;
            }

            const cable = this.cables.get(this.key(neighbor));
            if (!cable) continue;
            if (voltage > cable.maxEU) {
                results.push({
                    accepted: false,
                    euDelivered: 0,
                    exploded: true,
                    explosionForce: calculateExplosionForce(voltage)
                });
                continue;
            }

            const cableNeighbors = getAdjacentPositions(neighbor);
            for (const targetPos of cableNeighbors) {
                const target = this.consumers.get(this.key(targetPos));
                if (!target) continue;
                results.push(this.handlePacketToConsumer(target, euAmount, voltage, cable.loss, 1));
            }
        }

        return results;
    }

    receivePacket(
        consumer: EnergyConsumer,
        euAmount: number,
        voltage: number,
        totalLoss: number,
        distance: number
    ): PacketResult {
        return this.handlePacketToConsumer(consumer, euAmount, voltage, totalLoss, distance);
    }

    distributeEnergy(): void {
        for (const generator of this.generators.values()) {
            let available = generator.machine.energyStored;
            if (available <= 0) continue;

            const neighbors = getAdjacentPositions(generator.position);
            for (const neighbor of neighbors) {
                if (available <= 0) break;

                const neighborKey = this.key(neighbor);
                const neighborConsumer = this.consumers.get(neighborKey);
                if (neighborConsumer) {
                    const accepted = this.sendDirect(generator, neighborConsumer);
                    if (accepted > 0) {
                        generator.machine.removeEnergy(accepted);
                        available -= accepted;
                    }
                    continue;
                }

                const cable = this.cables.get(neighborKey);
                if (!cable) continue;
                if (generator.outputVoltage > cable.maxEU) {
                    continue;
                }

                const delivered = this.sendViaCable(generator, neighbor, cable);
                if (delivered > 0) {
                    generator.machine.removeEnergy(delivered);
                    available -= delivered;
                }
            }
        }
    }

    private handlePacketToConsumer(
        consumer: EnergyConsumer,
        euAmount: number,
        voltage: number,
        lossPerBlock: number,
        distance: number
    ): PacketResult {
        if (shouldExplode(voltage, consumer.maxVoltage)) {
            return {
                accepted: false,
                euDelivered: 0,
                exploded: true,
                explosionForce: calculateExplosionForce(voltage)
            };
        }

        const delivered = calculateDeliveredEnergy(euAmount, lossPerBlock, distance);
        const accepted = consumer.machine.addEnergy(Math.min(delivered, consumer.maxInput));
        return {
            accepted: accepted > 0,
            euDelivered: accepted,
            exploded: false
        };
    }

    private sendDirect(generator: EnergyGenerator, consumer: EnergyConsumer): number {
        if (generator.outputVoltage > consumer.maxVoltage) {
            return 0;
        }

        const packetSize = Math.min(generator.packetSize, generator.machine.energyStored);
        if (packetSize <= 0) return 0;

        const accepted = consumer.machine.addEnergy(Math.min(packetSize, consumer.maxInput));
        return accepted;
    }

    private sendViaCable(generator: EnergyGenerator, cablePos: Vector3, cable: CableConfig): number {
        const packetSize = Math.min(generator.packetSize, generator.machine.energyStored);
        if (packetSize <= 0) return 0;

        const neighbors = getAdjacentPositions(cablePos);
        let transferred = 0;
        for (const neighbor of neighbors) {
            if (transferred >= packetSize) break;

            const neighborKey = this.key(neighbor);
            const consumer = this.consumers.get(neighborKey);
            if (!consumer) continue;
            if (generator.outputVoltage > consumer.maxVoltage || generator.outputVoltage > cable.maxEU) {
                continue;
            }

            const available = packetSize - transferred;
            const afterLoss = calculateDeliveredEnergy(available, cable.loss, 1);
            if (afterLoss <= 0) continue;

            const accepted = consumer.machine.addEnergy(Math.min(afterLoss, consumer.maxInput));
            transferred += accepted;
        }

        return transferred;
    }

    getConsumers(): EnergyConsumer[] {
        return Array.from(this.consumers.values());
    }

    getGenerators(): EnergyGenerator[] {
        return Array.from(this.generators.values());
    }

    getConsumer(position: Vector3): EnergyConsumer | undefined {
        return this.consumers.get(this.key(position));
    }
}

export const energyNetwork = new EnergyNetwork();
