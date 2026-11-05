// Truck: camión de entregas. Llega por la ruta, muestra un pedido (maíz/huevos/leche),
// el jugador lo carga desde la zona al costado y, al completarlo, paga y se va.
import * as THREE from 'three';
import { createTruck, ITEMS } from '../models/Models.js';
import { Pile } from '../systems/Pile.js';
import { CashPile } from '../systems/CashPile.js';
import { TransferZone } from '../systems/TransferZone.js';
import { CanvasLabel, drawOrderBubble } from '../core/Labels.js';
import { CONFIG } from '../config.js';

export class Truck {
  constructor(game, { parkPos, enterX = -40, exitX = 45 }) {
    this.game = game;
    this.park = parkPos.clone();
    this.enterX = enterX;
    this.exitX = exitX;
    this.order = {};
    this.delivered = {};

    this.model = createTruck();
    this.root = this.model.root;
    this.root.rotation.y = Math.PI / 2; // frente hacia +X
    this.root.position.set(enterX, 0, parkPos.z);
    game.scene.add(this.root);

    this.bedPile = new Pile(game, {
      parent: this.model.bedAnchor, type: null, cols: 3, rows: 4, max: 80, spacing: [0.55, 0.6], layerHeight: 0.24,
    });

    // Zona de carga al costado (lado norte) del camión estacionado
    this.dropZone = new TransferZone(game, {
      position: new THREE.Vector3(parkPos.x - 1.0, 0, parkPos.z - 3.4), mode: 'drop',
      types: ['corn', 'egg', 'milk', 'wheat', 'pumpkin', 'bread', 'jam', 'cake'], target: this, roles: ['player'],
    });
    this.cashPile = new CashPile(game, { position: new THREE.Vector3(parkPos.x + 2.4, 0, parkPos.z - 3.4) });

    this.board = new CanvasLabel(420, 150, 1.25, (ctx, W, H) => this.drawBoard(ctx, W, H));
    this.board.sprite.visible = false;
    game.scene.add(this.board.sprite);

    this.state = 'away';
    this.timer = 1;
    this.completed = 0;
    this.speed = 0;
    this.doneTimer = -1;
    game.add(this);
  }

  // ---- Sink ----
  canAccept(type) {
    return this.state === 'waiting' && this.doneTimer < 0 && (this.order[type] || 0) > (this.delivered[type] || 0);
  }

  receive(type, mesh) {
    this.delivered[type] = (this.delivered[type] || 0) + 1;
    this.bedPile.receive(type, mesh, { duration: 0.35, arc: 1.6 });
    this.board.redraw();
    if (this.isComplete()) this.doneTimer = 0.7;
  }

  isComplete() {
    return Object.keys(this.order).every((t) => (this.delivered[t] || 0) >= this.order[t]);
  }

  /** Pedidos cada vez más grandes y variados. */
  newOrder() {
    const lvl = this.completed;
    const f = this.game.flags;
    // Productos que la granja ya puede producir
    const avail = ['corn'];
    if (lvl >= 1) avail.push('egg');
    if (f.milk) avail.push('milk');
    if (f.wheat) avail.push('wheat');
    if (f.bread) avail.push('bread');
    if (f.pumpkin) avail.push('pumpkin');
    if (f.jam) avail.push('jam');
    if (f.cake) avail.push('cake');

    const o = {};
    if (lvl < 2) {
      o.corn = 4 + lvl * 2;
      if (lvl === 1) o.egg = 3;
    } else {
      const kinds = Math.min(avail.length, Math.random() < 0.5 ? 2 : 3);
      const pool = [...avail];
      const budget = 10 + lvl * 4; // "valor" del pedido en unidades de precio
      for (let i = 0; i < kinds; i++) {
        const t = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
        o[t] = Math.max(1, Math.min(20, Math.round(budget / kinds / ITEMS[t].price)));
      }
    }
    this.order = o;
    this.delivered = {};
    this.doneTimer = -1;
    this.board.redraw();
  }

  reward() {
    const base = Object.entries(this.order).reduce((s, [t, n]) => s + ITEMS[t].price * n, 0);
    return Math.round(base * CONFIG.truck.rewardMult * this.game.incomeMult);
  }

  rollWheels(dist) {
    for (const w of this.model.wheels) w.rotation.x += dist / 0.42;
  }

  update(dt) {
    const pos = this.root.position;
    switch (this.state) {
      case 'away':
        this.timer -= dt;
        if (this.timer <= 0) {
          this.newOrder();
          this.state = 'arriving';
          pos.x = this.enterX;
        }
        break;
      case 'arriving': {
        const d = this.park.x - pos.x;
        const v = Math.min(12, Math.max(1.2, d * 2)); // frena al llegar
        const step = Math.min(d, v * dt);
        pos.x += step;
        this.rollWheels(step);
        if (d < 0.02) {
          pos.x = this.park.x;
          this.state = 'waiting';
          this.game.audio.play('horn', { pos });
        }
        break;
      }
      case 'waiting':
        if (this.doneTimer >= 0) {
          this.doneTimer -= dt;
          if (this.doneTimer < 0) this.depart();
        }
        break;
      case 'leaving': {
        this.speed = Math.min(14, this.speed + dt * 10);
        const step = this.speed * dt;
        pos.x += step;
        this.rollWheels(step);
        if (pos.x > this.exitX) {
          this.state = 'away';
          this.timer = CONFIG.truck.returnTime;
          this.bedPile.clear();
        }
        break;
      }
    }
    this.dropZone.enabled = this.state === 'waiting';
    this.board.sprite.visible = this.state === 'waiting' || this.state === 'arriving';
    this.board.sprite.position.set(pos.x + 1.4, 3.1, pos.z + 0.6); // sobre la cabina, sin tapar la zona de carga
  }

  depart() {
    const amount = this.reward();
    const from = this.root.position.clone().setY(1.6);
    this.cashPile.addMoney(amount, from);
    this.game.fx.floatText(`+$${amount}`, from.clone().setY(3.2), '#9bff8a');
    this.game.audio.play('register', { pos: from });
    this.game.emit('truck', {});
    this.completed++;
    this.state = 'leaving';
    this.speed = 0;
    this.doneTimer = -1;
  }

  drawBoard(ctx, W, H) {
    const entries = Object.keys(this.order).map((t) => {
      const left = Math.max(0, this.order[t] - (this.delivered[t] || 0));
      return { emoji: ITEMS[t].emoji, text: left ? String(left) : '✔', done: !left };
    });
    drawOrderBubble(ctx, W, H, entries);
  }
}
