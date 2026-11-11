// World: arma la granja de Mela y maneja toda la progresión:
//  - Desbloqueos únicos (camión, empleados, vacas, Zona Norte, talleres...) con `requires`.
//  - Mejoras por niveles (repeat): la baldosa reaparece con precio creciente.
//  - Granjas: al completar todo aparece "Granja N+1". Se conserva TODO (construcciones,
//    empleados, mejoras y plata) y cada granja suma contenido nuevo + ingresos ×1,5.
//    Granja 2: zapallar/dulcería/pastelería · 3: Zona Este (ovejas, tejeduría, feria)
//    4: frutillar/heladería · 5: manzanar/juguería
//    6: Zona Oeste (girasoles, aceitera, molino, facturería, mercado y panadero)
//    7: Los Cerros (pastizal, cabras, quesería, pizzería, parador y silo)
//    8: Las Flores (invernadero, colmenas, alfajorería y kiosco)
//    9: La Laguna (pesca, freiduría, rotisería y cantina)
//    10: Restaurante (mesas, cocina, mozo, propina) y la Fuente
//    11 a 20: ver world/Expansion.js (Zona Sur, La Chacra, Las Lomas, Las Sierras, La Costa,
//    hostería, tren, barco, boda...).
//    21+: se repiten los especiales (+20% cada uno).
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
import { CatAI } from '../entities/CatAI.js';
import { MatiasAI } from '../entities/MatiasAI.js';
import { Restaurant } from '../entities/Restaurant.js';
import { bakeGroup, batchStatic } from '../core/Bake.js';
import { Pile } from '../systems/Pile.js';
import { TransferZone } from '../systems/TransferZone.js';
import {
  mat, createTree, createBush, createRock, createFenceLine, createFarmhouse, createBin,
  createHayBale, createPumpkin, createSign,
  createWindmill, createSilo, createGreenhouse, createPond, createFountain, createDesk, createDuck,
} from '../models/Models.js';
import { CONFIG } from '../config.js';
import { seeded } from '../utils.js';
import { ExpansionMixin, SPECIALS_EXTRA, GERENCIAS_EXTRA, NEW_CONTENT } from './Expansion.js';

const V = (x, z) => new THREE.Vector3(x, 0, z);
const NORTH_MIN_Z = -38;
const EAST_MAX_X = 52;
const WEST_MIN_X = -46;
const HILLS_MIN_Z = -56; // Granja 7: Los Cerros (al norte de la Zona Norte)
const FLORES_MAX_X = 72; // Granja 8: Las Flores (al este de la Zona Este, de punta a punta)
const LAKE_MIN_Z = -70; // Granja 9: La Laguna (al norte de Los Cerros, de punta a punta)

/**
 * Construcciones especiales de Granja 6 en adelante (una por granja, en orden).
 * El Molino (Granja 6) es un taller de verdad (🌾🌾 → 🥣) en la Zona Oeste, el Silo (Granja 7)
 * agranda comederos y pallets en Los Cerros y el Invernadero (Granja 8) cultiva flores 🌷 para
 * las colmenas de Las Flores, la Laguna (Granja 9) da pescado y la Fuente (Granja 10) atrae
 * más comensales al Restaurante; la segunda ronda (Granja 11+) es sólo +20%.
 */
const SPECIALS = [
  { name: 'Molino', icon: '🌬️', model: createWindmill, pos: V(-24.5, -33) },
  { name: 'Silo', icon: '🏗️', model: createSilo, pos: V(32, -51) },
  { name: 'Invernadero', icon: '🌷', model: createGreenhouse, pos: V(62, -38) },
  { name: 'Laguna', icon: '🦆', model: createPond, pos: V(24, -64.5) },
  { name: 'Fuente', icon: '⛲', model: createFountain, pos: V(-24, -53) },
];

/** Todos los especiales en orden (Granja 6 = índice 0). Desde la Granja 21 se repiten. */
const ALL_SPECIALS = [...SPECIALS, ...SPECIALS_EXTRA];

/**
 * Ingresos base de una granja: +0,5 por granja hasta la 10 y +0,75 desde la 11
 * (los precios suben más despacio desde la 11: ver priceMultFor).
 */
export const incomeFor = (level) => 1 + 0.5 * Math.min(level - 1, 9) + 0.75 * Math.max(0, level - 10);
/** Multiplicador de precios: ×1,3 por granja hasta la 10 y ×1,15 desde la 11. */
export const priceMultFor = (level) => Math.pow(1.3, Math.min(level, 10) - 1) * Math.pow(1.15, Math.max(0, level - 10));
/** Precio de mudarse a la granja siguiente: ×1,6 por granja hasta la 10 y ×1,35 desde la 11. */
export const movePriceFor = (level) => 2500 * Math.pow(1.6, Math.min(level, 10) - 1) * Math.pow(1.35, Math.max(0, level - 10));

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
    this.specialBonus = 0; // +0,2 por cada construcción especial
    this.updateIncome();
    this.priceMult = priceMultFor(this.farmLevel);
    this.workerBonus = 0;
    this.growBonus = 0;
    this.ovenBonus = 0;
    this.westDecor = []; // árboles/rocas/pasto que se sacan al abrir la Zona Oeste
    this.hillsDecor = []; // ídem para Los Cerros (Granja 7)
    this.floresDecor = []; // ídem para Las Flores (Granja 8)
    this.lakeDecor = []; // ídem para La Laguna (Granja 9)
    this.rodBonus = 0; // mejora Cañas: la orilla de pesca rinde más rápido
    this.storageMult = 1; // el Silo agranda comederos y pallets de los corrales
    this.irrigation = 0; // Tanque australiano (Granja 13): +30% en todos los campos
    // Decoración de las zonas de las Granjas 11 a 20 (se saca al abrir cada zona)
    this.extraDecor = { sur: [], chacra: [], lomas: [], sierras: [], costa: [] };

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
      look: { wall: '#fff3e0', trim: '#d9473b', awning: ['#ffffff', '#e8503f'] },
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
    this.sheep = this.knit = this.icecream = this.juicery = this.shop3 = null;
    this.berryField = this.appleField = null;
    this.sunflowerField = this.mill = this.oilery = this.facturas = this.shop4 = null;
    this.grassField = this.goats = this.queseria = this.pizzeria = this.shop5 = this.silo = null;
    this.flowerField = this.hives = this.alfajoreria = this.shop6 = null;
    this.fishField = this.freiduria = this.rotiseria = this.shop7 = null;
    this.restaurant = null;
    // Granjas 11 a 20
    this.yerbaField = this.secadero = this.shop8 = this.train = null;
    this.caneField = this.ingenio = this.dulceria = null;
    this.tomatoField = this.pastas = null;
    this.potreroField = this.novillos = this.carniceria = this.parrilla = this.shop9 = null;
    this.lavadero = this.hostel = this.cottonField = null;
    this.pineField = this.aserradero = this.carpinteria = null;
    this.grapeField = this.bodega = this.shop10 = null;
    this.ship = this.deposit = null;
    this.peanutField = this.chocolateria = this.shop11 = null;
    this.wedding = null;
    this.eastOpen = this.westOpen = this.hillsOpen = this.floresOpen = this.lakeOpen = false;
    this.workers = [];
    this.cats = [];
    this.matias = null;

    this.defineUnlocks();

    // ---------- Restaurar partida ----------
    this.unlocked = [];
    this.upgrades = {};
    this.zones = new Map();
    const ups = { ...(saved?.upgrades ?? {}) };
    // Migración de partidas viejas (mejoras únicas → niveles)
    const MIGRATE = { cap1: 'cap', cap2: 'cap', cap3: 'cap', speed1: 'speed', speed2: 'speed', chickens: 'chickens', cows: 'cows', growth: 'grow' };
    // El Molino (special0) ahora vive en la Zona Oeste: quien ya lo tenía recibe la zona.
    const savedUnlocked = [...(saved?.unlocked ?? [])];
    const mi = savedUnlocked.indexOf('special0');
    if (mi >= 0 && !savedUnlocked.includes('west')) savedUnlocked.splice(mi, 0, 'west');
    // Ídem el Silo (special1): ahora está en Los Cerros, así que quien lo tenía recibe la zona.
    const si = savedUnlocked.indexOf('special1');
    if (si >= 0 && !savedUnlocked.includes('hills')) savedUnlocked.splice(si, 0, 'hills');
    // Ídem el Invernadero (special2): ahora cultiva flores en Las Flores.
    const gi = savedUnlocked.indexOf('special2');
    if (gi >= 0 && !savedUnlocked.includes('flores')) savedUnlocked.splice(gi, 0, 'flores');
    // Ídem la Laguna (special3): ahora da pescado en La Laguna.
    const li = savedUnlocked.indexOf('special3');
    if (li >= 0 && !savedUnlocked.includes('laguna')) savedUnlocked.splice(li, 0, 'laguna');
    // Ídem la Fuente (special4): ahora está en la plaza del Restaurante.
    const fi = savedUnlocked.indexOf('special4');
    if (fi >= 0 && !savedUnlocked.includes('restaurant')) savedUnlocked.splice(fi, 0, 'restaurant');
    // Desde la Granja 11 los especiales son construcciones nuevas (Estación, Caballeriza...):
    // quien ya los tenía de partidas viejas recibe antes lo que necesitan (su zona, la hostería...).
    const withReqs = (id, out) => {
      if (out.includes(id)) return;
      const def = this.defs.find((d) => d.id === id && !d.repeat);
      for (const r of def?.requires ?? []) if (!savedUnlocked.includes(r)) withReqs(r, out);
      out.push(id);
    };
    const ordered = [];
    for (const id of savedUnlocked) {
      if (/^special([5-9]|1[0-4])$/.test(id)) withReqs(id, ordered);
      else if (!ordered.includes(id)) ordered.push(id);
    }
    savedUnlocked.splice(0, savedUnlocked.length, ...ordered);
    for (const id of savedUnlocked) {
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

    // Los gatos de la granja (siempre presentes, viven en los mostradores)
    this.cats = [new CatAI(game, this, 'pitanga'), new CatAI(game, this, 'odin')];
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
      { id: 'matias', price: 250, label: 'Administrador Matías', icon: '👨‍💼', pos: V(19.5, 1.4), requires: ['cashier'],
        apply: (i) => this.hireMatias(i) },
      { id: 'cow', price: 180, label: 'Vacas', icon: '🐄', pos: V(19, -2), requires: ['cashier'], apply: (i) => this.buildBarn(i) },
      // Camionero: carga solo los pedidos del camión (caro, porque el camión rinde mucho)
      { id: 'trucker', price: 1500, label: 'Camionero Ramón', icon: '🚛', pos: V(-14.6, 9.4), requires: ['truck', 'cow'],
        apply: worker({ role: 'trucker', name: 'Ramón', position: V(-14.6, 9.4) }) },
      { id: 'carrier', price: 150, label: 'Repartidor Lucho', icon: '🧺', pos: V(2, -0.8), requires: ['cow'],
        apply: worker({ role: 'carrier', name: 'Lucho', position: V(2, -0.8), sources: () => [this.coop, this.barn], shop: () => this.shop }) },
      { id: 'tractor', price: 260, label: 'Tractor', icon: '🚜', pos: V(-15.5, 0.5), requires: ['cow'], apply: (i) => this.buildTractor(i) },
      { id: 'farmer2', price: 240, label: 'Granjera Rosa', icon: '👩‍🌾', pos: V(-5.5, -1.5), requires: ['farmer', 'cow'],
        apply: worker({ role: 'farmer', name: 'Rosa', position: V(-5.5, -1.5), field: () => this.field, unit: () => this.barn }) },

      // ----- Zona Norte: trigo, panadería y almacén -----
      { id: 'north', price: 500, label: 'Zona Norte', icon: '🌾', pos: V(13, -14.6), requires: ['cow'], apply: (i) => this.openNorth(i) },
      { id: 'bakery', price: 350, label: 'Panadería', icon: '🍞', pos: V(-1, -21.2), requires: ['north'], apply: (i) => this.buildBakery(i) },
      { id: 'shop2', price: 300, label: 'Almacén', icon: '🏪', pos: V(12, -19.5), requires: ['bakery'], apply: (i) => this.buildShop2(i) },
      { id: 'farmer3', price: 420, label: 'Granjero Beto', icon: '👨‍🌾', pos: V(-6, -19), requires: ['bakery'],
        apply: worker({ role: 'farmer', name: 'Beto', position: V(-6, -19), field: () => this.wheatField, unit: () => this.bakery }) },
      { id: 'cashier2', price: 400, label: 'Cajera Sol', icon: '🧑‍💼', pos: V(16.5, -24.5), requires: ['shop2'],
        apply: worker({ role: 'cashier', name: 'Sol', position: V(16.5, -24.5), shop: () => this.shop2 }) },
      { id: 'carrier2', price: 480, label: 'Repartidor Nico', icon: '🧺', pos: V(5, -19.5), requires: ['shop2'],
        apply: worker({ role: 'carrier', name: 'Nico', position: V(5, -19.5), sources: () => [this.bakery, this.sweets, this.pastry], shop: () => this.shop2 }) },

      // ----- Granja 2 en adelante: zapallos, dulcería y pastelería -----
      { id: 'pumpkins', price: 700, label: 'Zapallar', icon: '🎃', pos: V(-12, -32), requires: ['north'], minLevel: 2, apply: (i) => this.buildPumpkins(i) },
      { id: 'sweets', price: 650, label: 'Dulcería', icon: '🥫', pos: V(-1, -30.2), requires: ['pumpkins'], minLevel: 2, apply: (i) => this.buildSweets(i) },
      { id: 'pastry', price: 1100, label: 'Pastelería', icon: '🎂', pos: V(10, -30.2), requires: ['shop2', 'cow'], minLevel: 2, apply: (i) => this.buildPastry(i) },
      { id: 'farmer4', price: 800, label: 'Granjera Juana', icon: '👩‍🌾', pos: V(-6, -28.5), requires: ['sweets'], minLevel: 2,
        apply: worker({ role: 'farmer', name: 'Juana', position: V(-6, -28.5), field: () => this.pumpkinField, unit: () => this.sweets }) },
      // Pastelera: junta 🥚 + 🥛 + 🌾 para la Pastelería (si no, sólo la podía abastecer Mela)
      { id: 'baker0', price: 1600, label: 'Pastelera Dora', icon: '👩‍🍳', pos: V(15.8, -31), requires: ['pastry'], minLevel: 2,
        apply: worker({ role: 'baker', name: 'Dora', position: V(15.8, -31), targets: () => [this.pastry] }) },

      // ----- Granja 3: Zona Este (ovejas, tejeduría y feria) -----
      { id: 'east', price: 1500, label: 'Zona Este', icon: '🐑', pos: V(24.6, -13), requires: ['north'], minLevel: 3, apply: (i) => this.openEast(i) },
      { id: 'sheep', price: 1200, label: 'Ovejas', icon: '🐑', pos: V(34, -12), requires: ['east'], minLevel: 3, apply: (i) => this.buildSheep(i) },
      { id: 'knit', price: 1400, label: 'Tejeduría', icon: '🧣', pos: V(45, -10.2), requires: ['sheep'], minLevel: 3, apply: (i) => this.buildKnit(i) },
      { id: 'shop3', price: 1000, label: 'Feria', icon: '🎪', pos: V(44, 8.5), requires: ['knit'], minLevel: 3, apply: (i) => this.buildShop3(i) },
      { id: 'farmer5', price: 1300, label: 'Pastor Pancho', icon: '🧑‍🌾', pos: V(40, -6.5), requires: ['sheep'], minLevel: 3,
        apply: worker({ role: 'farmer', name: 'Pancho', position: V(40, -6.5), field: () => this.field, unit: () => this.sheep,
          errand: () => ({ type: 'wool', from: this.sheep, to: this.knit }) }) },
      { id: 'cashier3', price: 1200, label: 'Cajera Lola', icon: '🧑‍💼', pos: V(48.6, 3.4), requires: ['shop3'], minLevel: 3,
        apply: worker({ role: 'cashier', name: 'Lola', position: V(48.6, 3.4), shop: () => this.shop3 }) },
      { id: 'carrier3', price: 1400, label: 'Repartidor Mateo', icon: '🧺', pos: V(40, 1.6), requires: ['shop3'], minLevel: 3,
        apply: worker({ role: 'carrier', name: 'Mateo', position: V(40, 1.6), sources: () => [this.knit, this.icecream, this.juicery], shop: () => this.shop3 }) },

      // ----- Granja 4: frutillar y heladería -----
      { id: 'berries', price: 2500, label: 'Frutillar', icon: '🍓', pos: V(33, 4), requires: ['east'], minLevel: 4, apply: (i) => this.buildBerries(i) },
      { id: 'icecream', price: 3000, label: 'Heladería', icon: '🍦', pos: V(45, -0.4), requires: ['berries', 'cow'], minLevel: 4, apply: (i) => this.buildIceCream(i) },
      { id: 'farmer6', price: 2600, label: 'Granjera Ana', icon: '👩‍🌾', pos: V(39.6, -1.8), requires: ['icecream'], minLevel: 4,
        apply: worker({ role: 'farmer', name: 'Ana', position: V(39.6, -1.8), field: () => this.berryField, unit: () => this.icecream,
          errand: () => ({ type: 'milk', from: this.barn, to: this.icecream }) }) },

      // ----- Granja 5: manzanar y juguería -----
      { id: 'apples', price: 4000, label: 'Manzanar', icon: '🍎', pos: V(34, -30), requires: ['east'], minLevel: 5, apply: (i) => this.buildApples(i) },
      { id: 'juicery', price: 4500, label: 'Juguería', icon: '🧃', pos: V(45, -28.2), requires: ['apples'], minLevel: 5, apply: (i) => this.buildJuicery(i) },
      { id: 'farmer7', price: 4200, label: 'Granjero Toto', icon: '👨‍🌾', pos: V(40, -24.5), requires: ['juicery'], minLevel: 5,
        apply: worker({ role: 'farmer', name: 'Toto', position: V(40, -24.5), field: () => this.appleField, unit: () => this.juicery }) },

      // ----- Granja 6: Zona Oeste (girasoles, aceitera, molino, facturería y mercado) -----
      // Cadena larga a propósito: 🌾🌾 → 🥣 y 🌻🌻🌻 → 🧴, y la Facturería pide 🥣 + 🧴 + 🥚.
      { id: 'west', price: 5000, label: 'Zona Oeste', icon: '🌻', pos: V(-17.4, -4), requires: ['east'], minLevel: 6, apply: (i) => this.openWest(i) },
      { id: 'sunflowers', price: 4500, label: 'Girasoles', icon: '🌻', pos: V(-34, -27), requires: ['west'], minLevel: 6, apply: (i) => this.buildSunflowers(i) },
      { id: 'oilery', price: 5500, label: 'Aceitera', icon: '🧴', pos: V(-40.5, -14.2), requires: ['sunflowers'], minLevel: 6, apply: (i) => this.buildOilery(i) },
      { id: 'farmer8', price: 5000, label: 'Granjera Chela', icon: '👩‍🌾', pos: V(-34, -21.6), requires: ['oilery'], minLevel: 6,
        apply: worker({ role: 'farmer', name: 'Chela', position: V(-34, -21.6), field: () => this.sunflowerField, unit: () => this.oilery }) },
      { id: 'farmer9', price: 5000, label: 'Molinero Facu', icon: '👨‍🌾', pos: V(-20.8, -27), requires: ['special0'], minLevel: 6,
        apply: worker({ role: 'farmer', name: 'Facu', position: V(-20.8, -27), field: () => this.wheatField, unit: () => this.mill }) },
      { id: 'facturas', price: 9000, label: 'Facturería', icon: '🥐', pos: V(-24, -15.2), requires: ['oilery', 'special0'], minLevel: 6,
        apply: (i) => this.buildFacturas(i) },
      { id: 'shop4', price: 7000, label: 'Mercado', icon: '🧺', pos: V(-37, 5.6), requires: ['oilery'], minLevel: 6, apply: (i) => this.buildShop4(i) },
      { id: 'cashier4', price: 6500, label: 'Cajera Mirta', icon: '🧑‍💼', pos: V(-33, 0.6), requires: ['shop4'], minLevel: 6,
        apply: worker({ role: 'cashier', name: 'Mirta', position: V(-33, 0.6), shop: () => this.shop4 }) },
      { id: 'carrier4', price: 7500, label: 'Repartidor Rulo', icon: '🧺', pos: V(-30.5, 3), requires: ['shop4'], minLevel: 6,
        apply: worker({ role: 'carrier', name: 'Rulo', position: V(-30.5, 3), sources: () => [this.oilery, this.facturas], shop: () => this.shop4 }) },
      { id: 'baker', price: 12000, label: 'Panadero Julio', icon: '👨‍🍳', pos: V(-20.8, -12.5), requires: ['facturas', 'carrier4'], minLevel: 6,
        apply: worker({ role: 'baker', name: 'Julio', position: V(-20.8, -12.5), targets: () => [this.facturas, this.pastry] }) },

      // ----- Granja 7: Los Cerros (pastizal, cabras, quesería, pizzería y parador) -----
      // 🌿 → 🐐 → 🍶🍶 → 🧀, y la Pizzería junta 🥣 (Molino) + 🧀 + 🧴 (Aceitera): la cadena más larga.
      { id: 'hills', price: 6000, label: 'Los Cerros', icon: '🐐', pos: V(4.5, -36.6), requires: ['west'], minLevel: 7, apply: (i) => this.openHills(i) },
      { id: 'pasture', price: 5000, label: 'Pastizal', icon: '🌿', pos: V(-4, -48), requires: ['hills'], minLevel: 7, apply: (i) => this.buildPasture(i) },
      { id: 'goats', price: 7000, label: 'Cabras', icon: '🐐', pos: V(8, -50), requires: ['pasture'], minLevel: 7, apply: (i) => this.buildGoats(i) },
      { id: 'farmer10', price: 6000, label: 'Pastora Nina', icon: '👩‍🌾', pos: V(2.4, -43.8), requires: ['goats'], minLevel: 7,
        apply: worker({ role: 'farmer', name: 'Nina', position: V(2.4, -43.8), field: () => this.grassField, unit: () => this.goats,
          errand: () => ({ type: 'goatmilk', from: this.goats, to: this.queseria }) }) },
      { id: 'queseria', price: 8500, label: 'Quesería', icon: '🧀', pos: V(20, -45.2), requires: ['goats'], minLevel: 7, apply: (i) => this.buildQueseria(i) },
      { id: 'shop5', price: 8000, label: 'Parador', icon: '🏪', pos: V(-17, -44.4), requires: ['queseria'], minLevel: 7, apply: (i) => this.buildShop5(i) },
      { id: 'cashier5', price: 7500, label: 'Cajero Coco', icon: '🧑‍💼', pos: V(-13, -49.4), requires: ['shop5'], minLevel: 7,
        apply: worker({ role: 'cashier', name: 'Coco', position: V(-13, -49.4), shop: () => this.shop5 }) },
      { id: 'carrier5', price: 8500, label: 'Repartidora Lali', icon: '🧺', pos: V(-10.6, -45.2), requires: ['shop5'], minLevel: 7,
        apply: worker({ role: 'carrier', name: 'Lali', position: V(-10.6, -45.2), sources: () => [this.queseria, this.pizzeria], shop: () => this.shop5 }) },
      { id: 'pizzeria', price: 12000, label: 'Pizzería', icon: '🍕', pos: V(-30, -45.2), requires: ['queseria', 'oilery', 'special0'], minLevel: 7,
        apply: (i) => this.buildPizzeria(i) },
      { id: 'baker2', price: 15000, label: 'Pizzero Tano', icon: '👨‍🍳', pos: V(-24.4, -43.6), requires: ['pizzeria', 'carrier5'], minLevel: 7,
        apply: worker({ role: 'baker', name: 'Tano', position: V(-24.4, -43.6), targets: () => [this.pizzeria, this.queseria] }) },

      // ----- Granja 8: Las Flores (invernadero, colmenas, alfajorería y kiosco) -----
      // 🌷 (Invernadero) → 🐝 → 🍯, y la Alfajorería junta 🥣 (Molino) + 🍯 + 🥛 (establo): todo lejos.
      { id: 'flores', price: 7000, label: 'Las Flores', icon: '🌷', pos: V(50.2, -20.5), requires: ['hills'], minLevel: 8, apply: (i) => this.openFlores(i) },
      { id: 'hives', price: 8000, label: 'Colmenas', icon: '🐝', pos: V(62, -26), requires: ['special2'], minLevel: 8, apply: (i) => this.buildHives(i) },
      { id: 'farmer11', price: 7000, label: 'Apicultor Lucio', icon: '🧑‍🌾', pos: V(55.6, -30.6), requires: ['hives'], minLevel: 8,
        apply: worker({ role: 'farmer', name: 'Lucio', position: V(55.6, -30.6), field: () => this.flowerField, unit: () => this.hives,
          errand: () => ({ type: 'honey', from: this.hives, to: this.alfajoreria }) }) },
      { id: 'alfajoreria', price: 10000, label: 'Alfajorería', icon: '🍪', pos: V(62, -9.2), requires: ['hives', 'special0'], minLevel: 8,
        apply: (i) => this.buildAlfajoreria(i) },
      { id: 'shop6', price: 9000, label: 'Kiosco', icon: '🏪', pos: V(62, 5.6), requires: ['hives'], minLevel: 8, apply: (i) => this.buildShop6(i) },
      { id: 'cashier6', price: 8500, label: 'Cajera Male', icon: '🧑‍💼', pos: V(66.4, 0.4), requires: ['shop6'], minLevel: 8,
        apply: worker({ role: 'cashier', name: 'Male', position: V(66.4, 0.4), shop: () => this.shop6 }) },
      { id: 'carrier6', price: 9500, label: 'Repartidor Tomi', icon: '🧺', pos: V(55.4, 2.4), requires: ['shop6'], minLevel: 8,
        apply: worker({ role: 'carrier', name: 'Tomi', position: V(55.4, 2.4), sources: () => [this.alfajoreria, this.hives], shop: () => this.shop6 }) },
      { id: 'baker3', price: 16000, label: 'Alfajorero Gringo', icon: '👨‍🍳', pos: V(55.8, -10), requires: ['alfajoreria', 'carrier6'], minLevel: 8,
        apply: worker({ role: 'baker', name: 'Gringo', position: V(55.8, -10), targets: () => [this.alfajoreria] }) },

      // ----- Granja 9: La Laguna (pesca, freiduría, rotisería y cantina) -----
      // 🐟 sale de la orilla de la Laguna; 🐟🐟 + 🥚 → 🍤 (rebozado) y 🐟 + 🥣 → 🥟 (harina del Molino).
      { id: 'laguna', price: 8000, label: 'La Laguna', icon: '🦆', pos: V(44, -53.8), requires: ['flores'], minLevel: 9, apply: (i) => this.openLake(i) },
      { id: 'freiduria', price: 11000, label: 'Freiduría', icon: '🍤', pos: V(38, -60.2), requires: ['special3'], minLevel: 9, apply: (i) => this.buildFreiduria(i) },
      { id: 'farmer12', price: 8000, label: 'Pescador Cacho', icon: '🎣', pos: V(16.6, -57.2), requires: ['freiduria'], minLevel: 9,
        apply: worker({ role: 'farmer', name: 'Cacho', position: V(16.6, -57.2), field: () => this.fishField, unit: () => this.freiduria }) },
      { id: 'rotiseria', price: 12000, label: 'Rotisería', icon: '🥟', pos: V(48, -60.2), requires: ['freiduria', 'special0'], minLevel: 9,
        apply: (i) => this.buildRotiseria(i) },
      { id: 'shop7', price: 10000, label: 'Cantina', icon: '🏪', pos: V(60, -57.4), requires: ['freiduria'], minLevel: 9, apply: (i) => this.buildShop7(i) },
      { id: 'cashier7', price: 9500, label: 'Cajera Nelly', icon: '🧑‍💼', pos: V(64.4, -62.4), requires: ['shop7'], minLevel: 9,
        apply: worker({ role: 'cashier', name: 'Nelly', position: V(64.4, -62.4), shop: () => this.shop7 }) },
      { id: 'carrier7', price: 10500, label: 'Repartidor Juanchi', icon: '🧺', pos: V(54.2, -63.4), requires: ['shop7'], minLevel: 9,
        apply: worker({ role: 'carrier', name: 'Juanchi', position: V(54.2, -63.4), sources: () => [this.freiduria, this.rotiseria], shop: () => this.shop7 }) },
      { id: 'baker4', price: 18000, label: 'Cocinera Rosita', icon: '👩‍🍳', pos: V(43, -57.6), requires: ['rotiseria', 'carrier7'], minLevel: 9,
        apply: worker({ role: 'baker', name: 'Rosita', position: V(43, -57.6), targets: () => [this.rotiseria, this.freiduria] }) },

      // ----- Granja 10: el Restaurante (comensales en mesas, cocina, mozo y propina) -----
      // Platos: 🥞 (🥐 + 🥛), 🥪 (🍞 + 🧀), 🍲 (🐟 + 🎃), 🍨 (🎂 + 🍦): depende de toda la granja.
      { id: 'restaurant', price: 14000, label: 'Restaurante', icon: '🍽️', pos: V(-37, -61.2), requires: ['laguna'], minLevel: 10,
        apply: (i) => this.buildRestaurant(i) },
      { id: 'waiter', price: 13000, label: 'Mozo Pipo', icon: '🤵', pos: V(-27.6, -56.8), requires: ['restaurant'], minLevel: 10,
        apply: worker({ role: 'waiter', name: 'Pipo', position: V(-27.6, -56.8) }) },
      { id: 'baker5', price: 16000, label: 'Ayudante Fito', icon: '🧑‍🍳', pos: V(-44.2, -57.2), requires: ['restaurant'], minLevel: 10,
        apply: worker({ role: 'baker', name: 'Fito', position: V(-44.2, -57.2), targets: () => [this.restaurant] }) },

      // ----- Granjas 11 a 20 (world/Expansion.js) -----
      ...this.expansionDefs(),

      // ----- Granja 6 en adelante: una construcción especial por granja (Molino, Silo, ...) -----
      ...this.specialDefs(),

      // ----- Mejoras de Matías (las lee MatiasAI / game.saleMult) -----
      { id: 'collect', repeat: true, max: 5, growth: 1.7, price: 300, label: 'Cobranza', icon: '💼', pos: V(15.4, -0.4), requires: ['matias'],
        apply: () => {} },
      { id: 'accounting', repeat: true, max: 5, growth: 1.8, price: 400, label: 'Contabilidad', icon: '📊', pos: V(22.4, 1.8), requires: ['matias'],
        apply: () => {} },
      { id: 'helpme', repeat: true, max: 5, growth: 1.6, price: 250, label: 'Ayuda de Matías', icon: '🤝', pos: V(22.4, 4.7), requires: ['matias'],
        apply: () => {} },

      // ----- Gerencia: un negocio por baldosa, 3 niveles caros (ver BUSINESSES / applyGerencia) -----
      ...this.gerenciaDefs(),

      // ----- Mejoras por niveles -----
      { id: 'cap', repeat: true, max: 8, growth: 1.55, price: 30, label: 'Mochila', icon: '🎒', pos: V(-2, 7.5), requires: [],
        apply: () => { this.player.stack.capacity += 4; } },
      { id: 'speed', repeat: true, fixedMax: true, max: 10, growth: 1.6, price: 45, label: 'Botas', icon: '👟', pos: V(0.8, 7.5), requires: ['truck'],
        apply: () => { this.player.speed += 0.5; } },
      { id: 'helpers', repeat: true, max: 6, growth: 1.6, price: 120, label: 'Ayudantes', icon: '💪', pos: V(3.6, 7.5), requires: ['farmer'],
        apply: () => { this.workerBonus++; this.workers.forEach((w) => w.applyBonus()); } },
      { id: 'chickens', repeat: true, max: 6, growth: 1.5, price: 90, label: 'Gallinas', icon: '🐔', pos: V(7.6, -3.4), requires: ['farmer'],
        apply: (i) => { this.coop.addAnimals(1, i); this.coop.speedMult += 0.3; } },
      { id: 'cows', repeat: true, max: 5, growth: 1.5, price: 220, label: 'Vacas', icon: '🐮', pos: V(24.2, -2), requires: ['cow'],
        needs: () => !!this.barn, // se aplica recién cuando hay establo
        apply: (i) => { this.barn.addAnimals(1, i); this.barn.speedMult += 0.35; } },
      { id: 'grow', repeat: true, max: 6, growth: 1.6, price: 300, label: 'Fertilizante', icon: '🌱', pos: V(-15.5, 0.5), requires: ['tractor'],
        apply: () => { this.growBonus++; this.fields().forEach((f) => { f.growMult = this.fieldGrow(f); }); } },
      { id: 'goatsUp', repeat: true, max: 5, growth: 1.5, price: 2500, label: 'Cabritas', icon: '🐐', pos: V(14.2, -44.4), requires: ['goats'], minLevel: 7,
        needs: () => !!this.goats,
        apply: (i) => { this.goats.addAnimals(1, i); this.goats.speedMult += 0.3; } },
      { id: 'hivesUp', repeat: true, max: 5, growth: 1.5, price: 3000, label: 'Abejas', icon: '🐝', pos: V(68.2, -21.2), requires: ['hives'], minLevel: 8,
        needs: () => !!this.hives,
        apply: (i) => { this.hives.addAnimals(2, i); this.hives.speedMult += 0.3; } },
      { id: 'rods', repeat: true, max: 5, growth: 1.5, price: 3500, label: 'Cañas', icon: '🎣', pos: V(31.6, -57.4), requires: ['special3'], minLevel: 9,
        apply: () => { this.rodBonus++; this.fields().forEach((f) => { f.growMult = this.fieldGrow(f); }); } },
      { id: 'tables', repeat: true, fixedMax: true, max: 2, growth: 2.2, price: 6000, label: 'Más mesas', icon: '🪑', pos: V(-13.4, -57.2),
        requires: ['restaurant'], minLevel: 10, needs: () => !!this.restaurant,
        levelLabels: ['Más mesas (6)', 'Más mesas (8)'],
        apply: (i) => this.restaurant.addTables(2, i) },
      { id: 'oven', repeat: true, max: 6, growth: 1.6, price: 300, label: 'Hornos', icon: '🔥', pos: V(5, -26), requires: ['bakery'],
        apply: () => {
          this.ovenBonus++;
          [...this.processors(), this.restaurant].filter(Boolean).forEach((p) => { p.speedMult = this.procSpeed(p); });
        } },
    ];
  }

  /** Una construcción especial por cada granja desde la 6 (+20% de ingresos cada una). */
  specialDefs() {
    const defs = [];
    for (let lvl = 6; lvl <= this.farmLevel; lvl++) {
      const k = lvl - 6;
      const s = ALL_SPECIALS[k % ALL_SPECIALS.length];
      const round = Math.floor(k / ALL_SPECIALS.length);
      if (k >= 5 && k < ALL_SPECIALS.length) {
        defs.push(this.expansionSpecialDef(k, lvl));
        continue;
      }
      if (k === 0) {
        defs.push({
          id: 'special0', price: 6000, minLevel: lvl, requires: ['west'], label: s.name, icon: s.icon,
          pos: V(s.pos.x, s.pos.z + 2.8), apply: (i) => this.buildMill(i),
        });
        continue;
      }
      if (k === 4) {
        // La Fuente: plaza del Restaurante, atrae más comensales
        defs.push({
          id: 'special4', price: 23050, minLevel: lvl, requires: ['restaurant'], label: s.name, icon: s.icon,
          pos: s.pos.clone(), apply: (i) => this.buildFountain(i),
        });
        continue;
      }
      if (k === 3) {
        // La Laguna: estanque con patos y una orilla donde se pesca 🐟
        defs.push({
          id: 'special3', price: 16450, minLevel: lvl, requires: ['laguna'], label: s.name, icon: s.icon,
          pos: V(24, -58.8), apply: (i) => this.buildLagoon(i),
        });
        continue;
      }
      if (k === 2) {
        // El Invernadero vive en Las Flores y cultiva 🌷 para las colmenas
        defs.push({
          id: 'special2', price: 11750, minLevel: lvl, requires: ['flores'], label: s.name, icon: s.icon,
          pos: s.pos.clone(), apply: (i) => this.buildGreenhouse(i),
        });
        continue;
      }
      if (k === 1) {
        // El Silo vive en Los Cerros y agranda comederos y pallets
        defs.push({
          id: 'special1', price: 8400, minLevel: lvl, requires: ['hills'], label: s.name, icon: s.icon,
          pos: V(s.pos.x, s.pos.z + 3), apply: (i) => this.buildSilo(i),
        });
        continue;
      }
      // Granja 21+: segunda ronda de especiales (sólo +20% de ingresos)
      defs.push({
        id: `special${k}`, price: 40000 * Math.pow(1.1, k - ALL_SPECIALS.length), minLevel: lvl, requires: ['east'],
        label: round ? `${s.name} ${round + 1}` : s.name, icon: s.icon,
        pos: round ? V(-7.4, 11.6) : s.pos,
        apply: (i) => this.buildSpecial(s, round === 0, i),
      });
    }
    return defs;
  }

  /**
   * Gerencia: cada negocio (tienda + sus talleres/corrales) puede volverse autónomo.
   *  Nv.1 Encargado/a: empleado que cubre lo que más falta (mesas, estantería o comederos).
   *  Nv.2 Caja propia: las ventas entran directo a la plata (sin pilas de billetes).
   *  Nv.3 A full: talleres y corrales del negocio +40% de velocidad.
   * Son caras a propósito: sirven para sacarle trabajo a Mela cuando ya hay muchos negocios.
   */
  businesses() {
    return {
      tienda: { name: 'Tienda', shop: () => this.shop, parts: () => [this.coop, this.barn] },
      almacen: { name: 'Almacén', shop: () => this.shop2, parts: () => [this.bakery, this.sweets, this.pastry] },
      feria: { name: 'Feria', shop: () => this.shop3, parts: () => [this.sheep, this.knit, this.icecream, this.juicery] },
      mercado: { name: 'Mercado', shop: () => this.shop4, parts: () => [this.oilery, this.mill, this.facturas] },
      parador: { name: 'Parador', shop: () => this.shop5, parts: () => [this.goats, this.queseria, this.pizzeria] },
      kiosco: { name: 'Kiosco', shop: () => this.shop6, parts: () => [this.hives, this.alfajoreria] },
      cantina: { name: 'Cantina', shop: () => this.shop7, parts: () => [this.freiduria, this.rotiseria] },
      restaurante: { name: 'Restaurante', shop: () => this.restaurant, parts: () => [this.restaurant] },
      pulperia: { name: 'Pulpería', shop: () => this.shop8, parts: () => [this.secadero, this.ingenio, this.dulceria] },
      bodegon: { name: 'Bodegón', shop: () => this.shop9, parts: () => [this.novillos, this.carniceria, this.parrilla, this.pastas] },
      hosteria: { name: 'Hostería', shop: () => this.hostel, parts: () => [this.lavadero] },
      vinoteca: { name: 'Vinoteca', shop: () => this.shop10, parts: () => [this.bodega] },
      chocolates: { name: 'Casa de Chocolates', shop: () => this.shop11, parts: () => [this.chocolateria] },
    };
  }

  gerenciaDefs() {
    const B = [
      // id, precio base, requisitos (negocio con cajero y repartidor), encargado, lugar de la baldosa
      ['tienda', 2500, ['cashier', 'carrier', 'farmer2'], 'Marta', V(12.6, 6.8)],
      ['almacen', 4000, ['cashier2', 'carrier2', 'baker0'], 'Raúl', V(17.6, -19.4)],
      ['feria', 6000, ['cashier3', 'carrier3'], 'Vicky', V(38.4, 8.6)],
      ['mercado', 9000, ['cashier4', 'carrier4'], 'Ernesto', V(-42.4, -0.6)],
      ['parador', 12000, ['cashier5', 'carrier5'], 'Pocha', V(-21.6, -41.6)],
      ['kiosco', 16000, ['cashier6', 'carrier6'], 'Chola', V(57.2, 7.8)],
      ['cantina', 20000, ['cashier7', 'carrier7'], 'Tota', V(55.2, -57.2)],
      ['restaurante', 26000, ['waiter', 'baker5'], 'Beba', V(-40.6, -56.4)],
      ...GERENCIAS_EXTRA.map(([key, , price, requires, boss, , pos]) => [key, price, requires, boss, pos]),
    ];
    const FEMALE = ['Marta', 'Vicky', 'Pocha', 'Chola', 'Tota', 'Beba', ...GERENCIAS_EXTRA.filter((g) => g[5]).map((g) => g[4])];
    return B.map(([key, price, requires, boss, pos]) => {
      const name = this.businesses()[key].name;
      return {
        id: `ger_${key}`, repeat: true, fixedMax: true, max: 3, growth: 3, price, requires, pos,
        label: `Gerencia ${name}`, icon: '📋',
        levelLabels: [`${FEMALE.includes(boss) ? 'Encargada' : 'Encargado'} ${boss}`, 'Caja propia', 'Gerencia a full'],
        needs: () => !!this.businesses()[key].shop(),
        apply: (i) => this.applyGerencia(key, (this.applied[`ger_${key}`] ?? 0) + 1, boss, pos, i),
      };
    });
  }

  applyGerencia(key, level, boss, pos, instant) {
    const biz = this.businesses()[key];
    const shop = biz.shop();
    if (level === 1) {
      // El encargado reparte lo que haga falta entre los talleres, corrales y la estantería del negocio
      this.spawnWorker({ role: 'manager', name: boss, position: pos.clone().add(V(0, 1.2)), instant,
        targets: () => [...biz.parts().filter(Boolean).map((x) => this.sinkOf(x)), this.sinkOf(shop)] });
      const art = ['Almacén', 'Mercado', 'Parador', 'Kiosco', 'Restaurante', 'Bodegón'].includes(biz.name) ? 'del' : 'de la';
      if (!instant) this.game.chatter?.say(this.player, `¡${boss} se encarga ${art} ${biz.name}! 📋`, 3);
    } else if (level === 2) {
      shop.autoBank = true;
      // Lo que ya estaba en la pila se cobra solo
      let left = 0;
      while (shop.cashPile.hasLanded()) { const e = shop.cashPile.give(); left += e.value ?? 0; e.mesh.removeFromParent(); }
      for (const q of shop.cashPile.queue) left += q.value;
      shop.cashPile.queue = [];
      if (left) this.game.addMoney(left);
      shop.cashPile.base.mesh.visible = false;
    } else if (level === 3) {
      this.fullBiz = { ...(this.fullBiz ?? {}), [key]: true };
      for (const u of biz.parts().filter(Boolean)) {
        if (u.recipe) u.speedMult = this.procSpeed(u);
        else u.speedMult += 0.4;
      }
    }
  }

  /** Velocidad de un taller: Hornos (+30% por nivel) y Gerencia "a full" de su negocio (+40%). */
  procSpeed(p) {
    let v = 1 + 0.3 * this.ovenBonus;
    for (const [key, biz] of Object.entries(this.businesses())) {
      if (this.fullBiz?.[key] && biz.parts().includes(p)) v += 0.4;
    }
    return v;
  }

  /** Destino para un encargado: mesas de un taller, comedero de un corral o estantería de una tienda. */
  sinkOf(x) {
    if (!x) return null;
    if (x.recipe) return x; // Processor: ya tiene inputs + dropZone
    if (x.feederPile) return { owner: x, inputs: { [x.inputType]: x.feederPile }, dropZone: x.dropZone };
    const inputs = {};
    for (const t of x.availableTypes()) inputs[t] = x.piles[t];
    return { owner: x, inputs, dropZone: x.dropZone };
  }

  /** Texto de la pantalla "¡Nueva granja!" para la granja `level`. */
  newContentFor(level) {
    const items = {
      2: ['🎃 Zapallar y 🥫 Dulcería', '🎂 Pastelería (🥚 + 🥛 + 🌾) y 👩‍🍳 Pastelera Dora'],
      3: ['🐑 Zona Este con ovejas (🧶 lana)', '🧣 Tejeduría y 🎪 Feria'],
      4: ['🍓 Frutillar', '🍦 Heladería (🍓 + 🥛)'],
      5: ['🍎 Manzanar', '🧃 Juguería'],
      6: [
        '🌻 Zona Oeste: girasoles y 🧴 Aceitera',
        '🌬️ Molino de harina (🌾🌾 → 🥣)',
        '🥐 Facturería (🥣 + 🧴 + 🥚) y 🧺 Mercado',
        '👨‍🍳 Panadero Julio: abastece Facturería y Pastelería',
      ],
      7: [
        '🐐 Los Cerros: pastizal 🌿 y cabras (🍶 leche de cabra)',
        '🧀 Quesería (🍶🍶 → 🧀) y 🏪 Parador',
        '🍕 Pizzería (🥣 + 🧀 + 🧴) y el Pizzero Tano',
        '🏗️ Silo: comederos y pallets más grandes',
      ],
      8: [
        '🌷 Las Flores: el Invernadero cultiva tulipanes',
        '🐝 Colmenas (🌷 → 🍯 miel)',
        '🍪 Alfajorería (🥣 + 🍯 + 🥛) y 🏪 Kiosco',
        '👨‍🍳 Alfajorero Gringo y Gerencia del Kiosco',
      ],
      9: [
        '🦆 La Laguna: patos y una orilla para pescar 🐟',
        '🍤 Freiduría (🐟🐟 + 🥚) y 🥟 Rotisería (🐟 + 🥣)',
        '🏪 Cantina, Pescador Cacho y Cocinera Rosita',
        '🎣 Mejora Cañas y Gerencia de la Cantina',
      ],
      10: [
        '🍽️ Restaurante: los clientes se sientan y piden platos',
        '🥞 🥪 🍲 🍨 con productos de toda la granja',
        '🤵 Mozo Pipo y 🧑‍🍳 Ayudante Fito · ¡propina si servís rápido!',
        '⛲ Fuente: atrae más comensales',
      ],
      ...NEW_CONTENT,
    }[level];
    if (items) return items;
    const s = ALL_SPECIALS[(level - 6) % ALL_SPECIALS.length];
    return [`${s.icon} ${s.name} ${Math.floor((level - 6) / ALL_SPECIALS.length) + 1}: +20% de ingresos`];
  }

  updateIncome() {
    this.game.incomeMult = Math.round((incomeFor(this.farmLevel) + this.specialBonus) * 100) / 100;
    this.game.hud?.setFarm(this.farmLevel, this.game.incomeMult);
  }

  fields() {
    return [this.field, this.wheatField, this.pumpkinField, this.berryField, this.appleField, this.sunflowerField, this.grassField,
      this.flowerField, this.fishField, this.yerbaField, this.caneField, this.tomatoField, this.potreroField, this.pineField,
      this.grapeField, this.peanutField, this.cottonField].filter(Boolean);
  }
  animalUnits() { return [this.coop, this.barn, this.sheep, this.goats, this.hives, this.novillos].filter(Boolean); }
  processors() {
    return [this.bakery, this.sweets, this.pastry, this.knit, this.icecream, this.juicery, this.mill, this.oilery, this.facturas,
      this.queseria, this.pizzeria, this.alfajoreria, this.freiduria, this.rotiseria, this.secadero, this.ingenio, this.dulceria,
      this.pastas, this.carniceria, this.parrilla, this.lavadero, this.aserradero, this.carpinteria, this.bodega, this.chocolateria].filter(Boolean);
  }
  shops() {
    return [this.shop, this.shop2, this.shop3, this.shop4, this.shop5, this.shop6, this.shop7, this.shop8, this.shop9, this.shop10, this.shop11].filter(Boolean);
  }

  maxLevel(def) { return def.fixedMax ? def.max : def.max + 2 * (this.farmLevel - 1); }
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
        label = def.levelLabels ? def.levelLabels[lvl] : `${def.label} Nv.${lvl + 1}`;
      } else if (this.unlocked.includes(def.id)) continue;
      this.zones.set(def.id, new UnlockZone(this.game, {
        position: def.pos, price: this.priceOf(def), label, icon: def.icon, instant,
        onComplete: () => this.unlock(def),
      }));
    }
    // Prestigio: mudarse a una granja más grande
    if (!this.zones.has('move') && this.allDone()) {
      this.zones.set('move', new UnlockZone(this.game, {
        position: V(-7.4, 8.9), price: niceRound(movePriceFor(this.farmLevel)),
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
   * Mudanza a la granja siguiente: se conserva TODO (construcciones, empleados, mejoras y plata);
   * la granja nueva suma ingresos ×1,5 y contenido nuevo (ver newContentFor).
   */
  prestige() {
    const next = this.farmLevel + 1;
    this.game.saveSystem.save({
      version: 2, farmLevel: next, money: this.game.money, unlocked: this.unlocked, upgrades: this.upgrades,
      missions: this.game.missions?.serialize(),
    });
    this.resetting = true;
    this.game.showLevelUp(next, this.newContentFor(next), incomeFor(next) + this.specialBonus);
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
    f.growMult = this.fieldGrow(f);
    return f;
  }

  /** Velocidad de un campo: Fertilizante (+25% por nivel), riego del Tanque (+30%) y, en la orilla de pesca, Cañas (+30%). */
  fieldGrow(f) {
    return 1 + 0.25 * (this.growBonus ?? 0) + (this.irrigation ?? 0) + (f.type === 'fish' ? 0.3 * (this.rodBonus ?? 0) : 0);
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
    this.applyStorage(this.barn);
    if (!instant) {
      this.game.fx.popIn(this.barn.group);
      this.game.fx.burst(V(19, -8).setY(1));
    }
  }

  buildTractor(instant) {
    const binPos = V(-11, -0.4);
    const bin = bakeGroup(createBin());
    bin.position.copy(binPos);
    this.scene.add(bin);
    this.game.obstacles.push({ minX: binPos.x - 1.0, maxX: binPos.x + 1.0, minZ: binPos.z - 0.7, maxZ: binPos.z + 0.7 });
    this.crate = new Pile(this.game, {
      position: binPos.clone().setY(0.1), type: 'corn', cols: 3, rows: 4, max: this.storageMult > 1 ? 54 : 36, spacing: [0.55, 0.3],
    });
    this.crateZone = new TransferZone(this.game, {
      position: binPos.clone().add(V(0, 1.75)), mode: 'pickup', target: this.crate, roles: ['player', 'trucker'],
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
    const bales = [];
    for (const [x, z] of [[22, -36], [23, -36.2], [-17.5, -36.5]]) {
      const h = createHayBale();
      h.position.set(x, 0, z);
      bales.push(h);
    }
    batchStatic(bales, this.scene);
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
      inputRoles: ['player', 'baker'], outputRoles: ['player', 'carrier'], outputMax: 16,
      outputPile: { spacing: [0.48, 0.48] },
    });
    this.afterProcessor(this.pastry, instant);
    this.game.flags.cake = true;
  }

  afterProcessor(p, instant) {
    p.speedMult = this.procSpeed(p);
    if (!instant) {
      this.game.fx.popIn(p.group);
      this.game.fx.burst(p.position.clone().setY(1.5), 36);
    }
  }

  buildShop2(instant) {
    this.shop2 = new Shop(this.game, {
      position: V(12, -22), name: 'ALMACÉN', spawnPoint: V(25.5, -18), exitPoint: V(25.5, -26), queueSize: 5, instant,
      look: { wall: '#fdebd0', trim: '#a0522d', awning: ['#ffffff', '#e8762b'] },
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

  /** Matías, el administrador: escritorio propio + IA. */
  hireMatias(instant) {
    const deskPos = V(19.5, 0.8);
    const desk = bakeGroup(createDesk());
    desk.position.copy(deskPos);
    this.scene.add(desk);
    if (!instant) this.game.fx.popIn(desk);
    this.game.obstacles.push({ minX: deskPos.x - 0.95, maxX: deskPos.x + 0.95, minZ: deskPos.z - 1.2, maxZ: deskPos.z + 0.5 });
    // Se para adelante del escritorio cuando "trabaja"
    this.matias = new MatiasAI(this.game, this, { position: V(19.5, 2.2), desk: V(19.5, 1.75), instant });
    if (!instant) this.game.chatter?.say(this.matias, '¡Hola a todos! Yo me encargo de los números 📊', 3.2);
  }

  // ---------- Granja 3+: Zona Este ----------
  /** Abre la Zona Este: corre el cerco hacia la derecha y agrega tierra. */
  openEast(instant) {
    this.bounds.maxX = EAST_MAX_X;
    this.eastOpen = true;
    this.buildFence();
    const x0 = CONFIG.bounds.maxX + 0.6;
    const x1 = EAST_MAX_X + 0.6;
    const z0 = this.bounds.minZ - 0.6;
    const z1 = this.bounds.maxZ + 0.6;
    const yard = new THREE.Mesh(
      new THREE.PlaneGeometry(x1 - x0 + 0.02, z1 - z0),
      new THREE.MeshStandardMaterial({ map: this.makeDirtTexture((x1 - x0) / 8, (z1 - z0) / 8), roughness: 0.95 }),
    );
    yard.rotation.x = -Math.PI / 2;
    yard.position.set((x0 + x1) / 2, -0.016, (z0 + z1) / 2);
    yard.receiveShadow = true;
    this.scene.add(yard);
    this.game.flags.east = true;
    if (!instant) {
      this.game.fx.burst(V(38, -10).setY(1), 40);
      this.game.chatter?.say(this.player, '¡La granja sigue creciendo! 🐑', 3);
    }
  }

  buildSheep(instant) {
    this.sheep = new ProductionUnit(this.game, {
      position: V(34, -12), inputType: 'corn', outputType: 'wool', animal: 'sheep', animalCount: 3, house: 'coop',
      produceTime: 2.4, feederMax: 24, outputMax: 24, floorColor: '#b9d77a',
      outputPile: { cols: 2, rows: 2, spacing: [0.5, 0.45] },
      inputRoles: ['player', 'farmer'], outputRoles: ['player', 'carrier'],
    });
    this.game.flags.wool = true;
    this.applyStorage(this.sheep);
    if (!instant) {
      this.game.fx.popIn(this.sheep.group);
      this.game.fx.burst(V(34, -12).setY(1), 36);
    }
  }

  buildKnit(instant) {
    this.knit = new Processor(this.game, {
      position: V(45, -13), recipe: { wool: 1 }, output: 'scarf', produceTime: 3, name: 'TEJEDURÍA',
      look: { wall: '#e8f0ff', roofColor: '#5a7fd6', awning: ['#ffffff', '#5a7fd6'] },
      inputRoles: ['player', 'farmer'], outputRoles: ['player', 'carrier'],
    });
    this.afterProcessor(this.knit, instant);
    this.game.flags.scarf = true;
  }

  buildShop3(instant) {
    this.shop3 = new Shop(this.game, {
      position: V(44, 6), name: 'FERIA', spawnPoint: V(51.5, 12), exitPoint: V(51.5, 1), queueSize: 4, instant,
      look: { wall: '#f3e8ff', trim: '#7b2cbf', awning: ['#ffcf3a', '#7b2cbf'] },
      products: [
        { type: 'scarf', x: -1.15, max: 12, pile: { cols: 1, rows: 2, spacing: [0.5, 0.45] } },
        { type: 'icecream', flag: 'icecream', x: -0.4, max: 10, pile: { cols: 1, rows: 2, spacing: [0.4, 0.4] } },
        { type: 'juice', flag: 'juice', x: 0.4, max: 12, pile: { cols: 1, rows: 2, spacing: [0.4, 0.4] } },
      ],
    });
    this.game.flags.shop3 = true;
  }

  buildBerries(instant) {
    this.berryField = this.addField({ type: 'strawberry', center: V(33, 4), cols: 6, rows: 3, spacing: 1.5, growTime: 8 });
    this.game.flags.strawberry = true;
    if (!instant) this.game.fx.burst(V(33, 4).setY(1), 36);
  }

  buildIceCream(instant) {
    this.icecream = new Processor(this.game, {
      position: V(45, -3), recipe: { strawberry: 1, milk: 1 }, output: 'icecream', produceTime: 4, name: 'HELADERÍA',
      look: { wall: '#fff0f6', roofColor: '#ff9ec4', awning: ['#ffffff', '#7fd3f7'] },
      inputRoles: ['player', 'farmer'], outputRoles: ['player', 'carrier'], outputMax: 16,
      outputPile: { spacing: [0.4, 0.4] },
    });
    this.afterProcessor(this.icecream, instant);
    this.game.flags.icecream = true;
  }

  buildApples(instant) {
    this.appleField = this.addField({ type: 'apple', center: V(34, -30), cols: 5, rows: 4, spacing: 1.9, growTime: 10 });
    this.game.flags.apple = true;
    if (!instant) this.game.fx.burst(V(34, -30).setY(1), 36);
  }

  buildJuicery(instant) {
    this.juicery = new Processor(this.game, {
      position: V(45, -31), recipe: { apple: 1 }, output: 'juice', produceTime: 3, name: 'JUGUERÍA',
      look: { wall: '#f2ffe6', roofColor: '#57b947', awning: ['#ffffff', '#e2483d'] },
      inputRoles: ['player', 'farmer'], outputRoles: ['player', 'carrier'],
      outputPile: { spacing: [0.4, 0.4] },
    });
    this.afterProcessor(this.juicery, instant);
    this.game.flags.juice = true;
  }

  // ---------- Granja 6: Zona Oeste ----------
  /** Abre la Zona Oeste: corre el cerco hacia la izquierda, saca la vegetación y agrega tierra. */
  openWest(instant) {
    this.bounds.minX = WEST_MIN_X;
    this.westOpen = true;
    this.buildFence();
    for (const o of this.westDecor) o.removeFromParent();
    this.westDecor = [];
    const x0 = WEST_MIN_X - 0.6;
    const x1 = CONFIG.bounds.minX - 0.6;
    const z0 = this.bounds.minZ - 0.6;
    const z1 = this.bounds.maxZ + 0.6;
    const yard = new THREE.Mesh(
      new THREE.PlaneGeometry(x1 - x0 + 0.02, z1 - z0),
      new THREE.MeshStandardMaterial({ map: this.makeDirtTexture((x1 - x0) / 8, (z1 - z0) / 8), roughness: 0.95 }),
    );
    yard.rotation.x = -Math.PI / 2;
    yard.position.set((x0 + x1) / 2, -0.016, (z0 + z1) / 2);
    yard.receiveShadow = true;
    this.scene.add(yard);
    this.game.flags.west = true;
    if (!instant) {
      this.game.fx.burst(V(-32, -8).setY(1), 40);
      this.game.chatter?.say(this.player, '¡Ahora la granja llega hasta la casa! 🌻', 3);
    }
  }

  buildSunflowers(instant) {
    this.sunflowerField = this.addField({ type: 'sunflower', center: V(-34, -27), cols: 6, rows: 4, spacing: 1.7, growTime: 11 });
    this.game.flags.sunflower = true;
    if (!instant) this.game.fx.burst(V(-34, -27).setY(1), 36);
  }

  buildOilery(instant) {
    this.oilery = new Processor(this.game, {
      position: V(-40.5, -17), recipe: { sunflower: 3 }, output: 'oil', produceTime: 4, name: 'ACEITERA',
      look: { wall: '#fff6d6', roofColor: '#e0a800', awning: ['#ffffff', '#2e8b57'] },
      inputRoles: ['player', 'farmer'], outputRoles: ['player', 'carrier'], inputMax: 24,
      outputPile: { spacing: [0.4, 0.4] },
    });
    this.afterProcessor(this.oilery, instant);
    this.game.flags.oil = true;
  }

  /** Molino (Granja 6): muele trigo en harina y además suma +20% de ingresos como construcción especial. */
  buildMill(instant) {
    this.mill = new Processor(this.game, {
      position: SPECIALS[0].pos, recipe: { wheat: 2 }, output: 'flour', produceTime: 3.5, name: 'MOLINO',
      model: createWindmill, labelY: 6.2,
      inputRoles: ['player', 'farmer'], outputRoles: ['player', 'carrier'],
      outputPile: { spacing: [0.44, 0.4] },
    });
    this.afterProcessor(this.mill, instant);
    this.game.flags.flour = true;
    this.specialBonus += 0.2;
    this.updateIncome();
  }

  buildFacturas(instant) {
    this.facturas = new Processor(this.game, {
      position: V(-24, -18), recipe: { flour: 1, oil: 1, egg: 1 }, output: 'croissant', produceTime: 5, name: 'FACTURERÍA',
      look: { wall: '#fdebd0', roofColor: '#8e5229', awning: ['#ffffff', '#d48f3c'] },
      inputRoles: ['player', 'baker'], outputRoles: ['player', 'carrier'], outputMax: 16,
      outputPile: { spacing: [0.44, 0.38] },
    });
    this.afterProcessor(this.facturas, instant);
    this.game.flags.croissant = true;
  }

  buildShop4(instant) {
    this.shop4 = new Shop(this.game, {
      position: V(-37, 3), name: 'MERCADO', spawnPoint: V(-45, 12.5), exitPoint: V(-45, -3), queueSize: 4, instant,
      look: { wall: '#eef7e4', trim: '#2e8b57', awning: ['#ffffff', '#2e8b57'] },
      products: [
        // La harina no se vende acá: es insumo de la Facturería (y va en los pedidos del camión)
        { type: 'oil', x: -0.85, max: 12, pile: { cols: 2, rows: 2, spacing: [0.4, 0.4] } },
        { type: 'croissant', flag: 'croissant', x: 0.4, max: 16, pile: { cols: 2, rows: 2, spacing: [0.42, 0.38] } },
      ],
    });
    this.game.flags.shop4 = true;
  }

  // ---------- Granja 7: Los Cerros ----------
  /** Abre Los Cerros: corre el cerco hacia el norte (todo el ancho) y saca árboles y pasto. */
  openHills(instant) {
    this.bounds.minZ = HILLS_MIN_Z;
    this.hillsOpen = true;
    this.buildFence();
    for (const o of this.hillsDecor) o.removeFromParent();
    this.hillsDecor = [];
    const x0 = WEST_MIN_X - 0.6;
    const x1 = EAST_MAX_X + 0.6;
    const z0 = HILLS_MIN_Z - 0.6;
    const z1 = NORTH_MIN_Z - 0.6;
    const yard = new THREE.Mesh(
      new THREE.PlaneGeometry(x1 - x0, z1 - z0 + 0.02),
      new THREE.MeshStandardMaterial({ map: this.makeDirtTexture((x1 - x0) / 8, (z1 - z0) / 8), roughness: 0.95 }),
    );
    yard.rotation.x = -Math.PI / 2;
    yard.position.set((x0 + x1) / 2, -0.016, (z0 + z1) / 2);
    yard.receiveShadow = true;
    this.scene.add(yard);
    const bales = [];
    for (const [x, z, r] of [[-40, -53.5, 0], [-38.8, -53.6, 0.1], [45, -53.4, 0.2], [46.2, -53.3, 0]]) {
      const h = createHayBale();
      h.position.set(x, 0, z);
      h.rotation.y = r;
      bales.push(h);
    }
    batchStatic(bales, this.scene);
    this.game.flags.hills = true;
    if (!instant) {
      this.game.fx.burst(V(4, -47).setY(1), 40);
      this.game.chatter?.say(this.player, '¡Llegamos a los cerros! Acá van a vivir las cabras 🐐', 3.2);
    }
  }

  buildPasture(instant) {
    this.grassField = this.addField({ type: 'grass', center: V(-4, -48), cols: 6, rows: 4, spacing: 1.5, growTime: 7 });
    this.game.flags.grass = true;
    if (!instant) this.game.fx.burst(V(-4, -48).setY(1), 36);
  }

  buildGoats(instant) {
    this.goats = new ProductionUnit(this.game, {
      position: V(8, -50), inputType: 'grass', outputType: 'goatmilk', animal: 'goat', animalCount: 3, house: 'coop',
      produceTime: 2.8, feederMax: 20, outputMax: 24, floorColor: '#c9dd8a',
      outputPile: { cols: 3, rows: 2, spacing: [0.3, 0.3] },
      inputRoles: ['player', 'farmer'], outputRoles: ['player', 'carrier'],
    });
    this.game.flags.goatmilk = true;
    this.applyStorage(this.goats);
    if (!instant) {
      this.game.fx.popIn(this.goats.group);
      this.game.fx.burst(V(8, -50).setY(1), 36);
    }
  }

  buildQueseria(instant) {
    this.queseria = new Processor(this.game, {
      position: V(20, -48), recipe: { goatmilk: 2 }, output: 'cheese', produceTime: 4.5, name: 'QUESERÍA',
      look: { wall: '#fff8dc', roofColor: '#e0a800', awning: ['#ffffff', '#8fbf45'] },
      inputRoles: ['player', 'farmer', 'baker'], outputRoles: ['player', 'carrier'], outputMax: 16,
      outputPile: { spacing: [0.4, 0.4] },
    });
    this.afterProcessor(this.queseria, instant);
    this.game.flags.cheese = true;
  }

  buildPizzeria(instant) {
    this.pizzeria = new Processor(this.game, {
      position: V(-30, -48), recipe: { flour: 1, cheese: 1, oil: 1 }, output: 'pizza', produceTime: 6, name: 'PIZZERÍA',
      look: { wall: '#fdf0e0', roofColor: '#d9412e', awning: ['#ffffff', '#2e8b57'] },
      inputRoles: ['player', 'baker'], outputRoles: ['player', 'carrier'], outputMax: 12,
      outputPile: { spacing: [0.46, 0.46] },
    });
    this.afterProcessor(this.pizzeria, instant);
    this.game.flags.pizza = true;
  }

  buildShop5(instant) {
    // Los clientes bajan de los cerros (aparecen del otro lado del cerco norte)
    this.shop5 = new Shop(this.game, {
      position: V(-17, -47), name: 'PARADOR', spawnPoint: V(-9, -61), exitPoint: V(-5, -61), queueSize: 4, instant,
      look: { wall: '#fff8dc', trim: '#b5651d', awning: ['#ffffff', '#e0a800'] },
      products: [
        { type: 'cheese', x: -0.85, max: 12, pile: { cols: 2, rows: 2, spacing: [0.42, 0.4] } },
        { type: 'pizza', flag: 'pizza', x: 0.4, max: 10, pile: { cols: 1, rows: 2, spacing: [0.46, 0.46] } },
      ],
    });
    this.game.flags.shop5 = true;
  }

  /** Silo (Granja 7): +50% de lugar en comederos, pallets de los corrales y el cajón del tractor, y +20% de ingresos. */
  buildSilo(instant) {
    const s = SPECIALS[1];
    this.silo = bakeGroup(s.model());
    this.silo.position.copy(s.pos);
    this.scene.add(this.silo);
    this.game.obstacles.push({ minX: s.pos.x - 1.3, maxX: s.pos.x + 3.3, minZ: s.pos.z - 1.6, maxZ: s.pos.z + 1.6 });
    this.storageMult = 1.5;
    for (const u of this.animalUnits()) this.applyStorage(u);
    if (this.crate) this.crate.max = 54;
    this.specialBonus += 0.2;
    this.updateIncome();
    if (!instant) {
      this.game.fx.popIn(this.silo);
      this.game.fx.burst(s.pos.clone().setY(1.5), 50);
      this.game.chatter?.say(this.player, '¡Con el silo entra mucho más alimento! 🏗️', 3);
    }
  }

  /** Capacidad de comedero y pallet de un corral según el Silo. */
  applyStorage(u) {
    if (!u) return;
    u.baseFeederMax ??= u.feederPile.max;
    u.baseOutputMax ??= u.outputPile.max;
    u.feederPile.max = Math.round(u.baseFeederMax * this.storageMult);
    u.outputPile.max = Math.round(u.baseOutputMax * this.storageMult);
  }

  // ---------- Granja 8: Las Flores ----------
  /** Abre Las Flores: corre el cerco hacia el este (de punta a punta) y saca árboles y pasto. */
  openFlores(instant) {
    this.bounds.maxX = FLORES_MAX_X;
    this.floresOpen = true;
    this.buildFence();
    for (const o of this.floresDecor) o.removeFromParent();
    this.floresDecor = [];
    const x0 = EAST_MAX_X + 0.6;
    const x1 = FLORES_MAX_X + 0.6;
    const z0 = this.bounds.minZ - 0.6;
    const z1 = this.bounds.maxZ + 0.6;
    const yard = new THREE.Mesh(
      new THREE.PlaneGeometry(x1 - x0 + 0.02, z1 - z0),
      new THREE.MeshStandardMaterial({ map: this.makeDirtTexture((x1 - x0) / 8, (z1 - z0) / 8), roughness: 0.95 }),
    );
    yard.rotation.x = -Math.PI / 2;
    yard.position.set((x0 + x1) / 2, -0.016, (z0 + z1) / 2);
    yard.receiveShadow = true;
    this.scene.add(yard);
    const pumpkins = [];
    for (const [x, z] of [[70, -45], [69, -45.2], [70.2, 10.5]]) {
      const pm = createPumpkin(1.4);
      pm.position.set(x, 0, z);
      pumpkins.push(pm);
    }
    batchStatic(pumpkins, this.scene);
    this.game.flags.flores = true;
    if (!instant) {
      this.game.fx.burst(V(62, -20).setY(1), 40);
      this.game.chatter?.say(this.player, '¡Qué lindo! Acá va a haber flores y abejas 🌷🐝', 3.2);
    }
  }

  /** Invernadero (Granja 8): cantero de tulipanes bajo vidrio (+20% de ingresos como especial). */
  buildGreenhouse(instant) {
    const c = SPECIALS[2].pos;
    this.flowerField = this.addField({ type: 'flower', center: c.clone(), cols: 6, rows: 4, spacing: 1.5, growTime: 9 });
    this.game.flags.flower = true;
    // Estructura de vidrio: fondo y costados (el frente queda abierto para entrar a cosechar)
    const g = new THREE.Group();
    const glass = new THREE.MeshStandardMaterial({ color: '#bfe8ff', transparent: true, opacity: 0.32, roughness: 0.1, depthWrite: false });
    const hw = this.flowerField.halfW + 0.35;
    const hd = this.flowerField.halfD + 0.35;
    const H = 2.4;
    const pane = (w, d, x, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), glass);
      m.position.set(x, H / 2, z);
      g.add(m);
    };
    pane(hw * 2, 0.06, 0, -hd);
    pane(0.06, hd * 2, -hw, 0);
    pane(0.06, hd * 2, hw, 0);
    const white = mat('#ffffff');
    for (const x of [-hw, -hw / 3, hw / 3, hw]) {
      for (const z of [-hd, hd]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, H + 0.6, 0.12), white);
        post.position.set(x, (H + 0.6) / 2, z);
        g.add(post);
      }
      const rafter = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, hd * 2 + 0.2), white);
      rafter.position.set(x, H + 0.6, 0);
      g.add(rafter);
    }
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 0.2, 0.12, 0.12), white);
    ridge.position.set(0, H + 0.6, 0);
    g.add(ridge);
    g.position.copy(c);
    bakeGroup(g); // postes y vigas en un mesh (el vidrio queda aparte, es transparente)
    this.scene.add(g);
    this.game.obstacles.push(
      { minX: c.x - hw - 0.1, maxX: c.x + hw + 0.1, minZ: c.z - hd - 0.1, maxZ: c.z - hd + 0.1 },
      { minX: c.x - hw - 0.1, maxX: c.x - hw + 0.1, minZ: c.z - hd, maxZ: c.z + hd },
      { minX: c.x + hw - 0.1, maxX: c.x + hw + 0.1, minZ: c.z - hd, maxZ: c.z + hd },
    );
    this.specialBonus += 0.2;
    this.updateIncome();
    if (!instant) {
      this.game.fx.popIn(g);
      this.game.fx.burst(c.clone().setY(1.5), 50);
    }
  }

  buildHives(instant) {
    this.hives = new ProductionUnit(this.game, {
      position: V(62, -26), inputType: 'flower', outputType: 'honey', animal: 'bee', animalCount: 4, house: 'hive',
      produceTime: 3, feederMax: 18, outputMax: 20, floorColor: '#d9ef9a',
      outputPile: { cols: 2, rows: 2, spacing: [0.34, 0.34] },
      inputRoles: ['player', 'farmer'], outputRoles: ['player', 'carrier'],
    });
    this.game.flags.honey = true;
    this.applyStorage(this.hives);
    if (!instant) {
      this.game.fx.popIn(this.hives.group);
      this.game.fx.burst(V(62, -26).setY(1), 36);
    }
  }

  buildAlfajoreria(instant) {
    this.alfajoreria = new Processor(this.game, {
      position: V(62, -12), recipe: { flour: 1, honey: 1, milk: 1 }, output: 'alfajor', produceTime: 5.5, name: 'ALFAJORERÍA',
      look: { wall: '#fdebd0', roofColor: '#5a3220', awning: ['#ffffff', '#c98b4a'] },
      inputRoles: ['player', 'farmer', 'baker'], outputRoles: ['player', 'carrier'], outputMax: 14,
      outputPile: { spacing: [0.38, 0.38] },
    });
    this.afterProcessor(this.alfajoreria, instant);
    this.game.flags.alfajor = true;
  }

  buildShop6(instant) {
    this.shop6 = new Shop(this.game, {
      position: V(62, 3), name: 'KIOSCO', spawnPoint: V(70.5, 12.5), exitPoint: V(70.5, -4), queueSize: 4, instant,
      look: { wall: '#ffe8f0', trim: '#e0457b', awning: ['#ffffff', '#ff5d8f'] },
      products: [
        { type: 'honey', x: -0.85, max: 12, pile: { cols: 2, rows: 2, spacing: [0.38, 0.38] } },
        { type: 'alfajor', flag: 'alfajor', x: 0.4, max: 12, pile: { cols: 2, rows: 2, spacing: [0.36, 0.36] } },
      ],
    });
    this.game.flags.shop6 = true;
  }

  // ---------- Granja 9: La Laguna ----------
  /** Abre La Laguna: corre el cerco hacia el norte otra vez (de punta a punta) y saca árboles y pasto. */
  openLake(instant) {
    this.bounds.minZ = LAKE_MIN_Z;
    this.lakeOpen = true;
    this.buildFence();
    for (const o of this.lakeDecor) o.removeFromParent();
    this.lakeDecor = [];
    const x0 = WEST_MIN_X - 0.6;
    const x1 = this.bounds.maxX + 0.6;
    const z0 = LAKE_MIN_Z - 0.6;
    const z1 = HILLS_MIN_Z - 0.6;
    const yard = new THREE.Mesh(
      new THREE.PlaneGeometry(x1 - x0, z1 - z0 + 0.02),
      new THREE.MeshStandardMaterial({ map: this.makeDirtTexture((x1 - x0) / 8, (z1 - z0) / 8), roughness: 0.95 }),
    );
    yard.rotation.x = -Math.PI / 2;
    yard.position.set((x0 + x1) / 2, -0.016, (z0 + z1) / 2);
    yard.receiveShadow = true;
    this.scene.add(yard);
    this.game.flags.laguna = true;
    if (!instant) {
      this.game.fx.burst(V(24, -62).setY(1), 40);
      this.game.chatter?.say(this.player, '¡Una laguna! ¿Habrá peces? 🐟', 3);
    }
  }

  /** Laguna (Granja 9): estanque con patos y una orilla de pesca (+20% de ingresos como especial). */
  buildLagoon(instant) {
    const c = SPECIALS[3].pos; // centro del estanque
    const g = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.CircleGeometry(1, 40), mat('#e9d29a'));
    rim.scale.set(9.6, 5.2, 1);
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.012;
    const water = new THREE.Mesh(new THREE.CircleGeometry(1, 40),
      new THREE.MeshStandardMaterial({ color: '#4fa3d9', roughness: 0.15, metalness: 0.1 }));
    water.scale.set(8.8, 4.5, 1);
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.03;
    g.add(rim, water);
    // Juncos y camalotes alrededor
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      if (Math.sin(a) > 0.55) continue; // el lado de la orilla de pesca queda libre
      const x = Math.cos(a) * 9.2;
      const z = Math.sin(a) * 4.9;
      for (let k = 0; k < 3; k++) {
        const reed = new THREE.Mesh(new THREE.ConeGeometry(0.06, 1 + k * 0.25, 5), mat(k % 2 ? '#4f9e2c' : '#6fbf3a'));
        reed.position.set(x + (k - 1) * 0.15, 0.5 + k * 0.12, z);
        g.add(reed);
      }
    }
    for (const [x, z] of [[-4, -1.5], [3.5, -2.2], [5.5, 0.8], [-6, 1.2]]) {
      const pad = new THREE.Mesh(new THREE.CircleGeometry(0.45, 12), mat('#57b947'));
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(x, 0.04, z);
      g.add(pad);
    }
    g.position.copy(c);
    bakeGroup(g, { keep: [water] }); // juncos, camalotes y orilla en un mesh; el agua conserva su brillo
    this.scene.add(g);
    this.game.obstacles.push({ minX: c.x - 8.4, maxX: c.x + 8.4, minZ: c.z - 4.6, maxZ: c.z + 2.6 });
    // Patos nadando en círculos
    const ducks = [];
    for (let i = 0; i < 5; i++) {
      const d = bakeGroup(createDuck());
      d.position.copy(c).setY(0.02);
      this.scene.add(d);
      ducks.push({ d, a: (i / 5) * Math.PI * 2, r: 2 + (i % 3) * 1.5, w: 0.25 + (i % 2) * 0.12 });
    }
    this.game.add({ update: (dt) => {
      for (const k of ducks) {
        k.a += dt * k.w;
        k.d.position.set(c.x + Math.cos(k.a) * k.r * 1.6, 0.02 + Math.sin(k.a * 6) * 0.02, c.z + Math.sin(k.a) * k.r * 0.6 - 0.8);
        k.d.rotation.y = -k.a;
      }
    } });
    // Orilla de pesca: agua bajita donde saltan los peces (se cosecha como un campo)
    this.fishField = this.addField({ type: 'fish', center: V(c.x, c.z + 5.7), cols: 6, rows: 2, spacing: 1.5, growTime: 10 });
    this.game.flags.fish = true;
    this.specialBonus += 0.2;
    this.updateIncome();
    if (!instant) {
      this.game.fx.popIn(g);
      this.game.fx.burst(c.clone().setY(1.5), 50);
    }
  }

  buildFreiduria(instant) {
    this.freiduria = new Processor(this.game, {
      position: V(38, -63), recipe: { fish: 2, egg: 1 }, output: 'friedfish', produceTime: 4.5, name: 'FREIDURÍA',
      look: { wall: '#e8f6ff', roofColor: '#0077b6', awning: ['#ffffff', '#0077b6'] },
      inputRoles: ['player', 'farmer', 'baker'], outputRoles: ['player', 'carrier'], outputMax: 14,
      outputPile: { spacing: [0.4, 0.4] },
    });
    this.afterProcessor(this.freiduria, instant);
    this.game.flags.friedfish = true;
  }

  buildRotiseria(instant) {
    this.rotiseria = new Processor(this.game, {
      position: V(48, -63), recipe: { fish: 1, flour: 1 }, output: 'empanada', produceTime: 4, name: 'ROTISERÍA',
      look: { wall: '#fff1e0', roofColor: '#b5651d', awning: ['#ffffff', '#e8762b'] },
      inputRoles: ['player', 'farmer', 'baker'], outputRoles: ['player', 'carrier'], outputMax: 16,
      outputPile: { spacing: [0.4, 0.38] },
    });
    this.afterProcessor(this.rotiseria, instant);
    this.game.flags.empanada = true;
  }

  buildShop7(instant) {
    this.shop7 = new Shop(this.game, {
      position: V(60, -60), name: 'CANTINA', spawnPoint: V(68, -76), exitPoint: V(52, -76), queueSize: 4, instant,
      look: { wall: '#e8f6ff', trim: '#0077b6', awning: ['#ffffff', '#0077b6'] },
      products: [
        { type: 'friedfish', x: -0.85, max: 12, pile: { cols: 2, rows: 2, spacing: [0.38, 0.38] } },
        { type: 'empanada', flag: 'empanada', x: 0.4, max: 14, pile: { cols: 2, rows: 2, spacing: [0.38, 0.36] } },
      ],
    });
    this.game.flags.shop7 = true;
  }

  // ---------- Granja 10: Restaurante y Fuente ----------
  buildRestaurant(instant) {
    this.restaurant = new Restaurant(this.game, this, { position: V(-37, -66), instant });
    this.restaurant.speedMult = this.procSpeed(this.restaurant);
    if (this.fountainOn) this.restaurant.spawnMult = 1.7;
    this.game.flags.restaurant = true;
    if (!instant) {
      this.game.fx.popIn(this.restaurant.group);
      this.game.fx.burst(V(-37, -63).setY(1.5), 50);
      this.game.chatter?.say(this.player, '¡Abrimos el restaurante! A servir rápido para la propina ⭐', 3.4);
    }
  }

  /** Fuente (Granja 10): plaza frente al Restaurante; atrae más comensales (+20% de ingresos como especial). */
  buildFountain(instant) {
    const s = SPECIALS[4];
    const m = bakeGroup(s.model());
    m.position.copy(s.pos);
    this.scene.add(m);
    this.game.obstacles.push({ minX: s.pos.x - 1.7, maxX: s.pos.x + 1.7, minZ: s.pos.z - 1.7, maxZ: s.pos.z + 1.7 });
    // Chorritos de agua
    const drops = [];
    for (let i = 0; i < 6; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), mat('#9fe3ff'));
      this.scene.add(d);
      drops.push({ d, a: (i / 6) * Math.PI * 2 });
    }
    this.game.add({ update: () => {
      const t = this.game.time;
      for (const k of drops) {
        const u = (t * 0.9 + k.a / (Math.PI * 2)) % 1;
        k.d.position.set(s.pos.x + Math.cos(k.a) * u * 1.2, 2.2 + Math.sin(u * Math.PI) * 0.5 - u * 1.6, s.pos.z + Math.sin(k.a) * u * 1.2);
      }
    } });
    this.fountainOn = true;
    if (this.restaurant) this.restaurant.spawnMult = 1.7;
    this.specialBonus += 0.2;
    this.updateIncome();
    if (!instant) {
      this.game.fx.popIn(m);
      this.game.fx.burst(s.pos.clone().setY(1.5), 50);
    }
  }

  /** Construcción especial (Granja 11+): decoración animada + 20% más de ingresos. */
  buildSpecial(s, place, instant) {
    if (place) {
      const raw = s.model();
      const m = bakeGroup(raw, { keep: [raw.userData.spin] });
      m.position.copy(s.pos);
      this.scene.add(m);
      this.game.obstacles.push({ minX: s.pos.x - 1.6, maxX: s.pos.x + 1.6, minZ: s.pos.z - 1.6, maxZ: s.pos.z + 1.6 });
      if (m.userData.spin) this.game.add({ update: (dt) => { m.userData.spin.rotation.z += dt * 0.8; } });
      if (!instant) this.game.fx.popIn(m);
    }
    this.specialBonus += 0.2;
    this.updateIncome();
    if (!instant) this.game.fx.burst(s.pos.clone().setY(1.5), 50);
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
    // Tramo con huecos: [a, b] es el recorrido y gaps los pedazos sin cerco (ruta, vías, muelle)
    const span = (a, b, gaps, make) => {
      let s = a;
      for (const [g0, g1] of [...gaps].sort((x, y) => x[0] - y[0])) {
        if (g1 <= s || g0 >= b) continue;
        if (g0 - s > 0.5) this.fence.add(make(s, g0));
        s = Math.max(s, g1);
      }
      if (b - s > 0.5) this.fence.add(make(s, b));
    };
    const gaps = this.fenceGaps();
    this.fence.add(createFenceLine(fx0, fz0, fx1, fz0, 1.6));
    span(fx0, fx1, gaps.south, (a, c) => createFenceLine(a, fz1, c, fz1, 1.6));
    for (const x of [fx0, fx1]) span(fz0, fz1, gaps.side, (a, c) => createFenceLine(x, a, x, c, 1.6));
    bakeGroup(this.fence);
    this.scene.add(this.fence);
  }

  buildEnvironment() {
    const scene = this.scene;
    const b = this.bounds;
    const rnd = seeded(42);
    // Lo estático no va directo a la escena: se junta acá y al final se fusiona por zonas (batchStatic)
    const staged = [];
    const stage = (o) => { staged.push(o); return o; };

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
      stage(m);
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
      stage(edge);
    }
    for (let x = -70; x < 70; x += 4) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.035, 0.14), mat('#f6d55c'));
      line.position.set(x, 0, 16);
      stage(line);
    }

    this.buildFence();

    // Cartel de la granja
    const sign = createSign("Mela's Farm", `Granja ${this.farmLevel}`);
    sign.position.set(-5.2, 0, 5.2);
    sign.rotation.y = 0.25;
    stage(sign);
    this.game.obstacles.push({ minX: -6.6, maxX: -3.8, minZ: 4.9, maxZ: 5.5 });

    // Casa de la granja (al oeste, afuera del cerco)
    const house = createFarmhouse();
    house.position.set(-27, 0, -8);
    house.rotation.y = Math.PI / 2;
    stage(house);
    this.game.obstacles.push({ minX: -29.3, maxX: -24.7, minZ: -10.9, maxZ: -5.1 });

    // Fardos de heno y zapallos decorativos
    const bale = (x, z, ry = 0, y = 0) => {
      const h = createHayBale();
      h.position.set(x, y, z);
      h.rotation.y = ry;
      stage(h);
    };
    bale(7.6, -12.6); bale(8.7, -12.5, 0.1); bale(8.1, -12.55, 0.05, 0.5);
    bale(-17.6, 10.2, Math.PI / 2); bale(-17.6, 11.3, Math.PI / 2);
    this.game.obstacles.push({ minX: 7, maxX: 9.3, minZ: -13, maxZ: -12.2 });
    for (const [x, z, s] of [[-17.3, -13.5, 1], [-16.6, -14.2, 0.8], [-6.5, -11.5, 0.9], [13.5, 11.5, 1], [14.3, 12.2, 0.8], [25, 12.6, 1]]) {
      const p = createPumpkin(s * 1.6);
      p.position.set(x, 0, z);
      p.rotation.y = rnd() * 6;
      stage(p);
    }

    // Zona reservada para la expansión norte (sin árboles)
    const nz0 = NORTH_MIN_Z - 2.6;
    // Zonas reservadas para las expansiones norte y este (sin árboles)
    const reserved = (x, z) => x > fx0 - 2 && x < EAST_MAX_X + 3 && z > nz0 && z < fz1 + 2;
    // Zona Oeste (Granja 6): lo que se planta ahí se recuerda para sacarlo al abrirla (openWest)
    const inWest = (x, z) => x > WEST_MIN_X - 2.5 && x <= fx0 - 2 && z > nz0 && z < fz1 + 2;
    // Los Cerros (Granja 7): franja al norte de la Zona Norte, a todo el ancho
    const inHills = (x, z) => x > WEST_MIN_X - 2.5 && x < EAST_MAX_X + 1 && z > HILLS_MIN_Z - 2.5 && z <= nz0;
    // Las Flores (Granja 8): franja al este de la Zona Este, de punta a punta
    const inFlores = (x, z) => x >= EAST_MAX_X + 1 && x < FLORES_MAX_X + 2.5 && z > HILLS_MIN_Z - 2.5 && z < fz1 + 1;
    const blocked = reserved;
    const track = (o, x, z) => {
      if (inWest(x, z)) this.westDecor.push(o);
      else if (inFlores(x, z)) this.floresDecor.push(o);
      else if (inHills(x, z)) this.hillsDecor.push(o);
    };
    // Granjas 11 a 20: paisaje alrededor y, más lejos, el río
    this.stageExtraScenery(stage);
    this.buildRiver();

    // Árboles (verdes y otoñales), arbustos y rocas alrededor
    for (let i = 0; i < 130; i++) {
      const x = -48 + rnd() * 106;
      const z = -58 + rnd() * 88;
      const onRoad = Math.abs(z - 16) < 3;
      const nearHouse = Math.abs(x + 27) < 5 && Math.abs(z + 8) < 4.5;
      if (blocked(x, z) || onRoad || nearHouse) continue;
      const t = createTree(0.85 + rnd() * 0.7, rnd() < 0.35);
      t.position.set(x, 0, z);
      t.rotation.y = rnd() * 6;
      stage(t);
      track(t, x, z);
    }
    // Bosque más allá de Los Cerros (queda del otro lado del cerco cuando se abren)
    const rndN = seeded(99);
    for (let i = 0; i < 55; i++) {
      const x = -52 + rndN() * 112;
      const z = HILLS_MIN_Z - 3 - rndN() * 12;
      const t = createTree(0.85 + rndN() * 0.7, rndN() < 0.35);
      t.position.set(x, 0, z);
      t.rotation.y = rndN() * 6;
      stage(t);
      if (z > LAKE_MIN_Z - 2.5) this.lakeDecor.push(t);
    }
    // Bosque más allá de Las Flores (este) y la esquina noreste
    const rndE = seeded(123);
    for (let i = 0; i < 70; i++) {
      const x = FLORES_MAX_X + 3 + rndE() * 18;
      const z = LAKE_MIN_Z - 2 + rndE() * 94;
      const s = 0.85 + rndE() * 0.7;
      const autumn = rndE() < 0.35;
      if (Math.abs(z - 16) < 3) continue;
      const t = createTree(s, autumn);
      t.position.set(x, 0, z);
      t.rotation.y = rndE() * 6;
      stage(t);
    }
    for (let i = 0; i < 14; i++) {
      const t = createTree(0.85 + rndE() * 0.7, rndE() < 0.35);
      t.position.set(60 + rndE() * 15, 0, HILLS_MIN_Z - 3 - rndE() * 12);
      stage(t);
      if (t.position.z > LAKE_MIN_Z - 2.5 && t.position.x < FLORES_MAX_X + 2.5) this.lakeDecor.push(t);
    }
    // Bosque más allá de La Laguna (norte)
    const rndL = seeded(321);
    for (let i = 0; i < 75; i++) {
      const t = createTree(0.85 + rndL() * 0.7, rndL() < 0.35);
      t.position.set(-55 + rndL() * 135, 0, LAKE_MIN_Z - 3 - rndL() * 12);
      t.rotation.y = rndL() * 6;
      stage(t);
    }
    for (let i = 0; i < 40; i++) {
      const x = fx0 - 1.5 + rnd() * (yardW + 3);
      const z = rnd() < 0.5 ? nz0 - rnd() * 1.5 : 19 + rnd() * 3;
      const bsh = createBush(0.8 + rnd() * 0.6);
      bsh.position.set(x, 0, z);
      stage(bsh);
      track(bsh, x, z);
    }
    for (let i = 0; i < 25; i++) {
      const r = createRock(0.5 + rnd() * 0.8);
      r.position.x = -40 + rnd() * 90;
      r.position.z = -50 + rnd() * 78;
      if (Math.abs(r.position.z - 16) < 3 || blocked(r.position.x, r.position.z)) continue;
      r.rotation.y = rnd() * 6;
      stage(r);
      track(r, r.position.x, r.position.z);
    }

    // Matas de pasto y flores (instanciadas)
    const dummy = new THREE.Object3D();
    const tuftGeo = new THREE.ConeGeometry(0.13, 0.4, 5);
    const flowerGeo = new THREE.SphereGeometry(0.1, 8, 6);
    const flowerMat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
    const tuftMat = mat('#4fae35');
    const buckets = [null, this.westDecor, this.hillsDecor, this.floresDecor, this.extraDecor.sur].map((decor) => ({
      decor, tufts: new THREE.InstancedMesh(tuftGeo, tuftMat, 700), flowers: new THREE.InstancedMesh(flowerGeo, flowerMat, 300), nt: 0, nf: 0,
    }));
    const flowerColors = ['#ffffff', '#ffd166', '#ef476f', '#a29bfe', '#ff9f1c'].map((c) => new THREE.Color(c));
    let nt = 0;
    let nf = 0;
    for (let i = 0; i < 5000 && (nt < 700 || nf < 300); i++) {
      const x = -45 + rnd() * 100;
      const z = -55 + rnd() * 87;
      if (blocked(x, z) || Math.abs(z - 16) < 2.2) continue;
      dummy.position.set(x, 0.12, z);
      dummy.rotation.set(0, rnd() * 6, 0);
      const s = 0.7 + rnd() * 0.8;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      const bk = buckets[inWest(x, z) ? 1 : inFlores(x, z) ? 3 : inHills(x, z) ? 2 : this.extraZoneOf(x, z) === 'sur' ? 4 : 0];
      if (rnd() < 0.7 && nt < 700) {
        bk.tufts.setMatrixAt(bk.nt++, dummy.matrix);
        nt++;
      } else if (nf < 300) {
        bk.flowers.setMatrixAt(bk.nf, dummy.matrix);
        bk.flowers.setColorAt(bk.nf++, flowerColors[Math.floor(rnd() * flowerColors.length)]);
        nf++;
      }
    }
    for (const bk of buckets) {
      bk.tufts.count = bk.nt;
      bk.flowers.count = bk.nf;
      if (!bk.nt && !bk.nf) continue;
      scene.add(bk.tufts, bk.flowers);
      bk.decor?.push(bk.tufts, bk.flowers);
    }

    // Fusión por zonas: lo de cada expansión (oeste, cerros, flores, laguna) por separado,
    // así al abrirla se saca entero como antes.
    const decorOf = new Map();
    for (const arr of [this.westDecor, this.hillsDecor, this.floresDecor, this.lakeDecor]) for (const o of arr) decorOf.set(o, arr);
    // Lo que quedó suelto dentro de una zona de las Granjas 11 a 20 se saca cuando se abre esa zona
    const wp = new THREE.Vector3();
    for (const o of staged) {
      if (decorOf.has(o)) continue;
      o.getWorldPosition(wp);
      const key = this.extraZoneOf(wp.x, wp.z);
      if (key) { this.extraDecor[key].push(o); decorOf.set(o, this.extraDecor[key]); }
    }
    const groups = new Map();
    for (const o of staged) {
      const arr = decorOf.get(o) ?? null;
      if (!groups.has(arr)) groups.set(arr, []);
      groups.get(arr).push(o);
    }
    for (const [arr, objs] of groups) {
      const meshes = batchStatic(objs, scene);
      if (!arr) continue;
      for (const o of objs) arr.splice(arr.indexOf(o), 1);
      arr.push(...meshes);
    }
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

// Granjas 11 a 20: zonas, construcciones, especiales y la boda
Object.assign(World.prototype, ExpansionMixin);
