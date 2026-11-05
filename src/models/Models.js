// Models: fábricas de modelos estilo cartoon (formas redondeadas, sombreado suave).
// Todo se construye con primitivas de Three.js: no hay archivos de modelos externos.
// Geometrías y materiales se cachean para que cientos de ítems sean baratos.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const C = {
  grass: '#6cc24a',
  sand: '#e2b46e',
  soil: '#8f5b33',
  soilDark: '#744526',
  wood: '#c07a43',
  woodDark: '#8e5229',
  corn: '#f8c932',
  leaf: '#4ea72e',
  leafLight: '#7bcc45',
  egg: '#fbf8f1',
  white: '#f8f8f4',
  red: '#e2483d',
  dark: '#2b2b2b',
};

// ---------- Cachés ----------
const matCache = new Map();
const geoCache = new Map();

/** Material suave (cartoon). */
export function mat(color) {
  let m = matCache.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0 });
    matCache.set(color, m);
  }
  return m;
}

/** Material facetado (rocas). */
export function matFlat(color) {
  const key = `flat${color}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true });
    matCache.set(key, m);
  }
  return m;
}

function geo(key, make) {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
}

function finish(m, x, y, z) {
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Caja con bordes redondeados (da el look "juguete"). */
export function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const r = Math.min(0.07, Math.min(w, h, d) * 0.22);
  const g = geo(`b${w},${h},${d}`, () => new RoundedBoxGeometry(w, h, d, 2, r));
  return finish(new THREE.Mesh(g, mat(color)), x, y, z);
}

export const cyl = (rt, rb, h, seg, color, x = 0, y = 0, z = 0) => {
  const s = Math.max(seg, 12);
  return finish(new THREE.Mesh(geo(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s)), mat(color)), x, y, z);
};

export const cone = (r, h, seg, color, x = 0, y = 0, z = 0) => {
  const s = Math.max(seg, 10);
  return finish(new THREE.Mesh(geo(`k${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s)), mat(color)), x, y, z);
};

export const sphere = (r, color, x = 0, y = 0, z = 0, ws = 16, hs = 12) =>
  finish(new THREE.Mesh(geo(`s${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs)), mat(color)), x, y, z);

export const capsule = (r, len, color, x = 0, y = 0, z = 0) =>
  finish(new THREE.Mesh(geo(`p${r},${len}`, () => new THREE.CapsuleGeometry(r, len, 4, 12)), mat(color)), x, y, z);

/** Techo a dos aguas: prisma triangular (cumbrera a lo largo de Z). */
export function roof(w, h, d, color, x = 0, y = 0, z = 0) {
  const g = geo(`r${w},${h},${d}`, () => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(0, h);
    s.closePath();
    const eg = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 });
    eg.translate(0, 0, -d / 2);
    return eg;
  });
  return finish(new THREE.Mesh(g, mat(color)), x, y, z);
}

// =====================================================================
// ÍTEMS TRANSPORTABLES  (origen en la base; `height` = alto al apilar)
// =====================================================================
function createCornItem() {
  const g = new THREE.Group();
  const cob = capsule(0.1, 0.3, C.corn, 0.05, 0.11, 0);
  cob.rotation.z = Math.PI / 2;
  const husk = cone(0.12, 0.26, 8, C.leaf, -0.25, 0.11, 0);
  husk.rotation.z = Math.PI / 2;
  const leaf = box(0.32, 0.03, 0.1, C.leafLight, -0.1, 0.2, 0.06);
  leaf.rotation.y = 0.4;
  g.add(cob, husk, leaf);
  return g;
}

function createEggItem() {
  // Maple de cartón con 4 huevos grandes
  const g = new THREE.Group();
  g.add(box(0.48, 0.09, 0.48, '#e5bb79', 0, 0.045, 0));
  for (const x of [-0.11, 0.11]) {
    for (const z of [-0.11, 0.11]) {
      const e = sphere(0.095, C.egg, x, 0.15, z, 12, 10);
      e.scale.y = 1.25;
      g.add(e);
    }
  }
  return g;
}

function createMilkItem() {
  const g = new THREE.Group();
  g.add(cyl(0.11, 0.12, 0.32, 12, C.white, 0, 0.16, 0));
  g.add(cyl(0.122, 0.122, 0.1, 12, '#4a90d9', 0, 0.16, 0));
  g.add(cyl(0.06, 0.1, 0.08, 12, C.white, 0, 0.36, 0));
  g.add(cyl(0.065, 0.065, 0.05, 12, C.red, 0, 0.42, 0));
  return g;
}

function createCashItem() {
  // Fajo de billetes
  const g = new THREE.Group();
  g.add(box(0.5, 0.11, 0.28, '#4cc35a', 0, 0.055, 0));
  g.add(box(0.12, 0.115, 0.29, '#2f9e44', 0, 0.055, 0));
  g.add(box(0.3, 0.012, 0.16, '#8fe39a', 0, 0.112, 0));
  return g;
}

function createWheatItem() {
  // Gavilla de trigo atada
  const g = new THREE.Group();
  const bundle = cyl(0.1, 0.1, 0.36, 10, '#e2bb52', -0.04, 0.1, 0);
  bundle.rotation.z = Math.PI / 2;
  const heads = capsule(0.1, 0.12, '#f3d36b', 0.22, 0.11, 0);
  heads.rotation.z = Math.PI / 2;
  heads.scale.set(1.25, 1, 1.25);
  const band = cyl(0.106, 0.106, 0.06, 10, '#b5651d', 0.02, 0.1, 0);
  band.rotation.z = Math.PI / 2;
  g.add(bundle, heads, band);
  return g;
}

function createPumpkinItem() {
  return createPumpkin(1);
}

function createBreadItem() {
  const g = new THREE.Group();
  const loaf = capsule(0.11, 0.24, '#d99a4e', 0, 0.1, 0);
  loaf.rotation.z = Math.PI / 2;
  loaf.scale.set(0.85, 1, 1);
  g.add(loaf);
  for (const x of [-0.1, 0, 0.1]) {
    const cut = box(0.03, 0.02, 0.14, '#b5743a', x, 0.19, 0);
    cut.rotation.y = 0.5;
    g.add(cut);
  }
  return g;
}

function createJamItem() {
  // Frasco de dulce de zapallo
  const g = new THREE.Group();
  g.add(cyl(0.12, 0.12, 0.2, 14, '#e8762b', 0, 0.1, 0));
  g.add(cyl(0.123, 0.123, 0.08, 14, '#fff3d6', 0, 0.1, 0));
  g.add(cyl(0.13, 0.13, 0.05, 14, '#d9473b', 0, 0.225, 0));
  g.add(cyl(0.15, 0.13, 0.03, 14, '#fff3e0', 0, 0.255, 0));
  return g;
}

function createCakeItem() {
  const g = new THREE.Group();
  g.add(cyl(0.22, 0.22, 0.02, 16, '#ffffff', 0, 0.01, 0));
  g.add(cyl(0.19, 0.19, 0.14, 16, '#f7c6a3', 0, 0.09, 0));
  g.add(cyl(0.195, 0.195, 0.05, 16, '#ff9ec4', 0, 0.18, 0));
  g.add(cyl(0.13, 0.13, 0.06, 16, '#fff3f8', 0, 0.235, 0));
  g.add(sphere(0.045, '#e2483d', 0, 0.29, 0, 10, 8));
  return g;
}

function createWoolItem() {
  // Ovillo de lana
  const g = new THREE.Group();
  const ball = sphere(0.15, '#f4efe6', 0, 0.15, 0, 14, 10);
  g.add(ball);
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(geo(`torus${i}`, () => new THREE.TorusGeometry(0.15, 0.012, 6, 20)), mat('#d9cfc0'));
    ring.position.y = 0.15;
    ring.rotation.set(i * 1.1, i * 0.7, 0);
    g.add(ring);
  }
  return g;
}

function createScarfItem() {
  // Bufanda doblada a rayas
  const g = new THREE.Group();
  ['#e2483d', '#ffffff', '#e2483d', '#ffffff', '#e2483d'].forEach((c, i) => {
    g.add(box(0.1, 0.12, 0.34, c, -0.2 + i * 0.1, 0.06, 0));
  });
  g.add(box(0.5, 0.06, 0.12, '#e2483d', 0, 0.14, 0.12));
  return g;
}

function createStrawberryItem() {
  // Canastita de frutillas
  const g = new THREE.Group();
  g.add(box(0.44, 0.12, 0.34, '#d9a066', 0, 0.06, 0));
  for (const [x, z] of [[-0.12, -0.07], [0, -0.07], [0.12, -0.07], [-0.06, 0.07], [0.08, 0.07]]) {
    const b = sphere(0.07, '#e8304a', x, 0.15, z, 10, 8);
    b.scale.y = 1.2;
    g.add(b);
    g.add(cone(0.04, 0.04, 6, '#4f9e2c', x, 0.24, z));
  }
  return g;
}

function createIceCreamItem() {
  const g = new THREE.Group();
  const c = cone(0.1, 0.24, 12, '#e2b36b', 0, 0.12, 0);
  c.rotation.x = Math.PI;
  g.add(c);
  g.add(sphere(0.11, '#ff9ec4', 0, 0.27, 0, 12, 10));
  g.add(sphere(0.09, '#fff3d6', 0, 0.37, 0, 12, 10));
  g.add(sphere(0.03, '#e2483d', 0, 0.46, 0, 8, 6));
  return g;
}

function createAppleItem() {
  const g = new THREE.Group();
  const a = sphere(0.14, '#e2483d', 0, 0.14, 0, 14, 10);
  a.scale.set(1, 0.9, 1);
  g.add(a);
  g.add(cyl(0.012, 0.012, 0.08, 6, '#6b4226', 0, 0.29, 0));
  const leaf = sphere(0.04, '#4f9e2c', 0.04, 0.3, 0, 8, 6);
  leaf.scale.set(1.4, 0.4, 0.8);
  g.add(leaf);
  return g;
}

function createJuiceItem() {
  // Cajita de jugo con sorbete
  const g = new THREE.Group();
  g.add(box(0.2, 0.3, 0.14, '#7bcc45', 0, 0.15, 0));
  g.add(box(0.205, 0.1, 0.145, '#ffffff', 0, 0.15, 0));
  g.add(sphere(0.035, '#e2483d', 0, 0.15, 0.075, 8, 6));
  g.add(cyl(0.012, 0.012, 0.12, 6, '#ff9ec4', 0.05, 0.34, 0));
  return g;
}

/** Catálogo de ítems: alto al apilar, precio base de venta y emoji para la UI. */
export const ITEMS = {
  corn: { height: 0.22, price: 2, emoji: '🌽', name: 'maíz', create: createCornItem },
  egg: { height: 0.24, price: 3, emoji: '🥚', name: 'huevos', create: createEggItem },
  milk: { height: 0.46, price: 5, emoji: '🥛', name: 'leche', create: createMilkItem },
  wheat: { height: 0.21, price: 2, emoji: '🌾', name: 'trigo', create: createWheatItem },
  pumpkin: { height: 0.34, price: 3, emoji: '🎃', name: 'zapallos', create: createPumpkinItem },
  bread: { height: 0.21, price: 8, emoji: '🍞', name: 'panes', create: createBreadItem },
  jam: { height: 0.3, price: 12, emoji: '🍯', name: 'dulces', create: createJamItem },
  cake: { height: 0.32, price: 25, emoji: '🎂', name: 'tortas', create: createCakeItem },
  wool: { height: 0.3, price: 4, emoji: '🧶', name: 'lana', create: createWoolItem },
  scarf: { height: 0.2, price: 20, emoji: '🧣', name: 'bufandas', create: createScarfItem },
  strawberry: { height: 0.27, price: 3, emoji: '🍓', name: 'frutillas', create: createStrawberryItem },
  icecream: { height: 0.48, price: 30, emoji: '🍦', name: 'helados', create: createIceCreamItem },
  apple: { height: 0.28, price: 3, emoji: '🍎', name: 'manzanas', create: createAppleItem },
  juice: { height: 0.3, price: 15, emoji: '🧃', name: 'jugos', create: createJuiceItem },
  cash: { height: 0.11, price: 1, emoji: '💵', name: 'plata', create: createCashItem },
};

export const createItem = (type) => ITEMS[type].create();

// =====================================================================
// CULTIVO
// =====================================================================
export function createCornPlant() {
  const g = new THREE.Group();
  g.add(cyl(0.045, 0.07, 1.4, 8, C.leaf, 0, 0.7, 0));
  for (let i = 0; i < 4; i++) {
    const pivot = new THREE.Group();
    pivot.position.y = 0.35 + i * 0.22;
    pivot.rotation.y = i * (Math.PI / 2) + 0.4;
    const l = box(0.55, 0.03, 0.14, i % 2 ? C.leaf : C.leafLight, 0.25, 0, 0);
    l.rotation.z = 0.35;
    pivot.add(l);
    g.add(pivot);
  }
  const cob = new THREE.Group();
  cob.position.set(0.13, 0.85, 0);
  cob.rotation.z = -0.35;
  cob.add(capsule(0.07, 0.18, C.corn, 0, 0, 0));
  const husk = cone(0.085, 0.16, 8, C.leaf, 0, -0.2, 0);
  husk.rotation.x = Math.PI;
  cob.add(husk);
  g.add(cob);
  g.add(cone(0.08, 0.22, 8, '#e3c35a', 0, 1.5, 0));
  return { group: g, cob };
}

export function createWheatPlant() {
  const g = new THREE.Group();
  const heads = new THREE.Group();
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const r = 0.08 + Math.random() * 0.08;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const h = 0.8 + Math.random() * 0.2;
    g.add(cyl(0.015, 0.02, h, 6, '#a8b545', x, h / 2, z));
    const head = capsule(0.04, 0.13, '#eccb5a', x, h + 0.06, z);
    heads.add(head);
  }
  for (let i = 0; i < 3; i++) {
    const leaf = box(0.35, 0.02, 0.07, '#8fbf45', 0, 0.2 + i * 0.12, 0);
    leaf.rotation.set(0, i * 2.1, 0.4);
    g.add(leaf);
  }
  g.add(heads);
  return { group: g, cob: heads };
}

export function createPumpkinPlant() {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.6;
    const leaf = sphere(0.22, i % 2 ? '#4f9e2c' : '#62b53a', Math.cos(a) * 0.32, 0.1, Math.sin(a) * 0.32);
    leaf.scale.set(1, 0.3, 1);
    g.add(leaf);
  }
  const vine = cyl(0.03, 0.03, 0.7, 6, '#3f7f22', 0, 0.05, -0.05);
  vine.rotation.z = Math.PI / 2;
  g.add(vine);
  const pumpkin = createPumpkin(1.15);
  pumpkin.position.set(0.05, 0, 0.12);
  g.add(pumpkin);
  return { group: g, cob: pumpkin };
}

export function createStrawberryPlant() {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leaf = sphere(0.14, i % 2 ? '#3f8f2a' : '#57ad3a', Math.cos(a) * 0.18, 0.12, Math.sin(a) * 0.18);
    leaf.scale.set(1, 0.4, 1);
    g.add(leaf);
  }
  const berries = new THREE.Group();
  for (const [x, z] of [[0.08, 0.12], [-0.12, 0.05], [0.02, -0.14], [0.15, -0.05]]) {
    const b = sphere(0.065, '#e8304a', x, 0.14, z, 10, 8);
    b.scale.y = 1.2;
    berries.add(b);
  }
  g.add(berries);
  return { group: g, cob: berries };
}

export function createAppleTree() {
  const g = new THREE.Group();
  g.add(cyl(0.1, 0.14, 0.9, 8, '#8b5a2b', 0, 0.45, 0));
  g.add(sphere(0.55, '#4aa63c', 0, 1.15, 0));
  g.add(sphere(0.4, '#57b947', 0.25, 1.4, 0.1));
  const apples = new THREE.Group();
  for (const [x, y, z] of [[0.4, 1.0, 0.3], [-0.35, 1.2, 0.35], [0.1, 1.5, 0.42], [0.45, 1.35, -0.2], [-0.4, 0.95, -0.25]]) {
    apples.add(sphere(0.09, '#e2483d', x, y, z, 10, 8));
  }
  g.add(apples);
  return { group: g, cob: apples };
}

// =====================================================================
// PERSONAJES
// =====================================================================
/**
 * Personaje cartoon con extremidades articuladas.
 * hairStyle: 'short' | 'ponytail' | 'long' | 'bun' | 'bald'
 */
export function createCharacterRig({
  shirt = '#3b82f6', pants = '#2f4a7a', skin = '#f5c9a0', hair = '#5a3a22', hairStyle = 'short',
  hat = null, hatColor = '#e9c46a', shoes = '#5b3a24', overalls = null, tie = '#ff4f81', scale = 1,
  glasses = false, prop = null,
} = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const legColor = overalls || pants;

  const leg = (x) => {
    const p = new THREE.Group();
    p.position.set(x, 0.52, 0);
    p.add(capsule(0.085, 0.3, legColor, 0, -0.22, 0));
    p.add(box(0.15, 0.09, 0.24, shoes, 0, -0.47, 0.04));
    body.add(p);
    return p;
  };
  const legL = leg(-0.1);
  const legR = leg(0.1);
  body.add(box(0.36, 0.2, 0.24, legColor, 0, 0.6, 0)); // cadera

  const torso = capsule(0.16, 0.2, shirt, 0, 0.86, 0);
  torso.scale.set(1.12, 1, 0.82);
  body.add(torso);
  if (overalls) {
    body.add(box(0.26, 0.22, 0.06, overalls, 0, 0.84, 0.12));
    body.add(box(0.05, 0.22, 0.04, overalls, -0.1, 1.0, 0.1));
    body.add(box(0.05, 0.22, 0.04, overalls, 0.1, 1.0, 0.1));
    body.add(sphere(0.022, '#ffd23f', -0.1, 0.93, 0.155));
    body.add(sphere(0.022, '#ffd23f', 0.1, 0.93, 0.155));
  }

  const arm = (x) => {
    const p = new THREE.Group();
    p.position.set(x, 1.04, 0);
    p.add(capsule(0.065, 0.12, shirt, 0, -0.08, 0));
    p.add(capsule(0.055, 0.18, skin, 0, -0.26, 0));
    p.add(sphere(0.062, skin, 0, -0.39, 0));
    body.add(p);
    return p;
  };
  const armL = arm(-0.24);
  const armR = arm(0.24);
  body.add(cyl(0.06, 0.06, 0.1, 12, skin, 0, 1.14, 0)); // cuello

  // ---- Cabeza ----
  const head = new THREE.Group();
  head.position.set(0, 1.34, 0);
  body.add(head);
  const skull = sphere(0.2, skin);
  skull.scale.set(1, 1.04, 0.98);
  head.add(skull);
  const eyes = [];
  const shines = [];
  for (const x of [-0.07, 0.07]) {
    const eye = sphere(0.027, '#2a1a10', x, 0.0, 0.18, 10, 8);
    eye.scale.y = 1.35;
    head.add(eye);
    eyes.push(eye);
    const shine = sphere(0.009, '#ffffff', x + 0.01, 0.013, 0.205, 6, 4);
    head.add(shine);
    shines.push(shine);
    const blush = sphere(0.032, '#f7a1a1', x * 1.75, -0.05, 0.155, 10, 8);
    blush.scale.set(1, 0.6, 0.4);
    head.add(blush);
    head.add(box(0.07, 0.016, 0.012, hairStyle === 'bald' ? '#6b4a2b' : hair, x, 0.075, 0.19));
  }
  head.add(sphere(0.026, skin, 0, -0.03, 0.2, 10, 8));
  head.add(box(0.07, 0.016, 0.012, '#c0504d', 0, -0.09, 0.19));

  let tail = null;
  if (hairStyle !== 'bald') {
    const cap = sphere(0.218, hair, 0, 0.055, -0.05);
    cap.scale.set(1.02, 0.88, 1.0);
    head.add(cap);
    if (hairStyle !== 'short') {
      // Flequillo de costado
      const bangs = sphere(0.13, hair, 0.05, 0.13, 0.11);
      bangs.scale.set(1.25, 0.5, 0.7);
      bangs.rotation.z = -0.2;
      head.add(bangs);
    }
  }
  if (hairStyle === 'ponytail') {
    head.add(sphere(0.045, tie, 0, 0.1, -0.225, 10, 8));
    tail = new THREE.Group();
    tail.position.set(0, 0.1, -0.24);
    const t1 = sphere(0.085, hair, 0, -0.1, -0.04);
    t1.scale.set(0.9, 1.6, 0.9);
    tail.add(t1);
    tail.add(sphere(0.06, hair, 0, -0.25, -0.03));
    head.add(tail);
  } else if (hairStyle === 'long') {
    const back = sphere(0.2, hair, 0, -0.13, -0.08);
    back.scale.set(1.08, 1.45, 0.7);
    head.add(back);
  } else if (hairStyle === 'bun') {
    head.add(sphere(0.095, hair, 0, 0.25, -0.07));
  } else if (hairStyle === 'curly') {
    // Rulos: bolitas repartidas en espiral sobre la parte de arriba, costados y nuca,
    // dejando libre la cara; algunos rulos caen sobre la frente.
    const n = 46;
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 1.45;            // de arriba hacia la nuca
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const a = i * 2.39996;                          // ángulo áureo
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (z > 0.35 && y < 0.45) continue;             // no tapar la cara
      const s = 0.06 + ((i * 7) % 5) * 0.007;
      head.add(sphere(s, hair, x * 0.245, 0.07 + y * 0.21, z * 0.235 - 0.02, 8, 6));
    }
    // Rulos sobre la frente y a los costados de la cara
    for (const [x, y, z] of [[-0.09, 0.16, 0.17], [0.0, 0.18, 0.18], [0.09, 0.15, 0.17], [0.16, 0.1, 0.13],
      [-0.2, 0.0, 0.08], [0.2, 0.0, 0.08], [-0.21, -0.08, 0.0], [0.21, -0.08, 0.0]]) {
      head.add(sphere(0.055, hair, x, y, z, 8, 6));
    }
  }

  if (glasses) {
    for (const x of [-0.075, 0.075]) {
      const lens = new THREE.Mesh(geo('lens', () => new THREE.TorusGeometry(0.05, 0.011, 6, 16)), mat('#2b2b2b'));
      lens.position.set(x, 0.005, 0.2);
      head.add(lens);
    }
    head.add(box(0.05, 0.012, 0.012, '#2b2b2b', 0, 0.01, 0.205));
  }
  if (prop === 'clipboard') {
    // Tabla con papeles en la mano izquierda
    const board = new THREE.Group();
    board.position.set(0.02, -0.36, 0.1);
    board.rotation.x = -0.9;
    board.add(box(0.22, 0.3, 0.025, '#b5753f', 0, 0, 0));
    board.add(box(0.18, 0.22, 0.01, '#ffffff', 0, -0.02, 0.016));
    board.add(box(0.08, 0.03, 0.02, '#9aa4b1', 0, 0.14, 0.02));
    armL.add(board);
  }

  if (hat === 'straw') {
    head.add(cyl(0.38, 0.38, 0.035, 20, hatColor, 0, 0.2, -0.02));
    head.add(cyl(0.2, 0.22, 0.16, 16, hatColor, 0, 0.29, -0.02));
    head.add(cyl(0.222, 0.222, 0.045, 16, '#c0392b', 0, 0.24, -0.02));
  } else if (hat === 'cap') {
    const crown = sphere(0.215, hatColor, 0, 0.09, -0.02);
    crown.scale.set(1.02, 0.7, 1.02);
    head.add(crown);
    head.add(box(0.3, 0.03, 0.18, hatColor, 0, 0.1, 0.22));
  }

  // Anclajes para pilas: delante (como se lleva en brazos) y espalda
  const frontAnchor = new THREE.Group();
  frontAnchor.position.set(0, 0.72, 0.36);
  body.add(frontAnchor);
  const backAnchor = new THREE.Group();
  backAnchor.position.set(0, 0.62, -0.36);
  body.add(backAnchor);

  root.scale.setScalar(scale);
  return { root, body, legL, legR, armL, armR, head, tail, eyes, shines, backAnchor, frontAnchor };
}

export function createChicken() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const torso = sphere(0.2, C.white, 0, 0.3, 0);
  torso.scale.set(0.95, 0.9, 1.2);
  body.add(torso);
  const tailF = sphere(0.1, C.white, 0, 0.42, -0.22);
  tailF.scale.set(0.7, 1.2, 0.8);
  body.add(tailF);
  body.add(sphere(0.12, C.white, 0, 0.52, 0.16));
  body.add(sphere(0.04, '#e63946', 0, 0.65, 0.16, 8, 6));
  body.add(sphere(0.035, '#e63946', 0, 0.64, 0.21, 8, 6));
  const beak = cone(0.035, 0.08, 8, '#f4a261', 0, 0.51, 0.29);
  beak.rotation.x = Math.PI / 2;
  body.add(beak);
  body.add(sphere(0.025, '#e63946', 0, 0.45, 0.25, 8, 6));
  body.add(sphere(0.018, '#222', -0.07, 0.55, 0.25, 6, 4));
  body.add(sphere(0.018, '#222', 0.07, 0.55, 0.25, 6, 4));
  for (const x of [-0.18, 0.18]) {
    const wing = sphere(0.1, '#ecece6', x, 0.31, 0);
    wing.scale.set(0.35, 0.8, 1.2);
    body.add(wing);
  }
  body.add(cyl(0.018, 0.018, 0.16, 6, '#f4a261', -0.07, 0.08, 0));
  body.add(cyl(0.018, 0.018, 0.16, 6, '#f4a261', 0.07, 0.08, 0));
  return { root, body };
}

export function createCow() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.add(box(0.8, 0.62, 1.3, C.white, 0, 0.8, 0));
  body.add(box(0.82, 0.32, 0.4, C.dark, 0, 0.9, 0.2));
  body.add(box(0.5, 0.36, 0.82, C.dark, 0.16, 0.95, -0.3));
  body.add(box(0.48, 0.48, 0.48, C.white, 0, 1.06, 0.78));
  body.add(box(0.5, 0.22, 0.2, '#f4a6b0', 0, 0.92, 1.0));
  body.add(sphere(0.035, '#222', -0.12, 1.13, 1.02, 8, 6));
  body.add(sphere(0.035, '#222', 0.12, 1.13, 1.02, 8, 6));
  body.add(cone(0.05, 0.16, 8, '#f0e6c8', -0.2, 1.38, 0.72));
  body.add(cone(0.05, 0.16, 8, '#f0e6c8', 0.2, 1.38, 0.72));
  body.add(box(0.18, 0.08, 0.1, C.dark, -0.32, 1.18, 0.7));
  body.add(box(0.18, 0.08, 0.1, C.dark, 0.32, 1.18, 0.7));
  body.add(sphere(0.14, '#f4a6b0', 0, 0.5, -0.15));
  for (const [x, z] of [[-0.28, 0.48], [0.28, 0.48], [-0.28, -0.48], [0.28, -0.48]]) {
    body.add(box(0.17, 0.52, 0.17, C.white, x, 0.26, z));
    body.add(box(0.18, 0.1, 0.18, C.dark, x, 0.05, z));
  }
  body.add(box(0.06, 0.5, 0.06, C.dark, 0, 0.75, -0.68));
  return { root, body };
}

export function createSheep() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  // Lana esponjosa
  for (const [x, y, z, r] of [[0, 0.55, 0, 0.32], [0.18, 0.6, 0.2, 0.22], [-0.18, 0.6, 0.2, 0.22], [0.18, 0.6, -0.22, 0.22],
    [-0.18, 0.6, -0.22, 0.22], [0, 0.75, 0, 0.22]]) {
    body.add(sphere(r, '#f6f2ea', x, y, z, 12, 10));
  }
  body.add(sphere(0.15, '#3b3030', 0, 0.62, 0.38, 12, 10));
  body.add(sphere(0.1, '#f6f2ea', 0, 0.76, 0.34, 10, 8));
  for (const x of [-0.13, 0.13]) {
    const ear = sphere(0.05, '#3b3030', x, 0.66, 0.36, 8, 6);
    ear.scale.set(1.6, 0.6, 0.8);
    body.add(ear);
    body.add(sphere(0.02, '#ffffff', x * 0.45, 0.66, 0.52, 6, 4));
  }
  for (const [x, z] of [[-0.15, 0.18], [0.15, 0.18], [-0.15, -0.18], [0.15, -0.18]]) {
    body.add(cyl(0.04, 0.04, 0.35, 8, '#3b3030', x, 0.17, z));
  }
  return { root, body };
}

/**
 * Gato. pattern: 'tuxedo' (negro con pecho, hocico y patas blancas) | 'white'.
 * longHair agrega "melena" esponjosa; tag = color de la chapita del collar.
 */
export function createCat({ pattern = 'white', eyes = '#7fd0ff', collar = '#2f6fb5', tag = null, longHair = false } = {}) {
  const fur = pattern === 'tuxedo' ? '#1e1e22' : '#f7f5f0';
  const white = '#f7f5f0';
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const torso = sphere(0.2, fur, 0, 0.27, 0);
  torso.scale.set(0.85, 0.8, 1.35);
  body.add(torso);
  const chest = sphere(longHair ? 0.15 : 0.12, white, 0, 0.3, 0.17);
  chest.scale.set(1, 1.1, 0.8);
  body.add(chest);
  if (longHair) {
    for (const [x, y, z] of [[-0.14, 0.33, 0.05], [0.14, 0.33, 0.05], [0, 0.42, -0.08], [-0.12, 0.3, -0.18], [0.12, 0.3, -0.18]]) {
      body.add(sphere(0.1, fur, x, y, z, 10, 8));
    }
  }

  // Cabeza
  const head = new THREE.Group();
  head.position.set(0, 0.47, 0.26);
  body.add(head);
  const skull = sphere(0.15, fur);
  skull.scale.set(1.08, 0.95, 1);
  head.add(skull);
  if (longHair) {
    for (const x of [-0.12, 0.12]) {
      const cheek = sphere(0.08, white, x, -0.06, 0.04, 10, 8);
      cheek.scale.set(1.2, 0.9, 0.8);
      head.add(cheek);
    }
  }
  const muzzle = sphere(0.08, white, 0, -0.04, 0.11, 12, 10);
  muzzle.scale.set(1.25, 0.85, 0.8);
  head.add(muzzle);
  if (pattern === 'tuxedo') {
    const blaze = sphere(0.04, white, 0, 0.04, 0.135, 8, 6);
    blaze.scale.set(0.7, 1.6, 0.5);
    head.add(blaze);
  }
  head.add(sphere(0.022, '#f29eb0', 0, -0.015, 0.175, 8, 6));
  for (const x of [-0.06, 0.06]) {
    const eye = sphere(0.032, eyes, x, 0.03, 0.12, 10, 8);
    eye.scale.set(1, 0.85, 0.6);
    head.add(eye);
    const pupil = sphere(0.016, '#111111', x, 0.03, 0.138, 8, 6);
    pupil.scale.set(0.5, 1.2, 0.5);
    head.add(pupil);
    const ear = cone(0.06, 0.12, 4, fur, x * 1.55, 0.13, 0);
    ear.rotation.z = -x * 2.5;
    head.add(ear);
    const inner = cone(0.035, 0.07, 4, '#f2b5c0', x * 1.55, 0.125, 0.025);
    inner.rotation.z = -x * 2.5;
    head.add(inner);
    // Bigotes
    for (const a of [-0.15, 0, 0.15]) {
      const w = box(0.16, 0.004, 0.004, '#ffffff', x * 2.3, -0.035 + a * 0.1, 0.13);
      w.rotation.z = a * (x > 0 ? 1 : -1);
      head.add(w);
    }
  }

  // Collar con chapita
  const ring = new THREE.Mesh(geo('collar', () => new THREE.TorusGeometry(0.1, 0.018, 6, 16)), mat(collar));
  ring.position.set(0, 0.38, 0.2);
  ring.rotation.x = Math.PI / 2 + 0.5;
  body.add(ring);
  if (tag) body.add(box(0.05, 0.06, 0.012, tag, 0, 0.31, 0.28));

  // Patas (blancas en el gato frac)
  const legs = [];
  for (const [x, z] of [[-0.09, 0.15], [0.09, 0.15], [-0.09, -0.15], [0.09, -0.15]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.2, z);
    pivot.add(capsule(0.045, 0.1, fur, 0, -0.08, 0));
    pivot.add(sphere(0.05, pattern === 'tuxedo' ? white : fur, 0, -0.17, 0.01, 8, 6));
    body.add(pivot);
    legs.push(pivot);
  }

  // Cola esponjosa
  const tail = new THREE.Group();
  tail.position.set(0, 0.3, -0.25);
  const r = longHair ? 0.07 : 0.045;
  const t1 = capsule(r, 0.18, fur, 0, 0.12, -0.04);
  t1.rotation.x = -0.4;
  const t2 = capsule(r * 0.95, 0.16, fur, 0, 0.3, -0.1);
  t2.rotation.x = -0.15;
  tail.add(t1, t2);
  if (pattern === 'tuxedo') tail.add(sphere(r * 1.05, fur, 0, 0.42, -0.12, 8, 6));
  body.add(tail);

  return { root, body, head, tail, legs };
}

/** Escritorio de Matías: mesa, silla, compu y papeles. */
export function createDesk() {
  const g = new THREE.Group();
  g.add(box(1.8, 0.08, 0.9, C.wood, 0, 0.78, 0));
  for (const x of [-0.8, 0.8]) for (const z of [-0.35, 0.35]) g.add(box(0.08, 0.78, 0.08, C.woodDark, x, 0.39, z));
  g.add(box(0.5, 0.32, 0.03, '#2b2b2b', -0.3, 1.0, -0.2));
  g.add(box(0.46, 0.28, 0.01, '#7fd3f7', -0.3, 1.0, -0.18));
  g.add(box(0.5, 0.02, 0.3, '#3a3a3a', -0.3, 0.83, 0.05));
  for (let i = 0; i < 4; i++) g.add(box(0.28, 0.025, 0.36, i % 2 ? '#ffffff' : '#f1f1e6', 0.45, 0.835 + i * 0.026, 0));
  g.add(cyl(0.06, 0.05, 0.12, 10, '#e2483d', 0.75, 0.88, -0.25));
  // Silla
  g.add(box(0.5, 0.08, 0.5, '#3f6fb5', 0, 0.48, -0.8));
  g.add(box(0.5, 0.55, 0.08, '#3f6fb5', 0, 0.78, -1.05));
  g.add(cyl(0.04, 0.04, 0.44, 8, '#555555', 0, 0.22, -0.8));
  return g;
}

// =====================================================================
// CONSTRUCCIONES ESPECIALES (Granja 6+)
// =====================================================================
export function createWindmill() {
  const g = new THREE.Group();
  g.add(cyl(0.9, 1.3, 4.2, 12, '#f5e6c8', 0, 2.1, 0));
  g.add(cone(1.1, 1.2, 12, '#b23a48', 0, 4.8, 0));
  g.add(box(0.6, 1.0, 0.08, '#6b4226', 0, 0.5, 1.2));
  const blades = new THREE.Group();
  blades.position.set(0, 3.8, 1.15);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI) / 2;
    arm.add(box(0.12, 2.0, 0.06, '#8e5229', 0, 1.0, 0));
    arm.add(box(0.5, 1.4, 0.04, '#ffffff', 0.3, 1.2, 0.02));
    blades.add(arm);
  }
  g.add(blades);
  g.userData.spin = blades;
  return g;
}

export function createSilo() {
  const g = new THREE.Group();
  g.add(cyl(1.0, 1.0, 4.5, 16, '#c0392b', 0, 2.25, 0));
  for (const y of [1, 2.2, 3.4]) g.add(cyl(1.02, 1.02, 0.1, 16, '#ffffff', 0, y, 0));
  const dome = sphere(1.0, '#cfd6dd', 0, 4.5, 0, 16, 10);
  dome.scale.y = 0.7;
  g.add(dome);
  g.add(cyl(1.2, 1.2, 3.2, 12, '#a52f24', 1.9, 1.6, 0));
  g.add(roof(2.6, 1.0, 2.6, '#6d4c41', 1.9, 3.2, 0));
  return g;
}

export function createGreenhouse() {
  const g = new THREE.Group();
  g.add(box(4, 0.2, 2.6, C.woodDark, 0, 0.1, 0));
  const glass = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.8, 2.4),
    new THREE.MeshStandardMaterial({ color: '#bfe8ff', transparent: true, opacity: 0.45, roughness: 0.1 }));
  glass.position.y = 1.1;
  g.add(glass);
  for (const x of [-1.9, 0, 1.9]) g.add(box(0.08, 2.2, 2.5, '#ffffff', x, 1.2, 0));
  g.add(roof(4.1, 0.8, 2.6, '#d7f0ff', 0, 2.0, 0));
  for (let i = 0; i < 6; i++) g.add(sphere(0.22, i % 2 ? '#ff7aa2' : '#57b947', -1.4 + i * 0.56, 0.45, 0));
  return g;
}

export function createPond() {
  const g = new THREE.Group();
  const water = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.06, 24),
    new THREE.MeshStandardMaterial({ color: '#4fb6e8', roughness: 0.2 }));
  water.position.y = 0.03;
  water.receiveShadow = true;
  g.add(water);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    g.add(createRock(0.45).translateX(Math.cos(a) * 2.3).translateZ(Math.sin(a) * 2.3));
  }
  for (const [x, z] of [[-0.6, 0.3], [0.7, -0.5]]) {
    g.add(sphere(0.18, '#fff8e8', x, 0.18, z));
    g.add(sphere(0.1, '#2f8f4e', x, 0.36, z + 0.12));
    g.add(cone(0.04, 0.1, 6, '#f4a261', x, 0.34, z + 0.24).rotateX(Math.PI / 2));
  }
  return g;
}

export function createFountain() {
  const g = new THREE.Group();
  g.add(cyl(1.6, 1.7, 0.5, 20, '#cfd6dd', 0, 0.25, 0));
  const water = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.05, 20),
    new THREE.MeshStandardMaterial({ color: '#6fcff5', roughness: 0.15 }));
  water.position.y = 0.48;
  g.add(water);
  g.add(cyl(0.2, 0.3, 1.4, 12, '#cfd6dd', 0, 1.1, 0));
  g.add(cyl(0.7, 0.5, 0.2, 16, '#cfd6dd', 0, 1.8, 0));
  g.add(sphere(0.25, '#9fe3ff', 0, 2.1, 0));
  return g;
}

// =====================================================================
// ESCENARIO
// =====================================================================
/** Árbol "esponjoso". autumn = follaje naranja como en otoño. */
export function createTree(scale = 1, autumn = false) {
  const g = new THREE.Group();
  g.add(cyl(0.16, 0.24, 1.1, 10, '#8b5a2b', 0, 0.55, 0));
  const c1 = autumn ? '#f39c33' : '#57b947';
  const c2 = autumn ? '#e67e22' : '#4aa63c';
  const c3 = autumn ? '#f7b24a' : '#6fcf55';
  g.add(sphere(0.85, c2, 0, 1.6, 0));
  g.add(sphere(0.65, c1, 0.45, 1.95, 0.15));
  g.add(sphere(0.6, c3, -0.4, 2.05, -0.1));
  g.add(sphere(0.5, c1, 0, 2.45, 0.05));
  g.scale.setScalar(scale);
  return g;
}

export function createBush(scale = 1) {
  const g = new THREE.Group();
  g.add(sphere(0.45, '#4fae3f', 0, 0.3, 0));
  g.add(sphere(0.35, '#63c24f', 0.35, 0.25, 0.1));
  g.add(sphere(0.3, '#58b847', -0.32, 0.22, 0.05));
  g.scale.setScalar(scale);
  return g;
}

export function createRock(scale = 1) {
  const m = new THREE.Mesh(geo('rock', () => new THREE.DodecahedronGeometry(0.5, 0)), matFlat('#a3a39a'));
  m.castShadow = m.receiveShadow = true;
  m.scale.set(scale, scale * 0.6, scale);
  m.position.y = 0.15 * scale;
  return m;
}

export function createHayBale() {
  const g = new THREE.Group();
  g.add(box(1.0, 0.5, 0.62, '#f2c94c', 0, 0.25, 0));
  g.add(box(1.02, 0.08, 0.64, '#d9a62e', 0, 0.25, 0.0));
  for (const x of [-0.25, 0.25]) g.add(box(0.05, 0.52, 0.64, '#c99526', x, 0.25, 0));
  return g;
}

export function createPumpkin(scale = 1) {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const s = sphere(0.18, '#f28c28', Math.cos(a) * 0.09, 0.17, Math.sin(a) * 0.09);
    s.scale.set(0.8, 0.85, 0.8);
    g.add(s);
  }
  g.add(cyl(0.03, 0.04, 0.12, 8, '#4e7d2b', 0, 0.36, 0));
  g.scale.setScalar(scale);
  return g;
}

/** Cerco de madera entre dos puntos (coordenadas locales del padre). */
export function createFenceLine(x1, z1, x2, z2, gap = 1.25) {
  const g = new THREE.Group();
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  const n = Math.max(1, Math.round(len / gap));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    g.add(box(0.2, 0.9, 0.2, C.wood, x1 + dx * t, 0.45, z1 + dz * t));
  }
  const ang = Math.atan2(dz, dx);
  for (const y of [0.32, 0.66]) {
    const rail = box(len, 0.16, 0.08, C.woodDark, (x1 + x2) / 2, y, (z1 + z2) / 2);
    rail.rotation.y = -ang;
    g.add(rail);
  }
  return g;
}

export function createTruck() {
  const root = new THREE.Group();
  root.add(box(1.9, 0.3, 4.4, '#3a3a3a', 0, 0.55, 0));
  root.add(box(1.9, 1.15, 1.45, '#e8503f', 0, 1.3, 1.2));
  root.add(box(1.94, 0.5, 1.0, '#8fd3f4', 0, 1.6, 1.3));
  root.add(box(1.9, 0.75, 1.0, '#e8503f', 0, 1.05, 2.25));
  root.add(box(1.7, 0.28, 0.08, '#d9d9d9', 0, 0.82, 2.76));
  root.add(box(2.0, 0.2, 0.25, '#d9d9d9', 0, 0.62, 2.8));
  for (const x of [-0.65, 0.65]) {
    const l = cyl(0.13, 0.13, 0.06, 14, '#fff4b8', x, 1.12, 2.76);
    l.rotation.x = Math.PI / 2;
    root.add(l);
  }
  // Caja de carga
  root.add(box(2.0, 0.14, 2.8, C.wood, 0, 0.78, -0.95));
  root.add(box(0.12, 0.5, 2.8, '#d9473b', -0.95, 1.08, -0.95));
  root.add(box(0.12, 0.5, 2.8, '#d9473b', 0.95, 1.08, -0.95));
  root.add(box(2.0, 0.5, 0.12, '#d9473b', 0, 1.08, -2.3));
  root.add(box(2.0, 0.5, 0.12, '#d9473b', 0, 1.08, 0.45));
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.6], [0.95, 1.6], [-0.95, -1.5], [0.95, -1.5]]) {
    const w = cyl(0.42, 0.42, 0.3, 16, '#2a2a2a', x, 0.42, z);
    w.rotation.z = Math.PI / 2;
    root.add(w);
    const hub = cyl(0.2, 0.2, 0.32, 12, '#d0d0d0', x, 0.42, z);
    hub.rotation.z = Math.PI / 2;
    root.add(hub);
    wheels.push(w);
  }
  const bedAnchor = new THREE.Group();
  bedAnchor.position.set(0, 0.86, -0.95);
  root.add(bedAnchor);
  return { root, wheels, bedAnchor };
}

export function createTractor() {
  const root = new THREE.Group();
  root.add(box(0.9, 0.7, 2.0, '#2fae55', 0, 0.85, 0.2));
  root.add(box(0.7, 0.2, 0.8, '#238a42', 0, 1.25, 0.75));
  root.add(box(0.5, 0.3, 0.5, '#333', 0, 1.35, -0.35));
  for (const [x, z] of [[-0.55, -0.2], [0.55, -0.2], [-0.55, -1.0], [0.55, -1.0]]) {
    root.add(box(0.08, 1.1, 0.08, '#333', x, 1.75, z));
  }
  root.add(box(1.3, 0.12, 1.1, '#f1faee', 0, 2.3, -0.6));
  root.add(cyl(0.06, 0.06, 0.8, 8, '#333', 0.28, 1.55, 0.95));
  root.add(box(2.8, 0.4, 0.5, '#f4c430', 0, 0.4, 1.75));
  const reel = cyl(0.22, 0.22, 2.6, 10, '#d9a400', 0, 0.55, 1.9);
  reel.rotation.z = Math.PI / 2;
  root.add(reel);
  const rear = [];
  const front = [];
  for (const x of [-0.65, 0.65]) {
    const w = cyl(0.6, 0.6, 0.35, 16, '#222', x, 0.6, -0.55);
    w.rotation.z = Math.PI / 2;
    root.add(w);
    rear.push(w);
    const f = cyl(0.35, 0.35, 0.25, 14, '#222', x * 0.85, 0.35, 0.95);
    f.rotation.z = Math.PI / 2;
    root.add(f);
    front.push(f);
  }
  return { root, rear, front, reel };
}

/** Mostrador de venta: madera con tapa roja y caja registradora. */
export function createCounter() {
  const g = new THREE.Group();
  g.add(box(3.4, 0.92, 1.1, '#b5683b', 0, 0.46, 0));
  g.add(box(3.3, 0.5, 0.05, '#9a5530', 0, 0.45, 0.56));
  g.add(box(3.55, 0.12, 1.22, '#d9473b', 0, 0.98, 0));
  // Caja registradora
  g.add(box(0.5, 0.28, 0.42, '#3a6fd8', 1.35, 1.18, -0.05));
  g.add(box(0.42, 0.18, 0.08, '#2b56b0', 1.35, 1.38, -0.2));
  g.add(box(0.3, 0.04, 0.2, '#d9e6ff', 1.35, 1.33, 0.08));
  return g;
}

export function createCoopHouse() {
  const g = new THREE.Group();
  g.add(box(2.3, 0.2, 1.7, C.woodDark, 0, 0.1, 0));
  g.add(box(2.2, 1.3, 1.6, '#f2d7a0', 0, 0.85, 0));
  g.add(box(0.5, 0.6, 0.06, '#5c3d24', 0, 0.6, 0.81));
  g.add(box(0.4, 0.3, 0.06, '#9fd8ef', 0.65, 1.05, 0.81));
  g.add(roof(2.5, 0.8, 1.85, '#d1495b', 0, 1.5, 0));
  const ramp = box(0.45, 0.05, 0.8, C.wood, 0, 0.18, 1.15);
  ramp.rotation.x = 0.45;
  g.add(ramp);
  return g;
}

export function createBarnHouse() {
  const g = new THREE.Group();
  g.add(box(3.2, 2.0, 2.2, '#c0392b', 0, 1.0, 0));
  g.add(box(1.2, 1.4, 0.06, '#7b1f16', 0, 0.7, 1.11));
  const x1 = box(1.5, 0.1, 0.07, '#ffffff', 0, 0.7, 1.15);
  x1.rotation.z = 0.86;
  const x2 = box(1.5, 0.1, 0.07, '#ffffff', 0, 0.7, 1.15);
  x2.rotation.z = -0.86;
  g.add(x1, x2);
  g.add(box(1.3, 0.1, 0.07, '#ffffff', 0, 1.42, 1.15));
  g.add(roof(3.4, 1.2, 2.5, '#6d4c41', 0, 2.0, 0));
  g.add(box(0.5, 0.4, 0.06, '#ffffff', 0, 2.45, 1.2));
  return g;
}

export function createTrough() {
  const g = new THREE.Group();
  g.add(box(2.0, 0.35, 0.8, C.woodDark, 0, 0.2, 0));
  g.add(box(1.8, 0.05, 0.6, '#6b4a2b', 0, 0.38, 0));
  return g;
}

export function createPallet() {
  const g = new THREE.Group();
  g.add(box(1.3, 0.06, 1.1, C.wood, 0, 0.11, 0));
  for (const x of [-0.55, 0, 0.55]) g.add(box(0.14, 0.08, 1.1, C.woodDark, x, 0.04, 0));
  return g;
}

export function createBin() {
  const g = new THREE.Group();
  g.add(box(2.0, 0.1, 1.4, C.woodDark, 0, 0.05, 0));
  g.add(box(2.0, 0.5, 0.1, C.wood, 0, 0.3, -0.66));
  g.add(box(2.0, 0.5, 0.1, C.wood, 0, 0.3, 0.66));
  g.add(box(0.1, 0.5, 1.4, C.wood, -0.96, 0.3, 0));
  g.add(box(0.1, 0.5, 1.4, C.wood, 0.96, 0.3, 0));
  return g;
}

export function createFarmhouse() {
  const g = new THREE.Group();
  g.add(box(5, 3, 4, '#f5e6c8', 0, 1.5, 0));
  g.add(roof(5.6, 2, 4.4, '#b23a48', 0, 3, 0));
  g.add(box(0.9, 1.6, 0.08, '#6b4226', 0, 0.8, 2.02));
  for (const x of [-1.6, 1.6]) {
    g.add(box(0.8, 0.7, 0.08, '#9fd8ef', x, 1.7, 2.02));
    g.add(box(0.95, 0.1, 0.12, '#ffffff', x, 1.3, 2.05));
  }
  g.add(box(0.5, 1.2, 0.5, '#8d6e63', 1.4, 4.0, -0.6));
  return g;
}

/** Taller/fábrica genérico (panadería, dulcería, pastelería): paredes, techo, toldo y chimenea. */
export function createWorkshop({ wall = '#f5e6c8', roofColor = '#b5651d', awning = ['#ffffff', '#e2483d'] } = {}) {
  const g = new THREE.Group();
  g.add(box(4.2, 0.2, 3.0, C.woodDark, 0, 0.1, 0));
  g.add(box(4.0, 2.2, 2.8, wall, 0, 1.3, 0));
  g.add(roof(4.5, 1.4, 3.2, roofColor, 0, 2.4, 0));
  g.add(box(0.9, 1.4, 0.08, '#6b4226', 0, 0.9, 1.42));
  for (const x of [-1.3, 1.3]) {
    g.add(box(0.8, 0.6, 0.08, '#9fd8ef', x, 1.5, 1.42));
    g.add(box(0.95, 0.1, 0.14, '#ffffff', x, 1.15, 1.45));
  }
  g.add(box(0.45, 1.2, 0.45, '#8d6e63', 1.2, 3.3, -0.5));
  for (let i = 0; i < 5; i++) {
    const s = box(0.52, 0.08, 0.8, awning[i % 2], -1.04 + 0.52 * i, 2.3, 1.75);
    s.rotation.x = 0.35;
    g.add(s);
  }
  g.userData.chimney = new THREE.Vector3(1.2, 4.0, -0.5);
  return g;
}

/** Mesa de madera donde se apoyan los insumos de un taller. */
export function createTable(width = 1.6) {
  const g = new THREE.Group();
  g.add(box(width, 0.1, 0.8, C.wood, 0, 0.5, 0));
  for (const x of [-width / 2 + 0.1, width / 2 - 0.1]) {
    for (const z of [-0.3, 0.3]) g.add(box(0.1, 0.5, 0.1, C.woodDark, x, 0.25, z));
  }
  return g;
}

/** Cartel de madera con texto (canvas). */
export function createSign(text, sub = '') {
  const g = new THREE.Group();
  for (const x of [-1.3, 1.3]) g.add(box(0.16, 1.9, 0.16, C.woodDark, x, 0.95, 0));
  g.add(box(3.2, 1.1, 0.14, C.wood, 0, 1.6, 0));
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 176;
  const ctx = canvas.getContext('2d');
  const draw = () => {
    ctx.fillStyle = '#c07a43';
    ctx.fillRect(0, 0, 512, 176);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 84px "Nunito", "Segoe UI", Arial, sans-serif';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#6b3a1a';
    ctx.strokeText(text, 256, sub ? 70 : 88);
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(text, 256, sub ? 70 : 88);
    if (sub) {
      ctx.font = '800 34px "Nunito", "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = '#fff3d6';
      ctx.fillText(sub, 256, 138);
    }
  };
  draw();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  // Redibuja cuando termina de cargar la tipografía Nunito
  document.fonts?.ready.then(() => { draw(); tex.needsUpdate = true; });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.03), new THREE.MeshBasicMaterial({ map: tex }));
  face.position.set(0, 1.6, 0.075);
  g.add(face);
  return g;
}
