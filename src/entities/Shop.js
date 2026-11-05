// Shop: mostrador de venta genérico (Tienda: huevos/leche — Almacén: pan/dulces/tortas).
// Estanterías por producto, zona de reposición, lugar del cajero, fila de clientes y
// pila de billetes. Para atender hace falta alguien en la caja: Mela o un cajero.
import * as THREE from 'three';
import { createCounter, mat, ITEMS } from '../models/Models.js';
import { Pile } from '../systems/Pile.js';
import { CashPile } from '../systems/CashPile.js';
import { TransferZone } from '../systems/TransferZone.js';
import { GroundDecal, FONT, makeTextSprite } from '../core/Labels.js';
import { QueueSystem } from './QueueSystem.js';
import { CustomerAI } from './CustomerAI.js';
import { CONFIG } from '../config.js';
import { rand, randInt, distXZ2 } from '../utils.js';

export class Shop {
  /**
   * @param {object} opts
   * @param {{type:string, flag?:string, x:number, max:number, pile?:object}[]} opts.products
   *        productos que vende; `flag` = bandera de juego necesaria para que se venda
   */
  constructor(game, {
    position, products, name = 'TIENDA', spawnPoint, exitPoint, queueSize = CONFIG.shop.queueSize, instant = true,
  }) {
    this.game = game;
    this.position = position.clone();
    this.products = products;

    const counter = createCounter();
    counter.position.copy(position);
    game.scene.add(counter);
    if (!instant) game.fx.popIn(counter);
    game.obstacles.push({ minX: position.x - 1.8, maxX: position.x + 1.8, minZ: position.z - 0.62, maxZ: position.z + 0.62 });

    const sign = makeTextSprite(name, { color: '#ffffff', stroke: '#b5302a', worldHeight: 0.5 });
    sign.sprite.position.set(position.x, 2.6, position.z - 0.4);
    game.scene.add(sign.sprite);

    // Estanterías sobre el mostrador (una pila por producto)
    this.piles = {};
    for (const p of products) {
      this.piles[p.type] = new Pile(game, {
        position: new THREE.Vector3(position.x + p.x, 1.04, position.z), type: p.type,
        cols: 2, rows: 2, spacing: [0.5, 0.5], max: p.max, ...p.pile,
      });
    }

    // Zona de reposición (costado izquierdo)
    const sink = {
      canAccept: (t) => this.isAvailable(t) && this.piles[t].canAccept(t),
      receive: (t, m) => this.piles[t].receive(t, m),
    };
    this.dropZone = new TransferZone(game, {
      position: new THREE.Vector3(position.x - 2.8, 0, position.z), mode: 'drop', types: products.map((p) => p.type),
      target: sink, roles: ['player', 'carrier'],
    });

    // Círculo verde donde hay que pararse para cobrar
    this.cashierSpot = new THREE.Vector3(position.x, 0, position.z - 1.35);
    this.cashierDecal = new GroundDecal(1.7, (ctx, W, H, on) => {
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, W / 2 - 14, 0, Math.PI * 2);
      ctx.fillStyle = on ? 'rgba(94,224,122,0.55)' : 'rgba(94,224,122,0.25)';
      ctx.fill();
      ctx.lineWidth = 14;
      ctx.strokeStyle = '#3ee07a';
      ctx.stroke();
      if (!on) {
        ctx.font = `90px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💲', W / 2, H / 2 + 6);
      }
    });
    this.cashierDecal.mesh.position.set(this.cashierSpot.x, 0.03, this.cashierSpot.z);
    game.scene.add(this.cashierDecal.mesh);
    this.cashierOn = false;

    this.cashPile = new CashPile(game, { position: new THREE.Vector3(position.x + 2.8, 0, position.z) });

    // Fila de clientes (hacia +Z) sobre una senda de piedra clara
    const slots = [];
    for (let i = 0; i < queueSize; i++) slots.push(new THREE.Vector3(position.x, 0, position.z + 1.6 + i * 1.25));
    this.queue = new QueueSystem(slots);
    const len = queueSize * 1.25 + 1.6;
    const border = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.04, len), mat('#d2b47c'));
    border.position.set(position.x, 0.005, position.z + 0.7 + len / 2);
    const lane = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.05, len - 0.3), mat('#f3e3c0'));
    lane.position.set(position.x, 0.01, position.z + 0.7 + len / 2);
    border.receiveShadow = lane.receiveShadow = true;
    game.scene.add(border, lane);

    this.spawnPoint = spawnPoint;
    this.exitPoint = exitPoint;
    this.customers = [];
    this.spawnTimer = 1.5;
    this.serveTimer = 0;
    this.hasCashier = false;
    this.sales = 0;
    this.waitTime = 0; // cuánto lleva el primero de la fila esperando (para charlas/pistas)
    game.add(this);
  }

  isAvailable(type) {
    const p = this.products.find((q) => q.type === type);
    return !!p && (!p.flag || this.game.flags[p.flag]);
  }

  availableTypes() {
    return this.products.filter((p) => !p.flag || this.game.flags[p.flag]).map((p) => p.type);
  }

  /** Pedido aleatorio: los productos baratos se piden en más cantidad; crece con las ventas. */
  makeWants() {
    const avail = this.availableTypes();
    const wants = {};
    const kinds = Math.min(avail.length, Math.random() < 0.35 ? 2 : 1);
    const pool = [...avail];
    for (let i = 0; i < kinds; i++) {
      const t = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      const maxN = Math.max(1, Math.min(5, Math.floor(9 / ITEMS[t].price) + Math.floor(this.sales / 8)));
      wants[t] = randInt(1, maxN);
    }
    return wants;
  }

  spawnCustomer() {
    const c = new CustomerAI(this.game, { spawn: this.spawnPoint, exit: this.exitPoint, wants: this.makeWants() });
    c.shop = this;
    this.customers.push(c);
    this.queue.join(c);
  }

  update(dt) {
    const cfg = CONFIG.shop;

    // Spawn de clientes (sólo si hay algo para vender)
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && !this.queue.isFull && this.availableTypes().length) {
      this.spawnCustomer();
      this.spawnTimer = rand(cfg.spawnMin, cfg.spawnMax);
    }

    for (const c of this.customers) c.update(dt);
    this.customers = this.customers.filter((c) => !c.dead);

    // ¿Hay alguien en la caja?
    const playerAtCashier = distXZ2(this.game.player.position, this.cashierSpot) < 1.0;
    const on = this.hasCashier || playerAtCashier;
    if (on !== this.cashierOn) { this.cashierOn = on; this.cashierDecal.redraw(on); }

    const front = this.queue.front();
    if (front?.atSlot) this.waitTime += dt; else this.waitTime = 0;
    if (!front || !front.atSlot || !on) return;

    if (front.isSatisfied) {
      front.payTimer -= dt;
      if (front.payTimer <= 0) this.checkout(front);
      return;
    }

    this.serveTimer -= dt;
    if (this.serveTimer <= 0) {
      this.serveTimer = cfg.serveInterval;
      for (const t of front.remainingTypes()) {
        const e = this.piles[t].give();
        if (e) { front.receiveItem(t, e.mesh); break; }
      }
    }
  }

  checkout(c) {
    const amount = Math.round(c.total * this.game.saleMult());
    const from = c.position.clone().setY(1.2);
    this.cashPile.addMoney(amount, from);
    this.game.audio.play('register', { pos: from });
    this.game.fx.floatText(`+$${amount}`, from.clone().setY(2.6), '#9bff8a');
    for (const [t, n] of Object.entries(c.wants)) this.game.emit('sell', { type: t, n });
    this.queue.leave(c);
    c.leave();
    this.sales++;
    this.waitTime = 0;
  }

  /** Tipo que el primero de la fila quiere pero no hay en la estantería (para pistas). */
  missingType() {
    const f = this.queue.front();
    if (!f?.atSlot) return null;
    return f.remainingTypes().find((t) => !this.piles[t].hasLanded()) ?? null;
  }
}
