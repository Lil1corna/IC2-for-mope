/**
 * QuantumSuit Armor Handler
 * Requirements 18.1-18.8
 * 
 * QuantumSuit is Tier 4 armor with 10M EU capacity per piece.
 * - Helmet: Water Breathing, auto-feed (30k EU), cure Poison/Wither
 * - Chestplate: Jetpack flight, 100% damage absorption
 * - Leggings: Sprint speed × 3.5
 * - Boots: No fall damage, Jump Boost V
 */

import { ArmorSlot } from './NanoSuit';

/**
 * QuantumSuit configuration
 * Requirements 18.1
 */
export interface QuantumSuitConfig {
    /** Maximum EU capacity per armor piece */
    capacity: number;
    /** Voltage tier for charging */
    tier: number;
}

/**
 * Default QuantumSuit configuration matching IC2 Experimental
 * Requirements 18.1
 */
export const QUANTUMSUIT_CONFIG: QuantumSuitConfig = {
    capacity: 10_000_000,   // 10M EU per piece
    tier: 4                 // Tier 4 (charges in MFSU)
};

/**
 * Quantum Helmet configuration
 * Requirements 18.2-18.4
 */
export interface QuantumHelmetConfig {
    /** EU cost to restore one hunger point */
    autoFeedCost: number;
    /** Hunger threshold to trigger auto-feed */
    hungerThreshold: number;
    /** EU cost to cure poison effect */
    curePoisonCost: number;
    /** EU cost to cure wither effect */
    cureWitherCost: number;
    /** EU cost per tick for water breathing */
    waterBreathingCost: number;
}

export const QUANTUM_HELMET_CONFIG: QuantumHelmetConfig = {
    autoFeedCost: 30_000,       // 30k EU per hunger point
    hungerThreshold: 20,        // Trigger when hunger < 20
    curePoisonCost: 10_000,     // EU to cure poison
    cureWitherCost: 25_000,     // EU to cure wither
    waterBreathingCost: 0       // Free water breathing
};


/**
 * Quantum Chestplate configuration
 * Requirements 18.5-18.6
 */
export interface QuantumChestplateConfig {
    /** EU cost per tick for jetpack flight */
    flightCostPerTick: number;
    /** Damage absorption ratio (1.0 = 100%) */
    damageAbsorption: number;
    /** EU cost per damage point absorbed */
    euPerDamage: number;
}

export const QUANTUM_CHESTPLATE_CONFIG: QuantumChestplateConfig = {
    flightCostPerTick: 100,     // EU per tick while flying
    damageAbsorption: 1.0,      // 100% damage absorption
    euPerDamage: 1000           // EU per damage point
};

/**
 * Quantum Leggings configuration
 * Requirements 18.7
 */
export interface QuantumLeggingsConfig {
    /** Sprint speed multiplier */
    sprintMultiplier: number;
    /** EU cost per tick while sprinting */
    sprintCostPerTick: number;
}

export const QUANTUM_LEGGINGS_CONFIG: QuantumLeggingsConfig = {
    sprintMultiplier: 3.5,      // 3.5x sprint speed
    sprintCostPerTick: 50       // EU per tick while sprinting
};

/**
 * Quantum Boots configuration
 * Requirements 18.8
 */
export interface QuantumBootsConfig {
    /** Fall damage negation (true = no fall damage) */
    negateFallDamage: boolean;
    /** Jump boost level (5 = ~9 blocks) */
    jumpBoostLevel: number;
    /** EU cost per jump */
    jumpCost: number;
    /** EU cost to negate fall damage per damage point */
    fallDamageNegationCost: number;
}

export const QUANTUM_BOOTS_CONFIG: QuantumBootsConfig = {
    negateFallDamage: true,
    jumpBoostLevel: 5,          // Jump Boost V (~9 blocks)
    jumpCost: 1000,             // EU per boosted jump
    fallDamageNegationCost: 500 // EU per fall damage point negated
};

/**
 * QuantumSuit armor piece state
 */
export interface QuantumSuitPieceState {
    /** Current energy stored */
    energyStored: number;
    /** Armor slot */
    slot: ArmorSlot;
}

/**
 * Result of helmet effect processing
 */
export interface HelmetEffectResult {
    /** Whether water breathing is active */
    waterBreathing: boolean;
    /** Hunger points restored */
    hungerRestored: number;
    /** Effects cured */
    effectsCured: string[];
    /** Total EU consumed */
    euConsumed: number;
    /** Whether had enough energy for all effects */
    hadEnoughEnergy: boolean;
}

/**
 * Calculate Quantum Helmet effects
 * Requirements 18.2-18.4
 * 
 * @param currentEnergy Current energy in helmet
 * @param currentHunger Player's current hunger (0-20)
 * @param hasPoison Whether player has poison effect
 * @param hasWither Whether player has wither effect
 * @param isUnderwater Whether player is underwater
 * @param config Helmet configuration
 * @returns Effect processing result
 */
export function calculateHelmetEffects(
    currentEnergy: number,
    currentHunger: number,
    hasPoison: boolean,
    hasWither: boolean,
    isUnderwater: boolean,
    config: QuantumHelmetConfig = QUANTUM_HELMET_CONFIG
): HelmetEffectResult {
    let euConsumed = 0;
    let hungerRestored = 0;
    const effectsCured: string[] = [];
    let hadEnoughEnergy = true;

    // Water breathing is always active (free)
    // Requirements 18.2
    const waterBreathing = isUnderwater;
    if (waterBreathing) {
        euConsumed += config.waterBreathingCost;
    }

    // Auto-feed when hunger < 20
    // Requirements 18.3
    if (currentHunger < config.hungerThreshold) {
        const hungerToRestore = config.hungerThreshold - currentHunger;
        const feedCost = hungerToRestore * config.autoFeedCost;
        
        if (currentEnergy - euConsumed >= feedCost) {
            hungerRestored = hungerToRestore;
            euConsumed += feedCost;
        } else {
            // Partial feed with remaining energy
            const affordableHunger = Math.floor((currentEnergy - euConsumed) / config.autoFeedCost);
            if (affordableHunger > 0) {
                hungerRestored = affordableHunger;
                euConsumed += affordableHunger * config.autoFeedCost;
            }
            hadEnoughEnergy = false;
        }
    }

    // Cure Poison effect
    // Requirements 18.4
    if (hasPoison && currentEnergy - euConsumed >= config.curePoisonCost) {
        effectsCured.push('poison');
        euConsumed += config.curePoisonCost;
    } else if (hasPoison) {
        hadEnoughEnergy = false;
    }

    // Cure Wither effect
    // Requirements 18.4
    if (hasWither && currentEnergy - euConsumed >= config.cureWitherCost) {
        effectsCured.push('wither');
        euConsumed += config.cureWitherCost;
    } else if (hasWither) {
        hadEnoughEnergy = false;
    }

    return {
        waterBreathing,
        hungerRestored,
        effectsCured,
        euConsumed,
        hadEnoughEnergy
    };
}


/**
 * Result of chestplate damage absorption
 */
export interface ChestplateDamageResult {
    /** Damage absorbed (should be 100% for quantum) */
    absorbed: number;
    /** Damage passed through (should be 0 for quantum, except /kill) */
    passedThrough: number;
    /** EU consumed */
    euConsumed: number;
    /** Whether had enough energy */
    hadEnoughEnergy: boolean;
    /** Whether jetpack flight is active */
    flightActive: boolean;
}

/**
 * Calculate Quantum Chestplate damage absorption
 * Requirements 18.5-18.6
 * 
 * @param damage Incoming damage
 * @param currentEnergy Current energy in chestplate
 * @param isKillCommand Whether damage is from /kill command
 * @param config Chestplate configuration
 * @returns Damage absorption result
 */
export function calculateChestplateDamage(
    damage: number,
    currentEnergy: number,
    isKillCommand: boolean = false,
    config: QuantumChestplateConfig = QUANTUM_CHESTPLATE_CONFIG
): ChestplateDamageResult {
    // /kill command bypasses all protection
    // Requirements 18.6
    if (isKillCommand) {
        return {
            absorbed: 0,
            passedThrough: damage,
            euConsumed: 0,
            hadEnoughEnergy: true,
            flightActive: false
        };
    }

    if (damage <= 0) {
        return {
            absorbed: 0,
            passedThrough: 0,
            euConsumed: 0,
            hadEnoughEnergy: true,
            flightActive: false
        };
    }

    const euCost = damage * config.euPerDamage;

    if (currentEnergy >= euCost) {
        // Full absorption
        return {
            absorbed: damage * config.damageAbsorption,
            passedThrough: damage * (1 - config.damageAbsorption),
            euConsumed: euCost,
            hadEnoughEnergy: true,
            flightActive: false
        };
    }

    // Not enough energy - no absorption
    return {
        absorbed: 0,
        passedThrough: damage,
        euConsumed: 0,
        hadEnoughEnergy: false,
        flightActive: false
    };
}

/**
 * Calculate jetpack flight EU cost
 * Requirements 18.5
 * 
 * @param ticks Number of ticks flying
 * @param currentEnergy Current energy
 * @param config Chestplate configuration
 * @returns EU cost and whether flight can continue
 */
export function calculateFlightCost(
    ticks: number,
    currentEnergy: number,
    config: QuantumChestplateConfig = QUANTUM_CHESTPLATE_CONFIG
): { euCost: number; canFly: boolean } {
    const euCost = ticks * config.flightCostPerTick;
    return {
        euCost,
        canFly: currentEnergy >= euCost
    };
}

/**
 * Result of leggings sprint calculation
 */
export interface LeggingsSprintResult {
    /** Actual speed multiplier applied */
    speedMultiplier: number;
    /** EU consumed */
    euConsumed: number;
    /** Whether had enough energy */
    hadEnoughEnergy: boolean;
}

/**
 * Calculate Quantum Leggings sprint speed
 * Requirements 18.7
 * 
 * @param isSprinting Whether player is sprinting
 * @param ticks Number of ticks sprinting
 * @param currentEnergy Current energy in leggings
 * @param config Leggings configuration
 * @returns Sprint calculation result
 */
export function calculateLeggingsSprint(
    isSprinting: boolean,
    ticks: number,
    currentEnergy: number,
    config: QuantumLeggingsConfig = QUANTUM_LEGGINGS_CONFIG
): LeggingsSprintResult {
    if (!isSprinting) {
        return {
            speedMultiplier: 1.0,
            euConsumed: 0,
            hadEnoughEnergy: true
        };
    }

    const euCost = ticks * config.sprintCostPerTick;

    if (currentEnergy >= euCost) {
        return {
            speedMultiplier: config.sprintMultiplier,
            euConsumed: euCost,
            hadEnoughEnergy: true
        };
    }

    // Not enough energy - normal speed
    return {
        speedMultiplier: 1.0,
        euConsumed: 0,
        hadEnoughEnergy: false
    };
}

/**
 * Result of boots effect calculation
 */
export interface BootsEffectResult {
    /** Fall damage negated */
    fallDamageNegated: number;
    /** Jump boost level applied */
    jumpBoostLevel: number;
    /** EU consumed */
    euConsumed: number;
    /** Whether had enough energy */
    hadEnoughEnergy: boolean;
}

/**
 * Calculate Quantum Boots effects
 * Requirements 18.8
 * 
 * @param fallDamage Incoming fall damage
 * @param isJumping Whether player is jumping
 * @param currentEnergy Current energy in boots
 * @param config Boots configuration
 * @returns Boots effect result
 */
export function calculateBootsEffects(
    fallDamage: number,
    isJumping: boolean,
    currentEnergy: number,
    config: QuantumBootsConfig = QUANTUM_BOOTS_CONFIG
): BootsEffectResult {
    let euConsumed = 0;
    let fallDamageNegated = 0;
    let jumpBoostLevel = 0;
    let hadEnoughEnergy = true;

    // Negate fall damage
    if (fallDamage > 0 && config.negateFallDamage) {
        const fallCost = fallDamage * config.fallDamageNegationCost;
        if (currentEnergy >= fallCost) {
            fallDamageNegated = fallDamage;
            euConsumed += fallCost;
        } else {
            hadEnoughEnergy = false;
        }
    }

    // Jump boost
    if (isJumping) {
        if (currentEnergy - euConsumed >= config.jumpCost) {
            jumpBoostLevel = config.jumpBoostLevel;
            euConsumed += config.jumpCost;
        } else {
            hadEnoughEnergy = false;
        }
    }

    return {
        fallDamageNegated,
        jumpBoostLevel,
        euConsumed,
        hadEnoughEnergy
    };
}


/**
 * Base Quantum Suit piece class
 */
export class QuantumSuitPiece {
    protected state: QuantumSuitPieceState;
    protected config: QuantumSuitConfig;

    constructor(slot: ArmorSlot, config: QuantumSuitConfig = QUANTUMSUIT_CONFIG) {
        this.config = config;
        this.state = {
            energyStored: 0,
            slot
        };
    }

    getState(): QuantumSuitPieceState {
        return { ...this.state };
    }

    setState(state: QuantumSuitPieceState): void {
        this.state = { ...state };
    }

    getConfig(): QuantumSuitConfig {
        return this.config;
    }

    getEnergyStored(): number {
        return this.state.energyStored;
    }

    getMaxEnergy(): number {
        return this.config.capacity;
    }

    getSlot(): ArmorSlot {
        return this.state.slot;
    }

    charge(amount: number): number {
        const spaceAvailable = this.config.capacity - this.state.energyStored;
        const actualCharge = Math.min(amount, spaceAvailable);
        this.state.energyStored += actualCharge;
        return actualCharge;
    }

    discharge(amount: number): number {
        const actualDischarge = Math.min(amount, this.state.energyStored);
        this.state.energyStored -= actualDischarge;
        return actualDischarge;
    }

    hasEnergy(): boolean {
        return this.state.energyStored > 0;
    }

    getEnergyPercentage(): number {
        return this.state.energyStored / this.config.capacity;
    }
}

/**
 * Quantum Helmet
 * Requirements 18.2-18.4
 */
export class QuantumHelmet extends QuantumSuitPiece {
    private helmetConfig: QuantumHelmetConfig;

    constructor(
        config: QuantumSuitConfig = QUANTUMSUIT_CONFIG,
        helmetConfig: QuantumHelmetConfig = QUANTUM_HELMET_CONFIG
    ) {
        super(ArmorSlot.HELMET, config);
        this.helmetConfig = helmetConfig;
    }

    /**
     * Process helmet effects for one tick
     */
    processEffects(
        currentHunger: number,
        hasPoison: boolean,
        hasWither: boolean,
        isUnderwater: boolean
    ): HelmetEffectResult {
        const result = calculateHelmetEffects(
            this.state.energyStored,
            currentHunger,
            hasPoison,
            hasWither,
            isUnderwater,
            this.helmetConfig
        );

        if (result.euConsumed > 0) {
            this.state.energyStored -= result.euConsumed;
        }

        return result;
    }
}

/**
 * Quantum Chestplate
 * Requirements 18.5-18.6
 */
export class QuantumChestplate extends QuantumSuitPiece {
    private chestplateConfig: QuantumChestplateConfig;
    private isFlying: boolean = false;

    constructor(
        config: QuantumSuitConfig = QUANTUMSUIT_CONFIG,
        chestplateConfig: QuantumChestplateConfig = QUANTUM_CHESTPLATE_CONFIG
    ) {
        super(ArmorSlot.CHESTPLATE, config);
        this.chestplateConfig = chestplateConfig;
    }

    /**
     * Handle incoming damage
     */
    handleDamage(damage: number, isKillCommand: boolean = false): ChestplateDamageResult {
        const result = calculateChestplateDamage(
            damage,
            this.state.energyStored,
            isKillCommand,
            this.chestplateConfig
        );

        if (result.euConsumed > 0) {
            this.state.energyStored -= result.euConsumed;
        }

        return result;
    }

    /**
     * Process flight for given ticks
     */
    processFlightTick(ticks: number = 1): { canFly: boolean; euConsumed: number } {
        const { euCost, canFly } = calculateFlightCost(
            ticks,
            this.state.energyStored,
            this.chestplateConfig
        );

        if (canFly) {
            this.state.energyStored -= euCost;
            this.isFlying = true;
        } else {
            this.isFlying = false;
        }

        return { canFly, euConsumed: canFly ? euCost : 0 };
    }

    isCurrentlyFlying(): boolean {
        return this.isFlying;
    }

    setFlying(flying: boolean): void {
        this.isFlying = flying;
    }
}

/**
 * Quantum Leggings
 * Requirements 18.7
 */
export class QuantumLeggings extends QuantumSuitPiece {
    private leggingsConfig: QuantumLeggingsConfig;

    constructor(
        config: QuantumSuitConfig = QUANTUMSUIT_CONFIG,
        leggingsConfig: QuantumLeggingsConfig = QUANTUM_LEGGINGS_CONFIG
    ) {
        super(ArmorSlot.LEGGINGS, config);
        this.leggingsConfig = leggingsConfig;
    }

    /**
     * Process sprint for given ticks
     */
    processSprint(isSprinting: boolean, ticks: number = 1): LeggingsSprintResult {
        const result = calculateLeggingsSprint(
            isSprinting,
            ticks,
            this.state.energyStored,
            this.leggingsConfig
        );

        if (result.euConsumed > 0) {
            this.state.energyStored -= result.euConsumed;
        }

        return result;
    }

    /**
     * Get sprint speed multiplier
     */
    getSprintMultiplier(): number {
        return this.leggingsConfig.sprintMultiplier;
    }
}

/**
 * Quantum Boots
 * Requirements 18.8
 */
export class QuantumBoots extends QuantumSuitPiece {
    private bootsConfig: QuantumBootsConfig;

    constructor(
        config: QuantumSuitConfig = QUANTUMSUIT_CONFIG,
        bootsConfig: QuantumBootsConfig = QUANTUM_BOOTS_CONFIG
    ) {
        super(ArmorSlot.BOOTS, config);
        this.bootsConfig = bootsConfig;
    }

    /**
     * Process boots effects
     */
    processEffects(fallDamage: number, isJumping: boolean): BootsEffectResult {
        const result = calculateBootsEffects(
            fallDamage,
            isJumping,
            this.state.energyStored,
            this.bootsConfig
        );

        if (result.euConsumed > 0) {
            this.state.energyStored -= result.euConsumed;
        }

        return result;
    }

    /**
     * Get jump boost level
     */
    getJumpBoostLevel(): number {
        return this.bootsConfig.jumpBoostLevel;
    }
}

/**
 * Full QuantumSuit set handler
 */
export class QuantumSuit {
    private helmet: QuantumHelmet;
    private chestplate: QuantumChestplate;
    private leggings: QuantumLeggings;
    private boots: QuantumBoots;
    private config: QuantumSuitConfig;

    constructor(config: QuantumSuitConfig = QUANTUMSUIT_CONFIG) {
        this.config = config;
        this.helmet = new QuantumHelmet(config);
        this.chestplate = new QuantumChestplate(config);
        this.leggings = new QuantumLeggings(config);
        this.boots = new QuantumBoots(config);
    }

    getHelmet(): QuantumHelmet {
        return this.helmet;
    }

    getChestplate(): QuantumChestplate {
        return this.chestplate;
    }

    getLeggings(): QuantumLeggings {
        return this.leggings;
    }

    getBoots(): QuantumBoots {
        return this.boots;
    }

    getAllPieces(): QuantumSuitPiece[] {
        return [this.helmet, this.chestplate, this.leggings, this.boots];
    }

    getTotalEnergy(): number {
        return this.helmet.getEnergyStored() +
               this.chestplate.getEnergyStored() +
               this.leggings.getEnergyStored() +
               this.boots.getEnergyStored();
    }

    getTotalMaxEnergy(): number {
        return this.config.capacity * 4;
    }

    /**
     * Handle damage with full suit (uses chestplate)
     */
    handleDamage(damage: number, isKillCommand: boolean = false): ChestplateDamageResult {
        return this.chestplate.handleDamage(damage, isKillCommand);
    }
}
