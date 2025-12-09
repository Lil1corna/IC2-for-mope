import { describe, it, expect, beforeEach } from 'vitest';
import { 
    GUIManager, 
    MachineType, 
    MachineGUIState,
    EnergyBarConfig,
    ProgressBarConfig,
    ReactorGUIState
} from './GUIManager';
import { 
    ReactorState, 
    ReactorComponent, 
    ReactorComponentType,
    REACTOR_ROWS,
    REACTOR_COLS,
    REACTOR_SLOTS,
    REACTOR_THRESHOLDS
} from '../machines/reactor/ReactorSimulator';

describe('GUIManager', () => {
    let guiManager: GUIManager;

    beforeEach(() => {
        guiManager = new GUIManager();
    });

    describe('createEnergyBar', () => {
        it('should create full bar when energy is at max', () => {
            const bar = guiManager.createEnergyBar(1000, 1000);
            expect(bar).toBe('[████████████████████]');
        });

        it('should create empty bar when energy is zero', () => {
            const bar = guiManager.createEnergyBar(0, 1000);
            expect(bar).toBe('[░░░░░░░░░░░░░░░░░░░░]');
        });

        it('should create half-filled bar at 50% energy', () => {
            const bar = guiManager.createEnergyBar(500, 1000);
            expect(bar).toBe('[██████████░░░░░░░░░░]');
        });

        it('should handle zero max energy', () => {
            const bar = guiManager.createEnergyBar(100, 0);
            expect(bar).toBe('[░░░░░░░░░░░░░░░░░░░░]');
        });

        it('should clamp values above max', () => {
            const bar = guiManager.createEnergyBar(2000, 1000);
            expect(bar).toBe('[████████████████████]');
        });

        it('should clamp negative values to zero', () => {
            const bar = guiManager.createEnergyBar(-100, 1000);
            expect(bar).toBe('[░░░░░░░░░░░░░░░░░░░░]');
        });
    });

    describe('createProgressBar', () => {
        it('should create full bar at 100% progress', () => {
            const bar = guiManager.createProgressBar(1.0);
            expect(bar).toBe('[▶▶▶▶▶▶▶▶▶▶]');
        });

        it('should create empty bar at 0% progress', () => {
            const bar = guiManager.createProgressBar(0);
            expect(bar).toBe('[▷▷▷▷▷▷▷▷▷▷]');
        });

        it('should create half-filled bar at 50% progress', () => {
            const bar = guiManager.createProgressBar(0.5);
            expect(bar).toBe('[▶▶▶▶▶▷▷▷▷▷]');
        });

        it('should clamp values above 1', () => {
            const bar = guiManager.createProgressBar(1.5);
            expect(bar).toBe('[▶▶▶▶▶▶▶▶▶▶]');
        });

        it('should clamp negative values to zero', () => {
            const bar = guiManager.createProgressBar(-0.5);
            expect(bar).toBe('[▷▷▷▷▷▷▷▷▷▷]');
        });
    });

    describe('formatEnergy', () => {
        it('should format small values as EU', () => {
            expect(guiManager.formatEnergy(500)).toBe('500 EU');
        });

        it('should format thousands as k EU', () => {
            expect(guiManager.formatEnergy(5000)).toBe('5.0k EU');
        });

        it('should format millions as M EU', () => {
            expect(guiManager.formatEnergy(5000000)).toBe('5.0M EU');
        });

        it('should handle zero', () => {
            expect(guiManager.formatEnergy(0)).toBe('0 EU');
        });

        it('should handle edge case at 1000', () => {
            expect(guiManager.formatEnergy(1000)).toBe('1.0k EU');
        });

        it('should handle edge case at 1000000', () => {
            expect(guiManager.formatEnergy(1000000)).toBe('1.0M EU');
        });
    });

    describe('formatProgress', () => {
        it('should format 0 as 0%', () => {
            expect(guiManager.formatProgress(0)).toBe('0%');
        });

        it('should format 1 as 100%', () => {
            expect(guiManager.formatProgress(1)).toBe('100%');
        });

        it('should format 0.5 as 50%', () => {
            expect(guiManager.formatProgress(0.5)).toBe('50%');
        });

        it('should round to nearest integer', () => {
            expect(guiManager.formatProgress(0.333)).toBe('33%');
        });
    });

    describe('getMachineDisplayName', () => {
        it('should return correct name for Generator', () => {
            expect(guiManager.getMachineDisplayName(MachineType.GENERATOR)).toBe('Generator');
        });

        it('should return correct name for Macerator', () => {
            expect(guiManager.getMachineDisplayName(MachineType.MACERATOR)).toBe('Macerator');
        });

        it('should return correct name for Nuclear Reactor', () => {
            expect(guiManager.getMachineDisplayName(MachineType.NUCLEAR_REACTOR)).toBe('Nuclear Reactor');
        });
    });

    describe('buildMachineGUIBody', () => {
        it('should include energy display for all machines', () => {
            const state: MachineGUIState = {
                machineType: MachineType.MACERATOR,
                energyStored: 200,
                maxEnergy: 400,
                progress: 0.5,
                isProcessing: true
            };
            
            const body = guiManager.buildMachineGUIBody(state);
            expect(body).toContain('Energy:');
            expect(body).toContain('200 EU');
            expect(body).toContain('400 EU');
        });

        it('should include progress display for processing machines', () => {
            const state: MachineGUIState = {
                machineType: MachineType.MACERATOR,
                energyStored: 200,
                maxEnergy: 400,
                progress: 0.5,
                isProcessing: true
            };
            
            const body = guiManager.buildMachineGUIBody(state);
            expect(body).toContain('Progress:');
            expect(body).toContain('50%');
            expect(body).toContain('(Processing)');
        });

        it('should not include progress for generators', () => {
            const state: MachineGUIState = {
                machineType: MachineType.GENERATOR,
                energyStored: 2000,
                maxEnergy: 4000,
                progress: 0,
                isProcessing: false
            };
            
            const body = guiManager.buildMachineGUIBody(state);
            expect(body).not.toContain('Progress:');
        });

        it('should show Idle when not processing', () => {
            const state: MachineGUIState = {
                machineType: MachineType.MACERATOR,
                energyStored: 200,
                maxEnergy: 400,
                progress: 0,
                isProcessing: false
            };
            
            const body = guiManager.buildMachineGUIBody(state);
            expect(body).toContain('(Idle)');
        });

        it('should include input slot info when provided', () => {
            const state: MachineGUIState = {
                machineType: MachineType.MACERATOR,
                energyStored: 200,
                maxEnergy: 400,
                progress: 0,
                isProcessing: false,
                inputItem: 'iron_ore',
                inputCount: 5
            };
            
            const body = guiManager.buildMachineGUIBody(state);
            expect(body).toContain('Input:');
            expect(body).toContain('iron_ore x5');
        });

        it('should show Empty for empty input slot', () => {
            const state: MachineGUIState = {
                machineType: MachineType.MACERATOR,
                energyStored: 200,
                maxEnergy: 400,
                progress: 0,
                isProcessing: false,
                inputItem: '',
                inputCount: 0
            };
            
            const body = guiManager.buildMachineGUIBody(state);
            expect(body).toContain('Input:');
            expect(body).toContain('Empty');
        });

        it('should include output slot info when provided', () => {
            const state: MachineGUIState = {
                machineType: MachineType.MACERATOR,
                energyStored: 200,
                maxEnergy: 400,
                progress: 0,
                isProcessing: false,
                outputItem: 'crushed_iron_ore',
                outputCount: 2
            };
            
            const body = guiManager.buildMachineGUIBody(state);
            expect(body).toContain('Output:');
            expect(body).toContain('crushed_iron_ore x2');
        });

        it('should include additional info when provided', () => {
            const state: MachineGUIState = {
                machineType: MachineType.WIND_MILL,
                energyStored: 0,
                maxEnergy: 0,
                progress: 0,
                isProcessing: false,
                additionalInfo: {
                    'Wind Strength': 15,
                    'Output': '0.5 EU/t'
                }
            };
            
            const body = guiManager.buildMachineGUIBody(state);
            expect(body).toContain('Wind Strength:');
            expect(body).toContain('15');
            expect(body).toContain('Output:');
            expect(body).toContain('0.5 EU/t');
        });
    });

    describe('custom configuration', () => {
        it('should use custom energy bar config', () => {
            const customConfig: EnergyBarConfig = {
                segments: 10,
                filledChar: '#',
                emptyChar: '-'
            };
            const customManager = new GUIManager(customConfig);
            
            const bar = customManager.createEnergyBar(500, 1000);
            expect(bar).toBe('[#####-----]');
        });

        it('should use custom progress bar config', () => {
            const customProgressConfig: ProgressBarConfig = {
                segments: 5,
                completedChar: '=',
                remainingChar: ' '
            };
            const customManager = new GUIManager(undefined, customProgressConfig);
            
            const bar = customManager.createProgressBar(0.6);
            expect(bar).toBe('[===  ]');
        });
    });

    // ==========================================
    // Task 39: Reactor GUI Tests
    // ==========================================

    describe('Reactor GUI - Task 39', () => {
        /**
         * Helper to create an empty reactor state
         */
        function createEmptyReactorState(): ReactorState {
            return {
                slots: new Array(REACTOR_SLOTS).fill(null),
                hullHeat: 0,
                maxHullHeat: REACTOR_THRESHOLDS.meltdown,
                euProducedThisTick: 0,
                heatProducedThisTick: 0
            };
        }

        /**
         * Helper to create a reactor GUI state
         */
        function createReactorGUIState(
            hullHeat: number = 0,
            euPerTick: number = 0,
            heatPerTick: number = 0,
            slots?: (ReactorComponent | null)[]
        ): ReactorGUIState {
            const reactorState = createEmptyReactorState();
            reactorState.hullHeat = hullHeat;
            if (slots) {
                reactorState.slots = slots;
            }
            return {
                reactorState,
                euPerTick,
                heatPerTick
            };
        }

        describe('Task 39.1: createReactorGrid - 6×9 grid interface', () => {
            it('should create a grid with correct dimensions (6 rows × 9 columns)', () => {
                const state = createReactorGUIState();
                const grid = guiManager.createReactorGrid(state.reactorState.slots);
                
                const lines = grid.split('\n');
                // Header + 6 rows = 7 lines
                expect(lines.length).toBe(REACTOR_ROWS + 1);
            });

            it('should show empty slots with □ character', () => {
                const state = createReactorGUIState();
                const grid = guiManager.createReactorGrid(state.reactorState.slots);
                
                // Should contain empty slot characters
                expect(grid).toContain('□');
            });

            it('should show uranium cells with ☢ character', () => {
                const slots: (ReactorComponent | null)[] = new Array(REACTOR_SLOTS).fill(null);
                slots[0] = { type: ReactorComponentType.URANIUM_CELL };
                
                const grid = guiManager.createReactorGrid(slots);
                expect(grid).toContain('☢');
            });

            it('should show heat vents with ⌀ character', () => {
                const slots: (ReactorComponent | null)[] = new Array(REACTOR_SLOTS).fill(null);
                slots[0] = { type: ReactorComponentType.HEAT_VENT };
                
                const grid = guiManager.createReactorGrid(slots);
                expect(grid).toContain('⌀');
            });

            it('should show component heat exchangers with ⇄ character', () => {
                const slots: (ReactorComponent | null)[] = new Array(REACTOR_SLOTS).fill(null);
                slots[0] = { type: ReactorComponentType.COMPONENT_HEAT_EXCHANGER };
                
                const grid = guiManager.createReactorGrid(slots);
                expect(grid).toContain('⇄');
            });

            it('should include row numbers 1-6', () => {
                const state = createReactorGUIState();
                const grid = guiManager.createReactorGrid(state.reactorState.slots);
                
                for (let row = 1; row <= REACTOR_ROWS; row++) {
                    expect(grid).toContain(`${row} `);
                }
            });

            it('should include column numbers 1-9 in header', () => {
                const state = createReactorGUIState();
                const grid = guiManager.createReactorGrid(state.reactorState.slots);
                
                const lines = grid.split('\n');
                const header = lines[0];
                for (let col = 1; col <= REACTOR_COLS; col++) {
                    expect(header).toContain(`${col}`);
                }
            });
        });

        describe('Task 39.2: createHeatBar - Heat display', () => {
            it('should create empty bar when heat is zero', () => {
                const bar = guiManager.createHeatBar(0, REACTOR_THRESHOLDS.meltdown);
                expect(bar).toContain('░');
                expect(bar).not.toContain('█');
            });

            it('should create full bar when heat is at max', () => {
                const bar = guiManager.createHeatBar(REACTOR_THRESHOLDS.meltdown, REACTOR_THRESHOLDS.meltdown);
                expect(bar).toContain('█');
            });

            it('should show partial fill at 50% heat', () => {
                const bar = guiManager.createHeatBar(5000, REACTOR_THRESHOLDS.meltdown);
                expect(bar).toContain('█');
                expect(bar).toContain('░');
            });

            it('should handle zero max heat', () => {
                const bar = guiManager.createHeatBar(100, 0);
                expect(bar).toContain('░');
            });

            it('should clamp values above max', () => {
                const bar = guiManager.createHeatBar(15000, REACTOR_THRESHOLDS.meltdown);
                // Should be full bar
                expect(bar).toContain('█');
            });
        });

        describe('Task 39.2: getHeatStatusText - Heat status messages', () => {
            it('should show Stable for low heat', () => {
                const status = guiManager.getHeatStatusText(1000);
                expect(status).toContain('Stable');
            });

            it('should show WARNING for heat > 4000 (fire threshold)', () => {
                const status = guiManager.getHeatStatusText(4500);
                expect(status).toContain('WARNING');
                expect(status).toContain('Fire');
            });

            it('should show DANGER for heat > 7000 (evaporate threshold)', () => {
                const status = guiManager.getHeatStatusText(7500);
                expect(status).toContain('DANGER');
                expect(status).toContain('Evaporating');
            });

            it('should show RADIATION LEAK for heat > 8500', () => {
                const status = guiManager.getHeatStatusText(9000);
                expect(status).toContain('RADIATION');
            });

            it('should show MELTDOWN for heat >= 10000', () => {
                const status = guiManager.getHeatStatusText(10000);
                expect(status).toContain('MELTDOWN');
            });
        });

        describe('Task 39.3: createEUOutputDisplay - EU output display', () => {
            it('should format EU output correctly', () => {
                const display = guiManager.createEUOutputDisplay(100);
                expect(display).toContain('100');
                expect(display).toContain('EU/t');
            });

            it('should handle zero EU output', () => {
                const display = guiManager.createEUOutputDisplay(0);
                expect(display).toContain('0');
                expect(display).toContain('EU/t');
            });

            it('should handle large EU output', () => {
                const display = guiManager.createEUOutputDisplay(500);
                expect(display).toContain('500');
                expect(display).toContain('EU/t');
            });
        });

        describe('buildReactorGUIBody - Combined reactor display', () => {
            it('should include EU output section', () => {
                const state = createReactorGUIState(0, 100, 50);
                const body = guiManager.buildReactorGUIBody(state);
                
                expect(body).toContain('EU Output');
                expect(body).toContain('100 EU/t');
            });

            it('should include heat display section', () => {
                const state = createReactorGUIState(5000, 100, 50);
                const body = guiManager.buildReactorGUIBody(state);
                
                expect(body).toContain('Hull Heat');
                expect(body).toContain('5000');
                expect(body).toContain('10000');
            });

            it('should include heat rate', () => {
                const state = createReactorGUIState(0, 100, 50);
                const body = guiManager.buildReactorGUIBody(state);
                
                expect(body).toContain('Heat Rate');
                expect(body).toContain('50 hU/t');
            });

            it('should include reactor grid', () => {
                const state = createReactorGUIState();
                const body = guiManager.buildReactorGUIBody(state);
                
                expect(body).toContain('Reactor Grid');
                expect(body).toContain('6×9');
            });

            it('should include legend', () => {
                const state = createReactorGUIState();
                const body = guiManager.buildReactorGUIBody(state);
                
                expect(body).toContain('Legend');
                expect(body).toContain('Uranium');
                expect(body).toContain('Vent');
            });

            it('should show heat status', () => {
                const state = createReactorGUIState(5000, 100, 50);
                const body = guiManager.buildReactorGUIBody(state);
                
                expect(body).toContain('Status');
            });
        });

        describe('getComponentName', () => {
            it('should return correct name for Uranium Cell', () => {
                expect(guiManager.getComponentName(ReactorComponentType.URANIUM_CELL)).toBe('Uranium Cell');
            });

            it('should return correct name for Heat Vent', () => {
                expect(guiManager.getComponentName(ReactorComponentType.HEAT_VENT)).toBe('Heat Vent');
            });

            it('should return correct name for Reactor Heat Vent', () => {
                expect(guiManager.getComponentName(ReactorComponentType.REACTOR_HEAT_VENT)).toBe('Reactor Heat Vent');
            });

            it('should return correct name for Overclocked Heat Vent', () => {
                expect(guiManager.getComponentName(ReactorComponentType.OVERCLOCKED_HEAT_VENT)).toBe('Overclocked Heat Vent');
            });

            it('should return correct name for Component Heat Exchanger', () => {
                expect(guiManager.getComponentName(ReactorComponentType.COMPONENT_HEAT_EXCHANGER)).toBe('Component Heat Exchanger');
            });

            it('should return Empty for empty type', () => {
                expect(guiManager.getComponentName(ReactorComponentType.EMPTY)).toBe('Empty');
            });
        });

        describe('getComponentChar', () => {
            it('should return □ for null/empty slot', () => {
                const char = guiManager.getComponentChar(null);
                expect(char).toContain('□');
            });

            it('should return ☢ for uranium cell', () => {
                const char = guiManager.getComponentChar({ type: ReactorComponentType.URANIUM_CELL });
                expect(char).toContain('☢');
            });

            it('should return ⌀ for heat vent', () => {
                const char = guiManager.getComponentChar({ type: ReactorComponentType.HEAT_VENT });
                expect(char).toContain('⌀');
            });

            it('should return ⇄ for component heat exchanger', () => {
                const char = guiManager.getComponentChar({ type: ReactorComponentType.COMPONENT_HEAT_EXCHANGER });
                expect(char).toContain('⇄');
            });
        });
    });
});
