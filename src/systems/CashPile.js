// CashPile: pila de fajos de billetes sobre una base en el suelo. Los pagos llegan
// volando y Mela los recoge pasando por encima (cada fajo suma su valor al contador).
import { Pile } from './Pile.js';
import { createItem } from '../models/Models.js';
import { GroundDecal, roundRect } from '../core/Labels.js';

const VISIBLE_MAX = 48; // fajos visibles como máximo por pila

export class CashPile extends Pile {
  constructor(game, { position, radius = 1.5 }) {
    super(game, {
      position: position.clone().setY(0.03), type: 'cash', cols: 3, rows: 2, max: 9999,
      spacing: [0.54, 0.32], layerHeight: 0.11,
    });
    this.radius = radius;
    this.center = position.clone();
    this.queue = [];       // fajos pendientes de aparecer
    this.spawnTimer = 0;
    this.collectTimer = 0;
    this.streak = 0;       // sube el tono de las monedas mientras se junta

    // Base oscura con borde cian
    this.base = new GroundDecal(2.1, (ctx, W, H) => {
      roundRect(ctx, 16, 40, W - 32, H - 80, 26);
      ctx.fillStyle = 'rgba(40, 52, 66, 0.55)';
      ctx.fill();
      ctx.lineWidth = 9;
      ctx.strokeStyle = '#3fd8ff';
      ctx.stroke();
    });
    this.base.mesh.position.set(position.x, 0.062, position.z);
    game.scene.add(this.base.mesh);
  }

  /** Reparte `amount` en varios fajos que vuelan desde `from` hasta la pila. */
  addMoney(amount, from) {
    amount = Math.round(amount);
    if (amount <= 0) return;
    const n = Math.min(Math.max(1, Math.ceil(amount / 4)), 24);
    const base = Math.floor(amount / n);
    let rem = amount - base * n;
    for (let k = 0; k < n; k++) {
      this.queue.push({ value: base + (rem > 0 ? 1 : 0), from: from.clone() });
      rem--;
    }
  }

  update(dt) {
    super.update(dt);

    // Aparición escalonada de fajos
    this.spawnTimer -= dt;
    while (this.queue.length && this.spawnTimer <= 0) {
      this.spawnTimer += 0.035;
      const q = this.queue.shift();
      const mesh = createItem('cash');
      mesh.position.copy(q.from);
      // Tope visual: pasados VISIBLE_MAX fajos, la plata se suma a los que ya están (no crece la torre,
      // que con miles de billetes sin juntar era lo más pesado de dibujar). El valor no se pierde.
      const top = this.items.length >= VISIBLE_MAX ? this.items[(this.bump = ((this.bump ?? 0) + 1) % this.items.length)] : null;
      if (top) {
        top.value = (top.value ?? 0) + q.value;
        this.game.scene.add(mesh);
        this.game.fx.fly(mesh, (out) => this.root.localToWorld(this.slot(this.items.length - 1, out)), {
          duration: 0.35, arc: 1.5, onDone: (m) => m.removeFromParent(),
        });
        continue;
      }
      const e = this.receive('cash', mesh, { duration: 0.35, arc: 1.5 });
      e.value = q.value;
    }
    if (this.spawnTimer < 0) this.spawnTimer = 0;

    // Recolección: sólo Mela junta plata
    const p = this.game.player.position;
    const dx = p.x - this.center.x;
    const dz = p.z - this.center.z;
    if (dx * dx + dz * dz < this.radius * this.radius) {
      this.collectTimer -= dt;
      while (this.collectTimer <= 0) {
        const e = this.give();
        if (!e) { this.collectTimer = 0; break; }
        this.collectTimer += 0.03;
        this.game.fx.fly(e.mesh, (out) => out.copy(p).setY(1.1), {
          duration: 0.22,
          arc: 0.8,
          onDone: (m) => {
            m.removeFromParent();
            this.game.addMoney(e.value);
            this.game.emit('earn', { amount: e.value });
            this.game.audio.play('coin', { pitch: 1 + Math.min(this.streak++, 40) * 0.012 });
          },
        });
      }
    } else {
      this.collectTimer = 0;
      this.streak = 0;
    }
  }
}
