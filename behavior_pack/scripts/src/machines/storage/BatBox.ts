import { Vector3 } from "@minecraft/server";
import { energyNetwork, VoltageTier } from "../../energy/EnergyNetwork";
import { IMachine } from "../IMachine";

export interface BatBoxState {
    energyStored: number;
}

export interface BatBoxConfig {
    maxEnergy: number;
    maxInput: number;
    maxOutput: number;
    tier: VoltageTier;
}

export const BATBOX_CONFIG: BatBoxConfig = {
    maxEnergy: 40000,
    maxInput: 32,
    maxOutput: 32,
    tier: VoltageTier.LV
};

export class BatBox implements IMachine<BatBoxState> {
    readonly position: Vector3;
    readonly type: string = "batbox";
    readonly maxEnergy: number;
    private readonly config: BatBoxConfig;
    private state: BatBoxState;

    constructor(position: Vector3, config: BatBoxConfig = BATBOX_CONFIG) {
        this.position = position;
        this.config = config;
        this.maxEnergy = config.maxEnergy;
        this.state = { energyStored: 0 };

        energyNetwork.registerConsumer(this.position, {
            maxVoltage: this.config.tier,
            maxInput: this.config.maxInput,
            machine: this
        });

        energyNetwork.registerGenerator(this.position, {
            outputVoltage: this.config.tier,
            packetSize: this.config.maxOutput,
            machine: this
        });
    }

    get energyStored(): number {
        return this.state.energyStored;
    }

    tick(delta: number = 1): void {
        const sendAmount = Math.min(this.config.maxOutput * delta, this.state.energyStored);
        if (sendAmount <= 0) return;

        const results = energyNetwork.sendPacket(this.position, sendAmount, this.config.tier);
        const accepted = results.reduce((total, r) => total + (r.accepted ? r.euDelivered : 0), 0);
        if (accepted > 0) {
            this.state.energyStored -= accepted;
        }
    }

    addEnergy(amount: number): number {
        if (amount <= 0) return 0;
        const space = this.config.maxEnergy - this.state.energyStored;
        const accepted = Math.min(space, amount, this.config.maxInput);
        this.state.energyStored += accepted;
        return accepted;
    }

    removeEnergy(amount: number): number {
        if (amount <= 0) return 0;
        const removed = Math.min(amount, this.state.energyStored, this.config.maxOutput);
        this.state.energyStored -= removed;
        return removed;
    }

    getState(): BatBoxState {
        return { ...this.state };
    }

    setState(state: BatBoxState): void {
        this.state = { ...state };
    }
}
