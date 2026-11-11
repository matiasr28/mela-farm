// MatiasAI: Matías, el administrador. Lleva la contabilidad, se lleva bien con todos y
// a veces reta (en broma) a algún empleado. Cada tanto acompaña a Mela unos segundos,
// charla brevemente (2 a 4 líneas, sin frenarla) y le da una ayuda:
//   ⚡ turbo de velocidad · 🏷️ promo de ventas · 💵 propina.
// Mejoras: 💼 Cobranza (junta solo la plata de las pilas, con interés),
//          📊 Contabilidad (+5% ventas, se aplica en game.saleMult) y 🤝 Ayuda (más seguido y más fuerte).
import * as THREE from 'three';
import { Character } from './Character.js';
import { createItem } from '../models/Models.js';
import { rand, pick, distXZ2, lerpAngle } from '../utils.js';

// Look de Matías: pelo negro con rulos, piel clara, buzo oscuro y la tabla en la mano.
const LOOK = {
  shirt: '#23262d', pants: '#3a3f4b', hair: '#17110e', hairStyle: 'curly', skin: '#f3d2b8',
  shoes: '#2b2b2b', prop: 'clipboard',
};

// Charlas con Mela (M = Matías, P = Mela). El tipo define la ayuda que da al final.
const HELP_CHATS = {
  speed: [
    [['M', 'Mela, ¿necesitás una mano con algo?'], ['P', '¡Sí, Mati! Estoy a full.'], ['M', 'Te organizo los repartos ⚡'], ['P', '¡Gracias, sos un sol!']],
    [['M', '¡Uh, cuánto laburo! Te despejo el camino ⚡'], ['P', '¡Dale, gracias!']],
  ],
  sales: [
    [['M', '¿Cómo venís, Mela?'], ['P', '¡Bien, pero hay mucha gente!'], ['M', 'Armo una promo en las tiendas 🏷️'], ['P', '¡Genial, Mati!']],
    [['M', 'Mela, se me ocurrió una oferta 🏷️'], ['P', '¡Hacela!']],
  ],
  tip: [
    [['M', 'Mela, cerré las cuentas del día 📊'], ['P', '¿Y qué tal?'], ['M', '¡Sobró algo! Tomá 💵'], ['P', '¡Sos un genio, Mati!']],
    [['M', 'Cobré unas facturas atrasadas 💵'], ['P', '¡Qué bueno!']],
  ],
};
const FRIENDLY = [
  ['¡Buen trabajo, {b}! Los números cierran 📈', '¡Gracias, Mati!'],
  ['{b}, ¿un mate? 🧉', '¡Siempre!'],
  ['¿Todo bien, {b}?', '¡Todo tranqui, Mati!'],
  ['{b}, ¡este mes venimos bárbaro!', '¡Eso es gracias a Mela!'],
];
const SCOLD = [
  ['{b}, ¿anotaste lo que llevaste? 📋', 'Eh... ¡ahora lo anoto, Mati!'],
  ['{b}, dejaste la tranquera abierta 😅', '¡Uy! Perdón, ya la cierro.'],
  ['{b}, ¡ese pedido estaba mal contado!', '¡Ups! No vuelve a pasar.'],
  ['{b}, menos charla y más trabajo, eh 😉', '¡Jaja, entendido, jefe!'],
];
const TO_CAT = [
  ['{b}, ¡bajate de la caja registradora! 😹', 'Miau.'],
  ['¿Quién es el gato más lindo? ¡{b}!', 'Prrrr 💕'],
];

const fill = (t, b) => t.replaceAll('{b}', b.name);

export class MatiasAI {
  constructor(game, world, { position, desk, instant = false }) {
    this.game = game;
    this.world = world;
    this.name = 'Matías';
    this.voice = 0.85;
    this.bubbleY = 2.45;
    this.desk = desk.clone();

    this.character = new Character(LOOK);
    this.root = this.character.root;
    this.root.position.copy(position);
    game.scene.add(this.root);
    if (!instant) game.fx.popIn(this.root);
    this.position = this.root.position;

    this.state = 'roam';
    this.target = this.desk.clone();
    this.wait = rand(2, 5);
    this.helpTimer = rand(50, 80);   // primera visita a Mela
    this.kissTimer = rand(300, 480); // 💋 pide un beso cada 5–8 minutos
    this.askTimer = 0;
    this.kissT = 0;
    this.chatTimer = rand(25, 50);
    this.collectCheck = 1;
    this.collectTimer = 0;
    this.pile = null;
    this.convo = null;
    this.buddy = null;
    this.helpKind = null;
    this.giveUp = 0;
    this.yaw = 0;
    this.speed = 3.6;
    game.add(this);
  }

  get lvl() { return this.world.upgrades; }

  update(dt) {
    const p = this.game.player;
    this.helpTimer -= dt;
    this.chatTimer -= dt;
    this.kissTimer -= dt;
    this.collectCheck -= dt;

    switch (this.state) {
      case 'roam': {
        if (this.arrived()) {
          this.wait -= dt;
          if (this.wait <= 0) this.pickNext();
        }
        break;
      }
      case 'collect': {
        if (!this.arrived()) break;
        this.collectTimer -= dt;
        if (this.collectTimer <= 0) {
          this.collectTimer = 0.09;
          const e = this.pile.give();
          if (!e) { this.state = 'roam'; this.wait = 1; break; }
          const bonus = 1 + 0.03 * (this.lvl.collect ?? 0);
          const me = this.position;
          this.game.fx.fly(e.mesh, (out) => out.copy(me).setY(1.1), {
            duration: 0.25, arc: 0.6,
            onDone: (m) => {
              m.removeFromParent();
              const v = Math.round(e.value * bonus);
              this.game.addMoney(v);
              this.game.emit('earn', { amount: v });
              this.game.audio.play('coin', { pos: me, volume: 0.6 });
            },
          });
        }
        break;
      }
      case 'toMela': {
        this.followPlayer();
        this.giveUp -= dt;
        if (distXZ2(this.position, p.position) < 2.6 * 2.6) {
          this.startHelpChat();
        } else if (this.giveUp <= 0) {
          this.state = 'roam';
          this.helpTimer = 20;
        }
        break;
      }
      case 'helping': {
        this.followPlayer();
        if (this.convoDone()) {
          this.applyHelp(this.helpKind);
          this.state = 'roam';
          this.wait = 1.5;
          this.target.copy(this.desk);
        }
        break;
      }
      case 'toBuddy': {
        const b = this.buddy;
        this.giveUp -= dt;
        if (!b || b.dead || this.giveUp <= 0) { this.state = 'roam'; break; }
        this.target.copy(b.position).add(new THREE.Vector3(1.2, 0, 0.6)).setY(0);
        if (distXZ2(this.position, b.position) < 2.2 * 2.2 && !b._talking && !this._talking) {
          const pool = b.isCat ? TO_CAT : Math.random() < 0.3 ? SCOLD : FRIENDLY;
          const [l1, l2] = pick(pool);
          this.convo = this.game.chatter.startConvo([[this, fill(l1, b)], [b, l2]]);
          this.state = 'talking';
        }
        break;
      }
      case 'talking':
        if (this.convoDone()) { this.state = 'roam'; this.wait = 2; }
        break;

      // ---------- 💋 Beso (sólo si el jugador toca el botón) ----------
      case 'toKiss':
        this.followPlayer();
        this.giveUp -= dt;
        if (distXZ2(this.position, p.position) < 2.6 * 2.6) {
          this.game.chatter.say(this, pick(['¿Un besito? 😘', 'Amor, ¿me das un beso? 💕', '¿Y mi beso, Mela? 😘']), 4);
          this.state = 'asking';
          this.askTimer = 8;
          this._talking = true; // que no arranquen otras charlas mientras espera el beso
          this.game.hud.showKiss(true, () => this.startKiss(), this.askTimer);
          this.game.audio.play('happy');
        } else if (this.giveUp <= 0) {
          this.state = 'roam';
          this.kissTimer = 60;
        }
        break;
      case 'asking':
        this.followPlayer();
        this.askTimer -= dt;
        this.game.hud.showKiss(true, () => this.startKiss(), this.askTimer);
        if (this.askTimer <= 0) {
          this._talking = false;
          this.game.hud.showKiss(false);
          this.game.chatter.say(this, pick(['¡Bueno, después! 😉', 'Me lo debés, eh 😘', '¡Uh, qué ocupada! Después 💕']));
          this.state = 'roam';
          this.kissTimer = rand(300, 480);
        }
        break;
      case 'kissing': {
        // De frente a Mela, a la distancia justa para que los labios se toquen al inclinarse.
        // Tiempos: 0–0,35 s se acercan · 0,35–1,45 s beso · 1,45–1,8 s se separan.
        const d = this.kissDir;
        const KISS_IN = 0.35;
        const KISS_OUT = 1.45;
        const KISS_END = 1.8;
        this.kissT += dt;
        // Si el jugador mueve el joystick, se separan con suavidad
        if (Math.hypot(p.velocity.x, p.velocity.z) > 0.5 && this.kissT < KISS_OUT) this.kissT = KISS_OUT;
        const t = this.kissT;
        const k = t < KISS_IN ? t / KISS_IN : t < KISS_OUT ? 1 : Math.max(0, 1 - (t - KISS_OUT) / (KISS_END - KISS_OUT));
        this.kissK = k;
        this.target.copy(p.position).addScaledVector(d, 0.72 + (1 - k) * 0.35).setY(0);
        p.kiss = { k, yaw: Math.atan2(d.x, d.z) };
        if (!this.kissPopped && t >= KISS_IN) { this.kissPopped = true; this.kissMoment(); }
        if (t >= KISS_END) this.finishKiss();
        break;
      }
    }

    // Decisiones (sólo cuando está "libre")
    if (this.state === 'roam' && !this._talking) {
      if (this.kissTimer <= 0 && !p._talking) {
        this.state = 'toKiss';
        this.giveUp = 25;
      } else if (this.helpTimer <= 0 && !p._talking) {
        const lvl = this.lvl.helpme ?? 0;
        this.helpTimer = Math.max(55, 130 - 15 * lvl);
        this.state = 'toMela';
        this.giveUp = 18;
      } else if ((this.lvl.collect ?? 0) > 0 && this.collectCheck <= 0) {
        this.collectCheck = 1.5;
        const pile = this.findPile();
        if (pile) { this.pile = pile; this.state = 'collect'; this.target.copy(pile.center).add(new THREE.Vector3(0, 0, 1.1)); }
      }
      if (this.state === 'roam' && this.chatTimer <= 0) {
        this.chatTimer = rand(35, 70);
        const pool = [...this.world.workers, ...this.world.cats.filter((c) => c.atHome)];
        if (pool.length) {
          this.buddy = pick(pool);
          this.state = 'toBuddy';
          this.giveUp = 20;
        }
      }
    }

    this.move(dt);
  }

  /** El jugador tocó 💋: beso de ~1,8 s en total (no frena el juego). */
  startKiss() {
    if (this.state !== 'asking') return;
    const g = this.game;
    g.hud.showKiss(false);
    this.state = 'kissing';
    this.kissT = 0;
    this.kissK = 0;
    this.kissPopped = false;
    // Dirección de Mela hacia Matías (se ubica de frente a ella en esa dirección)
    const d = this.position.clone().sub(g.player.position).setY(0);
    if (d.lengthSq() < 0.01) d.set(Math.sin(g.player.yaw), 0, Math.cos(g.player.yaw));
    this.kissDir = d.normalize();
    // Mientras se besan, no aparecen otros globitos encima
    this._talking = true;
    g.player._talking = true;
  }

  /** Momento del beso: "muak", corazón grande y corazoncitos alrededor. */
  kissMoment() {
    const g = this.game;
    g.audio.play('kiss');
    try { navigator.vibrate?.([30, 40, 30]); } catch { /* sin vibración */ }
    const mid = () => this.position.clone().lerp(g.player.position, 0.5);
    g.fx.floatText('💗', mid().setY(2.05));
    for (let i = 0; i < 6; i++) {
      g.fx.tween(0.15 + i * 0.13, null, () => {
        const m = mid();
        m.x += (Math.random() - 0.5) * 0.9;
        m.z += (Math.random() - 0.5) * 0.5;
        m.y = 1.8 + Math.random() * 0.4;
        g.fx.floatText(pick(['❤️', '💕', '💗']), m);
      });
    }
  }

  finishKiss() {
    const g = this.game;
    this.kissK = 0;
    g.player.kiss = null;
    this._talking = false;
    g.player._talking = false;
    g.addBoost('love', 30);
    g.fx.floatText('💕 ¡Enamorada!', g.player.position.clone().setY(2.9), '#ff9ec4');
    g.chatter.say(this, pick(['Te quiero, amor 💕', '¡Seguí rompiéndola, mi amor!', 'Sos lo más lindo de la granja 🌻']), 3);
    this.state = 'roam';
    this.wait = 2;
    this.target.copy(this.desk);
    this.kissTimer = rand(300, 480);
  }

  arrived() { return distXZ2(this.position, this.target) < 0.04; }
  convoDone() { return !this.convo || !this.game.chatter.convos.includes(this.convo); }

  /** Camina al costado de Mela (nunca se interpone: los NPC no colisionan con ella). */
  followPlayer() {
    const p = this.game.player;
    const side = new THREE.Vector3(Math.cos(p.yaw), 0, -Math.sin(p.yaw)).multiplyScalar(1.3);
    this.target.copy(p.position).add(side).setY(0);
  }

  startHelpChat() {
    const lvl = this.lvl.helpme ?? 0;
    this.helpKind = pick(['speed', 'sales', 'tip']);
    const p = this.game.player;
    const lines = pick(HELP_CHATS[this.helpKind]).map(([who, text]) => [who === 'M' ? this : p, text]);
    this.convo = this.game.chatter.startConvo(lines);
    this.state = 'helping';
    this.helpLevel = lvl;
  }

  applyHelp(kind) {
    const g = this.game;
    const lvl = this.lvl.helpme ?? 0;
    const head = this.position.clone().setY(2.6);
    if (kind === 'speed') {
      g.addBoost('speed', 20 + 6 * lvl);
      g.fx.floatText('⚡ ¡Turbo!', head, '#ffe066');
    } else if (kind === 'sales') {
      g.addBoost('sales', 25 + 6 * lvl);
      g.fx.floatText('🏷️ ¡Promo!', head, '#9bff8a');
    } else {
      const amount = Math.max(10, Math.round(((40 + 40 * lvl) * g.incomeMult) / 5) * 5);
      const n = 6;
      for (let i = 0; i < n; i++) {
        const bill = createItem('cash');
        bill.position.copy(this.position).setY(1.2);
        g.scene.add(bill);
        g.fx.tween(i * 0.06, null, () => g.fx.fly(bill, (out) => out.copy(g.player.position).setY(1.1), {
          duration: 0.35, arc: 1,
          onDone: (m) => { m.removeFromParent(); g.audio.play('coin', { pitch: 1 + i * 0.05 }); },
        }));
      }
      g.addMoney(amount);
      g.fx.floatText(`+$${amount}`, head, '#9bff8a');
    }
    g.audio.play('happy');
  }

  /** Pila de billetes con plata que Mela no esté juntando. */
  findPile() {
    const shops = this.world.shops();
    const piles = shops.map((s) => s.cashPile);
    if (this.world.truck) piles.push(this.world.truck.cashPile);
    if (this.world.restaurant) piles.push(this.world.restaurant.cashPile);
    for (const x of [this.world.train, this.world.ship, this.world.hostel]) if (x) piles.push(x.cashPile);
    if (this.world.balloonCash) piles.push(this.world.balloonCash);
    const p = this.game.player.position;
    return piles
      .filter((c) => c.landedCount >= 4 && distXZ2(c.center, p) > 4 * 4)
      .sort((a, b) => b.landedCount - a.landedCount)[0] ?? null;
  }

  /** Recorrido "revisando los números": escritorio, tiendas y talleres. */
  pickNext() {
    const w = this.world;
    const spots = [this.desk, this.desk];
    for (const s of w.shops()) spots.push(s.position.clone().add(new THREE.Vector3(3.4, 0, 1.8)));
    for (const pr of w.processors()) spots.push(pr.position.clone().add(new THREE.Vector3(0, 0, 5)));
    spots.push(w.coop.pickupZone.position.clone().add(new THREE.Vector3(1.5, 0, 1)));
    this.target.copy(pick(spots));
    this.wait = rand(4, 9);
  }

  move(dt) {
    const p = this.game.player;
    const dx = this.target.x - this.position.x;
    const dz = this.target.z - this.position.z;
    const d = Math.hypot(dx, dz);
    // Cuando acompaña a Mela puede ir tan rápido como ella
    const following = ['helping', 'toMela', 'toKiss', 'asking', 'kissing'].includes(this.state);
    const speed = following ? Math.max(this.speed, p.speed * this.game.speedMult() + 0.5) : this.speed;
    let moving = false;
    if (d > 0.08) {
      const step = Math.min(d, speed * dt);
      this.position.x += (dx / d) * step;
      this.position.z += (dz / d) * step;
      this.yaw = lerpAngle(this.yaw, Math.atan2(dx, dz), 1 - Math.exp(-dt * 10));
      moving = true;
    } else if (this.state === 'roam' && this.target.equals(this.desk)) {
      this.yaw = lerpAngle(this.yaw, 0, 1 - Math.exp(-dt * 6));
    }
    const kissing = this.state === 'kissing';
    if (kissing) {
      // De frente a Mela durante el beso
      this.yaw = lerpAngle(this.yaw, Math.atan2(-this.kissDir.x, -this.kissDir.z), 1 - Math.exp(-dt * 16));
    }
    this.root.rotation.y = this.yaw;
    this.character.kissK = kissing ? this.kissK : 0;
    this.character.kissArms = 'waist';
    this.character.animate(dt, moving && !kissing ? Math.min(1, speed / 5.5) : 0);
    if (!kissing) this.character.armL.rotation.x = -0.6; // la tabla en la mano
  }
}
