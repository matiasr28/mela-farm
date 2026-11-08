// Bake: "hornea" modelos hechos de muchas primitivas en un solo mesh con el color en los vértices.
// Cada pieza suelta es un draw call (y otro más para la sombra); un personaje tenía ~40 piezas,
// un árbol 5 y la granja entera más de 40.000. Horneando, cada parte rígida es 1 draw call.
//  - bakeGroup(obj, {keep})  : fusiona en el lugar las piezas de obj (menos las de `keep`, que se animan).
//  - bakeTemplate(key, make) : hornea una vez y devuelve la geometría cacheada (ítems y plantas repetidos).
//  - batchStatic(objs)       : decoración estática fusionada por zonas del mapa (mantiene el recorte de cámara).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Material único para todo lo horneado (el color viene de los vértices). */
export const BAKED_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0 });
const BAKED_FLAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, flatShading: true });

const _m = new THREE.Matrix4();
const _inv = new THREE.Matrix4();

/** ¿Se puede fusionar? Material estándar liso, sin textura ni transparencia, y sin hijos propios. */
function bakeable(o, allowTransparent = false) {
  const mt = o.material;
  return o.isMesh && !o.isInstancedMesh && o.visible && o.children.length === 0 && mt && !Array.isArray(mt)
    && mt.isMeshStandardMaterial && !mt.map && (allowTransparent || !mt.transparent) && !mt.vertexColors;
}

/** Copia de la geometría en el espacio pedido, sólo con posición, normal y color (todas indexadas). */
function prepare(geometry, matrix, color) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', geometry.attributes.position.clone());
  if (geometry.attributes.normal) g.setAttribute('normal', geometry.attributes.normal.clone());
  else g.computeVertexNormals();
  const n = g.attributes.position.count;
  if (geometry.index) g.setIndex(geometry.index.clone());
  else {
    const idx = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    g.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  g.applyMatrix4(matrix);
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = color.r; c[i * 3 + 1] = color.g; c[i * 3 + 2] = color.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

/** Junta geometrías indexadas (pasa a índices de 32 bits si hace falta). */
function merge(list) {
  if (list.length === 1) return list[0];
  let total = 0;
  for (const g of list) total += g.attributes.position.count;
  if (total > 65535) {
    for (const g of list) if (!(g.index.array instanceof Uint32Array)) g.setIndex(new THREE.BufferAttribute(new Uint32Array(g.index.array), 1));
  }
  const out = mergeGeometries(list, false);
  for (const g of list) g.dispose();
  return out;
}

/** Recorre obj juntando las piezas fusionables (sin entrar en las ramas de `keep`). */
function collect(root, keep, allowTransparent = false) {
  const out = [];
  const walk = (o) => {
    if (o !== root && keep.has(o)) return;
    if (bakeable(o, allowTransparent)) out.push(o);
    for (const ch of o.children) walk(ch);
  };
  walk(root);
  return out;
}

/**
 * Fusiona en el lugar las piezas de `obj` en uno o dos meshes (liso y facetado), hijos de `obj`.
 * @param {THREE.Object3D} obj
 * @param {{keep?: THREE.Object3D[], castShadow?: boolean, receiveShadow?: boolean}} opts
 */
export function bakeGroup(obj, { keep = [], castShadow = true, receiveShadow = true } = {}) {
  const keepSet = new Set(keep.filter(Boolean));
  obj.updateMatrixWorld(true);
  _inv.copy(obj.matrixWorld).invert();
  const parts = collect(obj, keepSet);
  if (parts.length === 0) return obj;
  const smooth = [];
  const flat = [];
  for (const p of parts) {
    _m.multiplyMatrices(_inv, p.matrixWorld);
    (p.material.flatShading ? flat : smooth).push(prepare(p.geometry, _m, p.material.color));
    p.parent.remove(p);
  }
  for (const [list, material] of [[smooth, BAKED_MAT], [flat, BAKED_FLAT]]) {
    if (!list.length) continue;
    const mesh = new THREE.Mesh(merge(list), material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.userData.baked = true;
    obj.add(mesh);
  }
  return obj;
}

const templates = new Map();
/** Hornea `make()` una sola vez y devuelve su geometría (para ítems y plantas que se repiten mucho). */
export function bakeTemplate(key, make) {
  let g = templates.get(key);
  if (!g) {
    const obj = make();
    obj.position.set(0, 0, 0);
    obj.rotation.set(0, 0, 0);
    obj.scale.set(1, 1, 1);
    obj.updateMatrixWorld(true);
    const parts = collect(obj, new Set(), true); // en los ítems, el vidrio también (queda opaco)
    g = merge(parts.map((p) => prepare(p.geometry, p.matrixWorld, p.material.color)));
    templates.set(key, g);
  }
  return g;
}

/**
 * Decoración estática (árboles, rocas, cercos...): fusiona todo por celdas de `cell` unidades para
 * que la cámara siga pudiendo descartar lo que no ve. Devuelve los meshes nuevos (ya en `parent`).
 * Lo que no se puede fusionar (instanciado, transparente) se agrega tal cual.
 */
export function batchStatic(objects, parent, { cell = 24, castShadow = true, receiveShadow = true } = {}) {
  const cells = new Map();
  const loose = [];
  const pos = new THREE.Vector3();
  for (const o of objects) {
    o.updateMatrixWorld(true);
    o.getWorldPosition(pos);
    const key = `${Math.floor(pos.x / cell)},${Math.floor(pos.z / cell)}`;
    let c = cells.get(key);
    if (!c) { c = { smooth: [], flat: [] }; cells.set(key, c); }
    const walk = (x) => {
      if (bakeable(x)) (x.material.flatShading ? c.flat : c.smooth).push(prepare(x.geometry, x.matrixWorld, x.material.color));
      else if (x.isMesh) loose.push(x);
      for (const ch of x.children) walk(ch);
    };
    walk(o);
  }
  const out = [];
  for (const c of cells.values()) {
    for (const [list, material] of [[c.smooth, BAKED_MAT], [c.flat, BAKED_FLAT]]) {
      if (!list.length) continue;
      const mesh = new THREE.Mesh(merge(list), material);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      parent.add(mesh);
      out.push(mesh);
    }
  }
  for (const m of loose) {
    m.updateMatrixWorld(true);
    m.matrix.copy(m.matrixWorld);
    m.matrix.decompose(m.position, m.quaternion, m.scale);
    parent.add(m);
    out.push(m);
  }
  return out;
}
