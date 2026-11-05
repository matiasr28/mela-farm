// CatAI: Pitanga y Odin. Casi siempre están en un mostrador (arriba o echados al lado);
// muy de vez en cuando salen a pasear por el mapa y después vuelven a "su" tienda.
// Son "talkers" para el sistema de charlas (los clientes los saludan y ellos maúllan).
import * as THREE from 'three';
import { createCat } from '../models/Models.js';
import { rand, pick, lerpAngle, clamp } from '../utils.js';

export const CATS = {
  pitanga: { name: 'Pitanga', look: { pattern: 'tuxedo', eyes: '#c8ecd0', collar: '#3d6fa8', tag: '#f2a33a', longHair: true }, spot: 'top', voice: 1.6 },
  odin: { name: 'Odin', look: { pattern: 'white', eyes: '#6fc8ff', collar: '#e2483d', tag: '#ffd23f' }, spot: 'floor', voice: 1.3 },
};

export class CatAI {
  constructor(game, world, key) {
    const def = CATS[key];
    this.game = game;
    this.world = world;
    this.name = def.name;
    this.voice = def.voice;
    this.spotKind = def.spot;
    this.isCat = true;

    const m = createCat(def.look);
    Object.assign(this, { body: m.body, head: m.head, tail: m.tail, legs: m.legs });
    this.root = m.root;
    this.root.scale.setScalar(1.15);
    game.scene.add(this.root);
    this.position = this.root.position;

    this.state = 'home';           // home | toGround | walk | rest | jumpUp | jumpDown
    this.shop = null;
    this.target = new THREE.Vector3();
    this.wanderTimer = rand(40, 90); // tiempo hasta el próximo paseo
    this.restTimer = 0;
    this.phase = rand(0, 6);
    this.yaw = 0;
    this.speed = 1.7;

    this.goHome(true);
    game.add(this);
  }

  shops() { return [this.world.shop, this.world.shop2, this.world.shop3].filter(Boolean); }

  /** Lugar en el mostrador: Pitanga arriba (borde izquierdo), Odin echado adelante. */
  homeSpot(shop, out) {
    const p = shop.position;
    if (this.spotKind === 'top') return out.set(p.x - 1.58, 1.04, p.z - 0.05);
    return out.set(p.x - 1.9, 0, p.z + 0.95);
  }

  /** Punto en el suelo desde donde salta al mostrador. */
  groundSpot(shop, out) {
    const p = shop.position;
    return out.set(p.x - 2.2, 0, p.z - 0.2);
  }

  goHome(instant = false) {
    this.shop = pick(this.shops());
    if (instant) {
      this.homeSpot(this.shop, this.position);
      this.state = 'home';
      this.yaw = 0;
      return;
    }
    if (this.spotKind === 'top') this.groundSpot(this.shop, this.target);
    else this.homeSpot(this.shop, this.target);
    this.state = 'toHome';
  }

  /** Paseo ocasional a un punto al azar del área jugable. */
  startWander() {
    const b = this.world.bounds;
    const base = this.shop.position;
    this.target.set(
      clamp(base.x + rand(-14, 14), b.minX + 1, b.maxX - 1), 0,
      clamp(base.z + rand(-12, 10), b.minZ + 1, b.maxZ - 1),
    );
    if (this.position.y > 0.01) this.jump(new THREE.Vector3(this.position.x - 0.6, 0, this.position.z), 'walk');
    else this.state = 'walk';
  }

  jump(to, next) {
    this.state = 'jumping';
    const from = this.position.clone();
    this.game.fx.tween(0.45, (k) => {
      this.position.lerpVectors(from, to, k);
      this.position.y += Math.sin(k * Math.PI) * 0.6;
    }, () => { this.position.copy(to); this.state = next; });
  }

  update(dt) {
    this.phase += dt;
    let moving = false;

    if (this.state === 'home') {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0 && !this._talking) {
        this.wanderTimer = rand(60, 140);
        this.startWander();
      }
      this.yaw = lerpAngle(this.yaw, 0, 1 - Math.exp(-dt * 4));
    } else if (this.state === 'walk' || this.state === 'toHome') {
      moving = this.moveTo(dt);
      if (!moving) {
        if (this.state === 'walk') { this.state = 'rest'; this.restTimer = rand(5, 12); }
        else if (this.spotKind === 'top') this.jump(this.homeSpot(this.shop, new THREE.Vector3()), 'home');
        else this.state = 'home';
      }
    } else if (this.state === 'rest') {
      this.restTimer -= dt;
      if (this.restTimer <= 0) this.goHome();
    }

    // Animación: patas al caminar, "sentado" en reposo, cola que se mueve
    const sit = !moving && this.state !== 'jumping';
    this.legs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(this.phase * 12 + (i % 2) * Math.PI) * 0.6 : 0; });
    this.body.rotation.x = sit ? -0.18 : 0;
    this.body.position.y = moving ? Math.abs(Math.sin(this.phase * 12)) * 0.02 : 0;
    this.tail.rotation.z = Math.sin(this.phase * (sit ? 1.6 : 4)) * 0.35;
    this.head.rotation.y = sit ? Math.sin(this.phase * 0.5) * 0.4 : 0;
    this.root.rotation.y = this.yaw;
  }

  moveTo(dt) {
    const dx = this.target.x - this.position.x;
    const dz = this.target.z - this.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.08) return false;
    const step = Math.min(d, this.speed * dt);
    this.position.x += (dx / d) * step;
    this.position.z += (dz / d) * step;
    this.yaw = lerpAngle(this.yaw, Math.atan2(dx, dz), 1 - Math.exp(-dt * 8));
    return true;
  }

  /** Altura del globito de diálogo (sube si está arriba del mostrador). */
  get bubbleY() { return this.position.y + 1.05; }

  /** Está en su mostrador (para los saludos de los clientes). */
  get atHome() { return this.state === 'home'; }
}
