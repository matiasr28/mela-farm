// CustomerAI: cliente que camina hasta su lugar en la fila, muestra lo que quiere
// en un globito, recibe los productos en las manos, paga y se va.
import { Character } from './Character.js';
import { StackManager } from '../systems/StackManager.js';
import { CanvasLabel, drawOrderBubble } from '../core/Labels.js';
import { ITEMS } from '../models/Models.js';
import { pick, rand, lerpAngle } from '../utils.js';

const SHIRTS = ['#3fa7e0', '#4cb860', '#ffb703', '#e76f51', '#a29bfe', '#ffffff', '#ff8fab', '#e8503f'];
const PANTS = ['#2f4f7f', '#3d405b', '#264653', '#1d3557', '#5c4033', '#3f72c0'];
const HAIR = ['#2b1d0e', '#6b3e26', '#d4a373', '#111111', '#b5651d', '#cfcfcf', '#8b4a22'];
const SKIN = ['#f8cfa8', '#f2c299', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
const STYLES = ['short', 'short', 'long', 'bun', 'bald', 'ponytail'];

export class CustomerAI {
  constructor(game, { spawn, exit, wants }) {
    this.game = game;
    const hairStyle = pick(STYLES);
    this.character = new Character({
      shirt: pick(SHIRTS), pants: pick(PANTS), hair: pick(HAIR), skin: pick(SKIN), hairStyle,
      tie: pick(SHIRTS), shoes: pick(['#5b3a24', '#2b2b2b', '#ffffff']),
      hat: hairStyle === 'short' && Math.random() < 0.35 ? pick(['cap', 'straw']) : null,
      hatColor: pick(['#f6d785', '#e8503f', '#2f7de1']),
      scale: rand(0.93, 1.05),
    });
    this.root = this.character.root;
    this.root.position.copy(spawn);
    game.scene.add(this.root);
    game.fx.popIn(this.root);

    this.position = this.root.position;
    this.voice = rand(0.75, 1.35);
    this.bubbleY = 3.15; // encima del globito de pedido
    this.stack = new StackManager(game, this.character.frontAnchor, 99, { wobble: 0.4 });
    this.stack.onLand = () => game.audio.play('pop', { pos: this.position, pitch: 1.2, volume: 0.6 });
    this.wants = wants;
    this.received = {};
    for (const t of Object.keys(wants)) this.received[t] = 0;

    this.state = 'queue'; // queue → leaving
    this.target = spawn.clone();
    this.exit = exit.clone();
    this.speed = rand(2.4, 3.0);
    this.payTimer = 0;
    this.yaw = Math.PI;
    this.dead = false;
    this.vx = 0;
    this.vz = 0;

    this.bubble = new CanvasLabel(256, 128, 0.85, (ctx, W, H) => this.drawBubble(ctx, W, H));
    game.scene.add(this.bubble.sprite);
  }

  setQueueTarget(pos) { this.target.copy(pos); }

  get atSlot() {
    if (this.state !== 'queue') return false;
    const dx = this.target.x - this.position.x;
    const dz = this.target.z - this.position.z;
    return dx * dx + dz * dz < 0.01;
  }

  remainingTypes() {
    return Object.keys(this.wants).filter((t) => this.received[t] < this.wants[t]);
  }

  get isSatisfied() { return this.remainingTypes().length === 0; }

  get total() {
    return Object.entries(this.wants).reduce((s, [t, n]) => s + ITEMS[t].price * n, 0);
  }

  receiveItem(type, mesh) {
    this.stack.receive(type, mesh);
    this.received[type]++;
    if (this.isSatisfied) this.payTimer = 0.45;
    this.bubble.redraw();
  }

  leave() {
    this.state = 'leaving';
    this.target.copy(this.exit);
    this.bubble.sprite.visible = false;
    this.game.fx.floatText('😊', this.position.clone().setY(2.4));
    this.game.audio.play('happy', { pos: this.position });
  }

  update(dt) {
    const dx = this.target.x - this.position.x;
    const dz = this.target.z - this.position.z;
    const d = Math.hypot(dx, dz);
    let moving = false;
    if (d > 0.02) {
      const step = Math.min(d, this.speed * dt);
      this.position.x += (dx / d) * step;
      this.position.z += (dz / d) * step;
      this.vx = (dx / d) * this.speed;
      this.vz = (dz / d) * this.speed;
      this.yaw = lerpAngle(this.yaw, Math.atan2(dx, dz), 1 - Math.exp(-dt * 10));
      moving = d > 0.1;
    } else {
      this.vx = this.vz = 0;
      if (this.state === 'queue') this.yaw = lerpAngle(this.yaw, Math.PI, 1 - Math.exp(-dt * 8)); // mira al mostrador
    }
    this.root.rotation.y = this.yaw;
    this.character.animate(dt, moving ? this.speed / 5.5 : 0, { carryFront: this.stack.count > 0 });
    this.stack.update(dt, this.vx, this.vz, this.yaw);

    this.bubble.sprite.position.set(this.position.x, 2.35, this.position.z);

    if (this.state === 'leaving' && d < 0.1 && !this.dead) {
      this.dead = true;
      this.bubble.dispose();
      this.game.fx.popOut(this.root);
    }
  }

  drawBubble(ctx, W, H) {
    const types = this.remainingTypes();
    const entries = types.length
      ? types.map((t) => ({ emoji: ITEMS[t].emoji, text: String(this.wants[t] - this.received[t]) }))
      : [{ emoji: '👍', text: '' }];
    drawOrderBubble(ctx, W, H, entries);
  }
}

