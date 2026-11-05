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

    this.kissPose(this.kissK ?? 0, this.kissArms);

    // Colita que rebota al caminar
    if (this.tail) {
      this.tail.rotation.x = 0.25 * s + Math.sin(this.phase * 2) * 0.18 * s + Math.sin(this.idle * 2) * 0.03;
      this.tail.rotation.z = Math.sin(this.phase) * 0.15 * s;
    }
  }

  /**
   * Pose de beso, mezclada con la pose actual según k (0..1):
   * se inclina hacia adelante, ladea la cabeza, cierra los ojos y abraza.
   * arms: 'neck' (brazos al cuello, en puntas de pie) | 'waist' (manos en la cintura).
   * Se aplica dentro de animate(); para usarla: character.kissK = k; character.kissArms = '...'.
   */
  kissPose(k, arms = 'waist') {
    if (k <= 0.001) {
      if (this._kissed) {
        this.eyes.forEach((e) => { e.scale.y = 1.35; });
        this.shines.forEach((s) => { s.visible = true; });
        this.head.rotation.x = 0;
        this._kissed = false;
      }
      return;
    }
    this._kissed = true;
    const s = k * k * (3 - 2 * k); // suavizado
    const mix = (a, b) => a + (b - a) * s;
    this.body.rotation.x = mix(this.body.rotation.x, 0.1);
    this.head.rotation.x = mix(0, 0.1);
    this.head.rotation.z = mix(this.head.rotation.z, -0.32); // cabeza ladeada (los dos al mismo lado propio)
    this.eyes.forEach((e) => { e.scale.y = 1.35 * (1 - 0.85 * s); });
    this.shines.forEach((sh) => { sh.visible = s < 0.5; });
    if (arms === 'neck') {
      this.body.position.y += 0.05 * s; // en puntas de pie
      this.armL.rotation.x = mix(this.armL.rotation.x, -2.25);
      this.armR.rotation.x = mix(this.armR.rotation.x, -2.25);
      this.armL.rotation.z = mix(this.armL.rotation.z, 0.38);
      this.armR.rotation.z = mix(this.armR.rotation.z, -0.38);
    } else {
      this.armL.rotation.x = mix(this.armL.rotation.x, -1.05);
      this.armR.rotation.x = mix(this.armR.rotation.x, -1.05);
      this.armL.rotation.z = mix(this.armL.rotation.z, 0.55);
      this.armR.rotation.z = mix(this.armR.rotation.z, -0.55);
    }
  }
}
