/**
 * NanoSuit Armor Handler
 * Requirements 17.1-17.3
 * 
 * NanoSuit is Tier 3 armor with 1M EU capacity per piece.
 * - Damage < 4: 100% absorption, cost = Damage × 800 EU
 * - Damage >= 4: 90% absorption, player receives 10%
 */

/**
 * NanoSuit configuration
 * Requirements 17.1
 */
export interface NanoSuitConfig {
    /** Maximum EU capacity per armor piece */
    capacity: number;
    /** Voltage tier for charging */
    tier: number;
    /** EU cost per damage point */
    euPerDamage: number;
}

/**
 * Default NanoSuit configuration matching IC2 Experimental
 * Requirements 17.1
 */
export const NANOSUIT_CONFIG: NanoSuitConfig = {
    capacity: 1_000_000,    // 1M EU per piece
    tier: 3,                // Tier 3 (charges in MFE/MFSU)
    euPerDamage: 800        // 800 EU per damage point
};

/**
 * NanoSuit armor piece state
 */
export interface NanoSuitPieceState {
    /** Current energy stored */
    energyStored: number;
    /** Armor slot (helmet, chestplate, leggings, boots) */
    slot: ArmorSlot;
}

/**
 * Armor slot types
 */
export enum ArmorSlot {
    HELMET = 'helmet',
    CHESTPLATE = 'chestplate',
    LEGGINGS = 'leggings',
    BOOTS = 'boots'
}

/**
 * Result of damage absorption calculation
 */
export interface DamageAbsorptionResult {
    /** Damage absorbed by armor (reduced to 0 for player) */
    absorbed: number;
    /** Damage passed through to player */
    passedThrough: number;
    /** EU cost for absorption */
    euCost: number;
    /** Absorption ratio (0-1) */
    absorptionRatio: number;
    /** Whether armor had enough energy */
    hadEnoughEnergy: boolean;
}

/**
 * Calculate damage absorption for NanoSuit
 * Requirements 17.2, 17.3
 * 
 * @param damage Incoming damage amount
 * @param currentEnergy Current energy stored in armor
 * @param config NanoSuit configuration
 * @returns Damage absorption result
 */
export function calculateDamageAbsorption(
    damage: number,
    currentEnergy: number,
    config: NanoSuitConfig = NANOSUIT_CONFIG
): DamageAbsorptionResult {
    // No damage, no absorption needed
    if (damage <= 0) {
        return {
            absorbed: 0,
            passedThrough: 0,
            euCost: 0,
            absorptionRatio: 1,
            hadEnoughEnergy: true
        };
    }

    // Calculate EU cost
    const euCost = damage * config.euPerDamage;

    // Check if we have enough energy
    if (currentEnergy < euCost) {
        // Not enough energy - no absorption
        return {
            absorbed: 0,
            passedThrough: damage,
            euCost: 0,
            absorptionRatio: 0,
            hadEnoughEnergy: false
        };
    }

    // Determine absorption ratio based on damage amount
    // Requirements 17.2: Damage < 4: 100% absorb
    // Requirements 17.3: Damage >= 4: 90% absorb
    let absorptionRatio: number;
    if (damage < 4) {
        absorptionRatio = 1.0;  // 100% absorption
    } else {
        absorptionRatio = 0.9;  // 90% absorption
    }

    const absorbed = damage * absorptionRatio;
    const passedThrough = damage - absorbed;

    return {
        absorbed,
        passedThrough,
        euCost,
        absorptionRatio,
        hadEnoughEnergy: true
    };
}

/**
 * NanoSuit armor piece class
 * Requirements 17.1-17.3
 */
export class NanoSuitPiece {
    private state: NanoSuitPieceState;
    private config: NanoSuitConfig;

    constructor(slot: ArmorSlot, config: NanoSuitConfig = NANOSUIT_CONFIG) {
        this.config = config;
        this.state = {
            energyStored: 0,
            slot
        };
    }

    /**
     * Get current state
     */
    getState(): NanoSuitPieceState {
        return { ...this.state };
    }

    /**
     * Set state (for persistence restore)
     */
    setState(state: NanoSuitPieceState): void {
        this.state = { ...state };
    }

    /**
     * Get configuration
     */
    getConfig(): NanoSuitConfig {
        return this.config;
    }

    /**
     * Get current energy stored
     */
    getEnergyStored(): number {
        return this.state.energyStored;
    }

    /**
     * Get maximum energy capacity
     */
    getMaxEnergy(): number {
        return this.config.capacity;
    }

    /**
     * Get armor slot
     */
    getSlot(): ArmorSlot {
        return this.state.slot;
    }

    /**
     * Charge armor with energy
     * @param amount EU to add
     * @returns Actual EU added
     */
    charge(amount: number): number {
        const spaceAvailable = this.config.capacity - this.state.energyStored;
        const actualCharge = Math.min(amount, spaceAvailable);
        this.state.energyStored += actualCharge;
        return actualCharge;
    }

    /**
     * Discharge energy from armor
     * @param amount EU to remove
     * @returns Actual EU removed
     */
    discharge(amount: number): number {
        const actualDischarge = Math.min(amount, this.state.energyStored);
        this.state.energyStored -= actualDischarge;
        return actualDischarge;
    }

    /**
     * Handle incoming damage
     * Requirements 17.2, 17.3
     * 
     * @param damage Incoming damage amount
     * @returns Damage absorption result
     */
    handleDamage(damage: number): DamageAbsorptionResult {
        const result = calculateDamageAbsorption(
            damage,
            this.state.energyStored,
            this.config
        );

        // Deduct EU cost if absorption occurred
        if (result.hadEnoughEnergy && result.euCost > 0) {
            this.state.energyStored -= result.euCost;
        }

        return result;
    }

    /**
     * Check if armor has energy
     */
    hasEnergy(): boolean {
        return this.state.energyStored > 0;
    }

    /**
     * Get energy percentage (0-1)
     */
    getEnergyPercentage(): number {
        return this.state.energyStored / this.config.capacity;
    }
}

/**
 * NanoSuit full set handler
 * Manages all four armor pieces together
 */
export class NanoSuit {
    private pieces: Map<ArmorSlot, NanoSuitPiece>;
    private config: NanoSuitConfig;

    constructor(config: NanoSuitConfig = NANOSUIT_CONFIG) {
        this.config = config;
        this.pieces = new Map();
        
        // Initialize all pieces
        for (const slot of Object.values(ArmorSlot)) {
            this.pieces.set(slot, new NanoSuitPiece(slot, config));
        }
    }

    /**
     * Get a specific armor piece
     */
    getPiece(slot: ArmorSlot): NanoSuitPiece | undefined {
        return this.pieces.get(slot);
    }

    /**
     * Get all pieces
     */
    getAllPieces(): NanoSuitPiece[] {
        return Array.from(this.pieces.values());
    }

    /**
     * Get total energy stored across all pieces
     */
    getTotalEnergy(): number {
        let total = 0;
        for (const piece of this.pieces.values()) {
            total += piece.getEnergyStored();
        }
        return total;
    }

    /**
     * Get total maximum energy capacity
     */
    getTotalMaxEnergy(): number {
        return this.config.capacity * 4;  // 4 pieces
    }

    /**
     * Handle damage with full suit
     * Distributes damage handling across pieces
     * 
     * @param damage Incoming damage
     * @returns Combined damage absorption result
     */
    handleDamage(damage: number): DamageAbsorptionResult {
        // Find first piece with enough energy
        for (const piece of this.pieces.values()) {
            if (piece.hasEnergy()) {
                return piece.handleDamage(damage);
            }
        }

        // No piece has energy
        return {
            absorbed: 0,
            passedThrough: damage,
            euCost: 0,
            absorptionRatio: 0,
            hadEnoughEnergy: false
        };
    }
}
