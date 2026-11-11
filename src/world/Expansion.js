// Expansion: Granjas 11 a 20 (se mezcla en World.prototype; `this` es el World).
//   11: 🧉 Zona Sur (yerbal, secadero, pulpería) + 🚂 Estación (tren con pedidos grandes)
//   12: 🎋 Cañaveral → 🍬 Ingenio → 🍮 Dulce de leche + 🐎 Caballeriza (Mela anda a caballo)
//   13: 🍅 La Chacra (huerta, 🍝 fábrica de pastas, plato 🍜) + 💧 Tanque australiano (riego)
//   14: 🐂 Novillos → 🌭 Carnicería → 🥙 Parrilla, 🏪 Bodegón, plato 🍖 + 🎻 Peña folklórica
//   15: 🏡 Las Lomas: Hostería (huéspedes, cabañas), ☁️ Algodonal → 🛏️ Lavadero (sábanas) + 🏊 Pileta
//   16: 🌲 Las Sierras: Pinar → 🪵 Aserradero → 🪑 Carpintería (amuebla cabañas) + 🚡 Aerosilla
//   17: 🍇 Viñedo → 🍷 Bodega, 🏪 Vinoteca, maridaje en el Restaurante + 🎈 Globo aerostático
//   18: ⚓ La Costa: Puerto (barco de exportación, paga ×4) y Despachante + 🏗️ Grúa
//   19: 🥜 Manisero → 🍫 Chocolatería, 🏪 Casa de Chocolates, plato 🍰 + 🌳 Plaza del pueblo
//   20: 🏛️ Estancia Mela, 💍 la boda de Mela y Matías + 🎆 Fiesta de la Cosecha
import * as THREE from 'three';
import { ProductionUnit } from '../entities/ProductionUnit.js';
import { Processor } from '../entities/Processor.js';
import { Shop } from '../entities/Shop.js';
import { Truck } from '../entities/Truck.js';
import { Hostel } from '../entities/Hostel.js';
import { Character } from '../entities/Character.js';
import { bakeGroup, batchStatic } from '../core/Bake.js';
import { Pile } from '../systems/Pile.js';
import { CashPile } from '../systems/CashPile.js';
import { TransferZone } from '../systems/TransferZone.js';
import { GroundDecal, FONT, makeTextSprite } from '../core/Labels.js';
import { mat, sphere, ITEMS, createHayBale } from '../models/Models.js';
import {
  createRails, createStation, createTrain, createStable, createWaterTank, createStage, createPool, createLiftTower,
  createLiftStation, createLiftChair, createBalloon, createShip, createDock, createCrane, createGlorieta, createCasona,
  createWeddingArch, createHarvestFest, createMountain, createPineTree, createTree, createRock,
} from '../models/ModelsExtra.js';
import { seeded, pick, rand, distXZ2, lerpAngle } from '../utils.js';

const V = (x, z) => new THREE.Vector3(x, 0, z);

// Límites de las zonas nuevas
export const SOUTH_MAX_Z = 46;     // Granja 11: Zona Sur (del otro lado de la ruta)
export const CHACRA_MIN_X = -74;   // Granja 13: La Chacra (lejano oeste, de punta a punta)
export const LOMAS_MAX_X = 98;     // Granja 15: Las Lomas (lejano este, de punta a punta)
export const SIERRAS_MIN_Z = -94;  // Granja 16: Las Sierras (lejano norte)
export const COSTA_MAX_Z = 62;     // Granja 18: La Costa (hasta el río)
const ROAD_Z = 16;
const TRACK_Z = 43;
const RIVER_Z = 63;
const DOCK = { x0: 19.6, x1: 28.4 };
const LIFT_A = V(93, -42); // estación de la aerosilla en Las Lomas
const LIFT_B = V(30, -88); // ...y en Las Sierras
const ARCH = V(44, 50.5);  // arco de la boda

/** Construcciones especiales de las Granjas 11 a 20 (siguen a Molino, Silo, Invernadero, Laguna y Fuente). */
export const SPECIALS_EXTRA = [
  { name: 'Estación', icon: '🚂', pos: V(20, 40.2), price: 20000, requires: ['south'], tile: V(23.4, 36.6), build: 'buildStation' },
  { name: 'Caballeriza', icon: '🐎', pos: V(14, 29), price: 22000, requires: ['south'], tile: V(14, 33), build: 'buildStable' },
  { name: 'Tanque australiano', icon: '💧', pos: V(-61, -10), price: 24000, requires: ['chacra'], build: 'buildTank' },
  { name: 'Peña folklórica', icon: '🎻', pos: V(-62, -56), price: 26000, requires: ['chacra'], tile: V(-62, -51.6), build: 'buildPena' },
  { name: 'Pileta', icon: '🏊', pos: V(91, 8), price: 28000, requires: ['hostel'], build: 'buildPool' },
  { name: 'Aerosilla', icon: '🚡', pos: LIFT_A, price: 30000, requires: ['sierras'], build: 'buildChairlift' },
  { name: 'Globo aerostático', icon: '🎈', pos: V(94.6, 38.4), price: 32000, requires: ['lomas'], build: 'buildBalloon' },
  { name: 'Grúa', icon: '🏗️', pos: V(31.4, 59.6), price: 34000, requires: ['puerto'], tile: V(32, 55.6), build: 'buildCrane' },
  { name: 'Plaza del pueblo', icon: '🌳', pos: V(6, 22), price: 36000, requires: ['south'], build: 'buildPlaza' },
  { name: 'Fiesta de la Cosecha', icon: '🎆', pos: V(70, 54), price: 40000, requires: ['estancia'], build: 'buildHarvestFest' },
];

/** Negocios nuevos con Gerencia: [clave, nombre, precio, requisitos, encargado/a, ¿encargada?, baldosa]. */
export const GERENCIAS_EXTRA = [
  ['pulperia', 'Pulpería', 30000, ['cashier8', 'carrier8'], 'Aldo', false, V(-8.8, 34.4)],
  ['bodegon', 'Bodegón', 34000, ['cashier9', 'carrier9'], 'Ramona', true, V(-64.8, 39.4)],
  ['hosteria', 'Hostería', 38000, ['cashier10', 'maid'], 'Susana', true, V(78.6, -6)],
  ['vinoteca', 'Vinoteca', 42000, ['cashier11', 'carrier10'], 'Pedro', false, V(88.2, 26.6)],
  ['chocolates', 'Casa de Chocolates', 46000, ['cashier12', 'carrier11'], 'Irma', true, V(-62.8, 55.4)],
];

export const NEW_CONTENT = {
  11: [
    '🧉 Zona Sur: yerbal 🍃 y Secadero (🍃🍃 → 🧉)',
    '🏪 Pulpería, Tarefera Chiche, Tincho y Yoli',
    '🚂 Estación: llega un tren con pedidos grandes',
  ],
  12: [
    '🎋 Cañaveral → 🍬 Ingenio (azúcar)',
    '🍮 Dulce de leche (🥛 + 🍬) y Doña Elsa',
    '🐎 Caballeriza: Mela sale a cabalgar un rato (más rápida y carga más)',
  ],
  13: [
    '🍅 La Chacra (lejano oeste): huerta de tomates',
    '🍝 Fábrica de Pastas (🥣 + 🥚) y Nonna Pina',
    '🍜 Plato nuevo en el Restaurante: tallarines con tuco',
    '💧 Tanque australiano: riego, campos +30%',
  ],
  14: [
    '🐂 Novillos (🌿 → 🥩) → 🌭 Carnicería → 🥙 Parrilla',
    '🏪 Bodegón, Gaucho Ciro y el Parrillero Chacho',
    '🍖 Plato nuevo: asado con ensalada',
    '🎻 Peña folklórica: cada tanto vienen el doble de clientes',
  ],
  15: [
    '🏡 Las Lomas: Hostería con cabañas y huéspedes',
    '☁️ Algodonal → 🛏️ Lavadero: las cabañas se limpian con sábanas',
    '🧹 Mucama Mabel, Conserje Lucía y Lavandera Tere',
    '🏊 Pileta: vienen más huéspedes',
  ],
  16: [
    '🌲 Las Sierras: pinar → 🪵 Aserradero → 🪑 Carpintería',
    '🪑 Las cabañas amuebladas pagan +50%',
    '🚡 Aerosilla entre la Hostería y Las Sierras',
  ],
  17: [
    '🍇 Viñedo → 🍷 Bodega y 🏪 Vinoteca',
    '🍷 Maridaje: con vino en la despensa, los platos pagan +40%',
    '🎈 Globo aerostático: paseos para turistas',
  ],
  18: [
    '⚓ La Costa: Puerto con barcos de exportación (pagan ×4)',
    '📦 Despachante Héctor carga los barcos',
    '🏗️ Grúa: carga sola lo que dejes en el depósito',
  ],
  19: [
    '🥜 Manisero → 🍫 Chocolatería (🍬 + 🥛 + 🥜)',
    '🏪 Casa de Chocolates y plato 🍰 chocotorta',
    '🌳 Plaza del pueblo: más clientes en todas las tiendas',
  ],
  20: [
    '🏛️ Estancia Mela: la Casona',
    '💍 ¡La boda de Mela y Matías!',
    '🎆 Fiesta de la Cosecha: cada tanto, ventas +50%',
  ],
};

export const ExpansionMixin = {
  // =====================================================================
  // DESBLOQUEOS
  // =====================================================================
  expansionDefs() {
    const worker = (opts) => (i) => this.spawnWorker({ ...opts, instant: i });
    return [
      // ----- Granja 11: Zona Sur (yerbal, secadero y pulpería) -----
      { id: 'south', price: 15000, label: 'Zona Sur', icon: '🧉', pos: V(4.5, 11.8), requires: ['restaurant'], minLevel: 11, apply: (i) => this.openSouth(i) },
      { id: 'yerbal', price: 12000, label: 'Yerbal', icon: '🍃', pos: V(-30, 28), requires: ['south'], minLevel: 11, apply: (i) => this.buildYerbal(i) },
      { id: 'secadero', price: 14000, label: 'Secadero', icon: '🧉', pos: V(-17, 24), requires: ['yerbal'], minLevel: 11, apply: (i) => this.buildSecadero(i) },
      { id: 'farmer13', price: 12000, label: 'Tarefera Chiche', icon: '👩‍🌾', pos: V(-22.5, 33.5), requires: ['secadero'], minLevel: 11,
        apply: worker({ role: 'farmer', name: 'Chiche', position: V(-22.5, 33.5), field: () => this.yerbaField, unit: () => this.secadero }) },
      { id: 'shop8', price: 13000, label: 'Pulpería', icon: '🏪', pos: V(-4, 30), requires: ['secadero'], minLevel: 11, apply: (i) => this.buildShop8(i) },
      { id: 'cashier8', price: 12500, label: 'Cajero Tincho', icon: '🧑‍💼', pos: V(0.2, 27.5), requires: ['shop8'], minLevel: 11,
        apply: worker({ role: 'cashier', name: 'Tincho', position: V(0.2, 27.5), shop: () => this.shop8 }) },
      { id: 'carrier8', price: 13500, label: 'Repartidora Yoli', icon: '🧺', pos: V(-9.5, 26.5), requires: ['shop8'], minLevel: 11,
        apply: worker({ role: 'carrier', name: 'Yoli', position: V(-9.5, 26.5), sources: () => [this.secadero, this.ingenio, this.dulceria], shop: () => this.shop8 }) },

      // ----- Granja 12: cañaveral, ingenio y dulce de leche -----
      { id: 'cane', price: 14000, label: 'Cañaveral', icon: '🎋', pos: V(30, 26), requires: ['south'], minLevel: 12, apply: (i) => this.buildCane(i) },
      { id: 'ingenio', price: 15000, label: 'Ingenio', icon: '🍬', pos: V(44, 22), requires: ['cane'], minLevel: 12, apply: (i) => this.buildIngenio(i) },
      { id: 'farmer14', price: 13000, label: 'Cañero Pepe', icon: '👨‍🌾', pos: V(37.5, 30.5), requires: ['ingenio'], minLevel: 12,
        apply: worker({ role: 'farmer', name: 'Pepe', position: V(37.5, 30.5), field: () => this.caneField, unit: () => this.ingenio }) },
      { id: 'dulceria', price: 18000, label: 'Dulce de Leche', icon: '🍮', pos: V(56, 22), requires: ['ingenio', 'cow'], minLevel: 12, apply: (i) => this.buildDulceria(i) },
      { id: 'baker6', price: 19000, label: 'Doña Elsa', icon: '👩‍🍳', pos: V(61.5, 26.5), requires: ['dulceria'], minLevel: 12,
        apply: worker({ role: 'baker', name: 'Elsa', position: V(61.5, 26.5), targets: () => [this.dulceria] }) },

      // ----- Granja 13: La Chacra (huerta y fábrica de pastas) -----
      { id: 'chacra', price: 17000, label: 'La Chacra', icon: '🍅', pos: V(-44.4, -34), requires: ['south'], minLevel: 13, apply: (i) => this.openChacra(i) },
      { id: 'huerta', price: 15000, label: 'Huerta', icon: '🍅', pos: V(-60, -40), requires: ['chacra'], minLevel: 13, apply: (i) => this.buildHuerta(i) },
      { id: 'farmer15', price: 15000, label: 'Huertero Quique', icon: '👨‍🌾', pos: V(-53, -40), requires: ['huerta'], minLevel: 13,
        apply: worker({ role: 'farmer', name: 'Quique', position: V(-53, -40), field: () => this.tomatoField, unit: () => this.restaurant }) },
      { id: 'pastas', price: 18000, label: 'Fábrica de Pastas', icon: '🍝', pos: V(-60, -28), requires: ['huerta', 'special0'], minLevel: 13, apply: (i) => this.buildPastas(i) },
      { id: 'baker7', price: 20000, label: 'Nonna Pina', icon: '👵', pos: V(-54, -25.6), requires: ['pastas'], minLevel: 13,
        apply: worker({ role: 'baker', name: 'Pina', position: V(-54, -25.6), targets: () => [this.pastas] }) },

      // ----- Granja 14: novillos, carnicería, parrilla y bodegón -----
      { id: 'potrero', price: 15000, label: 'Potrero', icon: '🌿', pos: V(-64, 8), requires: ['chacra'], minLevel: 14, apply: (i) => this.buildPotrero(i) },
      { id: 'novillos', price: 19000, label: 'Novillos', icon: '🐂', pos: V(-53, 6), requires: ['potrero'], minLevel: 14, apply: (i) => this.buildNovillos(i) },
      { id: 'carniceria', price: 20000, label: 'Carnicería', icon: '🌭', pos: V(-63, 22), requires: ['novillos'], minLevel: 14, apply: (i) => this.buildCarniceria(i) },
      { id: 'farmer16', price: 18000, label: 'Gaucho Ciro', icon: '🤠', pos: V(-58.3, 14), requires: ['novillos'], minLevel: 14,
        apply: worker({ role: 'farmer', name: 'Ciro', position: V(-58.3, 14), field: () => this.potreroField, unit: () => this.novillos,
          errand: () => ({ type: 'beef', from: this.novillos, to: this.carniceria }) }) },
      { id: 'parrilla', price: 23000, label: 'Parrilla', icon: '🥙', pos: V(-53, 22), requires: ['carniceria', 'bakery'], minLevel: 14, apply: (i) => this.buildParrilla(i) },
      { id: 'shop9', price: 20000, label: 'Bodegón', icon: '🏪', pos: V(-60, 35), requires: ['carniceria'], minLevel: 14, apply: (i) => this.buildShop9(i) },
      { id: 'cashier9', price: 19000, label: 'Cajera Nati', icon: '🧑‍💼', pos: V(-55.8, 32.5), requires: ['shop9'], minLevel: 14,
        apply: worker({ role: 'cashier', name: 'Nati', position: V(-55.8, 32.5), shop: () => this.shop9 }) },
      { id: 'carrier9', price: 20500, label: 'Repartidor Gaspar', icon: '🧺', pos: V(-50, 30), requires: ['shop9'], minLevel: 14,
        apply: worker({ role: 'carrier', name: 'Gaspar', position: V(-50, 30), sources: () => [this.carniceria, this.parrilla, this.pastas], shop: () => this.shop9 }) },
      { id: 'baker8', price: 24000, label: 'Parrillero Chacho', icon: '👨‍🍳', pos: V(-47.6, 22), requires: ['parrilla', 'carrier9'], minLevel: 14,
        apply: worker({ role: 'baker', name: 'Chacho', position: V(-47.6, 22), targets: () => [this.parrilla, this.carniceria] }) },

      // ----- Granja 15: Las Lomas (hostería, lavadero) -----
      { id: 'lomas', price: 19000, label: 'Las Lomas', icon: '🏡', pos: V(70.4, -50), requires: ['chacra'], minLevel: 15, apply: (i) => this.openLomas(i) },
      { id: 'algodonal', price: 17000, label: 'Algodonal', icon: '☁️', pos: V(78, 10.6), requires: ['lomas'], minLevel: 15, apply: (i) => this.buildAlgodonal(i) },
      { id: 'lavadero', price: 20000, label: 'Lavadero', icon: '🛏️', pos: V(79, 2), requires: ['algodonal'], minLevel: 15, apply: (i) => this.buildLavadero(i) },
      { id: 'hostel', price: 26000, label: 'Hostería', icon: '🏡', pos: V(85, -6), requires: ['lomas'], minLevel: 15, apply: (i) => this.buildHostel(i) },
      { id: 'farmer20', price: 22000, label: 'Lavandera Tere', icon: '🧺', pos: V(74.6, 3.6), requires: ['lavadero'], minLevel: 15,
        apply: worker({ role: 'farmer', name: 'Tere', position: V(74.6, 3.6), field: () => this.cottonField, unit: () => this.lavadero }) },
      { id: 'cashier10', price: 21000, label: 'Conserje Lucía', icon: '🛎️', pos: V(90.6, -4.4), requires: ['hostel'], minLevel: 15,
        apply: worker({ role: 'cashier', name: 'Lucía', position: V(90.6, -4.4), shop: () => this.hostel }) },
      { id: 'maid', price: 21000, label: 'Mucama Mabel', icon: '🧹', pos: V(79, -14.6), requires: ['hostel', 'lavadero'], minLevel: 15,
        apply: worker({ role: 'maid', name: 'Mabel', position: V(79, -14.6) }) },

      // ----- Granja 16: Las Sierras (pinar, aserradero, carpintería) -----
      { id: 'sierras', price: 21000, label: 'Las Sierras', icon: '🌲', pos: V(2, -68.4), requires: ['lomas'], minLevel: 16, apply: (i) => this.openSierras(i) },
      { id: 'pinar', price: 19000, label: 'Pinar', icon: '🌲', pos: V(-30, -84), requires: ['sierras'], minLevel: 16, apply: (i) => this.buildPinar(i) },
      { id: 'aserradero', price: 22000, label: 'Aserradero', icon: '🪵', pos: V(-14, -88), requires: ['pinar'], minLevel: 16, apply: (i) => this.buildAserradero(i) },
      { id: 'farmer17', price: 20000, label: 'Hachero Moncho', icon: '🪓', pos: V(-21.5, -80.4), requires: ['aserradero'], minLevel: 16,
        apply: worker({ role: 'farmer', name: 'Moncho', position: V(-21.5, -80.4), field: () => this.pineField, unit: () => this.aserradero }) },
      { id: 'carpinteria', price: 26000, label: 'Carpintería', icon: '🪑', pos: V(-2, -88), requires: ['aserradero'], minLevel: 16, apply: (i) => this.buildCarpinteria(i) },
      { id: 'baker10', price: 27000, label: 'Carpintero Fermín', icon: '🔨', pos: V(4.6, -84.4), requires: ['carpinteria'], minLevel: 16,
        apply: worker({ role: 'baker', name: 'Fermín', position: V(4.6, -84.4), targets: () => [this.carpinteria, this.aserradero] }) },

      // ----- Granja 17: viñedo, bodega y vinoteca -----
      { id: 'vinedo', price: 21000, label: 'Viñedo', icon: '🍇', pos: V(84, 33), requires: ['lomas'], minLevel: 17, apply: (i) => this.buildVinedo(i) },
      { id: 'bodega', price: 25000, label: 'Bodega', icon: '🍷', pos: V(78, 21.5), requires: ['vinedo'], minLevel: 17, apply: (i) => this.buildBodega(i) },
      { id: 'farmer18', price: 21000, label: 'Viñatera Flor', icon: '👩‍🌾', pos: V(84.4, 26.4), requires: ['bodega'], minLevel: 17,
        apply: worker({ role: 'farmer', name: 'Flor', position: V(84.4, 26.4), field: () => this.grapeField, unit: () => this.bodega }) },
      { id: 'shop10', price: 23000, label: 'Vinoteca', icon: '🏪', pos: V(93, 22.5), requires: ['bodega'], minLevel: 17, apply: (i) => this.buildShop10(i) },
      { id: 'cashier11', price: 22000, label: 'Cajero Santi', icon: '🧑‍💼', pos: V(96.9, 20), requires: ['shop10'], minLevel: 17,
        apply: worker({ role: 'cashier', name: 'Santi', position: V(96.9, 20), shop: () => this.shop10 }) },
      { id: 'carrier10', price: 23500, label: 'Repartidora Cami', icon: '🧺', pos: V(85.2, 21.6), requires: ['shop10'], minLevel: 17,
        apply: worker({ role: 'carrier', name: 'Cami', position: V(85.2, 21.6), sources: () => [this.bodega, this.chocolateria], shop: () => this.shop10 }) },

      // ----- Granja 18: La Costa (puerto) -----
      { id: 'costa', price: 23000, label: 'La Costa', icon: '⚓', pos: V(-30, 40), requires: ['south'], minLevel: 18, apply: (i) => this.openCosta(i) },
      { id: 'puerto', price: 28000, label: 'Puerto', icon: '🚢', pos: V(24, 58), requires: ['costa'], minLevel: 18, apply: (i) => this.buildPort(i) },
      { id: 'shipper', price: 30000, label: 'Despachante Héctor', icon: '📦', pos: V(16.4, 58.4), requires: ['puerto'], minLevel: 18,
        apply: worker({ role: 'trucker', name: 'Héctor', position: V(16.4, 58.4), vehicle: () => this.ship, idle: V(17.2, 59.6), talkRole: 'shipper' }) },

      // ----- Granja 19: manisero, chocolatería y casa de chocolates -----
      { id: 'manisero', price: 19000, label: 'Manisero', icon: '🥜', pos: V(-30, 53), requires: ['costa'], minLevel: 19, apply: (i) => this.buildManisero(i) },
      { id: 'chocolateria', price: 23000, label: 'Chocolatería', icon: '🍫', pos: V(-12, 50), requires: ['manisero', 'ingenio'], minLevel: 19,
        apply: (i) => this.buildChocolateria(i) },
      { id: 'farmer19', price: 19000, label: 'Manisero Rami', icon: '👨‍🌾', pos: V(-22, 57.4), requires: ['chocolateria'], minLevel: 19,
        apply: worker({ role: 'farmer', name: 'Rami', position: V(-22, 57.4), field: () => this.peanutField, unit: () => this.chocolateria }) },
      { id: 'baker11', price: 24000, label: 'Chocolatera Greta', icon: '👩‍🍳', pos: V(-5.6, 53), requires: ['chocolateria'], minLevel: 19,
        apply: worker({ role: 'baker', name: 'Greta', position: V(-5.6, 53), targets: () => [this.chocolateria] }) },
      { id: 'shop11', price: 21000, label: 'Casa de Chocolates', icon: '🏪', pos: V(-58, 51), requires: ['chocolateria'], minLevel: 19, apply: (i) => this.buildShop11(i) },
      { id: 'cashier12', price: 20000, label: 'Cajero Bruno', icon: '🧑‍💼', pos: V(-53.8, 48.5), requires: ['shop11'], minLevel: 19,
        apply: worker({ role: 'cashier', name: 'Bruno', position: V(-53.8, 48.5), shop: () => this.shop11 }) },
      { id: 'carrier11', price: 21500, label: 'Repartidora Maru', icon: '🧺', pos: V(-50, 54), requires: ['shop11'], minLevel: 19,
        apply: worker({ role: 'carrier', name: 'Maru', position: V(-50, 54), sources: () => [this.chocolateria, this.dulceria], shop: () => this.shop11 }) },

      // ----- Granja 20: Estancia Mela y la boda -----
      { id: 'estancia', price: 30000, label: 'Estancia Mela', icon: '🏛️', pos: V(58, 52), requires: ['costa'], minLevel: 20, apply: (i) => this.buildEstancia(i) },
      { id: 'boda', price: 25000, label: 'Casamiento', icon: '💍', pos: V(44, 47.6), requires: ['estancia', 'matias'], minLevel: 20, apply: (i) => this.buildWedding(i) },

      // ----- Mejoras por niveles nuevas -----
      { id: 'steersUp', repeat: true, max: 5, growth: 1.5, price: 6000, label: 'Novillos+', icon: '🐂', pos: V(-47.6, 3), requires: ['novillos'], minLevel: 14,
        needs: () => !!this.novillos,
        apply: (i) => { this.novillos.addAnimals(1, i); this.novillos.speedMult += 0.3; } },
      { id: 'cabins', repeat: true, fixedMax: true, max: 2, growth: 2.2, price: 12000, label: 'Más cabañas', icon: '🛖', pos: V(73.6, -22.4),
        requires: ['hostel'], minLevel: 15, needs: () => !!this.hostel,
        levelLabels: ['Más cabañas (6)', 'Más cabañas (8)'],
        apply: (i) => this.hostel.addCabins(2, i) },
    ];
  },

  /** Especial de las Granjas 11 a 20 (k = 5..14). */
  expansionSpecialDef(k, lvl) {
    const s = SPECIALS_EXTRA[k - 5];
    return {
      id: `special${k}`, price: s.price, minLevel: lvl, requires: s.requires, label: s.name, icon: s.icon,
      pos: (s.tile ?? s.pos).clone(),
      apply: (i) => {
        this[s.build](i, s);
        this.specialBonus += 0.2;
        this.updateIncome();
      },
    };
  },

  // =====================================================================
  // ZONAS NUEVAS
  // =====================================================================
  /** Patio de tierra para un rectángulo nuevo. */
  addYard(x0, x1, z0, z1) {
    const yard = new THREE.Mesh(
      new THREE.PlaneGeometry(x1 - x0 + 0.02, z1 - z0 + 0.02),
      new THREE.MeshStandardMaterial({ map: this.makeDirtTexture((x1 - x0) / 8, (z1 - z0) / 8), roughness: 0.95 }),
    );
    yard.rotation.x = -Math.PI / 2;
    yard.position.set((x0 + x1) / 2, -0.016, (z0 + z1) / 2);
    yard.receiveShadow = true;
    this.scene.add(yard);
  },

  clearDecor(key) {
    for (const o of this.extraDecor[key]) o.removeFromParent();
    this.extraDecor[key] = [];
  },

  openSouth(instant) {
    const z0 = this.bounds.maxZ + 0.6;
    this.bounds.maxZ = SOUTH_MAX_Z;
    this.southOpen = true;
    this.buildFence();
    this.clearDecor('sur');
    this.addYard(this.bounds.minX - 0.6, this.bounds.maxX + 0.6, z0, SOUTH_MAX_Z + 0.6);
    this.game.flags.south = true;
    if (!instant) {
      this.game.fx.burst(V(4, 28).setY(1), 40);
      this.game.chatter?.say(this.player, '¡Cruzamos la ruta! Acá va el yerbal 🧉', 3.2);
    }
  },

  openChacra(instant) {
    this.bounds.minX = CHACRA_MIN_X;
    this.chacraOpen = true;
    this.buildFence();
    this.clearDecor('chacra');
    this.addYard(CHACRA_MIN_X - 0.6, -46.6, this.bounds.minZ - 0.6, this.bounds.maxZ + 0.6);
    this.game.flags.chacra = true;
    if (!instant) {
      this.game.fx.burst(V(-60, -20).setY(1), 40);
      this.game.chatter?.say(this.player, '¡La Chacra! Tomates, pastas... ¡y asado! 🍅', 3.2);
    }
  },

  openLomas(instant) {
    const x0 = this.bounds.maxX + 0.6;
    this.bounds.maxX = LOMAS_MAX_X;
    this.lomasOpen = true;
    this.buildFence();
    this.clearDecor('lomas');
    this.addYard(x0, LOMAS_MAX_X + 0.6, this.bounds.minZ - 0.6, this.bounds.maxZ + 0.6);
    this.game.flags.lomas = true;
    if (!instant) {
      this.game.fx.burst(V(85, -10).setY(1), 40);
      this.game.chatter?.say(this.player, '¡Qué lindas lomas! Ideal para una hostería 🏡', 3.2);
    }
  },

  openSierras(instant) {
    const z1 = this.bounds.minZ - 0.6;
    this.bounds.minZ = SIERRAS_MIN_Z;
    this.sierrasOpen = true;
    this.buildFence();
    this.clearDecor('sierras');
    this.addYard(this.bounds.minX - 0.6, this.bounds.maxX + 0.6, SIERRAS_MIN_Z - 0.6, z1);
    this.game.flags.sierras = true;
    if (!instant) {
      this.game.fx.burst(V(0, -84).setY(1), 40);
      this.game.chatter?.say(this.player, '¡Llegamos a las sierras! Qué aire puro 🌲', 3.2);
    }
  },

  openCosta(instant) {
    const z0 = this.bounds.maxZ + 0.6;
    this.bounds.maxZ = COSTA_MAX_Z;
    this.costaOpen = true;
    this.buildFence();
    this.clearDecor('costa');
    this.addYard(this.bounds.minX - 0.6, this.bounds.maxX + 0.6, z0, COSTA_MAX_Z + 0.6);
    this.game.flags.costa = true;
    if (!instant) {
      this.game.fx.burst(V(20, 54).setY(1), 40);
      this.game.chatter?.say(this.player, '¡El río! Desde acá salen los barcos ⚓', 3.2);
    }
  },

  /** Huecos del cerco: la ruta y las vías cruzan los costados; el muelle, el cerco del sur. */
  fenceGaps() {
    const b = this.bounds;
    const side = [];
    if (b.maxZ > ROAD_Z) side.push([ROAD_Z - 2.0, ROAD_Z + 2.0]);
    if (this.stationOn && b.maxZ > TRACK_Z) side.push([TRACK_Z - 1.6, TRACK_Z + 1.6]);
    const south = this.portOn ? [[DOCK.x0, DOCK.x1]] : [];
    return { side, south };
  },

  // =====================================================================
  // GRANJA 11
  // =====================================================================
  buildYerbal(instant) {
    this.yerbaField = this.addField({ type: 'yerba', center: V(-30, 28), cols: 6, rows: 4, spacing: 1.6, growTime: 9 });
    this.game.flags.yerba = true;
    if (!instant) this.game.fx.burst(V(-30, 28).setY(1), 36);
  },

  buildSecadero(instant) {
    this.secadero = new Processor(this.game, {
      position: V(-17, 24), recipe: { yerba: 2 }, output: 'mate', produceTime: 3.5, name: 'SECADERO',
      look: { wall: '#eef7e4', roofColor: '#3f8f2a', awning: ['#ffffff', '#ffd23f'] },
      inputRoles: ['player', 'farmer', 'baker'], outputRoles: ['player', 'carrier'], inputMax: 24,
      outputPile: { spacing: [0.4, 0.36] },
    });
    this.afterProcessor(this.secadero, instant);
    this.game.flags.mate = true;
  },

  buildShop8(instant) {
    this.shop8 = new Shop(this.game, {
      position: V(-4, 30), name: 'PULPERÍA', spawnPoint: V(2, 49), exitPoint: V(-10, 49), queueSize: 4, instant,
      look: { wall: '#f6ead2', trim: '#2e7d32', awning: ['#ffffff', '#2e7d32'] },
      products: [
        { type: 'mate', x: -1.15, max: 14, pile: { cols: 1, rows: 2, spacing: [0.4, 0.4] } },
        { type: 'sugar', flag: 'sugar', x: -0.4, max: 12, pile: { cols: 1, rows: 2, spacing: [0.4, 0.4] } },
        { type: 'dulce', flag: 'dulce', x: 0.4, max: 12, pile: { cols: 1, rows: 2, spacing: [0.4, 0.4] } },
      ],
    });
    this.game.flags.shop8 = true;
  },

  /** Estación: andén, vías de punta a punta y un tren que trae pedidos grandes (paga ×2,4). */
  buildStation(instant, s) {
    const m = bakeGroup(createStation());
    m.position.copy(s.pos);
    this.scene.add(m);
    const rails = createRails(240);
    rails.position.set(0, 0, TRACK_Z);
    batchStatic([rails], this.scene, { castShadow: false });
    this.game.obstacles.push({ minX: s.pos.x - 5.6, maxX: s.pos.x - 1.2, minZ: s.pos.z - 2.7, maxZ: s.pos.z - 0.5 });
    this.stationOn = true;
    this.buildFence();
    this.train = new Truck(this.game, {
      parkPos: V(20, TRACK_Z), enterX: -120, exitX: 125, createModel: createTrain, rewardMult: 2.4, budgetMult: 2.5,
      returnTime: 25, startLevel: 6, bedMax: 120, maxSpeed: 14,
      dropOffset: new THREE.Vector3(1.6, 0, -3.3), cashOffset: new THREE.Vector3(5.2, 0, -3.3), boardOffset: new THREE.Vector3(0, 4.4, -2.4),
    });
    this.addSmoke(this.train);
    this.game.flags.train = true;
    if (!instant) {
      this.game.fx.popIn(m);
      this.game.fx.burst(s.pos.clone().setY(1.5), 50);
      this.game.chatter?.say(this.player, '¡Llega el tren! Trae pedidos grandotes 🚂', 3.2);
    }
  },

  /** Humo de la chimenea del tren / barco mientras anda. */
  addSmoke(v) {
    let t = 0;
    const tmp = new THREE.Vector3();
    this.game.add({ update: (dt) => {
      if (v.state === 'away') return;
      t -= dt;
      if (t > 0) return;
      t = v.state === 'waiting' ? 0.9 : 0.25;
      v.model.root.localToWorld(tmp.copy(v.model.smoke));
      const s = sphere(0.3, '#e8e8e8', tmp.x, tmp.y, tmp.z);
      s.castShadow = false;
      this.scene.add(s);
      const y0 = s.position.y;
      this.game.fx.tween(1.6, (u) => { s.position.y = y0 + u * 2; s.scale.setScalar(0.6 + u * 1.6); }, () => s.removeFromParent());
    } });
  },

  // =====================================================================
  // GRANJA 12
  // =====================================================================
  buildCane(instant) {
    this.caneField = this.addField({ type: 'cane', center: V(30, 26), cols: 6, rows: 4, spacing: 1.5, growTime: 9 });
    this.game.flags.cane = true;
    if (!instant) this.game.fx.burst(V(30, 26).setY(1), 36);
  },

  buildIngenio(instant) {
    this.ingenio = new Processor(this.game, {
      position: V(44, 22), recipe: { cane: 2 }, output: 'sugar', produceTime: 3.5, name: 'INGENIO',
      look: { wall: '#ffffff', roofColor: '#3f72c0', awning: ['#ffffff', '#3f72c0'] },
      inputRoles: ['player', 'farmer', 'baker'], outputRoles: ['player', 'carrier'], inputMax: 24,
      outputPile: { spacing: [0.44, 0.4] },
    });
    this.afterProcessor(this.ingenio, instant);
    this.game.flags.sugar = true;
  },

  buildDulceria(instant) {
    this.dulceria = new Processor(this.game, {
      position: V(56, 22), recipe: { milk: 1, sugar: 1 }, output: 'dulce', produceTime: 5, name: 'DULCE DE LECHE',
      look: { wall: '#fff3e0', roofColor: '#9b5a24', awning: ['#ffffff', '#9b5a24'] },
      inputRoles: ['player', 'baker'], outputRoles: ['player', 'carrier'], outputMax: 14,
      outputPile: { spacing: [0.4, 0.4] },
    });
    this.afterProcessor(this.dulceria, instant);
    this.game.flags.dulce = true;
  },

  /**
   * Caballeriza: parándose en la baldosa 🐎, Mela sale a cabalgar (+1,6 de velocidad y +10 de carga)
   * durante HORSE_RIDE segundos. Después el caballo se cansa, vuelve solo a la caballeriza y
   * descansa HORSE_REST segundos antes de poder salir de nuevo.
   */
  buildStable(instant, s) {
    const HORSE_RIDE = 75;
    const HORSE_REST = 90;
    const m = bakeGroup(createStable());
    m.position.copy(s.pos);
    this.scene.add(m);
    this.game.obstacles.push({ minX: s.pos.x - 2.4, maxX: s.pos.x + 3.3, minZ: s.pos.z - 1.7, maxZ: s.pos.z + 1.7 });
    const g = this.game;
    const p = this.player;
    const padPos = s.pos.clone().add(V(0, 2.9));
    const pad = new GroundDecal(2.2, (ctx, W, H, ready) => {
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, W / 2 - 14, 0, Math.PI * 2);
      ctx.fillStyle = ready ? 'rgba(255,207,58,0.45)' : 'rgba(120,120,120,0.25)';
      ctx.fill();
      ctx.lineWidth = 12;
      ctx.strokeStyle = ready ? '#ffcf3a' : '#9a9a9a';
      ctx.stroke();
      ctx.font = `100px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ready ? '🐎' : '😴', W / 2, H / 2 + 6);
    });
    pad.mesh.position.set(padPos.x, 0.07, padPos.z);
    this.scene.add(pad.mesh);
    const readyLbl = makeTextSprite('🐎 ¡A cabalgar!', { color: '#ffe066', stroke: '#6b3a1a', worldHeight: 0.5 });
    const restLbl = makeTextSprite('😴 El caballo descansa', { worldHeight: 0.45 });
    for (const l of [readyLbl, restLbl]) { l.sprite.position.set(padPos.x, 3.6, padPos.z - 1.2); this.scene.add(l.sprite); }
    const horse = { state: 'ready', restUntil: 0, armed: true };
    this.horse = horse;
    const paint = () => {
      pad.redraw(horse.state === 'ready');
      readyLbl.sprite.visible = horse.state === 'ready';
      restLbl.sprite.visible = horse.state === 'resting';
    };
    paint();
    g.add({ update: () => {
      if (horse.state === 'riding') {
        if (g.boostLeft('horse') > 0) return;
        horse.state = 'resting';
        horse.restUntil = g.time + HORSE_REST;
        p.dismountHorse();
        p.speed -= 1.6;
        p.stack.capacity -= 10;
        g.fx.floatText('😮‍💨 ¡Se cansó!', p.position.clone().setY(2.8), '#ffe066');
        g.chatter?.say(p, pick(['¡Uf, el caballo se cansó! Sigo a pie 🐴', 'Andá a descansar, caballito 💤', '¡Gracias, caballito! A la caballeriza 🐴']), 3);
        paint();
        return;
      }
      if (horse.state === 'resting') {
        if (g.time < horse.restUntil) return;
        horse.state = 'ready';
        paint();
        return;
      }
      // Listo: Mela se para en la baldosa para salir a cabalgar
      const inside = !p.frozen && distXZ2(p.position, padPos) < 1.1 * 1.1;
      if (!inside) { horse.armed = true; return; }
      if (!horse.armed) return;
      horse.armed = false;
      horse.state = 'riding';
      p.mountHorse();
      p.speed += 1.6;
      p.stack.capacity += 10;
      g.addBoost('horse', HORSE_RIDE);
      g.audio.play('happy');
      g.fx.burst(p.position.clone().setY(1.5), 30);
      g.chatter?.say(p, pick(['¡Arre, caballito! 🐎', '¡A galopar! 🐎', '¡Vamos, criollo! 🐎']), 2.5);
      paint();
    } });
    if (!instant) {
      g.fx.popIn(m);
      g.fx.burst(s.pos.clone().setY(1.5), 50);
      g.chatter?.say(p, '¡La caballeriza! Parate en la baldosa 🐎 para salir a cabalgar', 3.4);
    }
  },

  // =====================================================================
  // GRANJA 13
  // =====================================================================
  buildHuerta(instant) {
    this.tomatoField = this.addField({ type: 'tomato', center: V(-60, -40), cols: 6, rows: 4, spacing: 1.5, growTime: 9 });
    this.game.flags.tomato = true;
    if (!instant) this.game.fx.burst(V(-60, -40).setY(1), 36);
  },

  buildPastas(instant) {
    this.pastas = new Processor(this.game, {
      position: V(-60, -28), recipe: { flour: 1, egg: 1 }, output: 'pasta', produceTime: 4.5, name: 'PASTAS',
      look: { wall: '#fdf0e0', roofColor: '#2e8b57', awning: ['#ffffff', '#e8302a'] },
      inputRoles: ['player', 'baker'], outputRoles: ['player', 'carrier'], outputMax: 16,
      outputPile: { spacing: [0.44, 0.4] },
    });
    this.afterProcessor(this.pastas, instant);
    this.game.flags.pasta = true;
  },

  /** Tanque australiano: riega todos los campos (+30% de crecimiento). */
  buildTank(instant, s) {
    const raw = createWaterTank();
    const m = bakeGroup(raw, { keep: [raw.userData.spin] });
    bakeGroup(raw.userData.spin);
    m.position.copy(s.pos);
    this.scene.add(m);
    this.game.obstacles.push({ minX: s.pos.x - 2.5, maxX: s.pos.x + 4.1, minZ: s.pos.z - 2.5, maxZ: s.pos.z + 2.5 });
    const wheel = raw.userData.spin;
    this.game.add({ update: (dt) => { wheel.rotation.z += dt * 1.6; } });
    this.irrigation = 0.3;
    for (const f of this.fields()) f.growMult = this.fieldGrow(f);
    if (!instant) {
      this.game.fx.popIn(m);
      this.game.fx.burst(s.pos.clone().setY(1.5), 50);
      this.game.chatter?.say(this.player, '¡Con riego todo crece más rápido! 💧', 3);
    }
  },

  // =====================================================================
  // GRANJA 14
  // =====================================================================
  buildPotrero(instant) {
    this.potreroField = this.addField({ type: 'grass', center: V(-64, 8), cols: 5, rows: 4, spacing: 1.5, growTime: 7 });
    this.game.flags.grass = true;
    if (!instant) this.game.fx.burst(V(-64, 8).setY(1), 36);
  },

  buildNovillos(instant) {
    this.novillos = new ProductionUnit(this.game, {
      position: V(-53, 6), inputType: 'grass', outputType: 'beef', animal: 'steer', animalCount: 2, house: 'barn',
      produceTime: 3, feederMax: 20, outputMax: 20, floorColor: '#a9d46a',
      outputPile: { cols: 2, rows: 2, spacing: [0.5, 0.45] },
      inputRoles: ['player', 'farmer'], outputRoles: ['player', 'carrier'],
    });
    this.game.flags.beef = true;
    this.applyStorage(this.novillos);
    if (!instant) {
      this.game.fx.popIn(this.novillos.group);
      this.game.fx.burst(V(-53, 6).setY(1), 36);
    }
  },

  buildCarniceria(instant) {
    this.carniceria = new Processor(this.game, {
      position: V(-63, 22), recipe: { beef: 2 }, output: 'chorizo', produceTime: 4, name: 'CARNICERÍA',
      look: { wall: '#ffffff', roofColor: '#c0392b', awning: ['#ffffff', '#c0392b'] },
      inputRoles: ['player', 'farmer', 'baker'], outputRoles: ['player', 'carrier'], outputMax: 16,
      outputPile: { spacing: [0.44, 0.4] },
    });
    this.afterProcessor(this.carniceria, instant);
    this.game.flags.chorizo = true;
  },

  buildParrilla(instant) {
    this.parrilla = new Processor(this.game, {
      position: V(-53, 22), recipe: { chorizo: 1, bread: 1 }, output: 'choripan', produceTime: 5, name: 'PARRILLA',
      look: { wall: '#f5e6c8', roofColor: '#5c2e14', awning: ['#ffffff', '#74acdf'] },
      inputRoles: ['player', 'baker'], outputRoles: ['player', 'carrier'], outputMax: 14,
      outputPile: { spacing: [0.44, 0.4] },
    });
    this.afterProcessor(this.parrilla, instant);
    this.game.flags.choripan = true;
  },

  buildShop9(instant) {
    this.shop9 = new Shop(this.game, {
      position: V(-60, 35), name: 'BODEGÓN', spawnPoint: V(-77, 41), exitPoint: V(-77, 29), queueSize: 4, instant,
      look: { wall: '#f5e6c8', trim: '#5c2e14', awning: ['#ffffff', '#c0392b'] },
      products: [
        { type: 'chorizo', x: -1.15, max: 12, pile: { cols: 1, rows: 2, spacing: [0.4, 0.4] } },
        { type: 'choripan', flag: 'choripan', x: -0.4, max: 12, pile: { cols: 1, rows: 2, spacing: [0.4, 0.4] } },
        { type: 'pasta', flag: 'pasta', x: 0.4, max: 12, pile: { cols: 1, rows: 2, spacing: [0.42, 0.4] } },
      ],
    });
    this.game.flags.shop9 = true;
  },

  /** Peña folklórica: escenario con músicos; cada ~4 minutos, 45 s de peña con el doble de clientes. */
  buildPena(instant, s) {
    const m = bakeGroup(createStage());
    m.position.copy(s.pos);
    this.scene.add(m);
    this.game.obstacles.push({ minX: s.pos.x - 3.1, maxX: s.pos.x + 3.1, minZ: s.pos.z - 1.9, maxZ: s.pos.z + 1.9 });
    const looks = [
      { shirt: '#ffffff', pants: '#2b2b2b', hair: '#111111', hat: 'straw', hatColor: '#2b2b2b', tie: '#c0392b' },
      { shirt: '#c0392b', pants: '#2b2b2b', hair: '#6b3e26', hairStyle: 'long' },
      { shirt: '#74acdf', pants: '#2b2b2b', hair: '#cfcfcf', hat: 'straw', hatColor: '#f6d785' },
    ];
    const band = looks.map((look, i) => {
      const c = new Character(look);
      c.root.position.set(s.pos.x - 1.6 + i * 1.6, 0.64, s.pos.z - 0.2);
      this.scene.add(c.root);
      // Guitarra / bombo
      const inst = i === 1
        ? new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.3, 14), mat('#c07a43'))
        : new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.08), mat('#8e5229'));
      inst.position.set(0, 0.95, 0.28);
      if (i === 1) inst.rotation.x = Math.PI / 2;
      else inst.rotation.z = 0.9;
      c.root.add(inst);
      return c;
    });
    let timer = instant ? 40 : 3;
    this.game.add({ update: (dt) => {
      timer -= dt;
      if (timer <= 0) {
        timer = 240;
        this.game.addBoost('pena', 45);
        this.game.audio.play('happy');
        this.game.fx.burst(s.pos.clone().setY(2.5), 30);
        this.game.chatter?.say(this.player, '¡Arrancó la peña! 🎻 Vienen el doble de clientes', 3.2);
      }
      const on = this.game.boostLeft('pena') > 0;
      for (const [i, c] of band.entries()) {
        c.animate(dt, 0);
        if (on) {
          c.armR.rotation.x = -1.0 + Math.sin(this.game.time * 9 + i) * 0.35;
          c.armL.rotation.x = -0.8;
          c.body.position.y = Math.abs(Math.sin(this.game.time * 4.5 + i)) * 0.06;
        }
      }
    } });
    if (!instant) {
      this.game.fx.popIn(m);
      this.game.fx.burst(s.pos.clone().setY(1.5), 50);
    }
  },

  // =====================================================================
  // GRANJA 15
  // =====================================================================
  buildAlgodonal(instant) {
    this.cottonField = this.addField({ type: 'cotton', center: V(78, 10.6), cols: 5, rows: 2, spacing: 1.5, growTime: 8 });
    this.game.flags.cotton = true;
    if (!instant) this.game.fx.burst(V(78, 10.6).setY(1), 36);
  },

  buildLavadero(instant) {
    this.lavadero = new Processor(this.game, {
      position: V(79, 2), recipe: { cotton: 2 }, output: 'sheets', produceTime: 3.5, name: 'LAVADERO',
      look: { wall: '#e8f6ff', roofColor: '#74acdf', awning: ['#ffffff', '#ff8fab'] },
      inputRoles: ['player', 'farmer', 'baker'], outputRoles: ['player', 'carrier', 'maid'], inputMax: 24, outputMax: 16,
      outputPile: { spacing: [0.44, 0.4] },
    });
    this.afterProcessor(this.lavadero, instant);
    this.game.flags.sheets = true;
  },

  buildHostel(instant) {
    const slots = [];
    for (const z of [-20, -27.6]) for (const x of [76.5, 82.5, 88.5, 94.5]) slots.push(V(x, z));
    this.hostel = new Hostel(this.game, this, { position: V(85, -6), cabinSlots: slots, spawn: V(101, 6), exit: V(101, -2), instant });
    this.hostel.addCabins(4, instant);
    if (this.poolOn) this.hostel.spawnMult = 1.6;
    this.game.flags.hostel = true;
    if (!instant) {
      this.game.fx.burst(V(85, -8).setY(1.5), 50);
      this.game.chatter?.say(this.player, '¡Abrimos la hostería! Hay que tener las cabañas limpitas 🛏️', 3.4);
    }
  },

  /** Pileta: vienen más huéspedes a la hostería. */
  buildPool(instant, s) {
    const m = bakeGroup(createPool());
    m.position.copy(s.pos);
    this.scene.add(m);
    this.game.obstacles.push({ minX: s.pos.x - 3.6, maxX: s.pos.x + 3.6, minZ: s.pos.z - 2.3, maxZ: s.pos.z + 2.3 });
    this.poolOn = true;
    if (this.hostel) this.hostel.spawnMult = 1.6;
    if (!instant) {
      this.game.fx.popIn(m);
      this.game.fx.burst(s.pos.clone().setY(1.5), 50);
      this.game.chatter?.say(this.player, '¡Una pileta! Los huéspedes van a hacer fila 🏊', 3);
    }
  },

  // =====================================================================
  // GRANJA 16
  // =====================================================================
  buildPinar(instant) {
    this.pineField = this.addField({ type: 'log', center: V(-30, -84), cols: 6, rows: 3, spacing: 2.0, growTime: 12 });
    this.game.flags.log = true;
    if (!instant) this.game.fx.burst(V(-30, -84).setY(1), 36);
  },

  buildAserradero(instant) {
    this.aserradero = new Processor(this.game, {
      position: V(-14, -88), recipe: { log: 1 }, output: 'plank', produceTime: 3, name: 'ASERRADERO',
      look: { wall: '#e8d3a8', roofColor: '#5c4033', awning: ['#ffffff', '#2e7d32'] },
      inputRoles: ['player', 'farmer', 'baker'], outputRoles: ['player', 'carrier'],
      outputPile: { spacing: [0.48, 0.4] },
    });
    this.afterProcessor(this.aserradero, instant);
    this.game.flags.plank = true;
  },

  buildCarpinteria(instant) {
    this.carpinteria = new Processor(this.game, {
      position: V(-2, -88), recipe: { plank: 2 }, output: 'chair', produceTime: 5.5, name: 'CARPINTERÍA',
      look: { wall: '#f5e6c8', roofColor: '#8e5229', awning: ['#ffffff', '#8e5229'] },
      inputRoles: ['player', 'baker'], outputRoles: ['player', 'carrier', 'maid'], outputMax: 12,
      outputPile: { spacing: [0.5, 0.46] },
    });
    this.afterProcessor(this.carpinteria, instant);
    this.game.flags.chair = true;
  },

  /** Aerosilla: parándose en la estación, Mela viaja por el aire entre Las Lomas y Las Sierras. */
  buildChairlift(instant) {
    const A = LIFT_A;
    const B = LIFT_B;
    const parts = [];
    for (const p of [A, B]) {
      const st = createLiftStation();
      st.position.copy(p);
      parts.push(st);
      for (const [dx, dz] of [[-1.8, -1.3], [1.8, -1.3], [-1.8, 1.3], [1.8, 1.3]]) {
        this.game.obstacles.push({ minX: p.x + dx - 0.15, maxX: p.x + dx + 0.15, minZ: p.z + dz - 0.15, maxZ: p.z + dz + 0.15 });
      }
    }
    const dir = B.clone().sub(A);
    const len = dir.length();
    dir.normalize();
    const yaw = Math.atan2(dir.x, dir.z);
    const nT = Math.floor(len / 16);
    for (let i = 1; i <= nT; i++) {
      const p = A.clone().addScaledVector(dir, (i / (nT + 1)) * len);
      const t = createLiftTower(6);
      t.position.copy(p);
      t.rotation.y = yaw + Math.PI / 2;
      parts.push(t);
    }
    batchStatic(parts, this.scene);
    // Cable (dos líneas paralelas a 6 m)
    const side = new THREE.Vector3(dir.z, 0, -dir.x).multiplyScalar(1.2);
    for (const s of [-1, 1]) {
      const a = A.clone().addScaledVector(side, s).setY(5.9);
      const b = B.clone().addScaledVector(side, s).setY(5.9);
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 4), mat('#2b2b2b'));
      cable.position.copy(a).lerp(b, 0.5);
      cable.lookAt(b);
      cable.rotateX(Math.PI / 2);
      this.scene.add(cable);
    }
    // Sillas que circulan (decorativas)
    const chairs = [];
    for (let i = 0; i < 8; i++) {
      const c = bakeGroup(createLiftChair());
      this.scene.add(c);
      chairs.push({ c, u: i / 8, s: i % 2 ? 1 : -1 });
    }
    // Plataformas de subida
    const pads = [A, B].map((p, i) => {
      const d = new GroundDecal(2.2, (ctx, W, H, on) => {
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, W / 2 - 14, 0, Math.PI * 2);
        ctx.fillStyle = on ? 'rgba(63,216,255,0.5)' : 'rgba(63,216,255,0.2)';
        ctx.fill();
        ctx.lineWidth = 12;
        ctx.strokeStyle = '#3fd8ff';
        ctx.stroke();
        ctx.font = `100px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🚡', W / 2, H / 2 + 6);
      });
      d.mesh.position.set(p.x, 0.36, p.z);
      this.scene.add(d.mesh);
      const lbl = makeTextSprite(i ? '🚡 a la Hostería' : '🚡 a Las Sierras', { worldHeight: 0.45 });
      lbl.sprite.position.set(p.x, 4.6, p.z + 1.8);
      this.scene.add(lbl.sprite);
      return { p, d, other: i ? A : B, stand: 0, armed: true, on: false };
    });
    const player = this.player;
    let ride = null;
    this.game.add({ update: (dt) => {
      for (const k of chairs) {
        k.u = (k.u + dt * 0.02) % 1;
        const from = k.s > 0 ? A : B;
        const to = k.s > 0 ? B : A;
        k.c.position.copy(from).lerp(to, k.u).addScaledVector(side, k.s).setY(5.9);
        k.c.rotation.y = yaw;
      }
      if (ride) {
        ride.u = Math.min(1, ride.u + dt / ride.dur);
        const e = ride.u < 0.5 ? 2 * ride.u * ride.u : 1 - Math.pow(-2 * ride.u + 2, 2) / 2;
        player.position.copy(ride.from).lerp(ride.to, e);
        player.position.y = Math.sin(Math.PI * ride.u) * 4.2;
        player.yaw = ride.yaw;
        ride.chair.position.copy(player.position).setY(player.position.y + 1.62);
        ride.chair.rotation.y = ride.yaw;
        if (ride.u >= 1) {
          player.position.y = 0;
          player.position.z += 2.6;
          player.frozen = false;
          ride.chair.removeFromParent();
          for (const pd of pads) pd.armed = false;
          ride = null;
          this.game.audio.play('happy');
        }
        return;
      }
      for (const pd of pads) {
        const inside = distXZ2(player.position, pd.p) < 1.1 * 1.1;
        if (inside !== pd.on) { pd.on = inside; pd.d.redraw(inside); }
        if (!inside) { pd.armed = true; pd.stand = 0; continue; }
        if (!pd.armed) continue;
        pd.stand += dt;
        if (pd.stand > 0.6) {
          pd.stand = 0;
          pd.armed = false;
          const chair = bakeGroup(createLiftChair());
          this.scene.add(chair);
          const d = pd.other.clone().sub(pd.p);
          ride = { from: pd.p.clone(), to: pd.other.clone(), u: 0, dur: d.length() / 9, yaw: Math.atan2(d.x, d.z), chair };
          player.frozen = 'ride';
          this.game.audio.play('unlock');
          this.game.chatter?.say(player, pick(['¡Wiii! 🚡', '¡Qué vista! 😍', '¡Allá vamos!']), 2.5);
        }
      }
    } });
    if (!instant) {
      this.game.fx.burst(A.clone().setY(2), 50);
      this.game.chatter?.say(this.player, '¡Aerosilla! Ahora llego volando a las sierras 🚡', 3.2);
    }
  },

  // =====================================================================
  // GRANJA 17
  // =====================================================================
  buildVinedo(instant) {
    this.grapeField = this.addField({ type: 'grape', center: V(84, 33), cols: 6, rows: 4, spacing: 1.6, growTime: 10 });
    this.game.flags.grape = true;
    if (!instant) this.game.fx.burst(V(84, 33).setY(1), 36);
  },

  buildBodega(instant) {
    this.bodega = new Processor(this.game, {
      position: V(78, 21.5), recipe: { grape: 3 }, output: 'wine', produceTime: 5, name: 'BODEGA',
      look: { wall: '#f3e6d8', roofColor: '#6a2c91', awning: ['#ffffff', '#8e1b2f'] },
      inputRoles: ['player', 'farmer', 'baker'], outputRoles: ['player', 'carrier'], inputMax: 24, outputMax: 14,
      outputPile: { spacing: [0.4, 0.36] },
    });
    this.afterProcessor(this.bodega, instant);
    this.game.flags.wine = true;
  },

  buildShop10(instant) {
    this.shop10 = new Shop(this.game, {
      position: V(93, 22.5), name: 'VINOTECA', spawnPoint: V(101, 31), exitPoint: V(101, 20), queueSize: 4, instant,
      look: { wall: '#f3e6d8', trim: '#8e1b2f', awning: ['#ffffff', '#6a2c91'] },
      products: [
        { type: 'wine', x: -0.85, max: 12, pile: { cols: 2, rows: 2, spacing: [0.36, 0.36] } },
        { type: 'chocolate', flag: 'chocolate', x: 0.4, max: 12, pile: { cols: 2, rows: 2, spacing: [0.4, 0.3] } },
      ],
    });
    this.game.flags.shop10 = true;
  },

  /** Globo aerostático: sube con turistas, pasea y al bajar deja la plata del paseo. */
  buildBalloon(instant, s) {
    const m = bakeGroup(createBalloon());
    m.position.copy(s.pos);
    this.scene.add(m);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.05, 20), mat('#e8e1cf'));
    pad.position.set(s.pos.x, 0.02, s.pos.z);
    this.scene.add(pad);
    const cash = new CashPile(this.game, { position: s.pos.clone().add(V(-3.4, -0.6)) });
    this.balloonCash = cash;
    let t = instant ? 10 : 4;
    let phase = 'ground';
    this.game.add({ update: (dt) => {
      t -= dt;
      if (phase === 'ground') {
        m.position.y = 0;
        if (t <= 0) { phase = 'up'; t = 10; this.game.audio.play('happy', { pos: s.pos }); }
      } else if (phase === 'up') {
        m.position.y = (1 - t / 10) * 14;
        if (t <= 0) { phase = 'fly'; t = 22; }
      } else if (phase === 'fly') {
        m.position.y = 14 + Math.sin(this.game.time * 0.8) * 0.8;
        m.position.x = s.pos.x + Math.sin((22 - t) * 0.2) * 3;
        if (t <= 0) { phase = 'down'; t = 10; }
      } else if (phase === 'down') {
        m.position.y = (t / 10) * 14;
        m.position.x += (s.pos.x - m.position.x) * Math.min(1, dt * 0.6);
        if (t <= 0) {
          phase = 'ground';
          t = 30;
          m.position.x = s.pos.x;
          const amount = Math.round(450 * this.game.saleMult());
          cash.addMoney(amount, s.pos.clone().setY(1.5));
          this.game.fx.floatText(`🎈 +$${amount}`, s.pos.clone().setY(3), '#9bff8a');
        }
      }
      m.rotation.y += dt * 0.15;
    } });
    if (!instant) {
      this.game.fx.popIn(m);
      this.game.fx.burst(s.pos.clone().setY(2), 50);
      this.game.chatter?.say(this.player, '¡Paseos en globo para los turistas! 🎈', 3);
    }
  },

  // =====================================================================
  // GRANJA 18
  // =====================================================================
  /** Puerto: muelle y un barco que pide productos caros y paga ×4. */
  buildPort(instant) {
    const dock = createDock(8.4, 7.2);
    dock.position.set(24, -0.3, 61);
    bakeGroup(dock);
    this.scene.add(dock);
    this.portOn = true;
    this.buildFence();
    this.ship = new Truck(this.game, {
      parkPos: V(24, 66.8), enterX: -125, exitX: 130, createModel: createShip, rewardMult: 4, budgetMult: 3,
      returnTime: 30, startLevel: 8, bedMax: 120, maxSpeed: 9, maxKinds: 3,
      premium: ['dulce', 'wine', 'chair', 'mate', 'choripan', 'chocolate', 'pasta', 'cheese', 'pizza', 'alfajor', 'croissant', 'honey', 'sugar', 'chorizo', 'scarf', 'empanada'],
      dropOffset: new THREE.Vector3(-1.2, 0, -4.0), cashOffset: new THREE.Vector3(2.6, 0, -4.0), boardOffset: new THREE.Vector3(0, 5.6, -1.5),
    });
    this.addSmoke(this.ship);
    this.game.flags.port = true;
    if (!instant) {
      this.game.fx.popIn(dock);
      this.game.fx.burst(V(24, 60).setY(1.5), 50);
      this.game.chatter?.say(this.player, '¡Puerto listo! Los barcos pagan muchísimo 🚢', 3.2);
    }
  },

  /** Grúa: lo que se deje en el depósito del muelle, la grúa lo carga sola en el barco. */
  buildCrane(instant, s) {
    const raw = createCrane();
    const jib = raw.userData.jib;
    bakeGroup(jib);
    const m = bakeGroup(raw, { keep: [jib] });
    m.position.copy(s.pos);
    this.scene.add(m);
    this.game.obstacles.push({ minX: s.pos.x - 1.7, maxX: s.pos.x + 1.7, minZ: s.pos.z - 1.7, maxZ: s.pos.z + 1.7 });
    // Depósito: pallet grande donde se deja cualquier producto
    const dpos = V(s.pos.x + 4.4, s.pos.z - 2.6);
    const pal = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 2.0), mat('#c07a43'));
    pal.position.set(dpos.x, 0.06, dpos.z);
    this.scene.add(pal);
    const dep = new Pile(this.game, { position: dpos.clone().setY(0.14), type: null, cols: 4, rows: 3, max: 60, spacing: [0.5, 0.5], layerHeight: 0.3 });
    this.deposit = dep;
    const types = Object.keys(ITEMS).filter((t) => t !== 'cash' && !ITEMS[t].dish);
    new TransferZone(this.game, {
      position: dpos.clone().add(V(0, 2.2)), mode: 'drop', types, target: dep, roles: ['player', 'trucker'], icon: '📦',
    });
    const lbl = makeTextSprite('📦 DEPÓSITO', { worldHeight: 0.45 });
    lbl.sprite.position.set(dpos.x, 2.0, dpos.z);
    this.scene.add(lbl.sprite);
    let t = 0;
    this.game.add({ update: (dt) => {
      const ship = this.ship;
      const loading = ship && ship.state === 'waiting' && ship.doneTimer < 0;
      const want = loading ? -0.6 : 0.9; // la pluma apunta al barco mientras carga
      jib.rotation.y = lerpAngle(jib.rotation.y, want, 1 - Math.exp(-dt * 2));
      if (!loading) return;
      t -= dt;
      if (t > 0) return;
      t = 0.35;
      const i = dep.items.findIndex((e) => e.landed && ship.canAccept(e.type));
      if (i < 0) return;
      const e = dep.items.splice(i, 1)[0];
      this.scene.attach(e.mesh);
      ship.receive(e.type, e.mesh);
    } });
    if (!instant) {
      this.game.fx.popIn(m);
      this.game.fx.burst(s.pos.clone().setY(2), 50);
      this.game.chatter?.say(this.player, '¡La grúa carga sola lo que deje en el depósito! 🏗️', 3.2);
    }
  },

  // =====================================================================
  // GRANJA 19
  // =====================================================================
  buildManisero(instant) {
    this.peanutField = this.addField({ type: 'peanut', center: V(-30, 53), cols: 6, rows: 3, spacing: 1.5, growTime: 9 });
    this.game.flags.peanut = true;
    if (!instant) this.game.fx.burst(V(-30, 53).setY(1), 36);
  },

  buildChocolateria(instant) {
    this.chocolateria = new Processor(this.game, {
      position: V(-12, 50), recipe: { sugar: 1, milk: 1, peanut: 1 }, output: 'chocolate', produceTime: 5.5, name: 'CHOCOLATERÍA',
      look: { wall: '#f3e6d8', roofColor: '#5a3220', awning: ['#ffffff', '#e8503f'] },
      inputRoles: ['player', 'farmer', 'baker'], outputRoles: ['player', 'carrier'], outputMax: 14,
      outputPile: { spacing: [0.46, 0.34] },
    });
    this.afterProcessor(this.chocolateria, instant);
    this.game.flags.chocolate = true;
  },

  buildShop11(instant) {
    this.shop11 = new Shop(this.game, {
      position: V(-58, 51), name: 'CHOCOLATES', spawnPoint: V(-77, 58), exitPoint: V(-77, 47), queueSize: 4, instant,
      look: { wall: '#f3e6d8', trim: '#5a3220', awning: ['#ffffff', '#ff8fab'] },
      products: [
        { type: 'chocolate', x: -0.85, max: 14, pile: { cols: 2, rows: 2, spacing: [0.4, 0.3] } },
        { type: 'dulce', flag: 'dulce', x: 0.4, max: 12, pile: { cols: 2, rows: 2, spacing: [0.36, 0.36] } },
      ],
    });
    this.game.flags.shop11 = true;
  },

  /** Plaza del pueblo: glorieta con bancos y faroles; llegan más clientes a todas las tiendas. */
  buildPlaza(instant, s) {
    const m = bakeGroup(createGlorieta());
    m.position.copy(s.pos);
    this.scene.add(m);
    this.game.obstacles.push({ minX: s.pos.x - 2.1, maxX: s.pos.x + 2.1, minZ: s.pos.z - 2.1, maxZ: s.pos.z + 2.1 });
    this.plazaOn = true;
    if (!instant) {
      this.game.fx.popIn(m);
      this.game.fx.burst(s.pos.clone().setY(2), 50);
      this.game.chatter?.say(this.player, '¡La plaza del pueblo! Ahora viene más gente 🌳', 3);
    }
  },

  // =====================================================================
  // GRANJA 20
  // =====================================================================
  buildEstancia(instant) {
    const p = V(58, 52);
    const m = bakeGroup(createCasona());
    m.position.copy(p);
    this.scene.add(m);
    this.game.obstacles.push(
      { minX: p.x - 5.2, maxX: p.x + 5.2, minZ: p.z - 3.0, maxZ: p.z + 2.6 },
      { minX: p.x - 6.9, maxX: p.x - 6.3, minZ: p.z + 2.3, maxZ: p.z + 2.9 },
      { minX: p.x + 6.3, maxX: p.x + 6.9, minZ: p.z + 2.3, maxZ: p.z + 2.9 },
    );
    const sign = makeTextSprite('🏛️ ESTANCIA MELA', { color: '#ffd23f', stroke: '#6b3a1a', worldHeight: 0.8 });
    sign.sprite.position.set(p.x, 7.6, p.z + 1);
    this.scene.add(sign.sprite);
    this.game.flags.estancia = true;
    if (!instant) {
      this.game.fx.popIn(m);
      this.game.fx.burst(p.clone().setY(3), 60);
      this.game.chatter?.say(this.player, '¡Nuestra estancia! Mirá qué casona 😍', 3.2);
    }
  },

  /** Boda: arco de flores en el jardín de la estancia y la ceremonia (sólo cuando se compra). */
  buildWedding(instant) {
    const m = bakeGroup(createWeddingArch());
    m.position.copy(ARCH);
    this.scene.add(m);
    for (const x of [-1.6, 1.6]) this.game.obstacles.push({ minX: ARCH.x + x - 0.15, maxX: ARCH.x + x + 0.15, minZ: ARCH.z - 1.15, maxZ: ARCH.z - 0.85 });
    this.married = true;
    this.game.flags.married = true;
    if (!instant) {
      this.game.fx.popIn(m);
      this.startWedding();
    }
  },

  /** La ceremonia: vienen todos los empleados, Mela y Matías se dan el sí y se besan. */
  startWedding() {
    const g = this.game;
    const p = this.player;
    const mati = this.matias;
    if (!mati) return;
    // Invitados: en las sillas y, los que no entran, parados atrás
    const seats = new Map();
    const spots = [];
    for (let row = 0; row < 4; row++) for (const s of [-1, 1]) for (let k = 0; k < 2; k++) spots.push(V(ARCH.x + s * (1.4 + k * 0.7), ARCH.z + 2.2 + row * 1.6 - 0.35));
    for (let i = 0; spots.length < this.workers.length; i++) spots.push(V(ARCH.x - 4.5 + (i % 10) * 1.0, ARCH.z + 9 + Math.floor(i / 10) * 1.1));
    const back = new Map();
    this.workers.forEach((w, i) => {
      back.set(w, w.position.clone());
      seats.set(w, spots[i]);
      w.position.copy(spots[i]);
      w.target.copy(spots[i]);
      g.fx.popIn(w.root);
    });
    this.wedding = { seats, center: ARCH.clone() };
    // Los novios en el altar
    p.position.copy(ARCH).add(V(-0.75, 0.4));
    p.yaw = Math.PI / 2;
    p.frozen = 'stand';
    p.wearVeil();
    mati.state = 'event';
    mati.position.copy(ARCH).add(V(0.75, 0.4));
    mati.target.copy(mati.position);
    mati.yaw = -Math.PI / 2;
    g.audio.play('levelup');
    g.fx.burst(ARCH.clone().setY(2.5), 80);
    const guests = this.workers.length ? this.workers : [p];
    g.chatter?.startConvo([
      [mati, 'Mela, ¿te querés casar conmigo? 💍'],
      [p, '¡Sí, quiero! 💕'],
      [pick(guests), '¡Vivan los novios! 🎉'],
      [pick(guests), '¡Que se besen! 😍'],
    ]);
    // Beso (con la animación de siempre)
    g.fx.tween(11, null, () => {
      p.frozen = false;
      mati.state = 'asking';
      mati.startKiss();
    });
    // Fuegos artificiales
    for (let i = 0; i < 10; i++) g.fx.tween(12.5 + i * 0.45, null, () => this.firework(ARCH.clone().add(V(rand(-6, 6), rand(-2, 6)))));
    g.fx.tween(13, null, () => {
      g.fx.floatText('💍 ¡Recién casados!', ARCH.clone().setY(3.4), '#ffe066');
      g.addBoost('love', 60);
      g.chatter?.say(mati, '¡Te amo, Mela! Para siempre 💕', 3.5);
    });
    // Fin de la fiesta: cada uno vuelve a su trabajo
    g.fx.tween(19, null, () => {
      for (const [w, pos] of back) { w.position.copy(pos); w.target.copy(pos); g.fx.popIn(w.root); }
      this.wedding = null;
      if (mati.state === 'event') mati.state = 'roam';
      if (p.frozen) p.frozen = false;
    });
    // Luna de miel: mientras dura 💕, Mela sigue con el velo; después vuelve a su ropa de siempre
    g.fx.tween(74, null, () => p.removeVeil());
  },

  /** Cohete que sube y explota en confeti. */
  firework(from) {
    const g = this.game;
    const s = sphere(0.12, pick(['#ffd23f', '#ff5d8f', '#3fa7e0', '#7bcc45', '#ffffff']), from.x, 0.5, from.z);
    s.castShadow = false;
    this.scene.add(s);
    const top = rand(9, 13);
    g.fx.tween(0.9, (u) => { s.position.y = 0.5 + (1 - (1 - u) * (1 - u)) * top; }, () => {
      g.fx.burst(s.position.clone(), 40);
      g.audio.play('pop', { pos: s.position, pitch: 0.6 });
      s.removeFromParent();
    });
  },

  /** Fiesta de la Cosecha: fogón con banderines; cada ~5 minutos, 60 s de fiesta (ventas +50%). */
  buildHarvestFest(instant, s) {
    const m = bakeGroup(createHarvestFest());
    m.position.copy(s.pos);
    this.scene.add(m);
    this.game.obstacles.push({ minX: s.pos.x - 1.6, maxX: s.pos.x + 1.6, minZ: s.pos.z - 1.6, maxZ: s.pos.z + 1.6 });
    let timer = instant ? 60 : 4;
    let rockets = 0;
    this.game.add({ update: (dt) => {
      timer -= dt;
      if (timer <= 0) {
        timer = 300;
        rockets = 8;
        this.game.addBoost('fiesta', 60);
        this.game.audio.play('levelup');
        this.game.chatter?.say(this.player, '¡Fiesta de la Cosecha! 🎆 Todo se vende +50%', 3.4);
      }
      if (rockets > 0 && Math.random() < dt * 2) {
        rockets--;
        this.firework(s.pos.clone().add(V(rand(-3, 3), rand(-3, 3))));
      }
    } });
    if (!instant) {
      this.game.fx.popIn(m);
      this.game.fx.burst(s.pos.clone().setY(2), 60);
    }
  },

  // =====================================================================
  // DECORACIÓN DE LAS ZONAS NUEVAS
  // =====================================================================
  /** ¿En qué zona nueva cae (x, z)? (lo que se planta ahí se saca al abrirla). */
  extraZoneOf(x, z) {
    if (z > 18.2 && z < 48.5 && x > -48.5 && x < 74.5) return 'sur';
    if (x <= -48.5 && x > -76.5 && z > -72.5 && z < 48.5) return 'chacra';
    if (x >= 74.5 && x < 100.5 && z > -72.5 && z < 48.5) return 'lomas';
    if (z <= -72.5 && z > -96.5 && x > -76.5 && x < 100.5) return 'sierras';
    if (z >= 48.5 && z < 64.5 && x > -76.5 && x < 100.5) return 'costa';
    return null;
  },

  /** Paisaje alrededor de las zonas nuevas: bosques más allá de los cercos, montañas, el río y la otra orilla. */
  stageExtraScenery(stage) {
    const rnd = seeded(2024);
    const forest = (n, x0, x1, z0, z1, pine = false) => {
      for (let i = 0; i < n; i++) {
        const x = x0 + rnd() * (x1 - x0);
        const z = z0 + rnd() * (z1 - z0);
        if (Math.abs(z - ROAD_Z) < 3 || Math.abs(z - TRACK_Z) < 2.5) continue;
        const t = pine ? createPineTree(0.9 + rnd() * 0.6) : createTree(0.85 + rnd() * 0.7, rnd() < 0.35);
        t.position.set(x, 0, z);
        t.rotation.y = rnd() * 6;
        stage(t);
      }
    };
    // Zona Sur todavía sin abrir (y La Costa): campo con árboles
    forest(45, -46, 72, 20, 44);
    forest(30, -74, 98, 48, 61);
    // Más allá de La Chacra, Las Lomas y Las Sierras
    forest(60, -92, -77, -96, 62);
    forest(60, 101, 116, -96, 62);
    forest(70, -76, 100, -110, -97, true);
    for (let i = 0; i < 12; i++) {
      const mnt = createMountain(1.1 + rnd() * 0.9);
      mnt.position.set(-80 + i * 17 + rnd() * 6, 0, -116 - rnd() * 8);
      mnt.rotation.y = rnd() * 6;
      stage(mnt);
    }
    // Las Sierras (antes de abrirlas): pinos y rocas
    forest(40, -72, 96, -93, -73, true);
    for (let i = 0; i < 18; i++) {
      const r = createRock(0.6 + rnd() * 1.2);
      r.position.x = -70 + rnd() * 165;
      r.position.z = -93 + rnd() * 20;
      stage(r);
    }
    // La Chacra y Las Lomas (antes de abrirlas)
    forest(35, -73, -49, -68, 44);
    forest(35, 75, 97, -68, 44);
    for (const [x, z] of [[-70, -20], [-71, -19], [90, -50], [91, -50.3]]) {
      const h = createHayBale();
      h.position.set(x, 0, z);
      stage(h);
    }
    // La otra orilla del río
    forest(70, -110, 120, 88, 98);
  },

  /** El río al sur (siempre visible a lo lejos). */
  buildRiver() {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(240, 24), new THREE.MeshStandardMaterial({ color: '#4fa3d9', roughness: 0.15, metalness: 0.1 }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(5, 0.0, RIVER_Z + 12);
    water.receiveShadow = true;
    this.scene.add(water);
    const shore = new THREE.Mesh(new THREE.PlaneGeometry(240, 1.6), mat('#e9d29a'));
    shore.rotation.x = -Math.PI / 2;
    shore.position.set(5, 0.004, RIVER_Z - 0.4);
    this.scene.add(shore);
  },

};
