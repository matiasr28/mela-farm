// PlayerController: Mela, la protagonista. Movimiento con joystick/teclado en 8 direcciones
// (analógico), colisiones círculo-vs-AABB, límites del mapa y la pila que lleva en brazos.
import * as THREE from 'three';
import { Character } from './Character.js';
import { StackManager } from '../systems/StackManager.js';
import { makeTextSprite } from '../core/Labels.js';
import { createHorse } from '../models/ModelsExtra.js';
import { bakeGroup } from '../core/Bake.js';
import { mat } from '../models/Models.js';
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

    this.horse = null;   // Caballeriza (Granja 12): Mela anda a caballo
    this.frozen = false; // 'ride' = la lleva la aerosilla · 'stand' = ceremonia (no se mueve con el joystick)
    this.trot = 0;

    this.maxLabel = makeTextSprite('MAX', { color: '#ffdd33', stroke: '#7a2b00', worldHeight: 0.55 });
    this.maxLabel.sprite.visible = false;
    game.scene.add(this.maxLabel.sprite);

    game.add(this);
  }

  /** Caballeriza: Mela sube al caballo (más rápida y con más lugar para cargar) hasta que se cansa. */
  mountHorse() {
    this.riding = true;
    if (this.horse) { this.horse.root.visible = true; this.game.fx.popIn(this.horse.root); return; }
    const h = createHorse();
    for (const leg of h.legs) bakeGroup(leg);
    bakeGroup(h.head);
    bakeGroup(h.tail);
    bakeGroup(h.body, { keep: [...h.legs, h.head, h.tail] });
    h.root.position.z = -0.3;
    this.root.add(h.root);
    this.horse = h;
  }

  /** El caballo se cansó: Mela sigue a pie. */
  dismountHorse() {
    this.riding = false;
    if (!this.horse) return;
    this.horse.root.visible = false;
    this.character.legL.rotation.z = this.character.legR.rotation.z = 0;
  }

  /** Fin de la luna de miel: se saca el velo. */
  removeVeil() {
    this.veil?.removeFromParent();
    this.veil = null;
  }

  /** Boda (Granja 20): velo y corona de flores (durante la ceremonia y la luna de miel). */
  wearVeil() {
    if (this.veil) return;
    const head = this.character.head;
    const g = new THREE.Group();
    const veilMat = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, roughness: 0.5, side: THREE.DoubleSide });
    const veil = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.75, 16, 1, true), veilMat);
    veil.position.set(0, -0.05, -0.12);
    veil.rotation.x = -0.25;
    g.add(veil);
    const colors = ['#ffffff', '#ff8fab', '#ffd23f'];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mat(colors[i % 3]));
      f.position.set(Math.cos(a) * 0.21, 0.2, Math.sin(a) * 0.21 - 0.02);
      g.add(f);
    }
    head.add(g);
    this.veil = g;
  }

  update(dt) {
    if (this.frozen) {
      // Viajando en la aerosilla: quieta y sentada
      this.velocity.set(0, 0, 0);
      this.root.rotation.y = this.yaw;
      this.character.animate(dt, 0, { carryFront: this.stack.count > 0 });
      if (this.frozen === 'ride') this.character.legL.rotation.x = this.character.legR.rotation.x = -1.4;
      if (this.horse) this.horse.root.visible = false;
      this.stack.update(dt, 0, 0, this.yaw);
      this.maxLabel.sprite.visible = false;
      return;
    }
    const dir = this.game.input.getDirection();
    // Pantalla → mundo: derecha = +X, abajo = +Z (la cámara mira hacia -Z)
    const spd = this.speed * this.game.speedMult(); // ⚡ turbo de Matías
    const tx = dir.x * spd;
    const tz = dir.y * spd;
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

    // 💋 Beso con Matías (this.kiss lo maneja MatiasAI): de frente, abrazándolo del cuello.
    // Si el jugador mueve el joystick, la pose se suelta y Mela sigue caminando.
    const kiss = this.kiss;
    const kk = kiss && sp < 0.5 ? kiss.k : 0;
    if (kk > 0) {
      this.yaw = lerpAngle(this.yaw, kiss.yaw, 1 - Math.exp(-dt * 16));
      this.root.rotation.y = this.yaw;
    }
    this.character.kissK = kk;
    this.character.kissArms = 'neck';
    // La pila se corre al costado para que no quede entre los dos
    this.stack.root.position.set(0.5 * kk, 0, -0.2 * kk);

    this.character.animate(dt, sp / CONFIG.player.speed, { carryFront: this.stack.count > 0 });
    // A caballo: sentada en la montura y el caballo trota (durante el beso se baja)
    const h = this.riding ? this.horse : null;
    if (h) {
      const riding = kk < 0.01;
      h.root.visible = riding;
      const c = this.character;
      if (riding) {
        const s = Math.min(1, sp / (CONFIG.player.speed + 1.6));
        this.trot += dt * (4 + 9 * s);
        const bob = Math.abs(Math.sin(this.trot)) * 0.08 * s;
        c.body.position.y = h.saddleY - 0.5 + bob;
        c.legL.rotation.x = c.legR.rotation.x = -0.35;
        c.legL.rotation.z = -0.45;
        c.legR.rotation.z = 0.45;
        h.body.position.y = bob * 0.6;
        h.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(this.trot + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.6 * s; });
        h.head.rotation.x = Math.sin(this.trot * 2) * 0.06 * s;
        h.tail.rotation.x = 0.2 + Math.sin(this.trot) * 0.2 * s;
      } else {
        c.legL.rotation.z = c.legR.rotation.z = 0;
      }
    }
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
