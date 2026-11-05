// Fx: animaciones de juego (ítems volando en arco, tweens, textos flotantes, confeti).
import * as THREE from 'three';
import { makeTextSprite } from './Labels.js';

export const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

const PARTICLE_GEO = new THREE.BoxGeometry(0.12, 0.12, 0.12);
const PARTICLE_COLORS = ['#ffd166', '#06d6a0', '#ef476f', '#118ab2', '#ffffff'].map(
  (c) => new THREE.MeshBasicMaterial({ color: c }),
);

export class Fx {
  constructor(scene) {
    this.scene = scene;
    this.flights = [];
    this.tweens = [];
    this.particles = [];
  }

  /**
   * Hace volar un mesh en arco hasta un destino que puede moverse.
   * @param {THREE.Object3D} mesh
   * @param {(out: THREE.Vector3) => THREE.Vector3} getTarget  escribe la posición destino (mundo) en `out`
   */
  fly(mesh, getTarget, { duration = 0.28, arc = 1.2, onDone = null } = {}) {
    this.scene.attach(mesh); // conserva la transformación de mundo
    this.flights.push({
      mesh, getTarget, duration, arc, onDone,
      start: mesh.position.clone(),
      target: new THREE.Vector3(),
      t: 0,
    });
  }

  tween(duration, onUpdate, onDone) {
    this.tweens.push({ t: 0, duration, onUpdate, onDone });
  }

  popIn(obj, duration = 0.45, target = 1) {
    obj.scale.setScalar(0.001);
    this.tween(duration, (k) => obj.scale.setScalar(Math.max(0.001, easeOutBack(k) * target)));
  }

  popOut(obj, onDone) {
    const s = obj.scale.x;
    this.tween(0.25, (k) => obj.scale.setScalar(Math.max(0.001, s * (1 - k))), () => {
      obj.removeFromParent();
      onDone?.();
    });
  }

  floatText(text, position, color = '#ffffff') {
    const label = makeTextSprite(text, { color, worldHeight: 0.8 });
    const s = label.sprite;
    s.position.copy(position);
    this.scene.add(s);
    const y0 = position.y;
    this.tween(1.1, (k) => {
      s.position.y = y0 + k * 1.6;
      s.material.opacity = 1 - k * k;
    }, () => label.dispose());
  }

  /** Explosión de confeti (al desbloquear algo). */
  burst(position, count = 26) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(PARTICLE_GEO, PARTICLE_COLORS[i % PARTICLE_COLORS.length]);
      m.position.copy(position);
      this.scene.add(m);
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 4;
      this.particles.push({
        mesh: m,
        vel: new THREE.Vector3(Math.cos(a) * sp, 5 + Math.random() * 5, Math.sin(a) * sp),
        life: 1 + Math.random() * 0.5,
      });
    }
  }

  update(dt) {
    // Ítems volando (se itera hacia atrás para poder eliminar)
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const f = this.flights[i];
      f.t = Math.min(1, f.t + dt / f.duration);
      f.getTarget(f.target);
      const k = easeInOut(f.t);
      f.mesh.position.lerpVectors(f.start, f.target, k);
      f.mesh.position.y += Math.sin(Math.PI * f.t) * f.arc;
      if (f.t >= 1) {
        this.flights.splice(i, 1);
        f.onDone?.(f.mesh);
      }
    }

    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t = Math.min(1, tw.t + dt / tw.duration);
      tw.onUpdate?.(tw.t);
      if (tw.t >= 1) {
        this.tweens.splice(i, 1);
        tw.onDone?.();
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.vel.y -= 14 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += dt * 8;
      p.mesh.rotation.y += dt * 6;
      p.life -= dt;
      p.mesh.scale.setScalar(Math.max(0.01, Math.min(1, p.life)));
      if (p.life <= 0 || p.mesh.position.y < 0) {
        p.mesh.removeFromParent();
        this.particles.splice(i, 1);
      }
    }
  }
}
