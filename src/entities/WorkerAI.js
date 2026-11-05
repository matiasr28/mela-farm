// WorkerAI: ayudantes automáticos con máquina de estados simple.
//  - 'farmer'  : cosecha su campo hasta llenar la pila → lo lleva a su corral/taller.
//  - 'carrier' : junta productos de los pallets → repone las estanterías de su tienda.
//  - 'cashier' : se queda en la caja de su tienda atendiendo clientes.
// Las transferencias las hacen las propias zonas (TransferZone / ResourceNode):
// la IA sólo decide a dónde caminar y cuándo cambiar de estado.
import * as THREE from 'three';
import { Character } from './Character.js';
import { StackManager } from '../systems/StackManager.js';
import { CONFIG } from '../config.js';
import { lerpAngle, distXZ2 } from '../utils.js';

/** Looks y "voz" (tono del balbuceo) de cada empleado. */
export const LOOKS = {
  tito: { shirt: '#e8503f', overalls: '#3f6fb5', hair: '#6b3e26', hat: 'cap', hatColor: '#2f7de1', shoes: '#4a3020', voice: 0.75 },
  rosa: { shirt: '#ffffff', overalls: '#5a8f3c', hair: '#8b4a22', hairStyle: 'long', hat: 'straw', hatColor: '#f6d785', voice: 1.15 },
  lucho: { shirt: '#3fb6e8', pants: '#2b3a55', hair: '#1b1b1b', hat: 'cap', hatColor: '#ffb703', voice: 0.9 },
  pili: { shirt: '#e8503f', pants: '#2f5fa8', hair: '#d9541e', hairStyle: 'bun', skin: '#f6c8a0', voice: 1.25 },
  beto: { shirt: '#f4a261', overalls: '#7a5230', hair: '#cfcfcf', hat: 'straw', hatColor: '#e9c46a', voice: 0.65 },
  juana: { shirt: '#a29bfe', overalls: '#3f6fb5', hair: '#2b1d0e', hairStyle: 'ponytail', tie: '#ffd23f', voice: 1.2 },
  nico: { shirt: '#90be6d', pants: '#3d405b', hair: '#b5651d', hat: 'cap', hatColor: '#e8503f', voice: 0.95 },
  sol: { shirt: '#ffd23f', pants: '#264653', hair: '#111111', hairStyle: 'long', skin: '#c68642', voice: 1.3 },
  pancho: { shirt: '#5a8f3c', overalls: '#7a5230', hair: '#3d2b1f', hat: 'straw', hatColor: '#e9c46a', voice: 0.7 },
  lola: { shirt: '#ff8fab', pants: '#3d405b', hair: '#f7d55c', hairStyle: 'bun', voice: 1.3 },
  mateo: { shirt: '#ff9f1c', pants: '#2b3a55', hair: '#6b3e26', hat: 'cap', hatColor: '#3fa7e0', voice: 0.95 },
  ana: { shirt: '#e8304a', overalls: '#3f72c0', hair: '#b5651d', hairStyle: 'ponytail', tie: '#ffffff', voice: 1.2 },
  toto: { shirt: '#7bcc45', overalls: '#264653', hair: '#cfcfcf', hat: 'cap', hatColor: '#e2483d', voice: 0.8 },
  ramon: { shirt: '#d9473b', pants: '#2f4f7f', hair: '#4a3020', hat: 'cap', hatColor: '#ffffff', shoes: '#3a2a1e', voice: 0.6 },
};

export class WorkerAI {
  /**
   * @param {object} opts
   * @param {'farmer'|'carrier'|'cashier'} opts.role
   * @param {string} opts.name   nombre visible en las charlas (Tito, Rosa...)
   * @param {() => object} [opts.field]    farmer: campo que cosecha
   * @param {() => object} [opts.unit]     farmer: corral/taller al que lleva lo cosechado
   * @param {() => object[]} [opts.sources] carrier: talleres/corrales de donde junta
   * @param {() => object} [opts.shop]     carrier/cashier: tienda que atiende
   */
  constructor(game, world, { role, name, position, field, unit, sources, shop, instant = false }) {
    this.game = game;
    this.world = world;
    this.role = role;
    this.name = name;
    this.getField = field;
    this.getUnit = unit;
    this.getSources = sources;
    this.getShop = shop;

    const key = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); // "Ramón" → "ramon"
    const look = LOOKS[key] ?? LOOKS.tito;
    this.character = new Character(look);
    this.root = this.character.root;
    this.root.position.copy(position);
    game.scene.add(this.root);
    if (!instant) game.fx.popIn(this.root);

    // Datos para el sistema de charlas
    this.voice = look.voice ?? 1;
    this.bubbleY = 2.35;

    this.position = this.root.position;
    this.baseCapacity = role === 'trucker' ? 10 : role === 'carrier' ? 8 : 6;
    this.stack = new StackManager(game, this.character.frontAnchor, this.baseCapacity);
    this.stack.onLand = () => game.audio.play('pop', { pos: this.position, volume: 0.5 });
    this.canHarvest = role === 'farmer';
    this.harvestTypes = role === 'farmer' ? [field().type] : null;
    this.applyBonus();

    this.state = role === 'farmer' ? 'gather' : role === 'trucker' ? 'load' : 'pickup';
    this.job = null;
    this.noProgress = 0;
    this.lastCount = 0;
    this.target = this.position.clone();
    this.retarget = 0;
    this.wait = 0;
    this.source = null;
    this.yaw = 0;
    this.vx = 0;
    this.vz = 0;

    if (role === 'cashier') shop().hasCashier = true;
    game.carriers.push(this);
    game.add(this);
  }

  /** Aplica la mejora "Ayudantes" (velocidad y capacidad). */
  applyBonus() {
    const lvl = this.world.workerBonus || 0;
    this.speed = CONFIG.workers.speed + lvl * 0.35;
    this.stack.capacity = this.baseCapacity + lvl * 2;
  }

  update(dt) {
    if (this.role === 'farmer') this.thinkFarmer(dt);
    else if (this.role === 'carrier') this.thinkCarrier(dt);
    else if (this.role === 'trucker') this.thinkTrucker(dt);
    else this.target.copy(this.getShop().cashierSpot);
    this.moveTowards(dt);
  }

  // ---------------------------------------------------------------------------
  // Camionero: lee el pedido del camión, junta lo que falta y lo carga.
  // ---------------------------------------------------------------------------
  thinkTrucker(dt) {
    const truck = this.world.truck;
    const waiting = truck && truck.state === 'waiting' && truck.doneTimer < 0;
    const remaining = (t) => (truck.order[t] ?? 0) - (truck.delivered[t] ?? 0);

    // Progreso de carga (si no junta nada por un rato, entrega lo que tiene)
    if (this.stack.count !== this.lastCount) { this.lastCount = this.stack.count; this.noProgress = 0; } else this.noProgress += dt;

    if (this.state === 'deliver') {
      this.canHarvest = false;
      this.target.copy(truck?.dropZone.position ?? this.idleSpot());
      if (this.stack.count === 0) { this.state = 'load'; this.job = null; return; }
      const useful = waiting && this.stack.items.some((e) => e.landed && truck.canAccept(e.type));
      if (!useful && this.noProgress > 4) this.discard(); // lo que sobra va al depósito
      return;
    }

    // state 'load'
    if (!waiting) {
      this.canHarvest = false;
      if (this.stack.count > 0) this.state = 'deliver';
      else this.target.copy(this.idleSpot());
      return;
    }
    if (!this.job || remaining(this.job.type) - this.stack.count <= 0) {
      this.job = this.pickJob(truck);
      this.noProgress = 0;
    }
    if (!this.job) {
      this.canHarvest = false;
      if (this.stack.count > 0) this.state = 'deliver'; else this.target.copy(this.idleSpot());
      return;
    }
    const { type } = this.job;
    // Lleva exactamente lo que falta (sin pasarse de su capacidad)
    const cap = this.baseCapacity + (this.world.workerBonus || 0) * 2;
    this.stack.capacity = Math.max(this.stack.count, Math.min(cap, remaining(type)));
    if (this.stack.isFull || (this.stack.count > 0 && this.noProgress > 3)) { this.state = 'deliver'; return; }

    if (this.job.field) {
      this.canHarvest = true;
      this.harvestTypes = [type];
      const plant = this.job.field.nearestGrown(this.position);
      if (plant) this.target.copy(plant.position);
      else this.target.set(this.job.field.center.x + this.job.field.halfW + 0.8, 0, this.job.field.center.z);
    } else {
      this.canHarvest = false;
      this.target.copy(this.job.unit.pickupZone.position);
    }
    if (this.noProgress > 8) this.job = null; // probar con otro producto
  }

  /** Elige el próximo producto del pedido y de dónde sacarlo (pallet, cajón del tractor o campo). */
  pickJob(truck) {
    const w = this.world;
    const units = [w.coop, w.barn, w.sheep, ...w.processors()].filter(Boolean);
    if (w.crate) units.unshift({ outputType: 'corn', outputPile: w.crate, pickupZone: w.crateZone });
    const types = Object.keys(truck.order).filter((t) => truck.order[t] - (truck.delivered[t] ?? 0) - this.stack.countOf(t) > 0);
    let fallback = null;
    for (const t of types) {
      const unit = units.find((u) => u.outputType === t && u.outputPile.hasLanded());
      if (unit) return { type: t, unit };
      const field = w.fields().find((f) => f.type === t && f.nearestGrown(this.position));
      if (field) return { type: t, field };
      fallback ??= units.find((u) => u.outputType === t) ? { type: t, unit: units.find((u) => u.outputType === t) }
        : w.fields().find((f) => f.type === t) ? { type: t, field: w.fields().find((f) => f.type === t) } : null;
    }
    return fallback;
  }

  idleSpot() { return new THREE.Vector3(-14.2, 0, 11.4); }

  /** Lo que ya no sirve para el pedido se "guarda en el depósito" (desaparece). */
  discard() {
    for (const e of [...this.stack.items]) {
      if (!e.landed) continue;
      const t = this.stack.take(e.type);
      if (t) this.game.fx.popOut(t.mesh);
    }
    this.noProgress = 0;
  }

  thinkFarmer(dt) {
    const field = this.getField();
    const unit = this.getUnit();

    if (this.state === 'gather') {
      if (this.stack.isFull) {
        this.state = 'deliver';
      } else {
        this.retarget -= dt;
        if (this.retarget <= 0) {
          this.retarget = 0.25;
          const p = field.nearestGrown(this.position);
          if (p) this.target.copy(p.position);
          else if (this.stack.count > 0) this.state = 'deliver';
          else this.target.set(field.center.x + field.halfW + 0.8, 0, field.center.z); // espera al costado
        }
      }
    }
    if (this.state === 'deliver') {
      this.target.copy(unit.dropZone.position);
      if (this.stack.count === 0) { this.state = 'gather'; this.retarget = 0; }
    }
  }

  thinkCarrier(dt) {
    const shop = this.getShop();
    const sources = this.getSources().filter(Boolean);

    if (this.state === 'pickup') {
      if (!this.source) {
        // Elige la fuente con más producto cuya estantería tenga lugar
        let best = null;
        let bestScore = -1;
        for (const s of sources) {
          const shelf = shop.piles[s.outputType];
          if (!shelf || shelf.count >= shelf.max) continue;
          const score = s.outputPile.landedCount + Math.random() * 0.5;
          if (score > bestScore) { best = s; bestScore = score; }
        }
        this.source = best;
        this.wait = 0;
        if (!best) {
          this.target.copy(shop.dropZone.position).add(new THREE.Vector3(-1.2, 0, 1.2));
          return;
        }
      }
      this.target.copy(this.source.pickupZone.position);
      if (distXZ2(this.position, this.target) < 0.3) {
        this.wait += dt;
        const empty = !this.source.outputPile.hasLanded();
        if (this.stack.isFull || (this.stack.count > 0 && empty && this.wait > 1.2)) this.state = 'deliver';
        else if (this.stack.count === 0 && empty && this.wait > 2.5) this.source = null; // probar otra fuente
      }
    }
    if (this.state === 'deliver') {
      this.target.copy(shop.dropZone.position);
      if (this.stack.count === 0) { this.state = 'pickup'; this.source = null; }
    }
  }

  moveTowards(dt) {
    const dx = this.target.x - this.position.x;
    const dz = this.target.z - this.position.z;
    const d = Math.hypot(dx, dz);
    let moving = false;
    if (d > 0.08) {
      const step = Math.min(d, this.speed * dt);
      this.position.x += (dx / d) * step;
      this.position.z += (dz / d) * step;
      this.vx = (dx / d) * this.speed;
      this.vz = (dz / d) * this.speed;
      this.yaw = lerpAngle(this.yaw, Math.atan2(dx, dz), 1 - Math.exp(-dt * 10));
      moving = true;
    } else {
      this.vx = this.vz = 0;
      if (this.role === 'cashier') this.yaw = lerpAngle(this.yaw, 0, 1 - Math.exp(-dt * 8));
    }
    this.root.rotation.y = this.yaw;
    this.character.animate(dt, moving ? this.speed / CONFIG.player.speed : 0, { carryFront: this.stack.count > 0 });
    this.stack.update(dt, this.vx, this.vz, this.yaw);
  }
}
