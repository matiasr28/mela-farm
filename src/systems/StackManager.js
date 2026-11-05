// StackManager: pila dinámica de ítems en la espalda (o en las manos) de un personaje.
// - Cada ítem tiene su posición Y acumulada según la altura de los ítems de abajo.
// - Los ítems llegan volando (Fx.fly) y recién cuentan como "landed" al aterrizar.
// - Bamboleo físico: un resorte 2D se inclina en contra de la velocidad del personaje,
//   y cada ítem se desplaza proporcionalmente a su altura (los de arriba se mueven más).
import * as THREE from 'three';
import { ITEMS } from '../models/Models.js';

export class StackManager {
  /**
   * @param {Game} game
   * @param {THREE.Object3D} anchor  punto del personaje donde nace la pila
   * @param {number} capacity
   */
  constructor(game, anchor, capacity = 10, { wobble = 1 } = {}) {
    this.game = game;
    this.root = new THREE.Group();
    anchor.add(this.root);
    this.items = [];          // { type, mesh, h, y, landed }
    this.capacity = capacity;
    this.wobble = wobble;
    this.height = 0;
    this.lean = new THREE.Vector2();
    this.leanVel = new THREE.Vector2();
  }

  get count() { return this.items.length; }
  get isFull() { return this.items.length >= this.capacity; }

  countOf(type, landedOnly = false) {
    let n = 0;
    for (const e of this.items) if (e.type === type && (!landedOnly || e.landed)) n++;
    return n;
  }

  // ---- Interfaz "sink" (puede recibir ítems) ----
  canAccept() { return !this.isFull; }

  receive(type, mesh) {
    const entry = { type, mesh, h: ITEMS[type].height, y: 0, landed: false };
    this.items.push(entry);
    this.layout();
    this.game.fx.fly(mesh, (out) => {
      this.root.updateWorldMatrix(true, false);
      return this.root.localToWorld(out.set(0, entry.y, 0));
    }, {
      duration: 0.25,
      arc: 1.0,
      onDone: (m) => {
        if (!this.items.includes(entry)) { m.removeFromParent(); return; }
        this.root.add(m);
        m.position.set(0, entry.y, 0);
        m.rotation.set(0, 0, 0);
        m.scale.setScalar(1);
        entry.landed = true;
        this.onLand?.(entry); // hook (sonidos)
      },
    });
    return entry;
  }

  /** Saca el ítem aterrizado más alto de alguno de los tipos dados. Queda en coordenadas de mundo. */
  take(types) {
    const list = Array.isArray(types) ? types : [types];
    for (let i = this.items.length - 1; i >= 0; i--) {
      const e = this.items[i];
      if (e.landed && list.includes(e.type)) {
        this.items.splice(i, 1);
        this.game.scene.attach(e.mesh);
        this.layout();
        return e;
      }
    }
    return null;
  }

  /** Recalcula la altura Y de cada ítem (los de arriba "caen" si se saca uno del medio). */
  layout() {
    let y = 0;
    for (const e of this.items) { e.y = y; y += e.h; }
    this.height = y;
  }

  /**
   * @param {number} vx  velocidad en mundo (X)
   * @param {number} vz  velocidad en mundo (Z)
   * @param {number} yaw rotación Y del personaje
   */
  update(dt, vx = 0, vz = 0, yaw = 0) {
    // Velocidad en el espacio local del personaje
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const lx = vx * c - vz * s;
    const lz = vx * s + vz * c;

    // Resorte amortiguado (semi-implícito) → inercia + rebote
    const tx = -lx * 0.03 * this.wobble;
    const tz = -lz * 0.03 * this.wobble;
    const k = 120;
    const d = 9;
    this.leanVel.x += ((tx - this.lean.x) * k - this.leanVel.x * d) * dt;
    this.leanVel.y += ((tz - this.lean.y) * k - this.leanVel.y * d) * dt;
    this.lean.x += this.leanVel.x * dt;
    this.lean.y += this.leanVel.y * dt;

    for (const e of this.items) {
      if (!e.landed) continue;
      const f = Math.pow((e.y + 0.1) / 1.2, 1.4);
      e.mesh.position.set(this.lean.x * f, e.y, this.lean.y * f);
      e.mesh.rotation.set(this.lean.y * f * 0.5, 0, -this.lean.x * f * 0.5);
    }
  }
}
