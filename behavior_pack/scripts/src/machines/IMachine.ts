import { Vector3 } from "@minecraft/server";

/**
 * Core machine contract for IC2-style blocks.
 */
export interface IMachine<State = any> {
    position: Vector3;
    type: string;
    energyStored: number;
    maxEnergy: number;
    tick(delta: number): unknown;
    addEnergy(amount: number): number;
    removeEnergy(amount: number): number;
    getState(): State;
    setState(state: State): void;
}
