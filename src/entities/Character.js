// Character: modelo humanoide cartoon + animación procedural (caminata, brazos, colita).
import { createCharacterRig } from '../models/Models.js';

export class Character {
  constructor(opts) {
    Object.assign(this, createCharacterRig(opts)); // root, body, legs, arms, head, tail, anchors
    this.phase = 0;
    this.idle = Math.random() * 10;
  }

  /**
   * @param {number} speedNorm 0..1 velocidad relativa
   * @param {{carryFront?: boolean, carryBack?: boolean}} opts
   */
  animate(dt, speedNorm, { carryFront = false, carryBack = false } = {}) {
    const s = Math.min(1, Math.max(0, speedNorm));
    if (s > 0.05) this.phase += dt * (6 + 8 * s); // quieto: la fase se congela y swing = 0
    this.idle += dt;

    const swing = Math.sin(this.phase) * 0.75 * s;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;

    if (carryFront) {
      // Brazos hacia adelante sosteniendo la pila
      this.armL.rotation.x = this.armR.rotation.x = -1.25 + Math.sin(this.phase * 2) * 0.04 * s;
      this.armL.rotation.z = 0.12;
      this.armR.rotation.z = -0.12;
    } else if (carryBack) {
      this.armL.rotation.x = -0.35 - swing * 0.3;
      this.armR.rotation.x = -0.35 + swing * 0.3;
      this.armL.rotation.z = this.armR.rotation.z = 0;
    } else {
      this.armL.rotation.x = -swing * 0.9;
      this.armR.rotation.x = swing * 0.9;
      this.armL.rotation.z = 0.06;
      this.armR.rotation.z = -0.06;
    }

    this.body.position.y = Math.abs(Math.sin(this.phase)) * 0.07 * s;
    this.body.rotation.x = 0.06 * s; // leve inclinación al correr
    this.head.rotation.z = s < 0.05 ? Math.sin(this.idle * 1.3) * 0.03 : 0;

    // Colita que rebota al caminar
    if (this.tail) {
      this.tail.rotation.x = 0.25 * s + Math.sin(this.phase * 2) * 0.18 * s + Math.sin(this.idle * 2) * 0.03;
      this.tail.rotation.z = Math.sin(this.phase) * 0.15 * s;
    }
  }
}
