// Hostel (Granja 15): Hostería de campo. Los huéspedes hacen fila en la recepción; cuando Mela
// (o la conserje) está en la caja y hay una cabaña limpia, hacen el check-in, pagan y van a su
// cabaña. Al irse la dejan desordenada: hay que llevarle 🛏️ sábanas (del Lavadero) para que
// vuelva a estar lista. Con un 🪑 mueble de la Carpintería la cabaña queda "amueblada" y paga +50%.
import * as THREE from 'three';
import { Character } from './Character.js';
import { createCounter, mat } from '../models/Models.js';
import { createCabin, createHostelHouse } from '../models/ModelsExtra.js';
import { CashPile } from '../systems/CashPile.js';
import { TransferZone } from '../systems/TransferZone.js';
import { GroundDecal, FONT, makeTextSprite, CanvasLabel, drawOrderBubble } from '../core/Labels.js';
import { QueueSystem } from './QueueSystem.js';
import { bakeGroup } from '../core/Bake.js';
import { rand, pick, lerpAngle, distXZ2 } from '../utils.js';

const V = (x, z) => new THREE.Vector3(x, 0, z);
const SHIRTS = ['#3fa7e0', '#4cb860', '#ffb703', '#e76f51', '#a29bfe', '#ffffff', '#ff8fab', '#e8503f'];
const PANTS = ['#2f4f7f', '#3d405b', '#264653', '#1d3557', '#5c4033'];
const HAIR = ['#2b1d0e', '#6b3e26', '#d4a373', '#111111', '#b5651d', '#cfcfcf'];
const SKIN = ['#f8cfa8', '#f2c299', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
/** Precio base de una noche (se multiplica por los ingresos de la granja). */
export const STAY_PRICE = 220;

/** Huésped: fila → cabaña (se queda adentro un rato) → se va. Lleva una valija. */
class Guest {
  constructor(game, hostel) {
    this.game = game;
    this.hostel = hostel;
    this.character = new Character({
      shirt: pick(SHIRTS), pants: pick(PANTS), hair: pick(HAIR), skin: pick(SKIN),
      hairStyle: pick(['short', 'long', 'bun', 'ponytail', 'bald']), scale: rand(0.93, 1.05),
      hat: Math.random() < 0.3 ? 'straw' : null, hatColor: pick(['#f6d785', '#ffffff']),
    });
    this.root = this.character.root;
    this.root.position.copy(hostel.spawn);
    game.scene.add(this.root);
    game.fx.popIn(this.root);
    // Valija
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.16), mat(pick(['#e2483d', '#2f6fb5', '#7b2cbf', '#2e8b57'])));
    bag.position.set(0.32, 0.25, 0);
    this.root.add(bag);
    this.position = this.root.position;
    this.voice = rand(0.8, 1.3);
    this.bubbleY = 2.5;
    this.state = 'queue'; // queue → toCabin → inside → leave
    this.target = hostel.spawn.clone();
    this.speed = rand(2.4, 3.0);
    this.yaw = Math.PI;
    this.timer = 0;
    this.cabin = null;
    this.dead = false;
    this.bubble = new CanvasLabel(256, 128, 0.8, (ctx, W, H) => drawOrderBubble(ctx, W, H, [{ emoji: '🛏️', text: '' }]));
    game.scene.add(this.bubble.sprite);
  }

  setQueueTarget(pos) { this.target.copy(pos); }

  get atSlot() {
    return this.state === 'queue' && distXZ2(this.target, this.position) < 0.01;
  }

  update(dt) {
    const dx = this.target.x - this.position.x;
    const dz = this.target.z - this.position.z;
    const d = Math.hypot(dx, dz);
    let moving = false;
    if (this.state !== 'inside' && d > 0.03) {
      const step = Math.min(d, this.speed * dt);
      this.position.x += (dx / d) * step;
      this.position.z += (dz / d) * step;
      this.yaw = lerpAngle(this.yaw, Math.atan2(dx, dz), 1 - Math.exp(-dt * 10));
      moving = true;
    } else if (this.state === 'queue') {
      this.yaw = lerpAngle(this.yaw, Math.PI, 1 - Math.exp(-dt * 8));
    }
    this.root.rotation.y = this.yaw;
    this.character.animate(dt, moving ? this.speed / 5.5 : 0);
    this.bubble.sprite.position.set(this.position.x, 2.3, this.position.z);
    this.bubble.sprite.visible = this.state === 'queue';

    if (this.state === 'toCabin' && d < 0.05) {
      this.state = 'inside';
      this.timer = rand(18, 26);
      this.root.visible = false;
    } else if (this.state === 'inside') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.root.visible = true;
        this.game.fx.popIn(this.root);
        this.hostel.checkout(this);
        this.state = 'leave';
        this.target.copy(this.hostel.exit);
      }
    } else if (this.state === 'leave' && d < 0.1 && !this.dead) {
      this.dead = true;
      this.bubble.dispose();
      this.game.fx.popOut(this.root);
    }
  }
}

export class Hostel {
  constructor(game, world, { position, cabinSlots, spawn, exit, instant = false }) {
    this.game = game;
    this.world = world;
    this.position = position.clone();
    this.spawn = spawn.clone();
    this.exit = exit.clone();
    this.spawnMult = 1;    // la Pileta atrae más huéspedes
    this.autoBank = false; // Gerencia Nv.2
    this.hasCashier = false;
    this.piles = {};       // interfaz de tienda para la Gerencia (no vende en estantería)
    this.sales = 0;
    this.guests = [];
    this.cabins = [];
    this.cabinSlots = cabinSlots;
    this.spawnTimer = 3;
    this.serveTimer = 0;
    const P = this.position;

    // Casona + mostrador de recepción
    const g = new THREE.Group();
    g.add(createHostelHouse(), createCounter());
    bakeGroup(g);
    g.position.copy(P);
    game.scene.add(g);
    if (!instant) game.fx.popIn(g);
    this.group = g;
    game.obstacles.push(
      { minX: P.x - 1.8, maxX: P.x + 1.8, minZ: P.z - 0.62, maxZ: P.z + 0.62 },
      { minX: P.x - 3.7, maxX: P.x + 3.7, minZ: P.z - 6.1, maxZ: P.z - 2.6 },
    );
    const sign = makeTextSprite('🏡 HOSTERÍA', { color: '#ffffff', stroke: '#7a2b00', worldHeight: 0.7 });
    sign.sprite.position.set(P.x, 5.6, P.z - 2.6);
    game.scene.add(sign.sprite);

    // Caja: círculo verde atrás del mostrador (como en las tiendas)
    this.cashierSpot = V(P.x, P.z - 1.35);
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
        ctx.fillText('🛎️', W / 2, H / 2 + 6);
      }
    });
    this.cashierDecal.mesh.position.set(this.cashierSpot.x, 0.065, this.cashierSpot.z);
    game.scene.add(this.cashierDecal.mesh);
    this.cashierOn = false;
    this.cashPile = new CashPile(game, { position: V(P.x + 2.8, P.z) });
    this.dropZone = { position: V(P.x - 2.8, P.z) }; // (para la Gerencia: la recepción no recibe mercadería)

    // Fila
    const slots = [];
    for (let i = 0; i < 4; i++) slots.push(V(P.x, P.z + 1.6 + i * 1.25));
    this.queue = new QueueSystem(slots);
    const len = 4 * 1.25 + 1.6;
    const lane = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.05, len - 0.3), mat('#f3e3c0'));
    lane.position.set(P.x, 0.01, P.z + 0.7 + len / 2);
    lane.receiveShadow = true;
    game.scene.add(lane);
    game.add(this);
  }

  /** Agrega cabañas (empieza con 4; la mejora "Más cabañas" suma de a 2). */
  addCabins(n, instant = true) {
    for (let k = 0; k < n && this.cabins.length < this.cabinSlots.length; k++) {
      const pos = this.cabinSlots[this.cabins.length];
      const m = bakeGroup(createCabin(['#2e7d32', '#b23a48', '#2f6fb5', '#8e5229'][this.cabins.length % 4]));
      m.position.copy(pos);
      this.game.scene.add(m);
      if (!instant) {
        this.game.fx.popIn(m);
        this.game.fx.burst(pos.clone().setY(1.5), 30);
      }
      this.game.obstacles.push({ minX: pos.x - 1.6, maxX: pos.x + 1.6, minZ: pos.z - 1.35, maxZ: pos.z + 1.3 });
      const cabin = { pos, door: pos.clone().add(V(0, 1.9)), state: 'clean', furnished: false, guest: null };
      cabin.zone = new TransferZone(this.game, {
        position: pos.clone().add(V(0, 2.6)), mode: 'drop', types: ['sheets', 'chair'], roles: ['player', 'maid'], size: 1.8,
        target: {
          canAccept: (t) => (t === 'sheets' ? cabin.state === 'dirty' : t === 'chair' ? !cabin.furnished && cabin.state !== 'busy' : false),
          receive: (t, mesh) => {
            this.game.fx.fly(mesh, (out) => out.copy(cabin.door).setY(0.9), { duration: 0.35, arc: 1, onDone: (mm) => mm.removeFromParent() });
            if (t === 'sheets') {
              cabin.state = 'clean';
              this.game.fx.floatText('✨ ¡Limpia!', cabin.pos.clone().setY(3.2), '#9bff8a');
            } else {
              cabin.furnished = true;
              this.game.fx.floatText('🪑 ¡Amueblada! +50%', cabin.pos.clone().setY(3.2), '#ffe066');
            }
            this.game.audio.play('happy', { pos: cabin.pos });
            this.refreshCabin(cabin);
          },
        },
      });
      cabin.dirtySign = makeTextSprite('🛏️ ¡A limpiar!', { color: '#ffe066', stroke: '#7a2b00', worldHeight: 0.5 });
      cabin.busySign = makeTextSprite('💤', { worldHeight: 0.6 });
      cabin.starSign = makeTextSprite('⭐', { worldHeight: 0.45 });
      for (const s of [cabin.dirtySign, cabin.busySign, cabin.starSign]) this.game.scene.add(s.sprite);
      cabin.dirtySign.sprite.position.set(pos.x, 4.0, pos.z + 0.6);
      cabin.busySign.sprite.position.set(pos.x, 4.0, pos.z + 0.6);
      cabin.starSign.sprite.position.set(pos.x + 1.2, 3.4, pos.z + 0.6);
      this.cabins.push(cabin);
      this.refreshCabin(cabin);
    }
  }

  refreshCabin(c) {
    c.dirtySign.sprite.visible = c.state === 'dirty';
    c.busySign.sprite.visible = c.state === 'busy';
    c.starSign.sprite.visible = c.furnished;
  }

  /** Para la Gerencia: no hay estantería de venta. */
  availableTypes() { return []; }

  dirtyCabins() { return this.cabins.filter((c) => c.state === 'dirty'); }
  unfurnishedCabins() { return this.cabins.filter((c) => !c.furnished && c.state !== 'busy'); }

  update(dt) {
    // Llegan huéspedes (más con la Pileta)
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && !this.queue.isFull && this.cabins.length) {
      const g = new Guest(this.game, this);
      this.guests.push(g);
      this.queue.join(g);
      this.spawnTimer = rand(7, 12) / this.spawnMult;
    }
    for (const g of this.guests) g.update(dt);
    this.guests = this.guests.filter((g) => !g.dead);

    // ¿Hay alguien en la recepción?
    const playerAt = distXZ2(this.game.player.position, this.cashierSpot) < 1.0;
    const on = this.hasCashier || playerAt;
    if (on !== this.cashierOn) { this.cashierOn = on; this.cashierDecal.redraw(on); }

    const front = this.queue.front();
    this.waitTime = front?.atSlot ? (this.waitTime ?? 0) + dt : 0;
    if (!front?.atSlot || !on) { this.serveTimer = 0.8; return; }
    const cabin = this.cabins.find((c) => c.state === 'clean' && c.furnished) ?? this.cabins.find((c) => c.state === 'clean');
    if (!cabin) return;
    this.serveTimer -= dt;
    if (this.serveTimer > 0) return;
    this.serveTimer = 0.8;
    this.checkin(front, cabin);
  }

  checkin(g, cabin) {
    cabin.state = 'busy';
    cabin.guest = g;
    this.refreshCabin(cabin);
    g.cabin = cabin;
    g.state = 'toCabin';
    g.target.copy(cabin.door);
    this.queue.leave(g);
    const amount = Math.round(STAY_PRICE * (cabin.furnished ? 1.5 : 1) * this.game.saleMult());
    const from = g.position.clone().setY(1.2);
    if (this.autoBank) { this.game.addMoney(amount); this.game.emit('earn', { amount }); } else this.cashPile.addMoney(amount, from);
    this.game.audio.play('register', { pos: from });
    this.game.fx.floatText(`+$${amount}`, from.clone().setY(2.6), cabin.furnished ? '#ffe066' : '#9bff8a');
    this.game.emit('sell', { type: 'stay', n: 1 });
    this.sales++;
  }

  /** El huésped se va: la cabaña queda para limpiar. */
  checkout(g) {
    const c = g.cabin;
    if (!c) return;
    c.state = 'dirty';
    c.guest = null;
    this.refreshCabin(c);
  }
}
