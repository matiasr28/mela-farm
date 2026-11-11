// ModelsExtra: modelos de las Granjas 11 a 20 (mismo estilo low-poly que Models.js).
//  - Ítems nuevos (se registran en ITEMS al importar este módulo).
//  - Cultivos: yerbal, cañaveral, huerta de tomates, pinar, viñedo y manisero.
//  - Animales: novillos y el caballo de Mela.
//  - Construcciones: estación y tren, caballeriza, tanque australiano, escenario de la peña,
//    hostería (cabañas, recepción, pileta), aerosilla, globo, barco, muelle, grúa, glorieta,
//    casona de la estancia y arco de la boda.
import * as THREE from 'three';
import { box, cyl, cone, sphere, capsule, roof, mat, C, ITEMS, createTree, createRock } from './Models.js';

// =====================================================================
// ÍTEMS
// =====================================================================
function createYerbaItem() {
  // Atado de hojas de yerba mate
  const g = new THREE.Group();
  for (const [x, z, r] of [[-0.06, 0, 0.3], [0.06, 0.03, -0.25], [0, -0.05, 0.05]]) {
    const leaf = sphere(0.11, x ? '#3f7f22' : '#5a9e33', x, 0.08, z, 10, 6);
    leaf.scale.set(0.55, 0.35, 1.3);
    leaf.rotation.y = r;
    g.add(leaf);
  }
  g.add(cyl(0.03, 0.03, 0.05, 8, '#c98b4a', 0, 0.08, -0.12));
  return g;
}

function createMateItem() {
  // Paquete de yerba (verde con franja amarilla)
  const g = new THREE.Group();
  g.add(box(0.22, 0.3, 0.13, '#3f8f2a', 0, 0.15, 0));
  g.add(box(0.225, 0.08, 0.135, '#ffd23f', 0, 0.2, 0));
  g.add(box(0.12, 0.05, 0.14, '#ffffff', 0, 0.08, 0));
  return g;
}

function createCaneItem() {
  // Atado de cañas de azúcar
  const g = new THREE.Group();
  for (const [x, y] of [[-0.07, 0.05], [0.07, 0.05], [0, 0.14]]) {
    const c = cyl(0.045, 0.045, 0.48, 8, '#c6b25a', x, y, 0);
    c.rotation.z = Math.PI / 2;
    g.add(c);
    for (const k of [-0.12, 0.08]) {
      const n = cyl(0.05, 0.05, 0.02, 8, '#8f7d32', x + k, y, 0);
      n.rotation.z = Math.PI / 2;
      g.add(n);
    }
  }
  g.add(cyl(0.11, 0.11, 0.05, 10, '#b5651d', 0, 0.09, 0).rotateZ(Math.PI / 2));
  return g;
}

function createSugarItem() {
  // Bolsa de azúcar blanca con etiqueta azul
  const g = new THREE.Group();
  g.add(box(0.26, 0.24, 0.18, '#ffffff', 0, 0.12, 0));
  g.add(box(0.265, 0.09, 0.185, '#3f72c0', 0, 0.12, 0));
  g.add(box(0.2, 0.04, 0.12, '#f2f2f2', 0, 0.26, 0));
  return g;
}

function createDulceItem() {
  // Frasco de dulce de leche
  const g = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({ color: '#9b5a24', roughness: 0.25 });
  const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.2, 14), glass);
  jar.position.y = 0.1;
  jar.castShadow = true;
  g.add(jar);
  g.add(cyl(0.105, 0.105, 0.05, 14, '#ffffff', 0, 0.22, 0));
  g.add(box(0.16, 0.08, 0.02, '#e8e1cf', 0, 0.1, 0.098));
  return g;
}

function createTomatoItem() {
  const g = new THREE.Group();
  const t = sphere(0.12, '#e8302a', 0, 0.11, 0, 12, 10);
  t.scale.y = 0.85;
  g.add(t);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const l = box(0.08, 0.015, 0.025, '#3f8f2a', Math.cos(a) * 0.04, 0.21, Math.sin(a) * 0.04);
    l.rotation.y = -a;
    g.add(l);
  }
  return g;
}

function createPastaItem() {
  // Nidos de tallarines frescos sobre una bandejita
  const g = new THREE.Group();
  g.add(box(0.3, 0.03, 0.22, '#c98b4a', 0, 0.015, 0));
  for (const x of [-0.07, 0.07]) {
    const nest = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.025, 6, 14), mat('#f6dc8c'));
    nest.rotation.x = Math.PI / 2;
    nest.position.set(x, 0.06, 0);
    nest.castShadow = true;
    g.add(nest);
  }
  return g;
}

function createBeefItem() {
  // Corte de carne (bife) sobre papel
  const g = new THREE.Group();
  g.add(box(0.3, 0.02, 0.24, '#f4efe2', 0, 0.01, 0));
  const m = sphere(0.12, '#c0392b', 0, 0.05, 0, 12, 8);
  m.scale.set(1.15, 0.35, 0.85);
  g.add(m);
  const fat = sphere(0.05, '#f6e7d0', 0.1, 0.05, -0.03, 8, 6);
  fat.scale.set(0.6, 0.4, 1.4);
  g.add(fat);
  return g;
}

function createChorizoItem() {
  // Ristra de chorizos
  const g = new THREE.Group();
  for (const z of [-0.07, 0.07]) {
    const c = capsule(0.05, 0.22, '#a8321f', 0, 0.06, z);
    c.rotation.z = Math.PI / 2;
    g.add(c);
  }
  g.add(cyl(0.012, 0.012, 0.16, 6, '#f4efe2', 0.17, 0.06, 0).rotateX(Math.PI / 2));
  return g;
}

function createChoripanItem() {
  // Choripán: pan francés abierto con el chorizo y chimichurri
  const g = new THREE.Group();
  const bread = capsule(0.07, 0.24, '#e0a85a', 0, 0.06, 0);
  bread.rotation.z = Math.PI / 2;
  bread.scale.set(1, 0.8, 1.15);
  g.add(bread);
  const ch = capsule(0.04, 0.24, '#a8321f', 0, 0.11, 0);
  ch.rotation.z = Math.PI / 2;
  g.add(ch);
  for (const x of [-0.1, 0, 0.1]) g.add(sphere(0.018, '#3f8f2a', x, 0.15, 0.01, 6, 4));
  return g;
}

function createCottonItem() {
  // Copos de algodón en una bolsita de arpillera
  const g = new THREE.Group();
  g.add(cyl(0.13, 0.11, 0.16, 10, '#c9a66b', 0, 0.08, 0));
  for (const [x, z] of [[-0.05, 0], [0.06, 0.03], [0, -0.06], [0.02, 0.06]]) g.add(sphere(0.07, '#ffffff', x, 0.19, z, 8, 6));
  return g;
}

function createSheetsItem() {
  // Juego de sábanas dobladas con una cinta
  const g = new THREE.Group();
  g.add(box(0.32, 0.08, 0.24, '#ffffff', 0, 0.04, 0));
  g.add(box(0.32, 0.08, 0.24, '#bfe3ff', 0, 0.12, 0));
  g.add(box(0.04, 0.17, 0.25, '#ff8fab', 0, 0.085, 0));
  return g;
}

function createLogItem() {
  // Tronco de pino
  const g = new THREE.Group();
  const t = cyl(0.09, 0.09, 0.42, 10, '#8b5a2b', 0, 0.09, 0);
  t.rotation.z = Math.PI / 2;
  g.add(t);
  for (const x of [-0.211, 0.211]) {
    const ring = cyl(0.08, 0.08, 0.01, 10, '#e2b46e', x, 0.09, 0);
    ring.rotation.z = Math.PI / 2;
    g.add(ring);
  }
  return g;
}

function createPlankItem() {
  // Tablas apiladas
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) g.add(box(0.42, 0.04, 0.12, i % 2 ? '#e2b46e' : '#d9a35c', 0, 0.02 + i * 0.045, (i - 1) * 0.02));
  return g;
}

function createChairItem() {
  // Silla de madera (mueble para las cabañas)
  const g = new THREE.Group();
  g.add(box(0.26, 0.04, 0.26, '#c07a43', 0, 0.16, 0));
  for (const [x, z] of [[-0.11, -0.11], [0.11, -0.11], [-0.11, 0.11], [0.11, 0.11]]) g.add(box(0.035, 0.16, 0.035, '#8e5229', x, 0.08, z));
  g.add(box(0.26, 0.2, 0.035, '#c07a43', 0, 0.28, -0.115));
  return g;
}

function createGrapeItem() {
  // Racimo de uvas
  const g = new THREE.Group();
  const rows = [[3, 0.2], [3, 0.14], [2, 0.08], [1, 0.03]];
  for (const [n, y] of rows) {
    for (let i = 0; i < n; i++) g.add(sphere(0.04, '#6a2c91', (i - (n - 1) / 2) * 0.07, y, (i % 2) * 0.03, 8, 6));
  }
  g.add(cyl(0.01, 0.01, 0.06, 6, '#5c4033', 0, 0.26, 0));
  const leaf = sphere(0.05, '#4f9e2c', 0.05, 0.26, 0, 8, 6);
  leaf.scale.set(1.2, 0.3, 1);
  g.add(leaf);
  return g;
}

function createWineItem() {
  // Botella de vino tinto con etiqueta
  const g = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({ color: '#3b1020', roughness: 0.2 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.26, 12), glass);
  body.position.y = 0.13;
  body.castShadow = true;
  g.add(body);
  g.add(cyl(0.03, 0.06, 0.08, 10, '#3b1020', 0, 0.3, 0));
  g.add(cyl(0.03, 0.03, 0.05, 10, '#8e1b2f', 0, 0.36, 0));
  g.add(box(0.1, 0.08, 0.02, '#f4efe2', 0, 0.13, 0.072));
  return g;
}

function createPeanutItem() {
  // Bolsita de maní
  const g = new THREE.Group();
  g.add(box(0.22, 0.2, 0.14, '#e8c27a', 0, 0.1, 0));
  g.add(box(0.225, 0.05, 0.145, '#c0392b', 0, 0.2, 0));
  for (const x of [-0.04, 0.05]) {
    const p = capsule(0.025, 0.04, '#d4a373', x, 0.12, 0.075);
    p.rotation.z = Math.PI / 2;
    g.add(p);
  }
  return g;
}

function createChocolateItem() {
  // Tableta de chocolate en su envoltorio
  const g = new THREE.Group();
  g.add(box(0.3, 0.04, 0.18, '#5a3220', 0, 0.02, 0));
  for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) g.add(box(0.085, 0.02, 0.075, '#6b3e26', -0.1 + i * 0.1, 0.05, -0.04 + k * 0.08));
  g.add(box(0.31, 0.045, 0.08, '#e8503f', 0.0, 0.025, 0.05));
  return g;
}

// Platos nuevos del Restaurante
function plate(g) {
  g.add(cyl(0.2, 0.16, 0.03, 18, '#ffffff', 0, 0.015, 0));
  return g;
}

function createTallarinesItem() {
  // Tallarines con tuco
  const g = plate(new THREE.Group());
  const nest = sphere(0.12, '#f6dc8c', 0, 0.06, 0, 12, 8);
  nest.scale.y = 0.45;
  g.add(nest);
  const sauce = sphere(0.075, '#d9412e', 0, 0.1, 0, 10, 8);
  sauce.scale.y = 0.4;
  g.add(sauce);
  g.add(sphere(0.02, '#4f9e2c', 0.03, 0.13, 0.02, 6, 4));
  return g;
}

function createAsadoItem() {
  // Asado con ensalada de tomate
  const g = plate(new THREE.Group());
  const m = sphere(0.1, '#8e3b1f', -0.04, 0.05, 0, 12, 8);
  m.scale.set(1.3, 0.35, 0.8);
  g.add(m);
  for (const [x, z] of [[0.1, 0.05], [0.12, -0.05]]) {
    const t = cyl(0.04, 0.04, 0.02, 10, '#e8302a', x, 0.045, z);
    g.add(t);
  }
  g.add(sphere(0.03, '#4f9e2c', 0.08, 0.06, 0.0, 6, 4));
  return g;
}

function createChocotortaItem() {
  // Porción de chocotorta (capas de chocolate y dulce de leche)
  const g = plate(new THREE.Group());
  for (let i = 0; i < 4; i++) g.add(box(0.2, 0.025, 0.14, i % 2 ? '#e8d3a8' : '#5a3220', 0, 0.045 + i * 0.026, 0));
  g.add(sphere(0.025, '#e8503f', 0, 0.16, 0, 8, 6));
  return g;
}

/** Ítems nuevos (se suman al catálogo general). `dish` = plato del Restaurante (no va en camiones). */
Object.assign(ITEMS, {
  yerba: { height: 0.16, price: 4, emoji: '🍃', name: 'hojas de yerba', create: createYerbaItem },
  mate: { height: 0.3, price: 24, emoji: '🧉', name: 'paquetes de yerba', create: createMateItem },
  cane: { height: 0.2, price: 3, emoji: '🎋', name: 'cañas', create: createCaneItem },
  sugar: { height: 0.25, price: 12, emoji: '🍬', name: 'azúcar', create: createSugarItem },
  dulce: { height: 0.25, price: 65, emoji: '🍮', name: 'dulce de leche', create: createDulceItem },
  tomato: { height: 0.22, price: 4, emoji: '🍅', name: 'tomates', create: createTomatoItem },
  pasta: { height: 0.09, price: 45, emoji: '🍝', name: 'pastas', create: createPastaItem },
  beef: { height: 0.08, price: 9, emoji: '🥩', name: 'carne', create: createBeefItem },
  chorizo: { height: 0.12, price: 28, emoji: '🌭', name: 'chorizos', create: createChorizoItem },
  choripan: { height: 0.16, price: 80, emoji: '🥙', name: 'choripanes', create: createChoripanItem },
  cotton: { height: 0.22, price: 4, emoji: '☁️', name: 'algodón', create: createCottonItem },
  sheets: { height: 0.17, price: 22, emoji: '🛏️', name: 'sábanas', create: createSheetsItem },
  log: { height: 0.18, price: 5, emoji: '🌲', name: 'troncos', create: createLogItem },
  plank: { height: 0.14, price: 14, emoji: '🪵', name: 'tablas', create: createPlankItem },
  chair: { height: 0.4, price: 95, emoji: '🪑', name: 'muebles', create: createChairItem },
  grape: { height: 0.28, price: 4, emoji: '🍇', name: 'uvas', create: createGrapeItem },
  wine: { height: 0.39, price: 65, emoji: '🍷', name: 'vinos', create: createWineItem },
  peanut: { height: 0.21, price: 4, emoji: '🥜', name: 'maní', create: createPeanutItem },
  chocolate: { height: 0.06, price: 90, emoji: '🍫', name: 'chocolates', create: createChocolateItem },
  tallarines: { height: 0.12, price: 150, emoji: '🍜', name: 'tallarines', dish: true, create: createTallarinesItem },
  asado: { height: 0.1, price: 175, emoji: '🍖', name: 'asados', dish: true, create: createAsadoItem },
  chocotorta: { height: 0.17, price: 200, emoji: '🍰', name: 'chocotortas', dish: true, create: createChocotortaItem },
});
for (const t of ['breakfast', 'sandwich', 'stew', 'dessert']) ITEMS[t].dish = true;

// =====================================================================
// CULTIVOS (devuelven { group, cob }: `cob` es lo que se cosecha)
// =====================================================================
export function createYerbaPlant() {
  const g = new THREE.Group();
  g.add(cyl(0.05, 0.07, 0.5, 8, '#6b4a2b', 0, 0.25, 0));
  g.add(sphere(0.4, '#2f6b1f', 0, 0.75, 0, 10, 8));
  const leaves = new THREE.Group();
  for (const [x, y, z] of [[0.25, 0.85, 0.15], [-0.22, 0.9, 0.12], [0.05, 1.05, -0.2], [0.1, 0.7, 0.32]]) {
    const l = sphere(0.18, '#4e9a2e', x, y, z, 8, 6);
    l.scale.set(1, 0.7, 1);
    leaves.add(l);
  }
  g.add(leaves);
  return { group: g, cob: leaves };
}

export function createCanePlant() {
  const g = new THREE.Group();
  for (const [x, z, h] of [[0, 0, 1.7], [0.15, 0.1, 1.5], [-0.12, 0.12, 1.6], [0.05, -0.15, 1.45]]) {
    g.add(cyl(0.04, 0.05, h, 8, '#b7a24a', x, h / 2, z));
    for (let y = 0.35; y < h; y += 0.4) g.add(cyl(0.05, 0.05, 0.03, 8, '#8f7d32', x, y, z));
  }
  const tops = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const l = box(0.5, 0.02, 0.07, i % 2 ? '#5fae35' : '#7cc94a', Math.cos(a) * 0.2, 1.65, Math.sin(a) * 0.2);
    l.rotation.set(0, -a, 0.5);
    tops.add(l);
  }
  g.add(tops);
  return { group: g, cob: tops };
}

export function createTomatoPlant() {
  const g = new THREE.Group();
  g.add(cyl(0.025, 0.025, 1.2, 6, '#c98b4a', 0.12, 0.6, 0)); // tutor
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const l = sphere(0.2, i % 2 ? '#3f8f2a' : '#57ad3a', Math.cos(a) * 0.12, 0.35 + i * 0.15, Math.sin(a) * 0.12, 8, 6);
    l.scale.set(1, 0.8, 1);
    g.add(l);
  }
  const fruits = new THREE.Group();
  for (const [x, y, z] of [[0.2, 0.45, 0.12], [-0.18, 0.6, 0.15], [0.05, 0.8, -0.2], [0.18, 0.75, -0.05]]) {
    fruits.add(sphere(0.08, '#e8302a', x, y, z, 10, 8));
  }
  g.add(fruits);
  return { group: g, cob: fruits };
}

export function createPinePlant() {
  // Pino joven: al "cosecharlo" se lleva la copa (los troncos) y vuelve a crecer
  const g = new THREE.Group();
  g.add(cyl(0.12, 0.16, 0.8, 8, '#7a4a25', 0, 0.4, 0));
  const crown = new THREE.Group();
  crown.add(cone(0.75, 1.1, 9, '#2f6b3a', 0, 1.2, 0));
  crown.add(cone(0.6, 0.9, 9, '#3b8048', 0, 1.7, 0));
  crown.add(cone(0.42, 0.7, 9, '#4a9456', 0, 2.15, 0));
  g.add(crown);
  return { group: g, cob: crown };
}

export function createGrapePlant() {
  // Parra en espaldera con racimos colgando
  const g = new THREE.Group();
  for (const x of [-0.45, 0.45]) g.add(cyl(0.035, 0.035, 1.3, 6, '#8e5229', x, 0.65, 0));
  g.add(box(1.0, 0.03, 0.03, '#8e5229', 0, 1.25, 0));
  g.add(cyl(0.05, 0.06, 0.9, 6, '#6b4a2b', 0, 0.45, 0));
  for (let i = 0; i < 5; i++) {
    const l = sphere(0.18, i % 2 ? '#4f9e2c' : '#62b53a', -0.4 + i * 0.2, 1.15, 0, 8, 6);
    l.scale.set(1, 0.6, 0.8);
    g.add(l);
  }
  const bunches = new THREE.Group();
  for (const x of [-0.3, 0.05, 0.32]) {
    for (const [dx, dy] of [[0, 0], [-0.05, 0.07], [0.05, 0.07], [0, 0.14]]) bunches.add(sphere(0.05, '#6a2c91', x + dx, 0.85 + dy, 0.1, 8, 6));
  }
  g.add(bunches);
  return { group: g, cob: bunches };
}

export function createCottonPlant() {
  // Planta de algodón: ramitas con copos blancos
  const g = new THREE.Group();
  g.add(cyl(0.03, 0.04, 0.8, 6, '#6b4a2b', 0, 0.4, 0));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const l = sphere(0.14, i % 2 ? '#4f9e2c' : '#62b53a', Math.cos(a) * 0.16, 0.45 + i * 0.08, Math.sin(a) * 0.16, 8, 6);
    l.scale.set(1, 0.5, 1);
    g.add(l);
  }
  const puffs = new THREE.Group();
  for (const [x, y, z] of [[0.15, 0.8, 0.1], [-0.14, 0.75, 0.08], [0.02, 0.92, -0.12], [-0.05, 0.62, 0.18], [0.18, 0.6, -0.12]]) {
    puffs.add(sphere(0.085, '#ffffff', x, y, z, 8, 6));
  }
  g.add(puffs);
  return { group: g, cob: puffs };
}

export function createPeanutPlant() {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const l = sphere(0.13, i % 2 ? '#4f9e2c' : '#62b53a', Math.cos(a) * 0.2, 0.18, Math.sin(a) * 0.2, 8, 6);
    l.scale.set(1, 0.45, 1);
    g.add(l);
  }
  g.add(sphere(0.05, '#ffcf3a', 0, 0.3, 0, 6, 4));
  const pods = new THREE.Group();
  for (const [x, z] of [[0.12, 0.25], [-0.2, 0.18], [0.25, -0.12]]) {
    const p = capsule(0.035, 0.06, '#d4a373', x, 0.06, z);
    p.rotation.z = Math.PI / 2;
    pods.add(p);
  }
  g.add(pods);
  return { group: g, cob: pods };
}

// =====================================================================
// ANIMALES
// =====================================================================
export function createSteer() {
  // Novillo marrón con cuernos y manchita blanca en la frente
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.add(box(0.85, 0.7, 1.35, '#8b4a22', 0, 0.85, 0));
  body.add(box(0.5, 0.5, 0.5, '#8b4a22', 0, 1.1, 0.82));
  body.add(box(0.2, 0.2, 0.06, '#ffffff', 0, 1.22, 1.07));
  body.add(box(0.46, 0.2, 0.18, '#e8b49a', 0, 0.95, 1.06));
  for (const s of [-1, 1]) {
    body.add(sphere(0.035, '#222', s * 0.13, 1.18, 1.07, 8, 6));
    const horn = cone(0.05, 0.28, 8, '#f0e6c8', s * 0.32, 1.38, 0.8);
    horn.rotation.z = -s * 1.1;
    body.add(horn);
  }
  for (const [x, z] of [[-0.28, 0.48], [0.28, 0.48], [-0.28, -0.48], [0.28, -0.48]]) {
    body.add(box(0.18, 0.55, 0.18, '#7a3f1c', x, 0.27, z));
    body.add(box(0.19, 0.1, 0.19, '#2b2b2b', x, 0.05, z));
  }
  body.add(box(0.06, 0.5, 0.06, '#5c2e14', 0, 0.75, -0.7));
  return { root, body };
}

/** Caballo criollo (Mela lo monta desde la Caballeriza). Las patas tienen pivote para trotar. */
export function createHorse() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const coat = '#a0522d';
  const dark = '#3d2414';
  const torso = capsule(0.3, 0.75, coat, 0, 1.0, 0);
  torso.rotation.x = Math.PI / 2;
  body.add(torso);
  // Cuello y cabeza
  const neck = box(0.28, 0.65, 0.3, coat, 0, 1.38, 0.55);
  neck.rotation.x = 0.55;
  body.add(neck);
  const head = new THREE.Group();
  head.position.set(0, 1.72, 0.82);
  head.add(box(0.26, 0.26, 0.55, coat, 0, 0, 0.1));
  head.add(box(0.27, 0.12, 0.1, '#e9d6c0', 0, -0.06, 0.37));
  for (const s of [-1, 1]) {
    head.add(cone(0.05, 0.14, 6, coat, s * 0.09, 0.18, -0.08));
    head.add(sphere(0.03, '#111', s * 0.135, 0.05, 0.12, 6, 4));
  }
  body.add(head);
  // Crin y cola
  for (let i = 0; i < 4; i++) body.add(box(0.08, 0.16, 0.14, dark, 0, 1.5 + i * 0.08, 0.32 + i * 0.12));
  const tail = new THREE.Group();
  tail.position.set(0, 1.12, -0.62);
  const tl = capsule(0.07, 0.45, dark, 0, -0.25, -0.05);
  tl.rotation.x = 0.35;
  tail.add(tl);
  body.add(tail);
  // Montura y estribos
  body.add(box(0.66, 0.08, 0.5, '#5c2e14', 0, 1.32, 0));
  body.add(box(0.5, 0.1, 0.42, '#c0392b', 0, 1.38, 0));
  for (const s of [-1, 1]) body.add(box(0.04, 0.4, 0.04, '#2b2b2b', s * 0.36, 1.12, 0));
  // Patas con pivote en la cadera
  const legs = [];
  for (const [x, z] of [[-0.18, 0.42], [0.18, 0.42], [-0.18, -0.42], [0.18, -0.42]]) {
    const p = new THREE.Group();
    p.position.set(x, 0.85, z);
    p.add(cyl(0.07, 0.06, 0.78, 8, coat, 0, -0.39, 0));
    p.add(cyl(0.075, 0.08, 0.1, 8, dark, 0, -0.8, 0));
    body.add(p);
    legs.push(p);
  }
  return { root, body, legs, head, tail, saddleY: 1.42 };
}

// =====================================================================
// CONSTRUCCIONES
// =====================================================================
/** Vías del tren a lo largo de X (centradas en el origen). */
export function createRails(length) {
  const g = new THREE.Group();
  g.add(box(length, 0.06, 2.2, '#9a8f84', 0, 0.02, 0)); // balasto
  for (let x = -length / 2 + 0.4; x < length / 2; x += 0.9) g.add(box(0.22, 0.06, 1.9, '#6b4a2b', x, 0.07, 0));
  for (const z of [-0.6, 0.6]) g.add(box(length, 0.08, 0.08, '#8a8f99', 0, 0.13, z));
  return g;
}

/** Andén con casita de la estación y reloj. Origen = centro del andén; las vías pasan por z = +2.6. */
export function createStation() {
  const g = new THREE.Group();
  g.add(box(12, 0.35, 2.6, '#c9b79c', 0, 0.17, 0.2));
  g.add(box(12, 0.06, 0.25, '#ffd23f', 0, 0.37, 1.35));
  // Casita
  g.add(box(4.4, 2.4, 2.2, '#f2d7a0', -3.4, 1.55, -1.6));
  g.add(roof(4.9, 1.2, 2.6, '#b23a48', -3.4, 2.75, -1.6));
  g.add(box(0.8, 1.4, 0.06, '#6b4226', -3.4, 1.05, -0.48));
  for (const x of [-4.8, -2.0]) g.add(box(0.7, 0.6, 0.06, '#9fd8ef', x, 1.6, -0.48));
  // Techito del andén con columnas
  g.add(box(6, 0.12, 2.4, '#8e5229', 2.2, 2.6, 0.3));
  for (const x of [-0.6, 5.0]) for (const z of [-0.6, 1.1]) g.add(cyl(0.07, 0.07, 2.3, 8, '#5c4033', x, 1.45, z));
  // Reloj y banco
  g.add(cyl(0.3, 0.3, 0.08, 16, '#ffffff', 2.2, 2.25, 1.45).rotateX(Math.PI / 2));
  g.add(box(1.4, 0.08, 0.4, '#c07a43', 3.5, 0.75, -0.6));
  for (const x of [2.9, 4.1]) g.add(box(0.08, 0.4, 0.35, '#5c4033', x, 0.55, -0.6));
  return g;
}

/** Tren de carga: locomotora + vagones. Frente hacia +Z local (se rota para ir por X). */
export function createTrain() {
  const root = new THREE.Group();
  const wheels = [];
  const wheel = (x, z) => {
    const w = cyl(0.36, 0.36, 0.2, 14, '#2a2a2a', x, 0.36, z);
    w.rotation.z = Math.PI / 2;
    root.add(w);
    wheels.push(w);
  };
  // Locomotora a vapor
  root.add(box(1.8, 0.3, 3.4, '#2b2b2b', 0, 0.6, 4.2));
  const boiler = cyl(0.7, 0.7, 2.4, 16, '#2e7d32', 0, 1.35, 4.8);
  boiler.rotation.x = Math.PI / 2;
  root.add(boiler);
  root.add(box(1.8, 1.9, 1.3, '#2e7d32', 0, 1.6, 3.2));
  root.add(box(2.0, 0.15, 1.5, '#1b5e20', 0, 2.6, 3.2));
  root.add(box(1.82, 0.5, 1.0, '#8fd3f4', 0, 1.9, 3.25));
  root.add(cyl(0.22, 0.28, 0.7, 12, '#2b2b2b', 0, 2.3, 5.5));
  root.add(cyl(0.2, 0.2, 0.06, 12, '#ffd23f', 0, 1.35, 6.02).rotateX(Math.PI / 2));
  root.add(box(1.9, 0.12, 0.2, '#e2483d', 0, 0.55, 5.95));
  for (const z of [3.2, 4.4, 5.5]) { wheel(-0.9, z); wheel(0.9, z); }
  // Vagones (la carga va en el del medio)
  for (const [z, color] of [[0, '#c0392b'], [-3.8, '#d98c2b']]) {
    root.add(box(1.9, 0.2, 3.4, '#3a3a3a', 0, 0.62, z));
    root.add(box(1.9, 0.12, 3.4, '#c07a43', 0, 0.78, z));
    for (const s of [-1, 1]) root.add(box(0.1, 0.55, 3.4, color, s * 0.9, 1.1, z));
    for (const s of [-1, 1]) root.add(box(1.9, 0.55, 0.1, color, 0, 1.1, z + s * 1.65));
    for (const dz of [-1.1, 1.1]) { wheel(-0.9, z + dz); wheel(0.9, z + dz); }
    root.add(box(0.3, 0.12, 0.4, '#2b2b2b', 0, 0.6, z + 1.9));
  }
  const bedAnchor = new THREE.Group();
  bedAnchor.position.set(0, 0.86, 0);
  root.add(bedAnchor);
  return { root, wheels, bedAnchor, smoke: new THREE.Vector3(0, 2.7, 5.5) };
}

/** Caballeriza: establo chico con medio portón y el caballo asomado. */
export function createStable() {
  const g = new THREE.Group();
  g.add(box(4.6, 0.2, 3.2, C.woodDark, 0, 0.1, 0));
  g.add(box(4.4, 2.2, 3.0, '#a0522d', 0, 1.3, 0));
  g.add(roof(5.0, 1.3, 3.5, '#5c4033', 0, 2.4, 0));
  for (const x of [-1.2, 1.2]) {
    g.add(box(1.3, 0.8, 0.08, '#6b4226', x, 0.6, 1.52));
    g.add(box(1.3, 0.1, 0.1, '#ffffff', x, 1.0, 1.56));
  }
  // Cabezas de caballos asomadas
  for (const [x, c] of [[-1.2, '#a0522d'], [1.2, '#f2f2f2']]) {
    g.add(box(0.28, 0.3, 0.55, c, x, 1.35, 1.65));
    g.add(box(0.29, 0.12, 0.12, '#e9d6c0', x, 1.28, 1.95));
  }
  g.add(box(1.6, 0.4, 0.06, '#ffd23f', 0, 3.0, 1.52));
  // Herradura arriba de la puerta
  const shoe = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.05, 6, 14, Math.PI * 1.4), mat('#b0b0b0'));
  shoe.position.set(0, 2.2, 1.55);
  shoe.rotation.z = -Math.PI * 0.2;
  g.add(shoe);
  for (const [x, z] of [[2.7, 0.6], [2.75, -0.3]]) {
    g.add(box(1.0, 0.5, 0.62, '#f2c94c', x, 0.25, z));
  }
  return g;
}

/** Tanque australiano con molino de viento (aspas en userData.spin). */
export function createWaterTank() {
  const g = new THREE.Group();
  g.add(cyl(2.4, 2.4, 1.0, 24, '#9aa3ad', 0, 0.5, 0));
  for (const y of [0.3, 0.7]) g.add(cyl(2.42, 2.42, 0.05, 24, '#7d868f', 0, y, 0));
  const water = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.04, 24), new THREE.MeshStandardMaterial({ color: '#5fb8e6', roughness: 0.15 }));
  water.position.y = 0.95;
  g.add(water);
  // Torre del molino (al costado)
  const tx = 3.4;
  for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
    const leg = cyl(0.05, 0.05, 5.2, 6, '#7d868f', tx + x * 0.6, 2.6, z * 0.6);
    leg.rotation.z = -x * 0.12;
    leg.rotation.x = z * 0.12;
    g.add(leg);
  }
  for (const y of [1.2, 2.6, 4.0]) g.add(box(0.95 - y * 0.08, 0.05, 0.95 - y * 0.08, '#7d868f', tx, y, 0));
  g.add(box(0.3, 0.3, 0.6, '#7d868f', tx, 5.3, 0));
  g.add(box(0.05, 0.6, 0.9, '#e2483d', tx, 5.3, -0.7)); // timón
  const wheel = new THREE.Group();
  wheel.position.set(tx, 5.3, 0.38);
  for (let i = 0; i < 12; i++) {
    const blade = box(0.16, 1.0, 0.03, i % 2 ? '#d0d6dc' : '#aab3bc', 0, 0.55, 0);
    const arm = new THREE.Group();
    arm.rotation.z = (i / 12) * Math.PI * 2;
    blade.rotation.y = 0.4;
    arm.add(blade);
    wheel.add(arm);
  }
  g.add(wheel);
  g.add(cyl(0.05, 0.05, 2.6, 6, '#7d868f', tx - 1.2, 0.9, 0).rotateZ(Math.PI / 2 - 0.3)); // caño
  g.userData.spin = wheel;
  g.userData.water = water;
  return g;
}

/** Escenario de la peña: tarima, techito, banderines y parlantes. */
export function createStage() {
  const g = new THREE.Group();
  g.add(box(6, 0.6, 3.6, '#8e5229', 0, 0.3, 0));
  for (let i = 0; i < 6; i++) g.add(box(5.9, 0.04, 0.55, i % 2 ? '#c99a62' : '#bf8f57', 0, 0.62, -1.5 + i * 0.6));
  g.add(box(6.2, 2.6, 0.2, '#5c2e14', 0, 1.9, -1.75));
  for (const x of [-2.9, 2.9]) g.add(cyl(0.1, 0.1, 3.4, 8, '#5c4033', x, 1.7, 1.6));
  g.add(box(6.4, 0.15, 3.8, '#c0392b', 0, 3.4, 0));
  // Banderines
  const colors = ['#e8503f', '#ffd23f', '#3fa7e0', '#ffffff', '#7bcc45'];
  for (let i = 0; i < 12; i++) {
    const f = cone(0.14, 0.3, 3, colors[i % colors.length], -2.75 + i * 0.5, 3.1, 1.75);
    f.rotation.x = Math.PI;
    g.add(f);
  }
  for (const x of [-2.4, 2.4]) {
    g.add(box(0.6, 1.0, 0.5, '#2b2b2b', x, 1.1, -1.2));
    g.add(cyl(0.18, 0.18, 0.04, 12, '#555', x, 1.25, -0.94).rotateX(Math.PI / 2));
  }
  return g;
}

/** Cabaña de la hostería (puerta hacia +Z). */
export function createCabin(roofColor = '#2e7d32') {
  const g = new THREE.Group();
  g.add(box(3.2, 0.25, 2.6, C.woodDark, 0, 0.12, 0));
  g.add(box(3.0, 1.9, 2.4, '#c07a43', 0, 1.2, 0));
  for (let y = 0.4; y < 2.1; y += 0.35) g.add(box(3.04, 0.05, 2.44, '#a8673a', 0, y, 0)); // troncos
  g.add(roof(3.6, 1.3, 2.9, roofColor, 0, 2.15, 0));
  g.add(box(0.8, 1.3, 0.06, '#6b4226', 0, 0.9, 1.22));
  g.add(sphere(0.04, '#ffd23f', 0.28, 0.9, 1.27, 6, 4));
  for (const x of [-1.0, 1.0]) {
    g.add(box(0.6, 0.55, 0.06, '#9fd8ef', x, 1.35, 1.22));
    g.add(box(0.7, 0.08, 0.1, '#ffffff', x, 1.05, 1.25));
  }
  g.add(box(0.4, 0.9, 0.4, '#8d6e63', 1.0, 2.9, -0.4)); // chimenea
  // Alerito y escalón
  g.add(box(1.4, 0.06, 0.7, '#5c4033', 0, 1.75, 1.5));
  g.add(box(1.2, 0.12, 0.5, '#8d6e63', 0, 0.06, 1.5));
  return g;
}

/** Recepción de la hostería: casona con galería (el mostrador va adelante). */
export function createHostelHouse() {
  const g = new THREE.Group();
  g.add(box(7.4, 0.25, 4.2, C.woodDark, 0, 0.12, -4.0));
  g.add(box(7.0, 2.8, 3.8, '#fff3e0', 0, 1.6, -4.0));
  g.add(roof(7.6, 1.8, 4.4, '#b23a48', 0, 3.0, -4.0));
  for (const x of [-2.4, -0.8, 0.8, 2.4]) {
    g.add(box(0.7, 0.8, 0.06, '#9fd8ef', x, 2.0, -2.08));
    g.add(box(0.85, 0.1, 0.12, '#ffffff', x, 1.55, -2.04));
  }
  g.add(box(1.0, 1.6, 0.06, '#6b4226', 0, 0.95, -2.08));
  g.add(box(7.2, 0.12, 1.4, '#8e5229', 0, 2.4, -1.5)); // galería
  for (const x of [-3.4, -1.2, 1.2, 3.4]) g.add(cyl(0.08, 0.08, 2.3, 8, '#5c4033', x, 1.2, -0.9));
  for (const x of [-2.6, 2.6]) {
    g.add(cyl(0.22, 0.17, 0.32, 12, '#c2693c', x, 0.2, -0.6));
    g.add(sphere(0.26, '#4aa63c', x, 0.5, -0.6, 10, 8));
  }
  return g;
}

/** Pileta con agua, borde de lajas, reposeras y sombrilla. El agua es userData.water. */
export function createPool() {
  const g = new THREE.Group();
  g.add(box(7.2, 0.2, 4.6, '#e8e1cf', 0, 0.1, 0));
  const water = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.06, 3.6), new THREE.MeshStandardMaterial({ color: '#4fc3f7', roughness: 0.1, metalness: 0.05 }));
  water.position.y = 0.2;
  g.add(water);
  for (const x of [-2.6, -1.4]) {
    const r = box(0.6, 0.1, 1.5, '#ffffff', x, 0.45, 3.1);
    g.add(r);
    g.add(box(0.6, 0.5, 0.1, '#ff8fab', x, 0.65, 2.4).rotateX(-0.6));
  }
  g.add(cyl(0.04, 0.04, 2.2, 6, '#ffffff', 1.6, 1.1, 3.0));
  g.add(cone(1.0, 0.45, 10, '#ffd23f', 1.6, 2.3, 3.0));
  g.add(sphere(0.25, '#ff5d8f', -1.0, 0.32, 0.6, 10, 8)); // pelota inflable
  g.userData.water = water;
  return g;
}

/** Torre de la aerosilla con polea arriba. */
export function createLiftTower(h = 6) {
  const g = new THREE.Group();
  g.add(box(1.0, 0.3, 1.0, '#9aa3ad', 0, 0.15, 0));
  g.add(cyl(0.16, 0.22, h, 10, '#7d868f', 0, h / 2, 0));
  g.add(box(2.6, 0.18, 0.3, '#5c6670', 0, h, 0));
  for (const x of [-1.2, 1.2]) g.add(cyl(0.22, 0.22, 0.1, 12, '#2b2b2b', x, h - 0.1, 0).rotateZ(Math.PI / 2));
  return g;
}

/** Estación de la aerosilla: plataforma con techo y un cartel. */
export function createLiftStation() {
  const g = new THREE.Group();
  g.add(box(4.2, 0.3, 3.2, '#c9b79c', 0, 0.15, 0));
  for (const [x, z] of [[-1.8, -1.3], [1.8, -1.3], [-1.8, 1.3], [1.8, 1.3]]) g.add(cyl(0.1, 0.1, 3.6, 8, '#5c4033', x, 1.8, z));
  g.add(roof(4.6, 1.0, 3.6, '#2f6fb5', 0, 3.6, 0));
  g.add(cyl(0.9, 0.9, 0.3, 18, '#5c6670', 0, 3.3, 0));
  return g;
}

/** Silla de la aerosilla (cuelga de la barra). */
export function createLiftChair() {
  const g = new THREE.Group();
  g.add(cyl(0.03, 0.03, 1.6, 6, '#5c6670', 0, -0.8, 0));
  g.add(box(1.0, 0.08, 0.5, '#e2483d', 0, -1.6, 0));
  g.add(box(1.0, 0.5, 0.08, '#e2483d', 0, -1.35, -0.25));
  g.add(box(1.0, 0.04, 0.04, '#5c6670', 0, -1.25, 0.3));
  return g;
}

/** Globo aerostático (la canasta queda en el origen). */
export function createBalloon() {
  const g = new THREE.Group();
  g.add(box(1.1, 0.8, 1.1, '#a0703f', 0, 0.4, 0));
  g.add(box(1.16, 0.1, 1.16, '#7a5230', 0, 0.82, 0));
  for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
    const r = cyl(0.015, 0.015, 2.0, 4, '#5c4033', x * 1.2, 1.8, z * 1.2);
    r.rotation.z = -x * 0.3;
    r.rotation.x = z * 0.3;
    g.add(r);
  }
  g.add(cyl(0.2, 0.25, 0.3, 10, '#5c6670', 0, 1.1, 0));
  const colors = ['#e8503f', '#ffd23f', '#3fa7e0', '#ffffff', '#7bcc45', '#ff8fab'];
  for (let i = 0; i < 12; i++) {
    const seg = new THREE.Mesh(new THREE.SphereGeometry(2.2, 6, 14, (i / 12) * Math.PI * 2, Math.PI / 6), mat(colors[i % colors.length]));
    seg.position.y = 4.4;
    seg.scale.set(1, 1.2, 1);
    seg.castShadow = true;
    g.add(seg);
  }
  g.add(cone(0.95, 1.2, 12, '#e8503f', 0, 2.1, 0).rotateX(Math.PI));
  return g;
}

/** Barco carguero (frente hacia +Z local; se rota para ir por X). */
export function createShip() {
  const root = new THREE.Group();
  // Casco
  root.add(box(3.2, 1.3, 9, '#2f4f7f', 0, 0.3, 0));
  root.add(box(3.24, 0.25, 9.04, '#e8e8e8', 0, 0.98, 0));
  const bow = cone(1.6, 2.2, 4, '#2f4f7f', 0, 0.3, 5.6);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.scale.set(1, 1, 0.55);
  root.add(bow);
  root.add(box(3.0, 0.1, 8.6, '#c07a43', 0, 1.1, 0)); // cubierta
  // Puente de mando (atrás) y chimenea
  root.add(box(2.6, 1.6, 2.0, '#ffffff', 0, 1.95, -3.2));
  root.add(box(2.64, 0.4, 2.04, '#8fd3f4', 0, 2.35, -3.2));
  root.add(cyl(0.35, 0.35, 1.4, 12, '#e2483d', 0, 3.3, -3.6));
  root.add(cyl(0.36, 0.36, 0.25, 12, '#2b2b2b', 0, 4.0, -3.6));
  // Bodega abierta con borde (la carga va acá)
  for (const s of [-1, 1]) root.add(box(0.12, 0.45, 4.6, '#ffd23f', s * 1.3, 1.35, 1.2));
  for (const s of [-1, 1]) root.add(box(2.7, 0.45, 0.12, '#ffd23f', 0, 1.35, 1.2 + s * 2.3));
  root.add(cyl(0.05, 0.05, 2.6, 6, '#5c6670', 0, 2.4, 4.0));
  const flag = box(0.6, 0.35, 0.02, '#74acdf', 0.3, 3.5, 4.0);
  root.add(flag);
  root.add(box(0.6, 0.12, 0.025, '#ffffff', 0.3, 3.5, 4.0));
  const bedAnchor = new THREE.Group();
  bedAnchor.position.set(0, 1.18, 1.2);
  root.add(bedAnchor);
  return { root, wheels: [], bedAnchor, smoke: new THREE.Vector3(0, 4.2, -3.6) };
}

/** Muelle de madera sobre pilotes (a lo largo de Z). */
export function createDock(w, d) {
  const g = new THREE.Group();
  g.add(box(w, 0.15, d, '#8e5229', 0, 0.35, 0));
  const n = Math.round(d / 0.5);
  for (let i = 0; i < n; i++) g.add(box(w - 0.1, 0.04, d / n - 0.06, i % 2 ? '#c99a62' : '#bf8f57', 0, 0.45, -d / 2 + d / n / 2 + i * (d / n)));
  for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) for (let z = -d / 2 + 0.3; z < d / 2; z += 1.6) g.add(cyl(0.14, 0.14, 1.4, 8, '#5c4033', x, -0.2, z));
  for (const x of [-w / 2 + 0.3, w / 2 - 0.3]) g.add(cyl(0.12, 0.15, 0.5, 8, '#2b2b2b', x, 0.65, d / 2 - 0.4)); // bolardos
  return g;
}

/** Grúa portuaria: base, torre y pluma giratoria (userData.jib) con gancho. */
export function createCrane() {
  const g = new THREE.Group();
  g.add(box(3.2, 0.4, 3.2, '#5c6670', 0, 0.2, 0));
  for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) g.add(box(0.25, 2.2, 0.25, '#ffb703', x, 1.4, z));
  g.add(box(3.0, 0.3, 3.0, '#ffb703', 0, 2.6, 0));
  const jib = new THREE.Group();
  jib.position.set(0, 2.75, 0);
  jib.add(box(1.4, 1.2, 1.6, '#ffb703', 0, 0.6, 0));
  jib.add(box(1.0, 0.7, 0.06, '#8fd3f4', 0, 0.75, 0.8));
  const arm = box(0.4, 0.4, 7.5, '#e09f00', 0, 1.4, 3.0);
  arm.rotation.x = -0.25;
  jib.add(arm);
  jib.add(box(0.8, 0.8, 1.0, '#5c6670', 0, 1.1, -1.4)); // contrapeso
  const cable = cyl(0.02, 0.02, 3.2, 4, '#2b2b2b', 0, 1.0, 6.4);
  jib.add(cable);
  jib.add(box(0.3, 0.3, 0.3, '#e2483d', 0, -0.6, 6.4));
  g.add(jib);
  g.userData.jib = jib;
  return g;
}

/** Glorieta (plaza del pueblo): kiosco octogonal con techo, bancos y faroles. */
export function createGlorieta() {
  const g = new THREE.Group();
  g.add(cyl(3.6, 3.6, 0.08, 24, '#d8c9ab', 0, 0.04, 0));
  g.add(cyl(2.0, 2.1, 0.5, 8, '#f4efe2', 0, 0.3, 0));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(cyl(0.07, 0.07, 2.2, 6, '#ffffff', Math.cos(a) * 1.85, 1.6, Math.sin(a) * 1.85));
  }
  g.add(cone(2.4, 1.3, 8, '#2e7d32', 0, 3.3, 0));
  g.add(sphere(0.15, '#ffd23f', 0, 4.05, 0, 8, 6));
  for (const a of [0.4, 2.0, 3.6, 5.2]) {
    const x = Math.cos(a) * 3.1;
    const z = Math.sin(a) * 3.1;
    const bench = box(1.2, 0.08, 0.4, '#c07a43', x, 0.45, z);
    bench.rotation.y = -a + Math.PI / 2;
    g.add(bench);
  }
  for (const a of [1.2, 2.8, 4.4, 6.0]) {
    g.add(cyl(0.05, 0.05, 2.4, 6, '#2b2b2b', Math.cos(a) * 3.4, 1.2, Math.sin(a) * 3.4));
    g.add(sphere(0.16, '#fff3c4', Math.cos(a) * 3.4, 2.45, Math.sin(a) * 3.4, 8, 6));
  }
  return g;
}

/** Casona de la estancia: dos plantas, galería con columnas, molduras y palmeras. */
export function createCasona() {
  const g = new THREE.Group();
  g.add(box(11, 0.3, 6.4, '#c9b79c', 0, 0.15, 0));
  g.add(box(10, 3.0, 5.4, '#fff8e8', 0, 1.8, -0.2));
  g.add(box(10.2, 0.2, 5.6, '#e8d3a8', 0, 3.35, -0.2));
  g.add(box(7, 2.2, 4.4, '#fff8e8', 0, 4.55, -0.6));
  g.add(roof(7.6, 1.6, 4.9, '#b23a48', 0, 5.65, -0.6));
  for (const x of [-4.3, 4.3]) g.add(roof(1.6, 0.8, 5.6, '#b23a48', x, 3.45, -0.2));
  // Galería con columnas
  g.add(box(10.4, 0.2, 1.6, '#e8d3a8', 0, 3.2, 3.2));
  for (const x of [-4.6, -2.3, 0, 2.3, 4.6]) g.add(cyl(0.16, 0.18, 2.9, 10, '#ffffff', x, 1.75, 3.6));
  // Puerta doble y ventanas
  g.add(box(1.6, 2.2, 0.08, '#6b4226', 0, 1.4, 2.52));
  for (const x of [-3.4, -1.8, 1.8, 3.4]) {
    g.add(box(0.8, 1.2, 0.08, '#9fd8ef', x, 1.9, 2.52));
    g.add(box(0.95, 0.12, 0.14, '#ffffff', x, 1.25, 2.56));
  }
  for (const x of [-2.2, 0, 2.2]) g.add(box(0.8, 0.9, 0.08, '#9fd8ef', x, 4.6, 1.62));
  // Escalinata
  for (let i = 0; i < 3; i++) g.add(box(3.2 - i * 0.3, 0.15, 0.5, '#d8c9ab', 0, 0.075 + i * 0.15, 4.5 - i * 0.4));
  // Palmeras a los costados
  for (const x of [-6.6, 6.6]) {
    g.add(cyl(0.18, 0.25, 4.5, 8, '#8b6b45', x, 2.25, 2.6));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const leaf = box(1.8, 0.06, 0.4, '#3f8f2a', x + Math.cos(a) * 0.8, 4.4, 2.6 + Math.sin(a) * 0.8);
      leaf.rotation.set(0, -a, -0.35);
      g.add(leaf);
    }
  }
  return g;
}

/** Arco de flores para la boda, con alfombra, sillas de invitados y guirnalda. */
export function createWeddingArch() {
  const g = new THREE.Group();
  g.add(box(1.6, 0.03, 9, '#f4f4f4', 0, 0.02, 3.5)); // alfombra
  g.add(box(1.2, 0.035, 9, '#e8503f', 0, 0.03, 3.5));
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.12, 8, 24, Math.PI), mat('#ffffff'));
  arch.position.set(0, 1.0, -1);
  arch.castShadow = true;
  g.add(arch);
  for (const x of [-1.6, 1.6]) g.add(cyl(0.12, 0.12, 1.0, 8, '#ffffff', x, 0.5, -1));
  const colors = ['#ff8fab', '#ffffff', '#ffd23f', '#ff5d8f'];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI;
    g.add(sphere(0.16, colors[i % colors.length], Math.cos(a) * 1.6, 1.0 + Math.sin(a) * 1.6, -1, 8, 6));
  }
  // Sillas de invitados a los dos lados de la alfombra
  for (let row = 0; row < 4; row++) {
    for (const s of [-1, 1]) {
      for (let k = 0; k < 2; k++) {
        const x = s * (1.4 + k * 0.7);
        const z = 2.2 + row * 1.6;
        g.add(box(0.5, 0.06, 0.5, '#ffffff', x, 0.45, z));
        g.add(box(0.5, 0.5, 0.06, '#ffffff', x, 0.72, z + 0.25));
        g.add(sphere(0.07, '#ff8fab', x, 0.98, z + 0.25, 6, 4));
      }
    }
  }
  return g;
}

/** Fogón de la Fiesta de la Cosecha: parva de leña, mástil con banderines y cajón de fuegos artificiales. */
export function createHarvestFest() {
  const g = new THREE.Group();
  g.add(cyl(1.4, 1.5, 0.25, 14, '#8d8d8d', 0, 0.12, 0));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const log = cyl(0.12, 0.12, 1.4, 8, '#7a4a25', Math.cos(a) * 0.3, 0.6, Math.sin(a) * 0.3);
    log.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    g.add(log);
  }
  g.add(cone(0.5, 0.9, 8, '#ff9f1c', 0, 0.9, 0));
  g.add(cone(0.3, 0.6, 8, '#ffd23f', 0, 1.0, 0));
  g.add(cyl(0.08, 0.08, 5, 8, '#ffffff', 2.4, 2.5, 0));
  const colors = ['#e8503f', '#ffd23f', '#3fa7e0', '#7bcc45'];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const f = cone(0.18, 0.4, 3, colors[i % 4], 2.4 + Math.cos(a) * 1.8, 4.4 - i * 0.05, Math.sin(a) * 1.8);
    f.rotation.x = Math.PI;
    g.add(f);
  }
  g.add(box(1.0, 0.6, 0.7, '#c0392b', -2.4, 0.3, 0.4));
  for (let i = 0; i < 4; i++) g.add(cyl(0.06, 0.06, 0.6, 6, ['#ffd23f', '#3fa7e0', '#ff8fab', '#7bcc45'][i], -2.7 + i * 0.2, 0.9, 0.4));
  for (const [x, z] of [[1.2, 1.8], [-1.0, -1.9], [1.6, -1.4]]) g.add(box(1.0, 0.5, 0.62, '#f2c94c', x, 0.25, z));
  return g;
}

/** Montaña nevada de fondo (decoración de Las Sierras). */
export function createMountain(scale = 1) {
  const g = new THREE.Group();
  g.add(cone(6, 9, 7, '#7a8a6a', 0, 4.5, 0));
  g.add(cone(2.4, 3.6, 7, '#f4f7fb', 0, 7.2, 0));
  g.add(cone(4, 6, 7, '#6b7b5c', 4.5, 3, 1.5));
  g.scale.setScalar(scale);
  return g;
}

/** Pino decorativo (no se cosecha). */
export function createPineTree(scale = 1) {
  const g = new THREE.Group();
  g.add(cyl(0.14, 0.2, 0.9, 8, '#7a4a25', 0, 0.45, 0));
  g.add(cone(0.95, 1.4, 9, '#2f6b3a', 0, 1.4, 0));
  g.add(cone(0.75, 1.15, 9, '#3b8048', 0, 2.05, 0));
  g.add(cone(0.5, 0.9, 9, '#4a9456', 0, 2.6, 0));
  g.scale.setScalar(scale);
  return g;
}

export { createTree, createRock };
