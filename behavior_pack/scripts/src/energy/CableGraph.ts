import { Vector3 } from "@minecraft/server";
import { CABLE_CONFIG, CableConfig, CachedPath } from "./EnergyNetwork";

/**
 * Position key for map storage
 */
export function posToKey(pos: Vector3): string {
    return `${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`;
}

/**
 * Parse key back to Vector3
 */
export function keyToPos(key: string): Vector3 {
    const [x, y, z] = key.split(',').map(Number);
    return { x, y, z };
}

/**
 * Cable node in the graph
 */
export interface CableNode {
    position: Vector3;
    cableType: string;
    config: CableConfig;
}

/**
 * Consumer node for pathfinding targets
 */
export interface ConsumerNode {
    position: Vector3;
    maxVoltage: number;
}

/**
 * Generator node for pathfinding sources
 */
export interface GeneratorNode {
    position: Vector3;
    outputVoltage: number;
}

/**
 * Path result from BFS pathfinding
 */
export interface PathResult {
    target: Vector3;
    distance: number;
    totalLoss: number;
    maxVoltage: number;
    path: Vector3[];
}

/**
 * Get adjacent positions (6 directions: up, down, north, south, east, west)
 */
export function getAdjacentPositions(pos: Vector3): Vector3[] {
    return [
        { x: pos.x + 1, y: pos.y, z: pos.z },
        { x: pos.x - 1, y: pos.y, z: pos.z },
        { x: pos.x, y: pos.y + 1, z: pos.z },
        { x: pos.x, y: pos.y - 1, z: pos.z },
        { x: pos.x, y: pos.y, z: pos.z + 1 },
        { x: pos.x, y: pos.y, z: pos.z - 1 },
    ];
}


/**
 * CableGraph manages the cable network topology and pathfinding
 * Implements BFS pathfinding with caching for efficient energy routing
 * 
 * Requirements: 1.5, 2.1-2.6
 */
export class CableGraph {
    private cables: Map<string, CableNode> = new Map();
    private consumers: Map<string, ConsumerNode> = new Map();
    private generators: Map<string, GeneratorNode> = new Map();
    
    // Cache for paths from each generator to consumers
    private pathCache: Map<string, PathResult[]> = new Map();
    private cacheValid: boolean = false;
    private cacheVersion: number = 0;

    /**
     * Add a cable to the network
     * Invalidates cache as network topology changed
     */
    addCable(position: Vector3, cableType: string): boolean {
        const config = CABLE_CONFIG[cableType];
        if (!config) {
            return false;
        }

        const key = posToKey(position);
        this.cables.set(key, {
            position: { ...position },
            cableType,
            config
        });
        
        this.invalidateCache();
        return true;
    }

    /**
     * Remove a cable from the network
     * Invalidates cache as network topology changed
     */
    removeCable(position: Vector3): boolean {
        const key = posToKey(position);
        const existed = this.cables.has(key);
        this.cables.delete(key);
        
        if (existed) {
            this.invalidateCache();
        }
        return existed;
    }

    /**
     * Get cable at position
     */
    getCable(position: Vector3): CableNode | undefined {
        return this.cables.get(posToKey(position));
    }

    /**
     * Check if position has a cable
     */
    hasCable(position: Vector3): boolean {
        return this.cables.has(posToKey(position));
    }

    /**
     * Add a consumer to the network
     */
    addConsumer(position: Vector3, maxVoltage: number): void {
        const key = posToKey(position);
        this.consumers.set(key, {
            position: { ...position },
            maxVoltage
        });
        this.invalidateCache();
    }

    /**
     * Remove a consumer from the network
     */
    removeConsumer(position: Vector3): boolean {
        const key = posToKey(position);
        const existed = this.consumers.has(key);
        this.consumers.delete(key);
        
        if (existed) {
            this.invalidateCache();
        }
        return existed;
    }

    /**
     * Add a generator to the network
     */
    addGenerator(position: Vector3, outputVoltage: number): void {
        const key = posToKey(position);
        this.generators.set(key, {
            position: { ...position },
            outputVoltage
        });
        this.invalidateCache();
    }

    /**
     * Remove a generator from the network
     */
    removeGenerator(position: Vector3): boolean {
        const key = posToKey(position);
        const existed = this.generators.has(key);
        this.generators.delete(key);
        
        if (existed) {
            this.invalidateCache();
        }
        return existed;
    }

    /**
     * Invalidate the path cache
     * Called when network topology changes (cable/consumer/generator added/removed)
     */
    invalidateCache(): void {
        this.cacheValid = false;
        this.pathCache.clear();
        this.cacheVersion++;
    }

    /**
     * Check if cache is valid
     */
    isCacheValid(): boolean {
        return this.cacheValid;
    }

    /**
     * Get current cache version (increments on each invalidation)
     */
    getCacheVersion(): number {
        return this.cacheVersion;
    }

    /**
     * Get all cables in the network
     */
    getCables(): CableNode[] {
        return Array.from(this.cables.values());
    }

    /**
     * Get all consumers in the network
     */
    getConsumers(): ConsumerNode[] {
        return Array.from(this.consumers.values());
    }

    /**
     * Get all generators in the network
     */
    getGenerators(): GeneratorNode[] {
        return Array.from(this.generators.values());
    }


    /**
     * Find paths from a source position to all reachable consumers
     * Uses BFS through the cable network
     * Returns cached results if available
     */
    findPaths(source: Vector3): PathResult[] {
        const sourceKey = posToKey(source);
        
        // Return cached paths if valid
        if (this.cacheValid && this.pathCache.has(sourceKey)) {
            return this.pathCache.get(sourceKey)!;
        }

        const paths = this.calculatePaths(source);
        this.pathCache.set(sourceKey, paths);
        
        // Mark cache as valid only after all paths calculated
        if (this.pathCache.size === this.generators.size) {
            this.cacheValid = true;
        }

        return paths;
    }

    /**
     * Calculate paths from source to all reachable consumers using BFS
     * Tracks distance, cumulative loss, and minimum voltage along path
     */
    private calculatePaths(source: Vector3): PathResult[] {
        const results: PathResult[] = [];
        const sourceKey = posToKey(source);
        
        // BFS state
        interface BFSNode {
            position: Vector3;
            distance: number;
            totalLoss: number;
            minVoltage: number;
            path: Vector3[];
        }

        const visited = new Set<string>();
        const queue: BFSNode[] = [];

        // Start from adjacent positions to source (generator connects to cables)
        const startPositions = getAdjacentPositions(source);
        for (const pos of startPositions) {
            const key = posToKey(pos);
            
            // Check if it's a cable
            const cable = this.cables.get(key);
            if (cable) {
                queue.push({
                    position: pos,
                    distance: 1,
                    totalLoss: cable.config.loss,
                    minVoltage: cable.config.maxEU,
                    path: [source, pos]
                });
                visited.add(key);
            }
            
            // Check if it's a consumer directly adjacent
            const consumer = this.consumers.get(key);
            if (consumer) {
                results.push({
                    target: consumer.position,
                    distance: 1,
                    totalLoss: 0,
                    maxVoltage: consumer.maxVoltage,
                    path: [source, consumer.position]
                });
                visited.add(key);
            }
        }

        // BFS through cable network
        while (queue.length > 0) {
            const current = queue.shift()!;
            const currentKey = posToKey(current.position);

            // Check adjacent positions
            const neighbors = getAdjacentPositions(current.position);
            for (const neighbor of neighbors) {
                const neighborKey = posToKey(neighbor);
                
                // Skip if already visited
                if (visited.has(neighborKey)) continue;
                
                // Skip source position
                if (neighborKey === sourceKey) continue;

                // Check if neighbor is a consumer
                const consumer = this.consumers.get(neighborKey);
                if (consumer) {
                    visited.add(neighborKey);
                    results.push({
                        target: consumer.position,
                        distance: current.distance + 1,
                        totalLoss: current.totalLoss,
                        maxVoltage: Math.min(current.minVoltage, consumer.maxVoltage),
                        path: [...current.path, consumer.position]
                    });
                    continue;
                }

                // Check if neighbor is a cable
                const cable = this.cables.get(neighborKey);
                if (cable) {
                    visited.add(neighborKey);
                    queue.push({
                        position: neighbor,
                        distance: current.distance + 1,
                        totalLoss: current.totalLoss + cable.config.loss,
                        minVoltage: Math.min(current.minVoltage, cable.config.maxEU),
                        path: [...current.path, neighbor]
                    });
                }
            }
        }

        return results;
    }

    /**
     * Convert PathResult to CachedPath format for EnergyNetwork compatibility
     */
    toCachedPaths(paths: PathResult[]): CachedPath[] {
        return paths.map(p => ({
            target: p.target,
            distance: p.distance,
            totalLoss: p.totalLoss,
            maxVoltage: p.maxVoltage
        }));
    }

    /**
     * Get the number of cables in the network
     */
    getCableCount(): number {
        return this.cables.size;
    }

    /**
     * Get the number of consumers in the network
     */
    getConsumerCount(): number {
        return this.consumers.size;
    }

    /**
     * Get the number of generators in the network
     */
    getGeneratorCount(): number {
        return this.generators.size;
    }

    /**
     * Clear all network data
     */
    clear(): void {
        this.cables.clear();
        this.consumers.clear();
        this.generators.clear();
        this.invalidateCache();
    }
}

// Singleton instance for global cable network
export const cableGraph = new CableGraph();
