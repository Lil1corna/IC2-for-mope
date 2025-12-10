import { world, system, Player, Block, Vector3, EntityHurtAfterEvent, Dimension, ItemStack, EquipmentSlot, PlayerPlaceBlockAfterEvent, PlayerBreakBlockAfterEvent, PlayerInteractWithBlockAfterEvent, PlayerLeaveBeforeEvent } from "@minecraft/server";

// Energy system imports
import { energyNetwork } from "./energy/EnergyNetwork";
import { cableGraph } from "./energy/CableGraph";

// Persistence imports
import { persistenceManager, positionToKey } from "./persistence/PersistenceManager";

// Generator imports
import { Generator } from "./machines/generators/Generator";
import { GeothermalGenerator } from "./machines/generators/GeothermalGenerator";
import { SolarPanel, SolarConditions } from "./machines/generators/SolarPanel";
import { WindMill, WindConditions } from "./machines/generators/WindMill";

// Processing machine imports
import { BaseMachine } from "./machines/processing/BaseMachine";
import { Macerator } from "./machines/processing/Macerator";
import { ElectricFurnace } from "./machines/processing/ElectricFurnace";
import { Compressor } from "./machines/processing/Compressor";
import { Extractor } from "./machines/processing/Extractor";
import { Recycler } from "./machines/processing/Recycler";
import { BatBox } from "./machines/storage/BatBox";
import { IMachine } from "./machines/IMachine";

// Reactor imports
import { NuclearReactor } from "./machines/reactor/NuclearReactor";
import { ReactorSimulator } from "./machines/reactor/ReactorSimulator";

// Armor imports
import { NanoSuit, ArmorSlot } from "./machines/armor/NanoSuit";
import { QuantumSuit } from "./machines/armor/QuantumSuit";

// Tool imports
import { ElectricTools } from "./machines/tools/ElectricTools";

// Rubber tree imports
import { rubberTreeManager, ResinSpotState } from "./rubber/RubberTree";

// GUI imports
import { guiManager, MachineType, MachineGUIState, ReactorGUIState } from "./gui/GUIManager";

/**
 * IndustrialCraft 2 Experimental - Bedrock Edition
 * Main entry point for the addon scripts
 * 
 * Task 44: Wire up event handlers
 */

// ==========================================
// Machine Registries
// ==========================================

/** Electric tools system */
const electricTools = new ElectricTools();

/** Registry of player armor states */
const playerArmorStates = new Map<string, { nanosuit?: NanoSuit; quantumsuit?: QuantumSuit }>();

class MachineManager {
    private machines = new Map<string, IMachine>();

    createMachine(blockId: string, position: Vector3): IMachine | null {
        const posKey = vectorToKey(position);
        let machine: IMachine | null = null;

        switch (blockId) {
            case "ic2:generator":
                machine = new Generator(position);
                break;
            case "ic2:macerator":
                machine = new Macerator(position);
                break;
            case "ic2:electric_furnace":
                machine = new ElectricFurnace(position);
                break;
            case "ic2:compressor":
                machine = new Compressor(position);
                break;
            case "ic2:extractor":
                machine = new Extractor(position);
                break;
            case "ic2:recycler":
                machine = new Recycler(position);
                break;
            case "ic2:batbox":
                machine = new BatBox(position);
                break;
            default:
                break;
        }

        if (!machine) return null;

        this.machines.set(posKey, machine);
        return machine;
    }

    destroyMachine(posKey: string): void {
        const machine = this.machines.get(posKey);
        if (machine && typeof (machine as { destroy?: () => void }).destroy === "function") {
            try {
                (machine as { destroy: () => void }).destroy();
            } catch {
                // Ignore cleanup errors
            }
        }

        this.machines.delete(posKey);
        persistenceManager.clearMachineState(posKey);
    }

    tick(delta: number = 1): void {
        for (const [, machine] of this.machines) {
            try {
                machine.tick(delta);
            } catch {
                // Error ticking machine
            }
        }
    }

    getMachine(posKey: string): IMachine | undefined {
        return this.machines.get(posKey);
    }

    entries(): IterableIterator<[string, IMachine]> {
        return this.machines.entries();
    }
}

const machineManager = new MachineManager();

/** Registry of all active geothermal generators by position key */
const geothermalGenerators = new Map<string, GeothermalGenerator>();

/** Registry of all active solar panels by position key */
const solarPanels = new Map<string, SolarPanel>();

/** Registry of all active wind mills by position key */
const windMills = new Map<string, WindMill>();

/** Registry of all active reactors by position key */
const reactors = new Map<string, ReactorSimulator>();

// ==========================================
// Helper Functions
// ==========================================

/**
 * Convert Vector3 to position key string
 */
function vectorToKey(pos: Vector3): string {
    return positionToKey(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
}

/**
 * Get cable type from block ID
 */
function getCableTypeFromBlockId(blockId: string): string | null {
    if (blockId === "ic2:tin_cable") return "tin";
    if (blockId === "ic2:copper_cable") return "copper";
    if (blockId === "ic2:gold_cable") return "gold";
    if (blockId === "ic2:iron_cable") return "iron_hv";
    if (blockId === "ic2:glass_fibre_cable") return "glass_fibre";
    return null;
}

/**
 * Check if block is a processing machine
 */
function isProcessingMachine(blockId: string): boolean {
    return blockId === "ic2:macerator" ||
           blockId === "ic2:electric_furnace" ||
           blockId === "ic2:compressor" ||
           blockId === "ic2:extractor" ||
           blockId === "ic2:recycler";
}

/**
 * Get machine type from block ID
 */
function getMachineType(blockId: string): MachineType | null {
    switch (blockId) {
        case "ic2:generator": return MachineType.GENERATOR;
        case "ic2:geothermal_generator": return MachineType.GEOTHERMAL;
        case "ic2:solar_panel": return MachineType.SOLAR_PANEL;
        case "ic2:wind_mill": return MachineType.WIND_MILL;
        case "ic2:macerator": return MachineType.MACERATOR;
        case "ic2:electric_furnace": return MachineType.ELECTRIC_FURNACE;
        case "ic2:compressor": return MachineType.COMPRESSOR;
        case "ic2:extractor": return MachineType.EXTRACTOR;
        case "ic2:recycler": return MachineType.RECYCLER;
        case "ic2:nuclear_reactor": return MachineType.NUCLEAR_REACTOR;
        default: return null;
    }
}

/**
 * Create an ItemStack for spawning items
 */
function createItemStack(typeId: string, amount: number): ItemStack {
    const item = new ItemStack(typeId, amount);
    return item;
}

/**
 * Get current time of day from world
 */
function getTimeOfDay(): number {
    try {
        // Use world.getAbsoluteTime() and calculate time of day
        const absoluteTime = world.getAbsoluteTime();
        return absoluteTime % 24000;
    } catch {
        return 6000; // Default to noon
    }
}

/**
 * Check if it's raining in the overworld
 */
function isRaining(): boolean {
    try {
        const overworld = world.getDimension("overworld");
        // Check weather by trying to get weather state
        // Simplified: assume not raining by default
        return false;
    } catch {
        return false;
    }
}


// ==========================================
// Task 44.1: Block Placement Handler
// Register machines/cables, initialize state
// ==========================================

/**
 * Handle placement of IC2 blocks
 * Registers machines and cables with appropriate managers
 */
function handleBlockPlacement(block: Block): void {
    const blockId = block.typeId;
    const position = block.location;
    const posKey = vectorToKey(position);

    // Handle cable placement
    const cableType = getCableTypeFromBlockId(blockId);
    if (cableType) {
        energyNetwork.registerCable(position, cableType);
        cableGraph.addCable(position, cableType);
        return;
    }

    const machine = machineManager.createMachine(blockId, position);
    if (machine) {
        return;
    }

    if (blockId === "ic2:geothermal_generator") {
        const geothermal = new GeothermalGenerator(position);
        geothermalGenerators.set(posKey, geothermal);
        return;
    }

    if (blockId === "ic2:solar_panel") {
        const solar = new SolarPanel(position);
        solarPanels.set(posKey, solar);
        return;
    }

    if (blockId === "ic2:wind_mill") {
        const windmill = new WindMill(position);
        windMills.set(posKey, windmill);
        return;
    }

    // Handle nuclear reactor placement
    if (blockId === "ic2:nuclear_reactor") {
        const reactor = new ReactorSimulator(position);
        reactors.set(posKey, reactor);
        return;
    }

    // Handle rubber wood placement
    if (blockId === "ic2:rubber_wood") {
        rubberTreeManager.registerRubberWood(
            Math.floor(position.x),
            Math.floor(position.y),
            Math.floor(position.z)
        );
        return;
    }
}

// ==========================================
// Task 44.2: Block Destruction Handler
// Unregister, clear persistence, drop items
// ==========================================

/**
 * Handle destruction of IC2 blocks
 * Unregisters machines and cables, clears persistence
 */
function handleBlockDestruction(blockId: string, position: Vector3, dimension: Dimension): void {
    const posKey = vectorToKey(position);

    // Handle cable destruction
    const cableType = getCableTypeFromBlockId(blockId);
    if (cableType) {
        energyNetwork.unregisterCable(position);
        cableGraph.removeCable(position);
        return;
    }

    const machine = machineManager.getMachine(posKey);
    if (machine) {
        machineManager.destroyMachine(posKey);
        return;
    }

    if (blockId === "ic2:geothermal_generator") {
        const geothermal = geothermalGenerators.get(posKey);
        if (geothermal) {
            geothermal.destroy();
            geothermalGenerators.delete(posKey);
            persistenceManager.clearMachineState(posKey);
        }
        return;
    }

    if (blockId === "ic2:solar_panel") {
        const solar = solarPanels.get(posKey);
        if (solar) {
            solar.destroy();
            solarPanels.delete(posKey);
        }
        return;
    }

    if (blockId === "ic2:wind_mill") {
        const windmill = windMills.get(posKey);
        if (windmill) {
            windmill.destroy();
            windMills.delete(posKey);
            persistenceManager.clearMachineState(posKey);
        }
        return;
    }

    // Handle nuclear reactor destruction
    if (blockId === "ic2:nuclear_reactor") {
        const reactor = reactors.get(posKey);
        if (reactor) {
            reactor.destroy();
            reactors.delete(posKey);
            persistenceManager.clearMachineState(posKey);
        }
        return;
    }

    // Handle rubber wood destruction
    if (blockId === "ic2:rubber_wood") {
        const breakResult = rubberTreeManager.handleBreak(
            Math.floor(position.x),
            Math.floor(position.y),
            Math.floor(position.z)
        );
        
        // Drop sticky resin if applicable
        if (breakResult && breakResult.droppedResin) {
            try {
                const item = createItemStack("ic2:sticky_resin", breakResult.resinCount);
                dimension.spawnItem(item, position);
            } catch {
                // Failed to spawn item
            }
        }
        return;
    }
}


// ==========================================
// Task 44.3: Block Interaction Handler
// Open GUI, handle treetap
// ==========================================

/**
 * Handle interaction with IC2 blocks
 * Opens machine GUIs or handles tool interactions
 */
async function handleBlockInteraction(player: Player, block: Block, itemId?: string): Promise<void> {
    const blockId = block.typeId;
    const position = block.location;
    const posKey = vectorToKey(position);

    // Handle treetap on rubber wood
    if (blockId === "ic2:rubber_wood" && itemId === "ic2:treetap") {
        const result = rubberTreeManager.handleTreetap(
            Math.floor(position.x),
            Math.floor(position.y),
            Math.floor(position.z)
        );

        if (result && result.success) {
            try {
                const dimension = block.dimension;
                const item = createItemStack("ic2:sticky_resin", result.resinDropped);
                dimension.spawnItem(item, { x: position.x + 0.5, y: position.y + 0.5, z: position.z + 0.5 });
            } catch {
                // Failed to spawn item
            }
        }
        return;
    }

    // Handle machine GUI interactions
    const machineType = getMachineType(blockId);
    if (!machineType) return;

    // Build GUI state based on machine type
    let guiState: MachineGUIState | null = null;

    // Generator GUI
    if (blockId === "ic2:generator") {
        const machine = machineManager.getMachine(posKey);
        if (machine instanceof Generator) {
            const state = machine.getState();
            guiState = {
                machineType: MachineType.GENERATOR,
                energyStored: state.energyStored,
                maxEnergy: machine.getConfig().maxBuffer,
                progress: machine.getBurnProgress(),
                isProcessing: state.isActive,
                additionalInfo: {
                    "Burn Time": state.burnTimeRemaining > 0 ? `${Math.ceil(state.burnTimeRemaining / 20)}s` : "None"
                }
            };
        }
    }

    // Geothermal Generator GUI
    if (blockId === "ic2:geothermal_generator") {
        const geothermal = geothermalGenerators.get(posKey);
        if (geothermal) {
            const state = geothermal.getState();
            guiState = {
                machineType: MachineType.GEOTHERMAL,
                energyStored: state.energyStored,
                maxEnergy: geothermal.getConfig().maxBuffer,
                progress: geothermal.getLavaProgress(),
                isProcessing: state.isActive,
                additionalInfo: {
                    "Lava Energy": `${state.lavaEnergyRemaining} EU`
                }
            };
        }
    }

    // Solar Panel GUI
    if (blockId === "ic2:solar_panel") {
        const solar = solarPanels.get(posKey);
        if (solar) {
            const timeOfDayValue = getTimeOfDay();
            const conditions: SolarConditions = {
                timeOfDay: timeOfDayValue,
                isRaining: isRaining(),
                hasSkyAccess: true
            };
            const isProducing = solar.isProducing(conditions);
            guiState = {
                machineType: MachineType.SOLAR_PANEL,
                energyStored: 0,
                maxEnergy: 0,
                progress: 0,
                isProcessing: isProducing,
                additionalInfo: {
                    "Status": isProducing ? "Producing 1 EU/t" : "Inactive",
                    "Time": `${timeOfDayValue} ticks`
                }
            };
        }
    }

    // Wind Mill GUI
    if (blockId === "ic2:wind_mill") {
        const windmill = windMills.get(posKey);
        if (windmill) {
            const state = windmill.getState();
            const output = windmill.calculateCurrentOutput();
            guiState = {
                machineType: MachineType.WIND_MILL,
                energyStored: 0,
                maxEnergy: 0,
                progress: 0,
                isProcessing: output > 0,
                additionalInfo: {
                    "Wind Strength": state.windStrength.toString(),
                    "Output": `${output.toFixed(2)} EU/t`,
                    "Height": `Y=${Math.floor(position.y)}`,
                    "Status": state.isBroken ? "§cBROKEN" : "§aOperational"
                }
            };
        }
    }

    // Processing Machine GUIs
    if (isProcessingMachine(blockId)) {
        const machine = machineManager.getMachine(posKey);
        if (machine instanceof BaseMachine) {
            const state = machine.getState();
            guiState = {
                machineType: machineType,
                energyStored: state.energyStored,
                maxEnergy: machine.getConfig().maxEnergy,
                progress: machine.getProgress(),
                isProcessing: state.isProcessing,
                inputItem: state.hasInput ? "Item" : undefined,
                inputCount: state.hasInput ? 1 : undefined,
                outputItem: undefined,
                outputCount: undefined
            };
        }
    }

    // Nuclear Reactor GUI
    if (blockId === "ic2:nuclear_reactor") {
        const reactor = reactors.get(posKey);
        if (reactor) {
            const state = reactor.getState();
            const reactorGUIState: ReactorGUIState = {
                reactorState: state,
                euPerTick: state.euProducedThisTick,
                heatPerTick: state.heatProducedThisTick
            };
            
            await guiManager.showReactorGUI(player, reactorGUIState);
            return;
        }
    }

    // Show machine GUI if state was built
    if (guiState) {
        await guiManager.showMachineGUI(player, guiState);
    }
}


// ==========================================
// Task 44.4: Player Hurt Handler
// Armor damage absorption
// ==========================================

/**
 * Get or create armor state for player
 */
function getPlayerArmorState(playerId: string): { nanosuit?: NanoSuit; quantumsuit?: QuantumSuit } {
    let state = playerArmorStates.get(playerId);
    if (!state) {
        state = {};
        playerArmorStates.set(playerId, state);
    }
    return state;
}

/**
 * Handle player damage with IC2 armor
 * Implements NanoSuit and QuantumSuit damage absorption
 * Requirements 17.2, 17.3, 18.6, 18.8
 */
function handlePlayerHurt(event: EntityHurtAfterEvent): void {
    const entity = event.hurtEntity;
    
    // Only handle player damage
    if (entity.typeId !== "minecraft:player") return;
    
    const player = entity as Player;
    const damage = event.damage;
    const damageSource = event.damageSource;
    
    // Check for /kill command (bypasses all protection)
    const isKillCommand = damageSource.cause === "override";
    if (isKillCommand) return;
    
    const playerId = player.id;
    const armorState = getPlayerArmorState(playerId);
    
    // Check for fall damage with Quantum Boots
    const isFallDamage = damageSource.cause === "fall";
    
    try {
        const equipment = player.getComponent("minecraft:equippable");
        if (!equipment) return;
        
        const chestplate = equipment.getEquipment(EquipmentSlot.Chest);
        const boots = equipment.getEquipment(EquipmentSlot.Feet);
        
        // Handle Quantum Chestplate - 100% damage absorption (except /kill)
        // Requirements 18.6
        if (chestplate?.typeId === "ic2:quantumsuit_chestplate") {
            if (!armorState.quantumsuit) {
                armorState.quantumsuit = new QuantumSuit();
            }
            
            const result = armorState.quantumsuit.handleDamage(damage, isKillCommand);
            
            if (result.hadEnoughEnergy && result.absorbed > 0) {
                // Heal player for absorbed damage
                try {
                    const health = player.getComponent("minecraft:health");
                    if (health) {
                        const currentHealth = health.currentValue;
                        const maxHealth = health.effectiveMax;
                        const newHealth = Math.min(maxHealth, currentHealth + result.absorbed);
                        health.setCurrentValue(newHealth);
                    }
                } catch {
                    // Failed to heal
                }
                return;
            }
        }
        
        // Handle Quantum Boots - fall damage negation
        // Requirements 18.8
        if (isFallDamage && boots?.typeId === "ic2:quantumsuit_boots") {
            if (!armorState.quantumsuit) {
                armorState.quantumsuit = new QuantumSuit();
            }
            
            const bootsResult = armorState.quantumsuit.getBoots().processEffects(damage, false);
            
            if (bootsResult.hadEnoughEnergy && bootsResult.fallDamageNegated > 0) {
                try {
                    const health = player.getComponent("minecraft:health");
                    if (health) {
                        const currentHealth = health.currentValue;
                        const maxHealth = health.effectiveMax;
                        const newHealth = Math.min(maxHealth, currentHealth + bootsResult.fallDamageNegated);
                        health.setCurrentValue(newHealth);
                    }
                } catch {
                    // Failed to heal
                }
                return;
            }
        }
        
        // Handle NanoSuit damage absorption
        // Requirements 17.2, 17.3
        const helmet = equipment.getEquipment(EquipmentSlot.Head);
        const leggings = equipment.getEquipment(EquipmentSlot.Legs);
        
        const hasNanoArmor = 
            helmet?.typeId?.startsWith("ic2:nanosuit_") ||
            chestplate?.typeId?.startsWith("ic2:nanosuit_") ||
            leggings?.typeId?.startsWith("ic2:nanosuit_") ||
            boots?.typeId?.startsWith("ic2:nanosuit_");
        
        if (hasNanoArmor) {
            if (!armorState.nanosuit) {
                armorState.nanosuit = new NanoSuit();
            }
            
            const result = armorState.nanosuit.handleDamage(damage);
            
            if (result.hadEnoughEnergy && result.absorbed > 0) {
                try {
                    const health = player.getComponent("minecraft:health");
                    if (health) {
                        const currentHealth = health.currentValue;
                        const maxHealth = health.effectiveMax;
                        const newHealth = Math.min(maxHealth, currentHealth + result.absorbed);
                        health.setCurrentValue(newHealth);
                    }
                } catch {
                    // Failed to heal
                }
            }
        }
    } catch {
        // Error handling player hurt
    }
}


// ==========================================
// Task 44.5: Main Tick Loop
// Process generators, machines, reactor, wind updates
// ==========================================

/** Tick counter for periodic operations */
let tickCounter = 0;

/** Last time persistence was saved */
let lastSaveTime = 0;

/** Save interval in ticks (every 6000 ticks = 5 minutes) */
const SAVE_INTERVAL = 6000;

/**
 * Get solar conditions
 */
function getSolarConditions(): SolarConditions {
    return {
        timeOfDay: getTimeOfDay(),
        isRaining: isRaining(),
        hasSkyAccess: true
    };
}

/**
 * Get wind conditions for a position
 */
function getWindConditions(): WindConditions {
    return {
        windStrength: 15,
        isAreaBlocked: false
    };
}

/**
 * Process armor effects for all players
 * Applies NanoSuit and QuantumSuit passive effects
 */
function processArmorEffects(): void {
    const players = world.getAllPlayers();
    
    for (const player of players) {
        try {
            const equipment = player.getComponent("minecraft:equippable");
            if (!equipment) continue;
            
            const playerId = player.id;
            const armorState = getPlayerArmorState(playerId);
            
            const helmet = equipment.getEquipment(EquipmentSlot.Head);
            const chestplate = equipment.getEquipment(EquipmentSlot.Chest);
            const leggings = equipment.getEquipment(EquipmentSlot.Legs);
            const boots = equipment.getEquipment(EquipmentSlot.Feet);
            
            // QuantumSuit Helmet effects - water breathing, auto-feed, cure effects
            if (helmet?.typeId === "ic2:quantumsuit_helmet" || helmet?.typeId === "ic2:quantum_helmet") {
                if (!armorState.quantumsuit) {
                    armorState.quantumsuit = new QuantumSuit();
                }
                
                // Check player conditions
                const health = player.getComponent("minecraft:health");
                const isUnderwater = player.isInWater;
                
                // Get hunger level (simplified - Bedrock doesn't expose hunger directly)
                let currentHunger = 20;
                
                // Check for poison/wither effects
                let hasPoison = false;
                let hasWither = false;
                try {
                    hasPoison = player.getEffect("poison") !== undefined;
                    hasWither = player.getEffect("wither") !== undefined;
                } catch {
                    // Effects not available
                }
                
                const helmetResult = armorState.quantumsuit.getHelmet().processEffects(
                    currentHunger,
                    hasPoison,
                    hasWither,
                    isUnderwater
                );
                
                // Apply water breathing effect
                if (isUnderwater && helmetResult.waterBreathing) {
                    try {
                        player.addEffect("water_breathing", 40, { amplifier: 0, showParticles: false });
                    } catch {
                        // Failed to add effect
                    }
                }
                
                // Cure effects
                if (helmetResult.effectsCured.includes('poison')) {
                    try {
                        player.removeEffect("poison");
                    } catch {
                        // Failed to remove effect
                    }
                }
                if (helmetResult.effectsCured.includes('wither')) {
                    try {
                        player.removeEffect("wither");
                    } catch {
                        // Failed to remove effect
                    }
                }
            }
            
            // QuantumSuit Leggings - sprint speed boost
            if (leggings?.typeId === "ic2:quantumsuit_leggings" || leggings?.typeId === "ic2:quantum_leggings") {
                if (!armorState.quantumsuit) {
                    armorState.quantumsuit = new QuantumSuit();
                }
                
                const isSprinting = player.isSprinting;
                if (isSprinting) {
                    const sprintResult = armorState.quantumsuit.getLeggings().processSprint(true, 1);
                    if (sprintResult.hadEnoughEnergy) {
                        try {
                            player.addEffect("speed", 5, { amplifier: 3, showParticles: false });
                        } catch {
                            // Failed to add effect
                        }
                    }
                }
            }
            
            // QuantumSuit Boots - jump boost
            if (boots?.typeId === "ic2:quantumsuit_boots" || boots?.typeId === "ic2:quantum_boots") {
                if (!armorState.quantumsuit) {
                    armorState.quantumsuit = new QuantumSuit();
                }
                
                // Apply jump boost effect
                if (armorState.quantumsuit.getBoots().hasEnergy()) {
                    try {
                        player.addEffect("jump_boost", 5, { amplifier: 4, showParticles: false });
                    } catch {
                        // Failed to add effect
                    }
                }
            }
            
            // QuantumSuit Chestplate - flight (simplified - use levitation as substitute)
            if (chestplate?.typeId === "ic2:quantumsuit_chestplate" || chestplate?.typeId === "ic2:quantum_chestplate") {
                if (!armorState.quantumsuit) {
                    armorState.quantumsuit = new QuantumSuit();
                }
                
                // Check if player is trying to fly (jumping while in air)
                const isJumping = player.isJumping;
                const isOnGround = player.isOnGround;
                
                if (isJumping && !isOnGround) {
                    const flightResult = armorState.quantumsuit.getChestplate().processFlightTick(1);
                    if (flightResult.canFly) {
                        try {
                            player.addEffect("slow_falling", 5, { amplifier: 0, showParticles: false });
                            // Give slight upward boost
                            const velocity = player.getVelocity();
                            if (velocity.y < 0.5) {
                                player.applyKnockback(0, 0, 0, 0.3);
                            }
                        } catch {
                            // Failed to apply flight
                        }
                    }
                }
            }
            
            // NanoSuit night vision (helmet)
            if (helmet?.typeId === "ic2:nanosuit_helmet" || helmet?.typeId === "ic2:nano_helmet") {
                if (!armorState.nanosuit) {
                    armorState.nanosuit = new NanoSuit();
                }
                
                // Apply night vision if has energy
                const helmetPiece = armorState.nanosuit.getPiece(ArmorSlot.HELMET);
                if (helmetPiece && helmetPiece.hasEnergy()) {
                    try {
                        player.addEffect("night_vision", 220, { amplifier: 0, showParticles: false });
                    } catch {
                        // Failed to add effect
                    }
                }
            }
            
        } catch {
            // Error processing armor for player
        }
    }
}

/**
 * Main tick loop - processes all IC2 machines
 */
function processTick(): void {
    tickCounter++;
    
    // Process armor effects every 20 ticks (1 second)
    if (tickCounter % 20 === 0) {
        processArmorEffects();
    }
    
    // Process geothermal generators
    for (const [, geothermal] of geothermalGenerators) {
        try {
            geothermal.tick();
        } catch {
            // Error ticking geothermal
        }
    }
    
    // Process solar panels
    const solarConditions = getSolarConditions();
    for (const [, solar] of solarPanels) {
        try {
            solar.tick(solarConditions);
        } catch {
            // Error ticking solar panel
        }
    }
    
    // Process wind mills
    const windConditions = getWindConditions();
    for (const [posKey, windmill] of windMills) {
        try {
            const result = windmill.tick(windConditions);
            
            // Handle wind mill breaking
            if (result.broke) {
                windMills.delete(posKey);
            }
        } catch {
            // Error ticking wind mill
        }
    }
    
    machineManager.tick();
    energyNetwork.distributeEnergy();

    // Process nuclear reactors
    for (const [, reactor] of reactors) {
        try {
            reactor.tick();
        } catch {
            // Error ticking reactor
        }
    }

    // Nuclear reactor blocks are already processed via the reactors Map above
    // No need for world.getAllBlocks() which doesn't exist in Bedrock API
    
    // Process rubber tree random ticks (every 100 ticks)
    if (tickCounter % 100 === 0) {
        const allStates = rubberTreeManager.getAllStates();
        for (const [posKey, state] of allStates) {
            if (state.resinSpot === ResinSpotState.DRY) {
                if (Math.random() < 0.01) {
                    const [x, y, z] = posKey.split(',').map(Number);
                    rubberTreeManager.handleRandomTick(x, y, z);
                }
            }
        }
    }
    
    // Periodic persistence save
    if (tickCounter - lastSaveTime >= SAVE_INTERVAL) {
        saveMachineStates();
        lastSaveTime = tickCounter;
    }
}

/**
 * Save all machine states to persistence
 */
function saveMachineStates(): void {
    for (const [posKey, machine] of machineManager.entries()) {
        if (machine instanceof Generator) {
            const state = machine.getState();
            persistenceManager.saveMachineState({
                energyStored: state.energyStored,
                progress: state.burnTimeRemaining,
                machineType: "generator",
                positionKey: posKey
            });
            continue;
        }

        if (machine instanceof BaseMachine) {
            const state = machine.getState();
            persistenceManager.saveMachineState({
                energyStored: state.energyStored,
                progress: state.progress,
                machineType: "processing_machine",
                positionKey: posKey
            });
            continue;
        }

        if (machine instanceof BatBox) {
            const state = machine.getState();
            persistenceManager.saveMachineState({
                energyStored: state.energyStored,
                progress: 0,
                machineType: "batbox",
                positionKey: posKey
            });
        }
    }

    // Save geothermal states
    for (const [posKey, geothermal] of geothermalGenerators) {
        const state = geothermal.getState();
        persistenceManager.saveMachineState({
            energyStored: state.energyStored,
            progress: state.lavaEnergyRemaining,
            machineType: "geothermal_generator",
            positionKey: posKey
        });
    }
    
    // Save wind mill states
    for (const [posKey, windmill] of windMills) {
        const state = windmill.getState();
        persistenceManager.saveMachineState({
            energyStored: state.windStrength,
            progress: state.ticksUntilWindChange,
            machineType: "wind_mill",
            positionKey: posKey
        });
    }
    
    // Save reactor states
    for (const [posKey, reactor] of reactors) {
        const state = reactor.getState();
        persistenceManager.saveMachineState({
            energyStored: state.hullHeat,
            progress: state.euProducedThisTick,
            machineType: "nuclear_reactor",
            positionKey: posKey
        });
    }
    
    persistenceManager.markSaved();
}

/**
 * Load machine states from persistence
 */
function loadMachineStates(): void {
    // States would be loaded from world dynamic properties
    // For now, machines start fresh on world load
}


// ==========================================
// Event Subscriptions
// ==========================================

// Initialize the mod when world loads
world.afterEvents.worldInitialize.subscribe(() => {
    loadMachineStates();
});

// Task 44.1: Handle block placement for machines and cables
world.afterEvents.playerPlaceBlock.subscribe((event: PlayerPlaceBlockAfterEvent) => {
    const block = event.block;
    const blockId = block.typeId;
    
    if (blockId.startsWith("ic2:")) {
        handleBlockPlacement(block);
    }
});

// Task 44.2: Handle block destruction for cleanup
world.afterEvents.playerBreakBlock.subscribe((event: PlayerBreakBlockAfterEvent) => {
    const blockId = event.brokenBlockPermutation.type.id;
    const position = event.block.location;
    const dimension = event.block.dimension;
    
    if (blockId.startsWith("ic2:")) {
        handleBlockDestruction(blockId, position, dimension);
    }
});

// Task 44.3: Handle block interaction (GUI, treetap, etc.)
world.afterEvents.playerInteractWithBlock.subscribe((event: PlayerInteractWithBlockAfterEvent) => {
    const block = event.block;
    const blockId = block.typeId;
    const player = event.player;
    
    if (blockId.startsWith("ic2:")) {
        const equipment = player.getComponent("minecraft:equippable");
        const mainHand = equipment?.getEquipment(EquipmentSlot.Mainhand);
        const itemId = mainHand?.typeId;
        
        handleBlockInteraction(player, block, itemId).catch(() => {
            // Error handling block interaction
        });
    }
});

// Task 44.4: Handle player hurt for armor damage absorption
world.afterEvents.entityHurt.subscribe((event: EntityHurtAfterEvent) => {
    handlePlayerHurt(event);
});

// Task 44.5: Main tick loop - runs every tick
system.runInterval(() => {
    processTick();
}, 1);

// Save states when last player leaves
world.beforeEvents.playerLeave.subscribe((event: PlayerLeaveBeforeEvent) => {
    const players = world.getAllPlayers();
    if (players.length <= 1) {
        saveMachineStates();
    }
});

// Armor charging when using RE-Battery on armor
// Use RE-Battery while sneaking to charge worn IC2 armor
world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;
    
    if (!item || item.typeId !== "ic2:re_battery") return;
    if (!player.isSneaking) return;
    
    try {
        const playerId = player.id;
        const armorState = getPlayerArmorState(playerId);
        
        const equipment = player.getComponent("minecraft:equippable");
        if (!equipment) return;
        
        const helmet = equipment.getEquipment(EquipmentSlot.Head);
        const chestplate = equipment.getEquipment(EquipmentSlot.Chest);
        const leggings = equipment.getEquipment(EquipmentSlot.Legs);
        const boots = equipment.getEquipment(EquipmentSlot.Feet);
        
        let charged = false;
        const chargeAmount = 100_000; // 100k EU per use
        
        // Check for QuantumSuit pieces
        const hasQuantum = 
            helmet?.typeId?.includes("quantum") ||
            chestplate?.typeId?.includes("quantum") ||
            leggings?.typeId?.includes("quantum") ||
            boots?.typeId?.includes("quantum");
        
        // Check for NanoSuit pieces
        const hasNano = 
            helmet?.typeId?.includes("nano") ||
            chestplate?.typeId?.includes("nano") ||
            leggings?.typeId?.includes("nano") ||
            boots?.typeId?.includes("nano");
        
        if (hasQuantum) {
            if (!armorState.quantumsuit) {
                armorState.quantumsuit = new QuantumSuit();
            }
            for (const piece of armorState.quantumsuit.getAllPieces()) {
                const added = piece.charge(chargeAmount);
                if (added > 0) charged = true;
            }
        }
        
        if (hasNano) {
            if (!armorState.nanosuit) {
                armorState.nanosuit = new NanoSuit();
            }
            for (const piece of armorState.nanosuit.getAllPieces()) {
                const added = piece.charge(chargeAmount);
                if (added > 0) charged = true;
            }
        }
        
        if (charged) {
            player.sendMessage("§a[IC2] Броня заряжена (+100,000 EU)");
            
            // Show current energy
            let totalEnergy = 0;
            if (armorState.quantumsuit) totalEnergy += armorState.quantumsuit.getTotalEnergy();
            if (armorState.nanosuit) totalEnergy += armorState.nanosuit.getTotalEnergy();
            player.sendMessage(`§7Общая энергия: ${totalEnergy.toLocaleString()} EU`);
        } else if (hasQuantum || hasNano) {
            player.sendMessage("§e[IC2] Броня уже полностью заряжена");
        }
    } catch {
        // Error charging armor
    }
});

// Auto-charge armor when wearing it (initialize with some energy for testing)
world.afterEvents.playerSpawn.subscribe((event) => {
    const player = event.player;
    
    system.runTimeout(() => {
        try {
            const playerId = player.id;
            const armorState = getPlayerArmorState(playerId);
            
            // Initialize with full charge for testing
            if (!armorState.nanosuit) {
                armorState.nanosuit = new NanoSuit();
                for (const piece of armorState.nanosuit.getAllPieces()) {
                    piece.charge(1_000_000);
                }
            }
            if (!armorState.quantumsuit) {
                armorState.quantumsuit = new QuantumSuit();
                for (const piece of armorState.quantumsuit.getAllPieces()) {
                    piece.charge(10_000_000);
                }
            }
        } catch {
            // Error initializing armor
        }
    }, 20);
});

// Export registries and handlers for external access
export {
    geothermalGenerators,
    solarPanels,
    windMills,
    machineManager,
    reactors,
    handleBlockPlacement,
    handleBlockDestruction,
    handleBlockInteraction,
    handlePlayerHurt,
    processTick,
    saveMachineStates,
    loadMachineStates
};
