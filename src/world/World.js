// World: arma la granja de Mela y maneja toda la progresión:
//  - Desbloqueos únicos (camión, empleados, vacas, Zona Norte, talleres...) con `requires`.
//  - Mejoras por niveles (repeat): la baldosa reaparece con precio creciente.
//  - Granjas (prestigio): al completar todo aparece "Granja N+1"; se reinicia el progreso
//    con ingresos multiplicados, precios un poco más altos y contenido nuevo.
import * as THREE from 'three';
import { ResourceNode } from '../entities/ResourceNode.js';
import { ProductionUnit } from '../entities/ProductionUnit.js';
import { Processor } from '../entities/Processor.js';
import { Shop } from '../entities/Shop.js';
import { Truck } from '../entities/Truck.js';
import { UnlockZone } from '../entities/UnlockZone.js';
import { WorkerAI } from '../entities/WorkerAI.js';
import { Tractor } from '../entities/Tractor.js';
import { PlayerController } from '../entities/PlayerController.js';
import { Pile } from '../systems/Pile.js';
import { TransferZone } from '../systems/TransferZone.js';
import {
  mat, createTree, createBush, createRock, createFenceLine, createFarmhouse, createBin,
  createHayBale, createPumpkin, createSign,
} from '../models/Models.js';
import { CONFIG } from '../config.js';
import { seeded } from '../utils.js';

const V = (x, z) => new THREE.Vector3(x, 0, z);
const NORTH_MIN_Z = -38;

/** Redondeo "lindo" de precios: 5, 10 o 50 según magnitud. */
export const niceRound = (v) => (v < 100 ? Math.round(v / 5) * 5 : v < 1000 ? Math.round(v / 10) * 10 : Math.round(v / 50) * 50);

export class World {
  constructor(game, saved) {
    this.game = game;
    this.scene = game.scene;
    this.bounds = { ...CONFIG.bounds };
    this.resetting = false;

    // ---------- Granja actual (prestigio) ----------
    this.farmLevel = saved?.farmLevel ?? 1;
    game.incomeMult = 1 + 0.5 * (this.farmLevel - 1);
    this.priceMult = Math.pow(1.3, this.farmLevel - 1);
    this.workerBonus = 0;
    this.growBonus = 0;
    this.ovenBonus = 0;

    this.buildEnvironment();

    // ---------- Núcleo inicial ----------
    this.field = this.addField({ type: 'corn', center: V(-11, -6), cols: 6, rows: 5, spacing: 1.5 });
    this.coop = new ProductionUnit(game, {
      position: V(2, -8), inputType: 'corn', outputType: 'egg', animal: 'chicken', animalCount: 4, house: 'coop',
      produceTime: CONFIG.coop.produceTime, feederMax: CONFIG.coop.feederMax, outputMax: CONFIG.coop.outputMax,
      outputPile: { cols: 2, rows: 2, spacing: [0.52, 0.52] }, floorColor: '#ecd28c',
      inputRoles: ['player', 'farmer'], outputRoles: ['player', 'carrier'],
    });
    this.shop = new Shop(game, {
      position: V(8, 3), name: 'TIENDA', spawnPoint: V(25.5, 10), exitPoint: V(25.5, 4),
      products: [
        { type: 'egg', x: -0.85, max: CONFIG.shop.eggShelfMax },
        { type: 'milk', flag: 'milk', x: 0.4, max: CONFIG.shop.milkShelfMax, pile: { spacing: [0.28, 0.32] } },
      ],
    });

    this.player = new PlayerController(game, { position: V(-1, 3), bounds: this.bounds });
    game.carriers.push(this.player);

    this.truck = this.barn = this.tractor = null;
    this.wheatField = this.pumpkinField = null;
    this.bakery = this.sweets = this.pastry = this.shop2 = null;
    this.workers = [];

    this.defineUnlocks();

    // ---------- Restaurar partida ----------
    this.unlocked = [];
    this.upgrades = {};
    this.zones = new Map();
    const ups = { ...(saved?.upgrades ?? {}) };
    // Migración de partidas viejas (mejoras únicas → niveles)
    const MIGRATE = { cap1: 'cap', cap2: 'cap', cap3: 'cap', speed1: 'speed', speed2: 'speed', chickens: 'chickens', cows: 'cows', growth: 'grow' };
    for (const id of saved?.unlocked ?? []) {
      if (MIGRATE[id]) { ups[MIGRATE[id]] = (ups[MIGRATE[id]] ?? 0) + 1; continue; }
      const def = this.defs.find((d) => d.id === id && !d.repeat);
      if (!def || this.unlocked.includes(id)) continue;
      this.unlocked.push(id);
      def.apply(true);
    }
    // Las mejoras por nivel se conservan entre granjas: se guardan siempre y se
    // aplican apenas existe lo que necesitan (ver applyPendingUpgrades).
    this.applied = {};
    for (const def of this.defs.filter((d) => d.repeat)) {
      const lvl = Math.min(ups[def.id] ?? 0, this.maxLevel(def));
      if (lvl) this.upgrades[def.id] = lvl;
    }
    this.applyPendingUpgrades(true);
    this.refreshZones(true);
  }

  // =====================================================================
  // DEFINICIÓN DE DESBLOQUEOS
  // =====================================================================
  defineUnlocks() {
    const worker = (opts) => (i) => this.spawnWorker({ ...opts, instant: i });
    this.defs = [
      // ----- Granja base -----
      { id: 'truck', price: 20, label: 'Camión', icon: '🚚', pos: V(-11, 12.2), requires: [], apply: (i) => this.buildTruck(i) },
      { id: 'farmer', price: 60, label: 'Granjero Tito', icon: '🧑‍🌾', pos: V(-5.5, -1.5), requires: ['truck'],
        apply: worker({ role: 'farmer', name: 'Tito', position: V(-5.5, -1.5), field: () => this.field, unit: () => this.coop }) },
      { id: 'cashier', price: 90, label: 'Cajera Pili', icon: '🧑‍💼', pos: V(12.5, 0.5), requires: ['farmer'],
        apply: worker({ role: 'cashier', name: 'Pili', position: V(12.5, 0.5), shop: () => this.shop }) },
      { id: 'cow', keep: true, price: 180, label: 'Vacas', icon: '🐄', pos: V(19, -2), requires: ['cashier'], apply: (i) => this.buildBarn(i) },
      { id: 'carrier', price: 150, label: 'Repartidor Lucho', icon: '🧺', pos: V(2, -0.8), requires: ['cow'],
        apply: worker({ role: 'carrier', name: 'Lucho', position: V(2, -0.8), sources: () => [this.coop, this.barn], shop: () => this.shop }) },
      { id: 'tractor', keep: true, price: 260, label: 'Tractor', icon: '🚜', pos: V(-15.5, 0.5), requires: ['cow'], apply: (i) => this.buildTractor(i) },
      { id: 'farmer2', price: 240, label: 'Granjera Rosa', icon: '👩‍🌾', pos: V(-5.5, -1.5), requires: ['farmer', 'cow'],
        apply: worker({ role: 'farmer', name: 'Rosa', position: V(-5.5, -1.5), field: () => this.field, unit: () => this.barn }) },

      // ----- Zona Norte: trigo, panadería y almacén -----
      { id: 'north', keep: true, price: 500, label: 'Zona Norte', icon: '🌾', pos: V(13, -14.6), requires: ['cow'], apply: (i) => this.openNorth(i) },
      { id: 'bakery', keep: true, price: 350, label: 'Panadería', icon: '🍞', pos: V(-1, -21.2), requires: ['north'], apply: (i) => this.buildBakery(i) },
      { id: 'shop2', price: 300, label: 'Almacén', icon: '🏪', pos: V(12, -19.5), requires: ['bakery'], apply: (i) => this.buildShop2(i) },
      { id: 'farmer3', price: 420, label: 'Granjero Beto', icon: '👨‍🌾', pos: V(-6, -19), requires: ['bakery'],
        apply: worker({ role: 'farmer', name: 'Beto', position: V(-6, -19), field: () => this.wheatField, unit: () => this.bakery }) },
      { id: 'cashier2', price: 400, label: 'Cajera Sol', icon: '🧑‍💼', pos: V(16.5, -24.5), requires: ['shop2'],
        apply: worker({ role: 'cashier', name: 'Sol', position: V(16.5, -24.5), shop: () => this.shop2 }) },
      { id: 'carrier2', price: 480, label: 'Repartidor Nico', icon: '🧺', pos: V(5, -19.5), requires: ['shop2'],
        apply: worker({ role: 'carrier', name: 'Nico', position: V(5, -19.5), sources: () => [this.bakery, this.sweets, this.pastry], shop: () => this.shop2 }) },

      // ----- Granja 2 en adelante: zapallos, dulcería y pastelería -----
      { id: 'pumpkins', keep: true, price: 700, label: 'Zapallar', icon: '🎃', pos: V(-12, -32), requires: ['north'], minLevel: 2, apply: (i) => this.buildPumpkins(i) },
      { id: 'sweets', keep: true, price: 650, label: 'Dulcería', icon: '🍯', pos: V(-1, -30.2), requires: ['pumpkins'], minLevel: 2, apply: (i) => this.buildSweets(i) },
      { id: 'pastry', keep: true, price: 1100, label: 'Pastelería', icon: '🎂', pos: V(10, -30.2), requires: ['shop2', 'cow'], minLevel: 2, apply: (i) => this.buildPastry(i) },
      { id: 'farmer4', price: 800, label: 'Granjera Juana', icon: '👩‍🌾', pos: V(-6, -28.5), requires: ['sweets'], minLevel: 2,
        apply: worker({ role: 'farmer', name: 'Juana', position: V(-6, -28.5), field: () => this.pumpkinField, unit: () => this.sweets }) },

      // ----- Mejoras por niveles -----
      { id: 'cap', repeat: true, max: 8, growth: 1.55, price: 30, label: 'Mochila', icon: '🎒', pos: V(-2, 7.5), requires: [],
        apply: () => { this.player.stack.capacity += 4; } },
      { id: 'speed', repeat: true, max: 6, growth: 1.6, price: 45, label: 'Botas', icon: '👟', pos: V(0.8, 7.5), requires: ['truck'],
        apply: () => { this.player.speed += 0.5; } },
      { id: 'helpers', repeat: true, max: 6, growth: 1.6, price: 120, label: 'Ayudantes', icon: '💪', pos: V(3.6, 7.5), requires: ['farmer'],
        apply: () => { this.workerBonus++; this.workers.forEach((w) => w.applyBonus()); } },
      { id: 'chickens', repeat: true, max: 6, growth: 1.5, price: 90, label: 'Gallinas', icon: '🐔', pos: V(7.6, -3.4), requires: ['farmer'],
        apply: (i) => { this.coop.addAnimals(1, i); this.coop.speedMult += 0.3; } },
      { id: 'cows', repeat: true, max: 5, growth: 1.5, price: 220, label: 'Vacas', icon: '🐮', pos: V(24.2, -2), requires: ['cow'],
        needs: () => !!this.barn, // se aplica recién cuando hay establo
        apply: (i) => { this.barn.addAnimals(1, i); this.barn.speedMult += 0.35; } },
      { id: 'grow', repeat: true, max: 6, growth: 1.6, price: 300, label: 'Fertilizante', icon: '🌱', pos: V(-15.5, 0.5), requires: ['tractor'],
        apply: () => { this.growBonus++; this.fields().forEach((f) => { f.growMult = 1 + 0.25 * this.growBonus; }); } },
      { id: 'oven', repeat: true, max: 6, growth: 1.6, price: 300, label: 'Hornos', icon: '🔥', pos: V(5, -26), requires: ['bakery'],
        apply: () => { this.ovenBonus++; this.processors().forEach((p) => { p.speedMult = 1 + 0.3 * this.ovenBonus; }); } },
    ];
  }

  fields() { return [this.field, this.wheatField, this.pumpkinField].filter(Boolean); }
  processors() { return [this.bakery, this.sweets, this.pastry].filter(Boolean); }

  maxLevel(def) { return def.max + 2 * (this.farmLevel - 1); }
  requirementsMet(def) {
    return (def.minLevel ?? 1) <= this.farmLevel && def.requires.every((r) => this.unlocked.includes(r));
  }

  priceOf(def) {
    const lvl = def.repeat ? this.upgrades[def.id] ?? 0 : 0;
    return niceRound(def.price * Math.pow(def.growth ?? 1, lvl) * this.priceMult);
  }

  /** ¿Se compraron todos los desbloqueos únicos de esta granja? */
  allDone() {
    return this.defs.filter((d) => !d.repeat && (d.minLevel ?? 1) <= this.farmLevel).every((d) => this.unlocked.includes(d.id));
  }

  // =====================================================================
  // PROGRESIÓN
  // =====================================================================
  refreshZones(instant = false) {
    for (const def of this.defs) {
      if (this.zones.has(def.id) || !this.requirementsMet(def)) continue;
      let label = def.label;
      if (def.repeat) {
        const lvl = this.upgrades[def.id] ?? 0;
        if (lvl >= this.maxLevel(def)) continue;
        label = `${def.label} Nv.${lvl + 1}`;
      } else if (this.unlocked.includes(def.id)) continue;
      this.zones.set(def.id, new UnlockZone(this.game, {
        position: def.pos, price: this.priceOf(def), label, icon: def.icon, instant,
        onComplete: () => this.unlock(def),
      }));
    }
    // Prestigio: mudarse a una granja más grande
    if (!this.zones.has('move') && this.allDone()) {
      this.zones.set('move', new UnlockZone(this.game, {
        position: V(-7.4, 8.9), price: niceRound(2500 * Math.pow(1.6, this.farmLevel - 1)),
        label: `Granja ${this.farmLevel + 1}`, icon: '🏡', instant, size: 2.8,
        onComplete: () => this.prestige(),
      }));
      if (!instant) {
        this.game.chatter?.say(this.player, '¡Se puede comprar una granja más grande! 🏡', 3.5);
      }
    }
  }

  /** Aplica los niveles de mejora comprados que todavía no tienen efecto (p. ej. tras mudarse de granja). */
  applyPendingUpgrades(instant) {
    for (const def of this.defs) {
      if (!def.repeat || (def.needs && !def.needs())) continue;
      const target = this.upgrades[def.id] ?? 0;
      while ((this.applied[def.id] ?? 0) < target) {
        def.apply(instant);
        this.applied[def.id] = (this.applied[def.id] ?? 0) + 1;
      }
    }
  }

  unlock(def) {
    this.zones.delete(def.id);
    if (def.repeat) {
      this.upgrades[def.id] = (this.upgrades[def.id] ?? 0) + 1;
    } else {
      this.unlocked.push(def.id);
      def.apply(false);
    }
    // Mejoras nuevas, o heredadas que ahora tienen dónde aplicarse (ej. Vacas al comprar el establo)
    this.applyPendingUpgrades(false);
    this.game.fx.floatText(`¡${def.label}!`, def.pos.clone().setY(2), '#ffe066');
    this.game.emit('unlock', { id: def.id });
    this.game.chatter?.playerSays('unlock');
    this.save();
    // La mejora reaparece (siguiente nivel) después del confeti
    this.game.fx.tween(0.7, null, () => this.refreshZones());
  }

  /**
   * Mudanza a la granja siguiente. Se conserva lo que produce (corrales, campos, talleres:
   * defs con `keep`) y todas las mejoras; se reinician la plata, el camión, el Almacén y los empleados.
   */
  prestige() {
    const next = this.farmLevel + 1;
    const kept = this.unlocked.filter((id) => this.defs.find((d) => d.id === id)?.keep);
    this.game.saveSystem.save({
      version: 2, farmLevel: next, money: 0, unlocked: kept, upgrades: this.upgrades,
      missions: this.game.missions?.serialize(),
    });
    this.resetting = true;
    this.game.showLevelUp(next);
  }

  save() {
    if (this.resetting) return;
    this.game.saveSystem.save({
      version: 2, farmLevel: this.farmLevel, money: this.game.money, unlocked: this.unlocked,
      upgrades: this.upgrades, missions: this.game.missions?.serialize(),
    });
  }

  // =====================================================================
  // CONSTRUCTORES
  // =====================================================================
  addField(opts) {
    const f = new ResourceNode(this.game, opts);
    f.growMult = 1 + 0.25 * (this.growBonus ?? 0);
    return f;
  }

  spawnWorker(opts) {
    const w = new WorkerAI(this.game, this, opts);
    this.workers.push(w);
    return w;
  }

  buildTruck() {
    this.truck = new Truck(this.game, { parkPos: V(-10, 16) });
    this.game.flags.truck = true;
  }

  buildBarn(instant) {
    this.barn = new ProductionUnit(this.game, {
      position: V(19, -8), inputType: 'corn', outputType: 'milk', animal: 'cow', animalCount: 2, house: 'barn',
      produceTime: CONFIG.barn.produceTime, feederMax: CONFIG.barn.feederMax, outputMax: CONFIG.barn.outputMax,
      outputPile: { cols: 3, rows: 2, spacing: [0.3, 0.3] }, floorColor: '#a9d46a',
      inputRoles: ['player', 'farmer'], outputRoles: ['player', 'carrier'],
    });
    this.game.flags.milk = true;
    if (!instant) {
      this.game.fx.popIn(this.barn.group);
      this.game.fx.burst(V(19, -8).setY(1));
    }
  }

  buildTractor(instant) {
    const binPos = V(-11, -0.4);
    const bin = createBin();
    bin.position.copy(binPos);
    this.scene.add(bin);
    this.game.obstacles.push({ minX: binPos.x - 1.0, maxX: binPos.x + 1.0, minZ: binPos.z - 0.7, maxZ: binPos.z + 0.7 });
    this.crate = new Pile(this.game, {
      position: binPos.clone().setY(0.1), type: 'corn', cols: 3, rows: 4, max: 36, spacing: [0.55, 0.3],
    });
    this.crateZone = new TransferZone(this.game, {
      position: binPos.clone().add(V(0, 1.75)), mode: 'pickup', target: this.crate, roles: ['player'],
    });
    this.tractor = new Tractor(this.game, { field: this.field, crate: this.crate, instant });
    if (!instant) this.game.fx.popIn(bin);
  }

  /** Abre la Zona Norte: corre el cerco, agrega tierra y el campo de trigo. */
  openNorth(instant) {
    this.bounds.minZ = NORTH_MIN_Z;
    this.buildFence();
    const b = this.bounds;
    const x0 = b.minX - 0.6;
    const x1 = b.maxX + 0.6;
    const z0 = NORTH_MIN_Z - 0.6;
    const z1 = CONFIG.bounds.minZ - 0.6;
    const yard = new THREE.Mesh(
      new THREE.PlaneGeometry(x1 - x0, z1 - z0 + 0.02),
      new THREE.MeshStandardMaterial({ map: this.makeDirtTexture((x1 - x0) / 8, (z1 - z0) / 8), roughness: 0.95 }),
    );
    yard.rotation.x = -Math.PI / 2;
    yard.position.set((x0 + x1) / 2, -0.016, (z0 + z1) / 2);
    yard.receiveShadow = true;
    this.scene.add(yard);
    this.wheatField = this.addField({ type: 'wheat', center: V(-12, -22.5), cols: 6, rows: 4, spacing: 1.5, growTime: 8 });
    this.game.flags.wheat = true;
    for (const [x, z] of [[22, -36], [23, -36.2], [-17.5, -36.5]]) {
      const h = createHayBale();
      h.position.set(x, 0, z);
      this.scene.add(h);
    }
    if (!instant) {
      this.game.fx.burst(V(-12, -22.5).setY(1), 40);
      this.game.chatter?.say(this.player, '¡Wow! ¡Cuánto lugar nuevo! 🌾', 3);
    }
  }

  buildBakery(instant) {
    this.bakery = new Processor(this.game, {
      position: V(-1, -24), recipe: { wheat: 1 }, output: 'bread', produceTime: 2.5, name: 'PANADERÍA',
      look: { wall: '#f5e6c8', roofColor: '#b5651d', awning: ['#ffffff', '#b5651d'] },
      inputRoles: ['player', 'farmer'], outputRoles: ['player', 'carrier'],
    });
    this.afterProcessor(this.bakery, instant);
    this.game.flags.bread = true;
  }

  buildSweets(instant) {
    this.sweets = new Processor(this.game, {
      position: V(-1, -33), recipe: { pumpkin: 1 }, output: 'jam', produceTime: 3, name: 'DULCERÍA',
      look: { wall: '#ffe0b3', roofColor: '#e8762b', awning: ['#ffffff', '#e8762b'] },
      inputRoles: ['player', 'farmer'], outputRoles: ['player', 'carrier'],
      outputPile: { spacing: [0.4, 0.4] },
    });
    this.afterProcessor(this.sweets, instant);
    this.game.flags.jam = true;
  }

  buildPastry(instant) {
    this.pastry = new Processor(this.game, {
      position: V(10, -33), recipe: { egg: 1, milk: 1, wheat: 1 }, output: 'cake', produceTime: 4, name: 'PASTELERÍA',
      look: { wall: '#ffe3ef', roofColor: '#ff7aa2', awning: ['#ffffff', '#ff7aa2'] },
      inputRoles: ['player'], outputRoles: ['player', 'carrier'], outputMax: 16,
      outputPile: { spacing: [0.48, 0.48] },
    });
    this.afterProcessor(this.pastry, instant);
    this.game.flags.cake = true;
  }

  afterProcessor(p, instant) {
    p.speedMult = 1 + 0.3 * this.ovenBonus;
    if (!instant) {
      this.game.fx.popIn(p.group);
      this.game.fx.burst(p.position.clone().setY(1.5), 36);
    }
  }

  buildShop2(instant) {
    this.shop2 = new Shop(this.game, {
      position: V(12, -22), name: 'ALMACÉN', spawnPoint: V(25.5, -18), exitPoint: V(25.5, -26), queueSize: 5, instant,
      products: [
        { type: 'bread', x: -1.15, max: 16, pile: { cols: 1, rows: 2, spacing: [0.5, 0.45] } },
        { type: 'jam', flag: 'jam', x: -0.4, max: 12, pile: { cols: 1, rows: 2, spacing: [0.4, 0.4] } },
        { type: 'cake', flag: 'cake', x: 0.4, max: 8, pile: { cols: 1, rows: 2, spacing: [0.5, 0.45] } },
      ],
    });
    this.game.flags.shop2 = true;
  }

  buildPumpkins(instant) {
    this.pumpkinField = this.addField({ type: 'pumpkin', center: V(-12, -32), cols: 5, rows: 3, spacing: 1.7, growTime: 9 });
    this.game.flags.pumpkin = true;
    if (!instant) this.game.fx.burst(V(-12, -32).setY(1), 36);
  }

  // =====================================================================
  // DECORACIÓN
  // =====================================================================
  /** Cerco perimetral; se reconstruye cuando se agranda el área (Zona Norte). */
  buildFence() {
    this.fence?.removeFromParent();
    const b = this.bounds;
    const fx0 = b.minX - 0.6;
    const fx1 = b.maxX + 0.6;
    const fz0 = b.minZ - 0.6;
    const fz1 = b.maxZ + 0.6;
    this.fence = new THREE.Group();
    this.fence.add(createFenceLine(fx0, fz0, fx1, fz0, 1.6));
    this.fence.add(createFenceLine(fx0, fz1, fx1, fz1, 1.6));
    this.fence.add(createFenceLine(fx0, fz0, fx0, fz1, 1.6));
    this.fence.add(createFenceLine(fx1, fz0, fx1, fz1, 1.6));
    this.scene.add(this.fence);
  }

  buildEnvironment() {
    const scene = this.scene;
    const b = this.bounds;
    const rnd = seeded(42);

    // Pasto (afuera del cerco)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), mat('#6cc24a'));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.03, -10);
    ground.receiveShadow = true;
    scene.add(ground);

    // Patio de tierra (adentro del cerco) con textura moteada
    const fx0 = b.minX - 0.6;
    const fx1 = b.maxX + 0.6;
    const fz0 = b.minZ - 0.6;
    const fz1 = b.maxZ + 0.6;
    const yardW = fx1 - fx0;
    const yardD = fz1 - fz0;
    const yardMat = new THREE.MeshStandardMaterial({ map: this.makeDirtTexture(yardW / 8, yardD / 8), roughness: 0.95 });
    const yard = new THREE.Mesh(new THREE.PlaneGeometry(yardW, yardD), yardMat);
    yard.rotation.x = -Math.PI / 2;
    yard.position.set((fx0 + fx1) / 2, -0.015, (fz0 + fz1) / 2);
    yard.receiveShadow = true;
    scene.add(yard);

    // Caminos más claros
    const path = (x, z, w, d) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), mat('#efcf95'));
      m.position.set(x, -0.005, z);
      m.receiveShadow = true;
      scene.add(m);
    };
    path(3, -1.6, 44, 2.4);
    path(-1, 6, 2.4, 13);
    path(-6, 11.6, 13, 2.2);

    // Ruta del camión con bordes y línea central
    const road = new THREE.Mesh(new THREE.BoxGeometry(220, 0.03, 3.6), mat('#5d6470'));
    road.position.set(0, -0.005, 16);
    road.receiveShadow = true;
    scene.add(road);
    for (const z of [14.35, 17.65]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(220, 0.035, 0.14), mat('#e8e8e8'));
      edge.position.set(0, 0, z);
      scene.add(edge);
    }
    for (let x = -70; x < 70; x += 4) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.035, 0.14), mat('#f6d55c'));
      line.position.set(x, 0, 16);
      scene.add(line);
    }

    this.buildFence();

    // Cartel de la granja
    const sign = createSign("Mela's Farm", `Granja ${this.farmLevel}`);
    sign.position.set(-5.2, 0, 5.2);
    sign.rotation.y = 0.25;
    scene.add(sign);
    this.game.obstacles.push({ minX: -6.6, maxX: -3.8, minZ: 4.9, maxZ: 5.5 });

    // Casa de la granja (al oeste, afuera del cerco)
    const house = createFarmhouse();
    house.position.set(-27, 0, -8);
    house.rotation.y = Math.PI / 2;
    scene.add(house);

    // Fardos de heno y zapallos decorativos
    const bale = (x, z, ry = 0, y = 0) => {
      const h = createHayBale();
      h.position.set(x, y, z);
      h.rotation.y = ry;
      scene.add(h);
    };
    bale(7.6, -12.6); bale(8.7, -12.5, 0.1); bale(8.1, -12.55, 0.05, 0.5);
    bale(-17.6, 10.2, Math.PI / 2); bale(-17.6, 11.3, Math.PI / 2);
    this.game.obstacles.push({ minX: 7, maxX: 9.3, minZ: -13, maxZ: -12.2 });
    for (const [x, z, s] of [[-17.3, -13.5, 1], [-16.6, -14.2, 0.8], [-6.5, -11.5, 0.9], [13.5, 11.5, 1], [14.3, 12.2, 0.8], [25, 12.6, 1]]) {
      const p = createPumpkin(s * 1.6);
      p.position.set(x, 0, z);
      p.rotation.y = rnd() * 6;
      scene.add(p);
    }

    // Zona reservada para la expansión norte (sin árboles)
    const nz0 = NORTH_MIN_Z - 2.6;
    const reserved = (x, z) => x > fx0 - 2 && x < fx1 + 2 && z > nz0 && z < fz1 + 2;

    // Árboles (verdes y otoñales), arbustos y rocas alrededor
    for (let i = 0; i < 130; i++) {
      const x = -48 + rnd() * 106;
      const z = -58 + rnd() * 88;
      const onRoad = Math.abs(z - 16) < 3;
      const nearHouse = Math.abs(x + 27) < 5 && Math.abs(z + 8) < 4.5;
      if (reserved(x, z) || onRoad || nearHouse) continue;
      const t = createTree(0.85 + rnd() * 0.7, rnd() < 0.35);
      t.position.set(x, 0, z);
      t.rotation.y = rnd() * 6;
      scene.add(t);
    }
    for (let i = 0; i < 40; i++) {
      const x = fx0 - 1.5 + rnd() * (yardW + 3);
      const z = rnd() < 0.5 ? nz0 - rnd() * 1.5 : 19 + rnd() * 3;
      const bsh = createBush(0.8 + rnd() * 0.6);
      bsh.position.set(x, 0, z);
      scene.add(bsh);
    }
    for (let i = 0; i < 25; i++) {
      const r = createRock(0.5 + rnd() * 0.8);
      r.position.x = -40 + rnd() * 90;
      r.position.z = -50 + rnd() * 78;
      if (Math.abs(r.position.z - 16) < 3 || reserved(r.position.x, r.position.z)) continue;
      r.rotation.y = rnd() * 6;
      scene.add(r);
    }

    // Matas de pasto y flores (instanciadas)
    const dummy = new THREE.Object3D();
    const tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(0.13, 0.4, 5), mat('#4fae35'), 700);
    const flowers = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.1, 8, 6),
      new THREE.MeshStandardMaterial({ roughness: 0.8 }),
      300,
    );
    const flowerColors = ['#ffffff', '#ffd166', '#ef476f', '#a29bfe', '#ff9f1c'].map((c) => new THREE.Color(c));
    let nt = 0;
    let nf = 0;
    for (let i = 0; i < 5000 && (nt < 700 || nf < 300); i++) {
      const x = -45 + rnd() * 100;
      const z = -55 + rnd() * 87;
      if (reserved(x, z) || Math.abs(z - 16) < 2.2) continue;
      dummy.position.set(x, 0.12, z);
      dummy.rotation.set(0, rnd() * 6, 0);
      const s = 0.7 + rnd() * 0.8;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      if (rnd() < 0.7 && nt < 700) {
        tufts.setMatrixAt(nt++, dummy.matrix);
      } else if (nf < 300) {
        flowers.setMatrixAt(nf, dummy.matrix);
        flowers.setColorAt(nf, flowerColors[Math.floor(rnd() * flowerColors.length)]);
        nf++;
      }
    }
    tufts.count = nt;
    flowers.count = nf;
    scene.add(tufts, flowers);
  }

  /** Textura de tierra moteada generada con canvas. */
  makeDirtTexture(repeatX, repeatY) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e2b46e';
    ctx.fillRect(0, 0, 256, 256);
    const rnd = seeded(7);
    for (let i = 0; i < 260; i++) {
      const x = rnd() * 256;
      const y = rnd() * 256;
      const r = 1 + rnd() * 2.5;
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(190,140,80,0.16)' : 'rgba(250,215,150,0.22)';
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.4, r, rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = 4;
    return tex;
  }
}
