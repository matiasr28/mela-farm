// PlayerController: Mela, la protagonista. Movimiento con joystick/teclado en 8 direcciones
// (analógico), colisiones círculo-vs-AABB, límites del mapa y la pila que lleva en brazos.
import * as THREE from 'three';
import { Character } from './Character.js';
import { StackManager } from '../systems/StackManager.js';
import { makeTextSprite } from '../core/Labels.js';
import { CONFIG } from '../config.js';
import { lerpAngle, clamp } from '../utils.js';

const _v = new THREE.Vector3();

/** Look de Mela: rubia con colita, remera rosa y jean. */
export const MELA_LOOK = {
  hairStyle: 'ponytail', hair: '#f7d55c', skin: '#f8cfa8', shirt: '#ff6b8f', pants: '#3f72c0',
  shoes: '#ffffff', tie: '#ff3d7f',
};

export class PlayerController {
  constructor(game, { position, bounds }) {
    this.game = game;
    this.bounds = bounds;

    this.character = new Character(MELA_LOOK);
    this.root = this.character.root;
    this.root.position.copy(position);
    game.scene.add(this.root);

    // Interfaz "carrier" (compartida con los trabajadores)
    this.position = this.root.position;
    this.role = 'player';
    this.name = 'Mela';
    this.voice = 1.4;
    this.bubbleY = 2.4;
    this.canHarvest = true;
    this.stack = new StackManager(game, this.character.frontAnchor, CONFIG.player.capacity);
    this.stack.onLand = () => {
      game.audio.play('pop', { pitch: 0.9 + Math.min(this.stack.count, 30) * 0.025 });
    };

    this.velocity = new THREE.Vector3();
    this.speed = CONFIG.player.speed;
    this.radius = CONFIG.player.radius;
    this.yaw = 0;
    this.moved = false;
    this.wasFull = false;

    this.maxLabel = makeTextSprite('MAX', { color: '#ffdd33', stroke: '#7a2b00', worldHeight: 0.55 });
    this.maxLabel.sprite.visible = false;
    game.scene.add(this.maxLabel.sprite);

    game.add(this);
  }

  update(dt) {
    const dir = this.game.input.getDirection();
    // Pantalla → mundo: derecha = +X, abajo = +Z (la cámara mira hacia -Z)
    const tx = dir.x * this.speed;
    const tz = dir.y * this.speed;
    const k = 1 - Math.exp(-dt * 12); // aceleración suave
    this.velocity.x += (tx - this.velocity.x) * k;
    this.velocity.z += (tz - this.velocity.z) * k;

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.resolveCollisions();
    const b = this.bounds;
    this.position.x = clamp(this.position.x, b.minX, b.maxX);
    this.position.z = clamp(this.position.z, b.minZ, b.maxZ);

    const sp = Math.hypot(this.velocity.x, this.velocity.z);
    if (sp > 0.3) {
      this.yaw = lerpAngle(this.yaw, Math.atan2(this.velocity.x, this.velocity.z), 1 - Math.exp(-dt * 15));
      if (!this.moved) { this.moved = true; this.game.hud.hideHint(); }
    }
    this.root.rotation.y = this.yaw;

    this.character.animate(dt, sp / CONFIG.player.speed, { carryFront: this.stack.count > 0 });
    this.stack.update(dt, this.velocity.x, this.velocity.z, this.yaw);

    // Cartel "MAX" sobre la pila cuando está llena (+ sonido al llenarse)
    const full = this.stack.isFull;
    if (full && !this.wasFull) {
      this.game.audio.play('full');
      this.game.chatter?.playerSays('full');
    }
    this.wasFull = full;
    this.maxLabel.sprite.visible = full;
    if (full) {
      this.stack.root.getWorldPosition(_v);
      this.maxLabel.sprite.position.set(_v.x, _v.y + this.stack.height + 0.45, _v.z);
    }
  }

  /** Empuja al jugador fuera de cada obstáculo AABB (círculo vs caja). */
  resolveCollisions() {
    const p = this.position;
    const r = this.radius;
    for (const o of this.game.obstacles) {
      const cx = clamp(p.x, o.minX, o.maxX);
      const cz = clamp(p.z, o.minZ, o.maxZ);
      const dx = p.x - cx;
      const dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * r;
        p.z = cz + (dz / d) * r;
      } else {
        // Centro dentro de la caja: salir por el lado más cercano
        const left = p.x - o.minX;
        const right = o.maxX - p.x;
        const top = p.z - o.minZ;
        const bottom = o.maxZ - p.z;
        const m = Math.min(left, right, top, bottom);
        if (m === left) p.x = o.minX - r;
        else if (m === right) p.x = o.maxX + r;
        else if (m === top) p.z = o.minZ - r;
        else p.z = o.maxZ + r;
      }
    }
  }
}
