// Pile: almacenamiento de ítems en el mundo en forma de grilla apilada
// (comedero, pallet de huevos, estantería del mostrador, caja del camión...).
// Implementa la interfaz "sink" (canAccept/receive) y "source" (hasLanded/give).
import * as THREE from 'three';
import { ITEMS } from '../models/Models.js';

const _tmp = new THREE.Vector3();

export class Pile {
  constructor(game, {
    parent = game.scene, position = new THREE.Vector3(), type = null,
    cols = 2, rows = 2, max = 40, spacing = [0.56, 0.44], layerHeight = null, rotationY = 0,
  } = {}) {
    this.game = game;
    this.type = type; // null = acepta cualquier tipo
    this.cols = cols;
    this.rows = rows;
    this.max = max;
    this.spacing = spacing;
    this.layerHeight = layerHeight ?? (type ? ITEMS[type].height : 0.25);
    this.root = new THREE.Group();
    this.root.position.copy(position);
    this.root.rotation.y = rotationY;
    parent.add(this.root);
    this.items = []; // { type, mesh, landed, value }
    game.add(this);
  }

  get count() { return this.items.length; }
  get isFull() { return this.items.length >= this.max; }
  get landedCount() {
    let n = 0;
    for (const e of this.items) if (e.landed) n++;
    return n;
  }
  hasLanded() { return this.items.some((e) => e.landed); }

  /** Posición local del slot i: columnas × filas por capa, luego sube de capa. */
  slot(i, out) {
    const per = this.cols * this.rows;
    const layer = Math.floor(i / per);
    const j = i % per;
    const cx = j % this.cols;
    const cz = Math.floor(j / this.cols);
    return out.set(
      (cx - (this.cols - 1) / 2) * this.spacing[0],
      layer * this.layerHeight,
      (cz - (this.rows - 1) / 2) * this.spacing[1],
    );
  }

  worldSlot(i, out) {
    this.root.updateWorldMatrix(true, false);
    return this.root.localToWorld(this.slot(i, out));
  }

  // ---- Sink ----
  canAccept(type) { return (this.type === null || this.type === type) && !this.isFull; }

  receive(type, mesh, { duration = 0.3, arc = 1.2 } = {}) {
    const entry = { type, mesh, landed: false, value: 0 };
    this.items.push(entry);
    this.game.fx.fly(mesh, (out) => this.worldSlot(Math.max(0, this.items.indexOf(entry)), out), {
      duration,
      arc,
      onDone: (m) => {
        const idx = this.items.indexOf(entry);
        if (idx < 0) { m.removeFromParent(); return; } // la pila se vació mientras volaba
        this.root.add(m);
        this.slot(idx, m.position);
        m.rotation.set(0, (Math.random() - 0.5) * 0.15, 0);
        m.scale.setScalar(1);
        entry.landed = true;
      },
    });
    return entry;
  }

  // ---- Source ----
  give() {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const e = this.items[i];
      if (e.landed) {
        this.items.splice(i, 1);
        this.game.scene.attach(e.mesh);
        return e;
      }
    }
    return null;
  }

  clear() {
    for (const e of this.items) e.mesh.removeFromParent();
    this.items.length = 0;
  }

  update(dt) {
    // Reacomoda suavemente los ítems si se sacó alguno del medio
    const k = 1 - Math.exp(-dt * 14);
    for (let i = 0; i < this.items.length; i++) {
      const e = this.items[i];
      if (!e.landed) continue;
      this.slot(i, _tmp);
      e.mesh.position.lerp(_tmp, k);
    }
  }
}
