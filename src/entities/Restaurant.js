// Restaurant (Granja 10): no es una tienda con fila. Los clientes se sientan a una mesa y piden
// un plato; la cocina cocina SOLO lo que se pidió (con lo que haya en la despensa) y lo deja en el
// pasaplatos; Mela o el mozo lo llevan a la mesa. Si el plato llega rápido, dejan propina.
//   Despensa: 🥐 🥛 🍞 🧀 🐟 🎃 🎂 🍦   →   🥞 🥪 🍲 🍨
import * as THREE from 'three';
import { Character } from './Character.js';
import { createWorkshop, createTable, createItem, mat, ITEMS } from '../models/Models.js';
import { Pile } from '../systems/Pile.js';
import { CashPile } from '../systems/CashPile.js';
import { TransferZone } from '../systems/TransferZone.js';
import { CanvasLabel, drawOrderBubble, makeTextSprite } from '../core/Labels.js';
import { rand, pick, lerpAngle, distXZ2 } from '../utils.js';

/** Platos del menú: ingredientes de dos negocios distintos de la granja. */
export const DISHES = {
  breakfast: { croissant: 1, milk: 1 },
  sandwich: { bread: 1, cheese: 1 },
  stew: { fish: 1, pumpkin: 1 },
  dessert: { cake: 1, icecream: 1 },
};
const PANTRY = ['croissant', 'milk', 'bread', 'cheese', 'fish', 'pumpkin', 'cake', 'icecream'];

const V = (x, z) => new THREE.Vector3(x, 0, z);
const SHIRTS = ['#3fa7e0', '#4cb860', '#ffb703', '#e76f51', '#a29bfe', '#ffffff', '#ff8fab', '#e8503f'];
const PANTS = ['#2f4f7f', '#3d405b', '#264653', '#1d3557', '#5c4033'];
const HAIR = ['#2b1d0e', '#6b3e26', '#d4a373', '#111111', '#b5651d', '#cfcfcf'];
const SKIN = ['#f8cfa8', '#f2c299', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

/** Comensal: camina hasta su mesa, espera su plato, come, paga y se va. */
class Diner {
  constructor(game, rest, table) {
    this.game = game;
    this.rest = rest;
    this.table = table;
    table.diner = this;
    this.want = rest.chooseDish();
    this.character = new Character({
      shirt: pick(SHIRTS), pants: pick(PANTS), hair: pick(HAIR), skin: pick(SKIN),
      hairStyle: pick(['short', 'long', 'bun', 'ponytail', 'bald']), scale: rand(0.93, 1.05),
    });
    this.root = this.character.root;
    this.root.position.copy(rest.spawn);
    game.scene.add(this.root);
    game.fx.popIn(this.root);
    this.position = this.root.position;
    this.state = 'walk'; // walk → wait → eat → leave
    this.wait = 0;
    this.timer = 0;
    this.speed = rand(2.4, 3);
    this.dead = false;
    this.bubble = new CanvasLabel(256, 128, 0.8, (ctx, W, H) => drawOrderBubble(ctx, W, H,
      [{ emoji: ITEMS[this.want].emoji, text: this.state === 'wait' ? '1' : '' }]));
    this.bubble.sprite.visible = false;
    game.scene.add(this.bubble.sprite);
  }

  get target() {
    if (this.state === 'leave') return this.rest.exit;
    return this.table.seat;
  }

  update(dt) {
    const t = this.target;
    const dx = t.x - this.position.x;
    const dz = t.z - this.position.z;
    const d = Math.hypot(dx, dz);
    let moving = false;
    if (d > 0.05) {
      const step = Math.min(d, this.speed * dt);
      this.position.x += (dx / d) * step;
      this.position.z += (dz / d) * step;
      this.root.rotation.y = lerpAngle(this.root.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-dt * 10));
      moving = true;
    } else if (this.state !== 'leave') {
      // Sentado mirando la mesa
      const tx = this.table.pos.x - this.position.x;
      const tz = this.table.pos.z - this.position.z;
      this.root.rotation.y = lerpAngle(this.root.rotation.y, Math.atan2(tx, tz), 1 - Math.exp(-dt * 8));
    }
    this.character.animate(dt, moving ? this.speed / 5.5 : 0);
    this.bubble.sprite.position.set(this.position.x, 2.35, this.position.z);

    if (this.state === 'walk' && d < 0.06) {
      this.state = 'wait';
      this.bubble.sprite.visible = true;
      this.bubble.redraw();
    } else if (this.state === 'wait') {
      this.wait += dt;
    } else if (this.state === 'eat') {
      this.timer -= dt;
      if (this.timer <= 0) this.rest.pay(this);
    } else if (this.state === 'leave' && d < 0.1 && !this.dead) {
      this.dead = true;
      this.bubble.dispose();
      this.game.fx.popOut(this.root);
    }
  }

  serve(mesh) {
    this.state = 'eat';
    this.timer = 3.5;
    this.servedAfter = this.wait;
    this.plate = mesh;
    this.bubble.sprite.visible = false;
  }

  leave() {
    this.state = 'leave';
    this.table.diner = null;
    if (this.plate) { this.game.fx.popOut(this.plate); this.plate = null; }
  }
}

export class Restaurant {
  constructor(game, world, { position, instant = false }) {
    this.game = game;
    this.world = world;
    this.position = position.clone();
    this.recipe = { ...Object.fromEntries(PANTRY.map((t) => [t, 1])) }; // para la Gerencia (sinkOf)
    this.speedMult = 1;
    this.spawnMult = 1;   // la Fuente atrae más clientes
    this.autoBank = false; // Gerencia Nv.2
    this.piles = {};       // (interfaz de tienda para la Gerencia: no vende en estantería)
    this.sales = 0;
    this.tips = 0;
    this.diners = [];
    this.tables = [];
    this.cooking = null;
    this.spawnTimer = 2;
    const P = this.position;

    // Edificio grande con cartel
    this.group = new THREE.Group();
    this.group.position.copy(P);
    const b = createWorkshop({ wall: '#fff4e6', roofColor: '#7b2cbf', awning: ['#ffffff', '#7b2cbf'] });
    b.scale.setScalar(1.35);
    this.group.add(b);
    game.scene.add(this.group);
    game.obstacles.push({ minX: P.x - 2.9, maxX: P.x + 2.9, minZ: P.z - 2.1, maxZ: P.z + 2.2 });
    const sign = makeTextSprite('🍽️ RESTAURANTE', { color: '#ffffff', stroke: '#4a1a7a', worldHeight: 0.7 });
    sign.sprite.position.set(P.x, 5.6, P.z + 0.8);
    game.scene.add(sign.sprite);
    this.door = P.clone().add(V(0, 2.2)).setY(0.8);

    // Despensa: una pila por ingrediente
    const pantryX = P.x - 5.4;
    const pantryZ = P.z + 3.6;
    const table = createTable(PANTRY.length * 0.6 + 0.3);
    table.position.set(pantryX, 0, pantryZ);
    game.scene.add(table);
    this.inputs = {};
    PANTRY.forEach((t, i) => {
      this.inputs[t] = new Pile(game, {
        position: V(pantryX + (i - (PANTRY.length - 1) / 2) * 0.6, pantryZ).setY(0.56), type: t,
        cols: 1, rows: 2, spacing: [0.5, 0.34], max: 8,
      });
    });
    game.obstacles.push({ minX: pantryX - 2.6, maxX: pantryX + 2.6, minZ: pantryZ - 0.45, maxZ: pantryZ + 0.45 });
    this.dropZone = new TransferZone(game, {
      position: V(pantryX, pantryZ + 1.6), mode: 'drop', types: PANTRY,
      target: { canAccept: (t) => !!this.inputs[t]?.canAccept(t), receive: (t, m) => this.inputs[t].receive(t, m) },
      roles: ['player', 'baker'],
    });

    // Pasaplatos: un lugar por plato
    const passX = P.x + 3.6;
    const pass = createTable(2.7);
    pass.position.set(passX, 0, pantryZ);
    game.scene.add(pass);
    this.pass = {};
    Object.keys(DISHES).forEach((t, i) => {
      this.pass[t] = new Pile(game, { position: V(passX + (i - 1.5) * 0.62, pantryZ).setY(0.56), type: t, cols: 1, rows: 2, spacing: [0.5, 0.34], max: 4 });
    });
    game.obstacles.push({ minX: passX - 1.4, maxX: passX + 1.4, minZ: pantryZ - 0.45, maxZ: pantryZ + 0.45 });
    const passes = Object.values(this.pass);
    this.passZone = new TransferZone(game, {
      position: V(passX, pantryZ + 1.6), mode: 'pickup', roles: ['player', 'waiter'], icon: '🍽️',
      target: {
        type: null,
        hasLanded: () => passes.some((p) => p.hasLanded()),
        give: () => passes.find((p) => p.hasLanded()).give(),
      },
    });
    this.passZone.roles = this.passZone.roles.filter((r) => r !== 'manager'); // los platos los llevan Mela y el mozo

    // Caja (los clientes pagan acá)
    this.cashPile = new CashPile(game, { position: V(P.x - 0.6, pantryZ + 2.0) });

    // Mesas en la terraza (se agregan más con la mejora "Mesas")
    this.spawn = V(-50.5, -60);
    this.exit = V(-50.5, -67);
    this.slots = [];
    for (const z of [-64.6, -59.6]) for (const x of [-29.6, -25.6, -21.6, -17.6]) this.slots.push(V(x, z));
    this.addTables(4, instant);
    game.add(this);
  }

  /** Mesa redonda con dos sillas; el comensal se sienta del lado de atrás. */
  addTables(n, instant = true) {
    for (let k = 0; k < n && this.tables.length < this.slots.length; k++) {
      const pos = this.slots[this.tables.length];
      const g = new THREE.Group();
      g.position.copy(pos);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.08, 18), mat('#ffffff'));
      top.position.y = 0.78;
      const cloth = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.02, 18), mat('#e8503f'));
      cloth.position.y = 0.83;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 0.76, 8), mat('#5c4033'));
      leg.position.y = 0.38;
      g.add(top, cloth, leg);
      for (const s of [-1, 1]) {
        const chair = new THREE.Group();
        chair.add(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 0.45), mat('#c98b4a')));
        chair.children[0].position.y = 0.45;
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 0.06), mat('#c98b4a'));
        back.rotation.y = Math.PI / 2;
        back.position.set(s * 0.22, 0.72, 0);
        chair.add(back);
        chair.position.set(s * 1.0, 0, 0);
        g.add(chair);
      }
      // Sombrilla
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 6), mat('#ffffff'));
      pole.position.y = 1.5;
      pole.scale.y = 1.1;
      const umb = new THREE.Mesh(new THREE.ConeGeometry(0.8, 0.4, 10), mat(this.tables.length % 2 ? '#ffcf3a' : '#7b2cbf'));
      umb.position.y = 2.85;
      g.add(pole, umb);
      this.game.scene.add(g);
      if (!instant) this.game.fx.popIn(g);
      this.game.obstacles.push({ minX: pos.x - 0.55, maxX: pos.x + 0.55, minZ: pos.z - 0.55, maxZ: pos.z + 0.55 });
      // El comensal se sienta al costado (x-) y la comida se sirve desde adelante (z+)
      this.tables.push({ pos, seat: pos.clone().add(V(-1.0, 0)), serve: pos.clone().add(V(0, 1.15)), diner: null, group: g });
    }
  }

  /**
   * Qué pide un comensal nuevo: casi siempre algo que la cocina puede preparar con lo que hay
   * (así las mesas no se quedan todas esperando el plato más difícil), y a veces cualquier cosa
   * de la carta: eso es lo que le toca resolver a Mela.
   */
  chooseDish() {
    const all = Object.keys(DISHES);
    const possible = all.filter((type) => this.pass[type].count > 0 || Object.entries(DISHES[type]).every(([t, n]) => {
      // Ingredientes en la despensa, descontando lo que ya reservaron otros comensales esperando
      const reserved = this.diners.filter((d) => (d.state === 'walk' || d.state === 'wait') && DISHES[d.want][t]).length;
      return this.inputs[t].landedCount - reserved >= n;
    }));
    return possible.length && Math.random() < 0.8 ? pick(possible) : pick(all);
  }

  /** Para la Gerencia: no hay estantería de venta. */
  availableTypes() { return []; }

  /** Platos que faltan: pedidos esperando menos lo que ya está en el pasaplatos o en las manos de alguien. */
  demand(type) {
    let n = this.diners.filter((d) => d.state !== 'leave' && d.state !== 'eat' && d.want === type).length;
    n -= this.pass[type].count;
    for (const c of this.game.carriers) n -= c.stack.countOf(type);
    return n;
  }

  update(dt) {
    // Llegan comensales si hay mesa libre
    this.spawnTimer -= dt;
    const free = this.tables.filter((t) => !t.diner);
    if (this.spawnTimer <= 0 && free.length) {
      this.diners.push(new Diner(this.game, this, pick(free)));
      this.spawnTimer = rand(4, 8) / this.spawnMult;
    }
    for (const d of this.diners) d.update(dt);
    this.diners = this.diners.filter((d) => !d.dead);

    // Cocina: atiende primero al que más espera, con lo que haya en la despensa
    if (!this.cooking) {
      const waiting = this.diners.filter((d) => d.state === 'wait' || d.state === 'walk').sort((a, b) => b.wait - a.wait);
      for (const d of waiting) {
        const type = d.want;
        if (this.demand(type) <= 0 || this.pass[type].isFull) continue;
        if (!Object.entries(DISHES[type]).every(([t, n]) => this.inputs[t].landedCount >= n)) continue;
        for (const [t, n] of Object.entries(DISHES[type])) {
          for (let i = 0; i < n; i++) {
            const e = this.inputs[t].give();
            this.game.fx.fly(e.mesh, (out) => out.copy(this.door), { duration: 0.35, onDone: (m) => m.removeFromParent() });
          }
        }
        this.cooking = { type, t: 0 };
        this.game.audio.play('oven', { pos: this.position, volume: 0.6 });
        break;
      }
    } else {
      this.cooking.t += dt * this.speedMult;
      if (this.cooking.t >= 3.5) {
        const mesh = createItem(this.cooking.type);
        mesh.position.copy(this.door);
        this.game.scene.add(mesh);
        this.pass[this.cooking.type].receive(this.cooking.type, mesh);
        this.game.emit('produce', { type: this.cooking.type });
        this.cooking = null;
      }
    }

    // Servir: quien llegue a la mesa con el plato pedido se lo da al comensal
    for (const d of this.diners) {
      if (d.state !== 'wait') continue;
      for (const c of this.game.carriers) {
        if (c.role !== 'player' && c.role !== 'waiter') continue;
        if (distXZ2(c.position, d.table.pos) > 1.9 * 1.9 || c.stack.countOf(d.want, true) === 0) continue;
        const e = c.stack.take(d.want);
        const spot = d.table.pos.clone().setY(0.86);
        this.game.fx.fly(e.mesh, (out) => out.copy(spot), { duration: 0.3, arc: 0.6 });
        this.game.audio.play('drop', { pos: d.table.pos, volume: c.role === 'player' ? 1 : 0.5 });
        d.serve(e.mesh);
        break;
      }
    }
  }

  /** Cobra el plato; si llegó rápido, con propina. */
  pay(d) {
    const tip = d.servedAfter < 12 ? 0.5 : d.servedAfter < 25 ? 0.25 : 0;
    const base = ITEMS[d.want].price;
    const amount = Math.round(base * (1 + tip) * this.game.saleMult());
    const from = d.position.clone().setY(1.4);
    if (this.autoBank) { this.game.addMoney(amount); this.game.emit('earn', { amount }); } else this.cashPile.addMoney(amount, from);
    this.game.fx.floatText(tip ? `+$${amount} ⭐` : `+$${amount}`, from.clone().setY(2.6), tip ? '#ffe066' : '#9bff8a');
    this.game.audio.play('register', { pos: from });
    this.game.emit('sell', { type: d.want, n: 1 });
    this.sales++;
    if (tip) this.tips++;
    d.leave();
  }

  /** Para el mozo: el comensal esperando más cerca que quiere algo de lo que lleva. */
  dinerFor(c) {
    let best = null;
    let bd = Infinity;
    for (const d of this.diners) {
      if (d.state !== 'wait' || c.stack.countOf(d.want, true) === 0) continue;
      const dd = distXZ2(c.position, d.table.pos) - d.wait * 4; // prioriza al que más espera
      if (dd < bd) { bd = dd; best = d; }
    }
    return best;
  }
}
