/*
  IC2 Main Optimized
  - Переработанный, более структурированный и производительный вариант вашего скрипта.
  - Сфокусирован на: читаемости, безопасности, уменьшении аллокаций в тике, централизованной обработке машин/кабельной логики и улучшенной обработке брони.
  - Старался не менять внешние зависимости и API-звонки (energyNetwork, cableGraph, persistenceManager и т.д.),
    поэтому интеграция должна быть прямой.
*/

import {
  world,
  system,
  ItemStack,
  EquipmentSlot,
  EntityComponentTypes,
  Player,
  Block,
  Vector3
} from "@minecraft/server";

// === Local module imports (оставляем как были) ===
import { energyNetwork, VoltageTier } from "./energy/EnergyNetwork";
import { cableGraph } from "./energy/CableGraph";
import { persistenceManager, positionToKey } from "./persistence/PersistenceManager";
import { Generator } from "./machines/generators/Generator";
import { GeothermalGenerator } from "./machines/generators/GeothermalGenerator";
import { SolarPanel } from "./machines/generators/SolarPanel";
import { WindMill } from "./machines/generators/WindMill";
import { Macerator } from "./machines/processing/Macerator";
import { ElectricFurnace } from "./machines/processing/ElectricFurnace";
import { Compressor } from "./machines/processing/Compressor";
import { Extractor } from "./machines/processing/Extractor";
import { Recycler } from "./machines/processing/Recycler";
import { ReactorSimulator } from "./machines/reactor/ReactorSimulator";
import { NanoSuit, ArmorSlot } from "./machines/armor/NanoSuit";
import { QuantumSuit } from "./machines/armor/QuantumSuit";
import { rubberTreeManager, ResinSpotState } from "./rubber/RubberTree";
import { guiManager, MachineType } from "./gui/GUIManager";

// === Config ===
const CONFIG = Object.freeze({
  TICKS_PER_SECOND: 20,
  ARMOR_TICK_INTERVAL: 20, // ticks
  RUBBER_TREE_INTERVAL: 100,
  SAVE_INTERVAL: 6000,
  DEBUG: false,
  RUBBER_REGEN_PROB: 0.01
});

// === Short helpers / logging ===
const log = (...args) => { if (CONFIG.DEBUG) world.sendMessage(`[IC2] ${args.join(' ')}`); };
const warn = (...args) => { world.sendMessage(`[IC2][WARN] ${args.join(' ')}`); };

/**
 * Stable key from a position (integers) — минимизируем аллокации, используем разделитель ':'
 * @param {{x:number,y:number,z:number}} pos
 */
function vecKey(pos) {
  return `${Math.floor(pos.x)}:${Math.floor(pos.y)}:${Math.floor(pos.z)}`;
}

/** Safe executor, оставляем, но с минимальной обвязкой */
function safeExec(context, fn) {
  try { fn(); } catch (e) { if (CONFIG.DEBUG) warn(`${context} -> ${e}`); }
}

// === Registries (централизованные) ===
const Registries = {
  generators: new Map(),
  geothermalGenerators: new Map(),
  solarPanels: new Map(),
  windMills: new Map(),
  processingMachines: new Map(),
  reactors: new Map(),
  playerArmorStates: new Map() // key = player.id
};

// === Helpers: cable types / machine mapping ===
function getCableType(id) {
  switch (id) {
    case 'ic2:tin_cable': return 'tin';
    case 'ic2:copper_cable': return 'copper';
    case 'ic2:gold_cable': return 'gold';
    case 'ic2:iron_cable': return 'iron_hv';
    case 'ic2:glass_fibre_cable': return 'glass_fibre';
    default: return null;
  }
}

function isProcessorId(id) {
  return ['ic2:macerator','ic2:electric_furnace','ic2:compressor','ic2:extractor','ic2:recycler'].includes(id);
}

function getMachineType(blockId) {
  switch (blockId) {
    case 'ic2:generator': return MachineType.GENERATOR;
    case 'ic2:geothermal_generator': return MachineType.GEOTHERMAL;
    case 'ic2:solar_panel': return MachineType.SOLAR_PANEL;
    case 'ic2:wind_mill': return MachineType.WIND_MILL;
    case 'ic2:macerator': return MachineType.MACERATOR;
    case 'ic2:electric_furnace': return MachineType.ELECTRIC_FURNACE;
    case 'ic2:compressor': return MachineType.COMPRESSOR;
    case 'ic2:extractor': return MachineType.EXTRACTOR;
    case 'ic2:recycler': return MachineType.RECYCLER;
    case 'ic2:nuclear_reactor': return MachineType.NUCLEAR_REACTOR;
    default: return null;
  }
}

// === Placement / Removal centralized handlers ===
const placementHandlers = {
  'ic2:generator': pos => Registries.generators.set(vecKey(pos), new Generator(pos)),
  'ic2:geothermal_generator': pos => Registries.geothermalGenerators.set(vecKey(pos), new GeothermalGenerator(pos)),
  'ic2:solar_panel': pos => Registries.solarPanels.set(vecKey(pos), new SolarPanel(pos)),
  'ic2:wind_mill': pos => Registries.windMills.set(vecKey(pos), new WindMill(pos)),
  'ic2:nuclear_reactor': pos => Registries.reactors.set(vecKey(pos), new ReactorSimulator(pos)),
  'ic2:macerator': pos => { Registries.processingMachines.set(vecKey(pos), new Macerator(pos)); cableGraph.addConsumer(pos, VoltageTier.LV); },
  'ic2:electric_furnace': pos => { Registries.processingMachines.set(vecKey(pos), new ElectricFurnace(pos)); cableGraph.addConsumer(pos, VoltageTier.LV); },
  'ic2:compressor': pos => { Registries.processingMachines.set(vecKey(pos), new Compressor(pos)); cableGraph.addConsumer(pos, VoltageTier.LV); },
  'ic2:extractor': pos => { Registries.processingMachines.set(vecKey(pos), new Extractor(pos)); cableGraph.addConsumer(pos, VoltageTier.LV); },
  'ic2:recycler': pos => { Registries.processingMachines.set(vecKey(pos), new Recycler(pos)); cableGraph.addConsumer(pos, VoltageTier.LV); },
  'ic2:rubber_wood': pos => rubberTreeManager.registerRubberWood(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z))
};

const destructionHandlers = {
  'ic2:generator': (pos,key) => removeMachineMap(Registries.generators, key),
  'ic2:geothermal_generator': (pos,key) => removeMachineMap(Registries.geothermalGenerators, key),
  'ic2:solar_panel': (pos,key) => removeMachineMap(Registries.solarPanels, key),
  'ic2:wind_mill': (pos,key) => removeMachineMap(Registries.windMills, key),
  'ic2:nuclear_reactor': (pos,key) => removeMachineMap(Registries.reactors, key),
  'ic2:macerator': (pos,key) => removeMachineMap(Registries.processingMachines, key, true),
  'ic2:electric_furnace': (pos,key) => removeMachineMap(Registries.processingMachines, key, true),
  'ic2:compressor': (pos,key) => removeMachineMap(Registries.processingMachines, key, true),
  'ic2:extractor': (pos,key) => removeMachineMap(Registries.processingMachines, key, true),
  'ic2:recycler': (pos,key) => removeMachineMap(Registries.processingMachines, key, true),
  'ic2:rubber_wood': (pos,key) => {
    const res = rubberTreeManager.handleBreak(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
    if (res?.droppedResin) {
      try { pos.dimension.spawnItem(new ItemStack('ic2:sticky_resin', res.resinCount), pos); } catch(e){}
    }
  }
};

function removeMachineMap(map, key, isConsumer = false) {
  const machine = map.get(key);
  if (!machine) return;
  try { if (machine.destroy) machine.destroy(); } catch(e){ if (CONFIG.DEBUG) warn('destroy failed', e); }
  map.delete(key);
  persistenceManager.clearMachineState(key);
  if (isConsumer) cableGraph.removeConsumer(positionFromKey(key));
}

function positionFromKey(key) {
  const [x,y,z] = key.split(':').map(Number);
  return { x, y, z };
}

// === Block event handlers ===
function handleBlockPlacement(block) {
  const id = block.typeId;
  const pos = block.location;
  safeExec(`place:${id}`, () => {
    const cable = getCableType(id);
    if (cable) { energyNetwork.registerCable(pos, cable); cableGraph.addCable(pos, cable); return; }

    const handler = placementHandlers[id];
    if (handler) handler(pos);
  });
}

function handleBlockDestruction(blockId, position, dimension) {
  safeExec(`destroy:${blockId}`, () => {
    const key = vecKey(position);
    const cable = getCableType(blockId);
    if (cable) { energyNetwork.unregisterCable(position); cableGraph.removeCable(position); return; }

    const handler = destructionHandlers[blockId];
    if (handler) handler(position, key);
  });
}

// === Interaction / GUI ===
async function handleBlockInteraction(player, block, itemId) {
  const blockId = block.typeId;
  const key = vecKey(block.location);

  // Rubber tap
  if (blockId === 'ic2:rubber_wood' && itemId === 'ic2:treetap') {
    const { x,y,z } = block.location;
    const r = rubberTreeManager.handleTreetap(Math.floor(x), Math.floor(y), Math.floor(z));
    if (r?.success) {
      try { block.dimension.spawnItem(new ItemStack('ic2:sticky_resin', r.resinDropped), { x: x+0.5, y: y+0.5, z: z+0.5 }); } catch(e){}
    }
    return;
  }

  const machineType = getMachineType(blockId);
  if (!machineType) return;

  // Build a lightweight guiState only when needed
  let guiState = null;

  if (blockId === 'ic2:generator') {
    const m = Registries.generators.get(key);
    if (m) guiState = { ...m.getState(), machineType, maxEnergy: m.getConfig().maxBuffer, isProcessing: !!m.getState().isActive };
  } else if (blockId === 'ic2:geothermal_generator') {
    const m = Registries.geothermalGenerators.get(key);
    if (m) guiState = { ...m.getState(), machineType, maxEnergy: m.getConfig().maxBuffer, isProcessing: !!m.getState().isActive };
  } else if (isProcessorId(blockId)) {
    const m = Registries.processingMachines.get(key);
    if (m) guiState = { ...m.getState(), machineType, maxEnergy: m.getConfig().maxEnergy, isProcessing: !!m.getState().isProcessing };
  } else if (blockId === 'ic2:solar_panel') {
    const m = Registries.solarPanels.get(key);
    if (m) guiState = { machineType, isProcessing: m.isProducing(getSolarConditionsCached(system.currentTick)) };
  } else if (blockId === 'ic2:nuclear_reactor') {
    const m = Registries.reactors.get(key);
    if (m) { await guiManager.showReactorGUI(player, { reactorState: m.getState() }); return; }
  }

  if (guiState) {
    if (!guiState.energyStored) guiState.energyStored = 0;
    await guiManager.showMachineGUI(player, guiState);
  }
}

// === Solar environment caching (оптимизировано) ===
let solarCache = { tick: -1, data: null };
function getSolarConditionsCached(curTick) {
  if (solarCache.tick === curTick && solarCache.data) return solarCache.data;
  let time = 6000;
  try { time = world.getAbsoluteTime() % 24000; } catch (e){}
  // TODO: при необходимости можно расширить вычисление: проверять погоду в каждой дименсии/спот
  solarCache.tick = curTick;
  solarCache.data = { timeOfDay: time, isRaining: false, hasSkyAccess: true };
  return solarCache.data;
}

// === Armor processing (оптимизировано, меньше new в тике) ===
function getArmorState(playerId) {
  if (!Registries.playerArmorStates.has(playerId)) Registries.playerArmorStates.set(playerId, {});
  return Registries.playerArmorStates.get(playerId);
}

function processArmorEffects() {
  for (const player of world.getAllPlayers()) {
    const eqComp = player.getComponent(EntityComponentTypes.Equippable);
    if (!eqComp) continue;
    const armorState = getArmorState(player.id);

    // Cache equipment references to avoid repeated getEquipment() calls throughout code
    const helmet = eqComp.getEquipment(EquipmentSlot.Head);
    const chest = eqComp.getEquipment(EquipmentSlot.Chest);
    const legs = eqComp.getEquipment(EquipmentSlot.Legs);
    const boots = eqComp.getEquipment(EquipmentSlot.Feet);

    // Quantum helmet
    if (helmet?.typeId?.includes('quantum') || helmet?.typeId === 'ic2:quantumsuit_helmet') {
      armorState.quantum = armorState.quantum || new QuantumSuit();
      const qs = armorState.quantum;
      const isUnderwater = player.isInWater;
      const hasPoison = !!player.getEffect('poison');
      const hasWither = !!player.getEffect('wither');

      if (isUnderwater || hasPoison || hasWither) {
        const res = qs.getHelmet().processEffects(CONFIG.ARMOR_TICK_INTERVAL, hasPoison, hasWither, isUnderwater);
        if (isUnderwater && res.waterBreathing) player.addEffect('water_breathing', 40, { showParticles: false });
        if (res.effectsCured?.includes('poison')) player.removeEffect('poison');
        if (res.effectsCured?.includes('wither')) player.removeEffect('wither');
      }
    }

    // Quantum leggings (speed on sprint)
    if (legs?.typeId?.includes('quantum')) {
      armorState.quantum = armorState.quantum || new QuantumSuit();
      if (player.isSprinting && armorState.quantum.getLeggings().processSprint(true, 1).hadEnoughEnergy) {
        player.addEffect('speed', 5, { amplifier: 3, showParticles: false });
      }
    }

    // Quantum boots (jump)
    if (boots?.typeId?.includes('quantum')) {
      armorState.quantum = armorState.quantum || new QuantumSuit();
      if (armorState.quantum.getBoots().hasEnergy()) player.addEffect('jump_boost', 5, { amplifier: 4, showParticles: false });
    }

    // Nano helmet (night vision)
    if (helmet?.typeId?.includes('nano')) {
      armorState.nano = armorState.nano || new NanoSuit();
      if (armorState.nano.getPiece(ArmorSlot.HELMET)?.hasEnergy()) player.addEffect('night_vision', 220, { showParticles: false });
    }
  }
}

// === Tick loop (централизованный и читаемый) ===
let tickCounter = 0;
let lastSaveTick = 0;

function processTick() {
  tickCounter++;
  const solarCond = getSolarConditionsCached(tickCounter);

  // 1. Generators & power sources
  for (const gen of Registries.generators.values()) safeExec('genTick', () => gen.tick());
  for (const geo of Registries.geothermalGenerators.values()) safeExec('geoTick', () => geo.tick());
  for (const solar of Registries.solarPanels.values()) safeExec('solarTick', () => solar.tick(solarCond));
  for (const wind of Registries.windMills.values()) safeExec('windTick', () => wind.tick({ windStrength: 15, isAreaBlocked: false }));
  for (const reactor of Registries.reactors.values()) safeExec('reactorTick', () => reactor.tick());

  // 2. Processors — tick every server tick for smooth progress
  for (const proc of Registries.processingMachines.values()) safeExec('procTick', () => proc.tick());

  // 3. Armor effects at interval
  if (tickCounter % CONFIG.ARMOR_TICK_INTERVAL === 0) safeExec('armorEffects', processArmorEffects);

  // 4. Rubber tree random ticks
  if (tickCounter % CONFIG.RUBBER_TREE_INTERVAL === 0) safeExec('rubberTick', () => {
    const states = rubberTreeManager.getAllStates();
    for (const [key, state] of states) {
      if (state.resinSpot === ResinSpotState.DRY && Math.random() < CONFIG.RUBBER_REGEN_PROB) {
        const [x,y,z] = key.split(':').map(Number);
        rubberTreeManager.handleRandomTick(x,y,z);
      }
    }
  });

  // 5. Periodic save
  if (tickCounter - lastSaveTick >= CONFIG.SAVE_INTERVAL) {
    safeExec('save', saveMachineStates);
    lastSaveTick = tickCounter;
  }
}

function saveMachineStates() {
  // make a compact array of states to reduce per-machine persistence calls if persistenceManager supports batching
  const addToSave = (map, type) => {
    for (const [key, machine] of map) {
      if (!machine || !machine.getState) continue;
      try {
        const s = machine.getState();
        persistenceManager.saveMachineState({
          energyStored: s.energyStored ?? s.hullHeat ?? 0,
          progress: s.progress ?? s.burnTimeRemaining ?? 0,
          machineType: type,
          positionKey: key
        });
      } catch (e) { if (CONFIG.DEBUG) warn('save machine failed', key, e); }
    }
  };

  addToSave(Registries.generators, 'generator');
  addToSave(Registries.geothermalGenerators, 'geothermal_generator');
  addToSave(Registries.processingMachines, 'processing_machine');
  addToSave(Registries.reactors, 'nuclear_reactor');

  persistenceManager.markSaved();
  log('world saved');
}

function loadMachineStates() {
  // leave to PersistenceManager specifics — but we emit a debug message
  log('loading machine states...');
}

// === Event subscriptions (defensive checks) ===
system.runInterval(processTick, 1);

world.afterEvents.worldInitialize.subscribe(loadMachineStates);

world.afterEvents.playerPlaceBlock.subscribe(ev => {
  const b = ev.block;
  if (!b?.typeId?.startsWith) return;
  if (b.typeId.startsWith('ic2:')) handleBlockPlacement(b);
});

world.afterEvents.playerBreakBlock.subscribe(ev => {
  const id = ev.brokenBlockPermutation?.type?.id;
  if (!id) return;
  if (!id.startsWith('ic2:')) return;
  handleBlockDestruction(id, ev.block.location, ev.block.dimension);
});

world.afterEvents.playerInteractWithBlock.subscribe(ev => {
  const b = ev.block;
  if (!b?.typeId?.startsWith) return;
  if (!b.typeId.startsWith('ic2:')) return;
  const mainhand = ev.player.getComponent(EntityComponentTypes.Equippable)?.getEquipment(EquipmentSlot.Mainhand);
  handleBlockInteraction(ev.player, b, mainhand?.typeId);
});

world.afterEvents.entityHurt.subscribe(ev => {
  // если потребуется — вынести в отдельный модуль для тестирования
});

world.afterEvents.itemUse.subscribe(ev => {
  if (ev.itemStack?.typeId === 'ic2:re_battery' && ev.source?.isSneaking) {
    const armorState = getArmorState(ev.source.id);
    let charged = 0;
    const chargeSuit = (suit) => {
      if (!suit) return 0;
      let added = 0;
      for (const p of suit.getAllPieces()) { if (p.charge(100000)) added += 100000; }
      return added;
    };

    charged += chargeSuit(armorState.quantum);
    charged += chargeSuit(armorState.nano);
    if (charged > 0) ev.source.sendMessage(`§a[IC2] +${charged} EU to Armor`);
  }
});

// === Exports ===
export { Registries as registries, processTick };
