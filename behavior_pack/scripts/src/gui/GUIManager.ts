import { Player } from "@minecraft/server";
import { ActionFormData, ActionFormResponse, ModalFormData, ModalFormResponse } from "@minecraft/server-ui";
import { 
    ReactorState, 
    ReactorComponent, 
    ReactorComponentType, 
    REACTOR_ROWS, 
    REACTOR_COLS, 
    REACTOR_SLOTS,
    REACTOR_THRESHOLDS,
    slotToCoords
} from "../machines/reactor/ReactorSimulator";

// Declare console for Minecraft Bedrock Scripting API
declare const console: { log: (...args: unknown[]) => void; error: (...args: unknown[]) => void; warn: (...args: unknown[]) => void };

/**
 * Machine types supported by the GUI system
 */
export enum MachineType {
    GENERATOR = "generator",
    GEOTHERMAL = "geothermal_generator",
    SOLAR_PANEL = "solar_panel",
    WIND_MILL = "wind_mill",
    MACERATOR = "macerator",
    ELECTRIC_FURNACE = "electric_furnace",
    COMPRESSOR = "compressor",
    EXTRACTOR = "extractor",
    RECYCLER = "recycler",
    NUCLEAR_REACTOR = "nuclear_reactor"
}

/**
 * Machine state for GUI display
 */
export interface MachineGUIState {
    /** Machine type identifier */
    machineType: MachineType;
    /** Current energy stored in EU */
    energyStored: number;
    /** Maximum energy capacity in EU */
    maxEnergy: number;
    /** Current operation progress (0-1) */
    progress: number;
    /** Whether machine is currently processing */
    isProcessing: boolean;
    /** Input slot item (if any) */
    inputItem?: string;
    /** Input slot count */
    inputCount?: number;
    /** Output slot item (if any) */
    outputItem?: string;
    /** Output slot count */
    outputCount?: number;
    /** Additional info for specific machines */
    additionalInfo?: Record<string, string | number>;
}

/**
 * Slot interaction result
 */
export interface SlotInteractionResult {
    /** Type of interaction */
    action: "insert" | "extract" | "cancel";
    /** Slot type */
    slot: "input" | "output";
    /** Item identifier (for insert) */
    itemId?: string;
    /** Item count */
    count?: number;
}

/**
 * Energy bar display configuration
 */
export interface EnergyBarConfig {
    /** Number of segments in the bar */
    segments: number;
    /** Character for filled segment */
    filledChar: string;
    /** Character for empty segment */
    emptyChar: string;
}

/**
 * Progress bar display configuration
 */
export interface ProgressBarConfig {
    /** Number of segments in the bar */
    segments: number;
    /** Character for completed segment */
    completedChar: string;
    /** Character for remaining segment */
    remainingChar: string;
}

const DEFAULT_ENERGY_BAR: EnergyBarConfig = {
    segments: 20,
    filledChar: "█",
    emptyChar: "░"
};

const DEFAULT_PROGRESS_BAR: ProgressBarConfig = {
    segments: 10,
    completedChar: "▶",
    remainingChar: "▷"
};


/**
 * GUIManager - Handles machine GUI interactions using ActionFormData
 * Task 38.1: Create GUIManager class with ActionFormData for machine interaction
 */
export class GUIManager {
    private energyBarConfig: EnergyBarConfig;
    private progressBarConfig: ProgressBarConfig;

    constructor(
        energyBarConfig: EnergyBarConfig = DEFAULT_ENERGY_BAR,
        progressBarConfig: ProgressBarConfig = DEFAULT_PROGRESS_BAR
    ) {
        this.energyBarConfig = energyBarConfig;
        this.progressBarConfig = progressBarConfig;
    }

    /**
     * Task 38.2: Create energy bar display
     * Generates a visual energy bar string
     * @param current Current energy stored
     * @param max Maximum energy capacity
     * @returns Formatted energy bar string
     */
    createEnergyBar(current: number, max: number): string {
        if (max <= 0) return this.createEmptyBar(this.energyBarConfig.segments, this.energyBarConfig.emptyChar);
        
        const ratio = Math.max(0, Math.min(1, current / max));
        const filledSegments = Math.round(ratio * this.energyBarConfig.segments);
        const emptySegments = this.energyBarConfig.segments - filledSegments;
        
        const filled = this.energyBarConfig.filledChar.repeat(filledSegments);
        const empty = this.energyBarConfig.emptyChar.repeat(emptySegments);
        
        return `[${filled}${empty}]`;
    }

    /**
     * Task 38.3: Create progress bar display
     * Generates a visual progress bar string
     * @param progress Progress value (0-1)
     * @returns Formatted progress bar string
     */
    createProgressBar(progress: number): string {
        const ratio = Math.max(0, Math.min(1, progress));
        const completedSegments = Math.round(ratio * this.progressBarConfig.segments);
        const remainingSegments = this.progressBarConfig.segments - completedSegments;
        
        const completed = this.progressBarConfig.completedChar.repeat(completedSegments);
        const remaining = this.progressBarConfig.remainingChar.repeat(remainingSegments);
        
        return `[${completed}${remaining}]`;
    }

    /**
     * Create an empty bar with specified character
     */
    private createEmptyBar(segments: number, char: string): string {
        return `[${char.repeat(segments)}]`;
    }

    /**
     * Format energy value for display (e.g., 1000 -> "1.0k EU")
     */
    formatEnergy(eu: number): string {
        if (eu >= 1_000_000) {
            return `${(eu / 1_000_000).toFixed(1)}M EU`;
        } else if (eu >= 1_000) {
            return `${(eu / 1_000).toFixed(1)}k EU`;
        }
        return `${Math.floor(eu)} EU`;
    }

    /**
     * Format progress as percentage
     */
    formatProgress(progress: number): string {
        return `${Math.round(progress * 100)}%`;
    }

    /**
     * Get machine display name from type
     */
    getMachineDisplayName(machineType: MachineType): string {
        const names: Record<MachineType, string> = {
            [MachineType.GENERATOR]: "Generator",
            [MachineType.GEOTHERMAL]: "Geothermal Generator",
            [MachineType.SOLAR_PANEL]: "Solar Panel",
            [MachineType.WIND_MILL]: "Wind Mill",
            [MachineType.MACERATOR]: "Macerator",
            [MachineType.ELECTRIC_FURNACE]: "Electric Furnace",
            [MachineType.COMPRESSOR]: "Compressor",
            [MachineType.EXTRACTOR]: "Extractor",
            [MachineType.RECYCLER]: "Recycler",
            [MachineType.NUCLEAR_REACTOR]: "Nuclear Reactor"
        };
        return names[machineType] || "Unknown Machine";
    }

    /**
     * Build the machine GUI body text
     */
    buildMachineGUIBody(state: MachineGUIState): string {
        const lines: string[] = [];
        
        // Energy display
        lines.push("§6Energy:");
        lines.push(`${this.createEnergyBar(state.energyStored, state.maxEnergy)}`);
        lines.push(`${this.formatEnergy(state.energyStored)} / ${this.formatEnergy(state.maxEnergy)}`);
        lines.push("");
        
        // Progress display (for processing machines)
        if (state.machineType !== MachineType.SOLAR_PANEL && 
            state.machineType !== MachineType.WIND_MILL &&
            state.machineType !== MachineType.GENERATOR &&
            state.machineType !== MachineType.GEOTHERMAL) {
            lines.push("§eProgress:");
            lines.push(`${this.createProgressBar(state.progress)}`);
            lines.push(`${this.formatProgress(state.progress)} ${state.isProcessing ? "§a(Processing)" : "§7(Idle)"}`);
            lines.push("");
        }
        
        // Input slot
        if (state.inputItem !== undefined) {
            lines.push("§bInput:");
            lines.push(state.inputItem ? `${state.inputItem} x${state.inputCount || 0}` : "§7Empty");
            lines.push("");
        }
        
        // Output slot
        if (state.outputItem !== undefined) {
            lines.push("§aOutput:");
            lines.push(state.outputItem ? `${state.outputItem} x${state.outputCount || 0}` : "§7Empty");
            lines.push("");
        }
        
        // Additional info
        if (state.additionalInfo) {
            for (const [key, value] of Object.entries(state.additionalInfo)) {
                lines.push(`§d${key}: §f${value}`);
            }
        }
        
        return lines.join("\n");
    }


    /**
     * Task 38.4: Create slot interaction (input/output)
     * Show machine GUI with slot interaction options
     * @param player Player to show GUI to
     * @param state Current machine state
     * @returns Promise resolving to slot interaction result
     */
    async showMachineGUI(player: Player, state: MachineGUIState): Promise<SlotInteractionResult | null> {
        const title = this.getMachineDisplayName(state.machineType);
        const body = this.buildMachineGUIBody(state);
        
        const form = new ActionFormData()
            .title(title)
            .body(body);
        
        // Add slot interaction buttons based on machine type
        const buttons: Array<{ label: string; action: SlotInteractionResult }> = [];
        
        // Input slot button (for machines that accept input)
        if (this.machineHasInputSlot(state.machineType)) {
            if (state.inputItem) {
                buttons.push({
                    label: "§cExtract Input",
                    action: { action: "extract", slot: "input" }
                });
            } else {
                buttons.push({
                    label: "§aInsert Input",
                    action: { action: "insert", slot: "input" }
                });
            }
        }
        
        // Output slot button (for machines that produce output)
        if (this.machineHasOutputSlot(state.machineType)) {
            if (state.outputItem) {
                buttons.push({
                    label: "§aExtract Output",
                    action: { action: "extract", slot: "output" }
                });
            }
        }
        
        // Add close button
        buttons.push({
            label: "§7Close",
            action: { action: "cancel", slot: "input" }
        });
        
        // Add buttons to form
        for (const button of buttons) {
            form.button(button.label);
        }
        
        try {
            const response = await form.show(player) as ActionFormResponse;
            
            if (response.canceled || response.selection === undefined) {
                return null;
            }
            
            return buttons[response.selection]?.action || null;
        } catch (error) {
            console.error("[IC2 GUI] Error showing machine GUI:", error);
            return null;
        }
    }

    /**
     * Show item selection form for inserting items
     * @param player Player to show form to
     * @param availableItems List of valid items that can be inserted
     * @returns Selected item ID or null if canceled
     */
    async showItemSelectionForm(
        player: Player, 
        availableItems: Array<{ id: string; name: string; count: number }>
    ): Promise<{ itemId: string; count: number } | null> {
        if (availableItems.length === 0) {
            // Show message that no valid items are available
            const form = new ActionFormData()
                .title("No Valid Items")
                .body("You don't have any valid items to insert.")
                .button("OK");
            
            await form.show(player);
            return null;
        }
        
        const form = new ActionFormData()
            .title("Select Item")
            .body("Choose an item to insert:");
        
        for (const item of availableItems) {
            form.button(`${item.name} x${item.count}`);
        }
        form.button("§7Cancel");
        
        try {
            const response = await form.show(player) as ActionFormResponse;
            
            if (response.canceled || response.selection === undefined) {
                return null;
            }
            
            if (response.selection >= availableItems.length) {
                return null; // Cancel button
            }
            
            const selected = availableItems[response.selection];
            return { itemId: selected.id, count: selected.count };
        } catch (error) {
            console.error("[IC2 GUI] Error showing item selection:", error);
            return null;
        }
    }

    /**
     * Show quantity selection form
     * @param player Player to show form to
     * @param itemName Name of the item
     * @param maxCount Maximum count available
     * @returns Selected count or null if canceled
     */
    async showQuantityForm(
        player: Player,
        itemName: string,
        maxCount: number
    ): Promise<number | null> {
        const form = new ModalFormData()
            .title("Select Quantity")
            .slider(`${itemName} (max: ${maxCount})`, 1, maxCount, 1, Math.min(1, maxCount));
        
        try {
            const response = await form.show(player) as ModalFormResponse;
            
            if (response.canceled || !response.formValues) {
                return null;
            }
            
            return response.formValues[0] as number;
        } catch (error) {
            console.error("[IC2 GUI] Error showing quantity form:", error);
            return null;
        }
    }

    /**
     * Check if machine type has an input slot
     */
    private machineHasInputSlot(machineType: MachineType): boolean {
        const inputMachines = [
            MachineType.GENERATOR,
            MachineType.GEOTHERMAL,
            MachineType.MACERATOR,
            MachineType.ELECTRIC_FURNACE,
            MachineType.COMPRESSOR,
            MachineType.EXTRACTOR,
            MachineType.RECYCLER,
            MachineType.NUCLEAR_REACTOR
        ];
        return inputMachines.includes(machineType);
    }

    /**
     * Check if machine type has an output slot
     */
    private machineHasOutputSlot(machineType: MachineType): boolean {
        const outputMachines = [
            MachineType.MACERATOR,
            MachineType.ELECTRIC_FURNACE,
            MachineType.COMPRESSOR,
            MachineType.EXTRACTOR,
            MachineType.RECYCLER
        ];
        return outputMachines.includes(machineType);
    }

    // ==========================================
    // Task 39: Reactor GUI Implementation
    // ==========================================

    /**
     * Task 39.2: Create heat display
     * Generates a visual heat bar with color-coded segments based on thresholds
     * @param currentHeat Current hull heat
     * @param maxHeat Maximum hull heat (default 10000)
     * @returns Formatted heat bar string with colors
     */
    createHeatBar(currentHeat: number, maxHeat: number = REACTOR_THRESHOLDS.meltdown): string {
        if (maxHeat <= 0) return this.createEmptyBar(DEFAULT_HEAT_BAR.segments, "░");
        
        const ratio = Math.max(0, Math.min(1, currentHeat / maxHeat));
        const filledSegments = Math.round(ratio * DEFAULT_HEAT_BAR.segments);
        
        let bar = "[";
        for (let i = 0; i < DEFAULT_HEAT_BAR.segments; i++) {
            if (i < filledSegments) {
                // Determine color based on heat level at this segment
                const segmentHeat = (i / DEFAULT_HEAT_BAR.segments) * maxHeat;
                if (segmentHeat >= REACTOR_THRESHOLDS.radiation) {
                    bar += DEFAULT_HEAT_BAR.criticalChar;
                } else if (segmentHeat >= REACTOR_THRESHOLDS.evaporate) {
                    bar += DEFAULT_HEAT_BAR.dangerChar;
                } else if (segmentHeat >= REACTOR_THRESHOLDS.fire) {
                    bar += DEFAULT_HEAT_BAR.warningChar;
                } else {
                    bar += DEFAULT_HEAT_BAR.safeChar;
                }
            } else {
                bar += DEFAULT_HEAT_BAR.emptyChar;
            }
        }
        bar += "§r]";
        
        return bar;
    }

    /**
     * Get heat status text based on current heat level
     */
    getHeatStatusText(currentHeat: number): string {
        if (currentHeat >= REACTOR_THRESHOLDS.meltdown) {
            return "§4§lMELTDOWN!";
        } else if (currentHeat > REACTOR_THRESHOLDS.radiation) {
            return "§c§lRADIATION LEAK";
        } else if (currentHeat > REACTOR_THRESHOLDS.evaporate) {
            return "§6§lDANGER - Water Evaporating";
        } else if (currentHeat > REACTOR_THRESHOLDS.fire) {
            return "§e§lWARNING - Fire Risk";
        } else {
            return "§aStable";
        }
    }

    /**
     * Task 39.3: Create EU output display
     * Formats EU output per tick for reactor display
     * @param euPerTick EU produced per tick
     * @returns Formatted EU output string
     */
    createEUOutputDisplay(euPerTick: number): string {
        return `§6${euPerTick} EU/t`;
    }

    /**
     * Get component display character for grid
     */
    getComponentChar(component: ReactorComponent | null): string {
        if (!component) return "§7□";
        
        switch (component.type) {
            case ReactorComponentType.URANIUM_CELL:
                return "§a☢";
            case ReactorComponentType.HEAT_VENT:
                return "§b⌀";
            case ReactorComponentType.REACTOR_HEAT_VENT:
                return "§3⌀";
            case ReactorComponentType.OVERCLOCKED_HEAT_VENT:
                return "§c⌀";
            case ReactorComponentType.COMPONENT_HEAT_EXCHANGER:
                return "§d⇄";
            default:
                return "§7□";
        }
    }

    /**
     * Get component display name
     */
    getComponentName(type: ReactorComponentType): string {
        const names: Record<ReactorComponentType, string> = {
            [ReactorComponentType.EMPTY]: "Empty",
            [ReactorComponentType.URANIUM_CELL]: "Uranium Cell",
            [ReactorComponentType.HEAT_VENT]: "Heat Vent",
            [ReactorComponentType.REACTOR_HEAT_VENT]: "Reactor Heat Vent",
            [ReactorComponentType.OVERCLOCKED_HEAT_VENT]: "Overclocked Heat Vent",
            [ReactorComponentType.COMPONENT_HEAT_EXCHANGER]: "Component Heat Exchanger"
        };
        return names[type] || "Unknown";
    }

    /**
     * Task 39.1: Create 6×9 grid interface
     * Generates a visual representation of the reactor grid
     * @param slots Array of 54 reactor slots
     * @returns Formatted grid string
     */
    createReactorGrid(slots: (ReactorComponent | null)[]): string {
        const lines: string[] = [];
        
        // Header with column numbers
        let header = "  ";
        for (let col = 0; col < REACTOR_COLS; col++) {
            header += `${col + 1} `;
        }
        lines.push(header);
        
        // Grid rows
        for (let row = 0; row < REACTOR_ROWS; row++) {
            let rowStr = `${row + 1} `;
            for (let col = 0; col < REACTOR_COLS; col++) {
                const slotIndex = row * REACTOR_COLS + col;
                const component = slots[slotIndex];
                rowStr += this.getComponentChar(component) + " ";
            }
            lines.push(rowStr);
        }
        
        return lines.join("\n");
    }

    /**
     * Build the reactor GUI body text
     * Combines grid, heat display, and EU output
     */
    buildReactorGUIBody(state: ReactorGUIState): string {
        const lines: string[] = [];
        
        // Title section
        lines.push("§l§6=== Nuclear Reactor ===§r");
        lines.push("");
        
        // Task 39.3: EU Output Display
        lines.push("§eEU Output:");
        lines.push(this.createEUOutputDisplay(state.euPerTick));
        lines.push("");
        
        // Task 39.2: Heat Display
        lines.push("§cHull Heat:");
        lines.push(this.createHeatBar(state.reactorState.hullHeat));
        lines.push(`${state.reactorState.hullHeat} / ${REACTOR_THRESHOLDS.meltdown} hU`);
        lines.push(`Status: ${this.getHeatStatusText(state.reactorState.hullHeat)}`);
        lines.push("");
        
        // Heat production rate
        lines.push(`§cHeat Rate: §f${state.heatPerTick} hU/t`);
        lines.push("");
        
        // Task 39.1: 6×9 Grid Interface
        lines.push("§bReactor Grid (6×9):");
        lines.push(this.createReactorGrid(state.reactorState.slots));
        lines.push("");
        
        // Legend
        lines.push("§7Legend:");
        lines.push("§a☢§7=Uranium §b⌀§7=Vent §3⌀§7=R.Vent §c⌀§7=OC.Vent §d⇄§7=Exchanger");
        
        return lines.join("\n");
    }

    /**
     * Show reactor GUI with slot interaction options
     * @param player Player to show GUI to
     * @param state Current reactor GUI state
     * @returns Promise resolving to slot interaction result
     */
    async showReactorGUI(player: Player, state: ReactorGUIState): Promise<ReactorSlotInteractionResult | null> {
        const body = this.buildReactorGUIBody(state);
        
        const form = new ActionFormData()
            .title("Nuclear Reactor")
            .body(body);
        
        // Add interaction buttons
        form.button("§aInsert Component");
        form.button("§cExtract Component");
        form.button("§eView Slot Details");
        form.button("§7Close");
        
        try {
            const response = await form.show(player) as ActionFormResponse;
            
            if (response.canceled || response.selection === undefined) {
                return null;
            }
            
            switch (response.selection) {
                case 0: // Insert Component
                    return await this.showReactorSlotSelection(player, state, "insert");
                case 1: // Extract Component
                    return await this.showReactorSlotSelection(player, state, "extract");
                case 2: // View Slot Details
                    await this.showReactorSlotDetails(player, state);
                    return null;
                case 3: // Close
                default:
                    return { action: "cancel", slotIndex: -1 };
            }
        } catch (error) {
            console.error("[IC2 GUI] Error showing reactor GUI:", error);
            return null;
        }
    }

    /**
     * Show slot selection form for reactor
     * @param player Player to show form to
     * @param state Current reactor state
     * @param action Insert or extract action
     */
    async showReactorSlotSelection(
        player: Player, 
        state: ReactorGUIState,
        action: "insert" | "extract"
    ): Promise<ReactorSlotInteractionResult | null> {
        const form = new ModalFormData()
            .title(action === "insert" ? "Insert Component" : "Extract Component");
        
        // Row selection (1-6)
        form.slider("Row", 1, REACTOR_ROWS, 1, 1);
        // Column selection (1-9)
        form.slider("Column", 1, REACTOR_COLS, 1, 1);
        
        try {
            const response = await form.show(player) as ModalFormResponse;
            
            if (response.canceled || !response.formValues) {
                return null;
            }
            
            const row = (response.formValues[0] as number) - 1;
            const col = (response.formValues[1] as number) - 1;
            const slotIndex = row * REACTOR_COLS + col;
            
            if (action === "insert") {
                // Show component selection
                return await this.showComponentSelection(player, slotIndex, state);
            } else {
                // Extract - check if slot has component
                const component = state.reactorState.slots[slotIndex];
                if (!component) {
                    await this.showMessage(player, "Empty Slot", "This slot is empty.");
                    return null;
                }
                return { action: "extract", slotIndex };
            }
        } catch (error) {
            console.error("[IC2 GUI] Error showing slot selection:", error);
            return null;
        }
    }

    /**
     * Show component selection form for inserting into reactor
     */
    async showComponentSelection(
        player: Player,
        slotIndex: number,
        state: ReactorGUIState
    ): Promise<ReactorSlotInteractionResult | null> {
        // Check if slot is already occupied
        if (state.reactorState.slots[slotIndex]) {
            await this.showMessage(player, "Slot Occupied", "This slot already has a component. Extract it first.");
            return null;
        }
        
        const form = new ActionFormData()
            .title("Select Component")
            .body(`Insert component into slot ${slotIndex + 1}`);
        
        const componentTypes = [
            ReactorComponentType.URANIUM_CELL,
            ReactorComponentType.HEAT_VENT,
            ReactorComponentType.REACTOR_HEAT_VENT,
            ReactorComponentType.OVERCLOCKED_HEAT_VENT,
            ReactorComponentType.COMPONENT_HEAT_EXCHANGER
        ];
        
        for (const type of componentTypes) {
            form.button(this.getComponentName(type));
        }
        form.button("§7Cancel");
        
        try {
            const response = await form.show(player) as ActionFormResponse;
            
            if (response.canceled || response.selection === undefined) {
                return null;
            }
            
            if (response.selection >= componentTypes.length) {
                return null; // Cancel
            }
            
            return {
                action: "insert",
                slotIndex,
                componentType: componentTypes[response.selection]
            };
        } catch (error) {
            console.error("[IC2 GUI] Error showing component selection:", error);
            return null;
        }
    }

    /**
     * Show detailed information about reactor slots
     */
    async showReactorSlotDetails(player: Player, state: ReactorGUIState): Promise<void> {
        const lines: string[] = [];
        lines.push("§l§bSlot Details§r\n");
        
        let uraniumCount = 0;
        let ventCount = 0;
        let exchangerCount = 0;
        
        for (let i = 0; i < REACTOR_SLOTS; i++) {
            const component = state.reactorState.slots[i];
            if (component) {
                const { row, col } = slotToCoords(i);
                switch (component.type) {
                    case ReactorComponentType.URANIUM_CELL:
                        uraniumCount++;
                        break;
                    case ReactorComponentType.HEAT_VENT:
                    case ReactorComponentType.REACTOR_HEAT_VENT:
                    case ReactorComponentType.OVERCLOCKED_HEAT_VENT:
                        ventCount++;
                        break;
                    case ReactorComponentType.COMPONENT_HEAT_EXCHANGER:
                        exchangerCount++;
                        break;
                }
            }
        }
        
        lines.push(`§aUranium Cells: §f${uraniumCount}`);
        lines.push(`§bHeat Vents: §f${ventCount}`);
        lines.push(`§dHeat Exchangers: §f${exchangerCount}`);
        lines.push(`§7Empty Slots: §f${REACTOR_SLOTS - uraniumCount - ventCount - exchangerCount}`);
        
        const form = new ActionFormData()
            .title("Reactor Details")
            .body(lines.join("\n"))
            .button("OK");
        
        await form.show(player);
    }

    /**
     * Show a simple message dialog
     */
    async showMessage(player: Player, title: string, message: string): Promise<void> {
        const form = new ActionFormData()
            .title(title)
            .body(message)
            .button("OK");
        
        await form.show(player);
    }
}

/**
 * Reactor GUI state for display
 * Task 39: Create reactor GUI
 */
export interface ReactorGUIState {
    /** Reactor state from ReactorSimulator */
    reactorState: ReactorState;
    /** EU produced per tick */
    euPerTick: number;
    /** Heat produced per tick */
    heatPerTick: number;
}

/**
 * Reactor slot interaction result
 */
export interface ReactorSlotInteractionResult {
    /** Type of interaction */
    action: "insert" | "extract" | "cancel";
    /** Slot index (0-53) */
    slotIndex: number;
    /** Component type (for insert) */
    componentType?: ReactorComponentType;
}

/**
 * Heat bar display configuration
 */
export interface HeatBarConfig {
    /** Number of segments in the bar */
    segments: number;
    /** Character for safe heat level */
    safeChar: string;
    /** Character for warning heat level */
    warningChar: string;
    /** Character for danger heat level */
    dangerChar: string;
    /** Character for critical heat level */
    criticalChar: string;
    /** Character for empty segment */
    emptyChar: string;
}

const DEFAULT_HEAT_BAR: HeatBarConfig = {
    segments: 20,
    safeChar: "§a█",
    warningChar: "§e█",
    dangerChar: "§6█",
    criticalChar: "§c█",
    emptyChar: "§7░"
};

// Export singleton instance
export const guiManager = new GUIManager();
