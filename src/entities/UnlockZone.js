// UnlockZone: cuadro en el suelo con precio. Mientras el jugador está parado encima,
// su dinero se transfiere gradualmente (billetes volando) y la barra se llena.
// Al completarse, dispara onComplete() y desaparece con confeti.
import { GroundDecal, roundRect, strokeText, FONT } from '../core/Labels.js';
import { createItem } from '../models/Models.js';

export class UnlockZone {
  constructor(game, { position, price, label, icon, onComplete, size = 2.4, instant = false }) {
    this.game = game;
    this.position = position.clone();
    this.price = price;
    this.label = label;
    this.icon = icon;
    this.onComplete = onComplete;
    this.size = size;
    this.paid = 0;
    this.acc = 0;
    this.standTime = 0;
    this.billTimer = 0;
    this.done = false;

    this.decal = new GroundDecal(size, (ctx, W, H) => this.draw(ctx, W, H), 256);
    this.decal.mesh.position.set(position.x, 0.035, position.z);
    game.scene.add(this.decal.mesh);
    if (!instant) game.fx.popIn(this.decal.mesh);
    game.add(this);
  }

  get remaining() { return this.price - this.paid; }

  update(dt) {
    if (this.done) return;
    const p = this.game.player.position;
    const half = this.size / 2;
    const inside = !this.game.player.frozen && Math.abs(p.x - this.position.x) < half && Math.abs(p.z - this.position.z) < half;

    // Leve "respiración" para llamar la atención (después de la animación de aparición)
    this.age = (this.age ?? 0) + dt;
    if (this.age > 0.5) {
      const s = 1 + Math.sin(this.game.time * 3) * (inside ? 0.04 : 0.015);
      this.decal.mesh.scale.set(s, s, 1);
    }

    // Si la zona aparece debajo del jugador, no cobra hasta que salga y vuelva a entrar
    if (this.armed === undefined) this.armed = !inside;
    if (!inside) { this.armed = true; this.standTime = 0; this.acc = 0; return; }
    if (!this.armed) return;
    this.standTime += dt;
    if (this.standTime < 0.3 || this.game.money <= 0) return;

    // Velocidad de pago: ~1.6 s para cualquier precio (mínimo 12/s)
    const rate = Math.max(this.price / 1.6, 12);
    this.acc += rate * dt;
    let amount = Math.floor(this.acc);
    if (amount < 1) return;
    this.acc -= amount;
    amount = Math.min(amount, this.game.money, this.remaining);
    this.game.spendMoney(amount);
    this.paid += amount;
    this.decal.redraw();
    this.game.audio.play('tick', { pitch: 0.8 + (this.paid / this.price) * 0.8 });

    // Billetes volando del jugador a la zona (puramente visual)
    this.billTimer -= dt;
    if (this.billTimer <= 0) {
      this.billTimer = 0.06;
      const bill = createItem('cash');
      bill.position.copy(p).setY(1.3);
      this.game.scene.add(bill);
      const dest = this.position.clone().setY(0.1);
      this.game.fx.fly(bill, (out) => out.copy(dest), { duration: 0.25, arc: 0.8, onDone: (m) => m.removeFromParent() });
    }

    if (this.paid >= this.price) this.complete();
  }

  complete() {
    this.done = true;
    this.game.fx.burst(this.position.clone().setY(0.5));
    this.game.audio.play('unlock');
    try { navigator.vibrate?.(60); } catch { /* sin vibración */ }
    this.game.fx.popOut(this.decal.mesh, () => this.decal.dispose());
    this.game.remove(this);
    this.onComplete?.();
  }

  /** Baldosa celeste "en relieve" con el precio grande; se llena de verde al pagar. */
  draw(ctx, W, H) {
    const pad = 12;
    const r = 42;
    const depth = 12;
    const w = W - 2 * pad;
    const h = H - 2 * pad - depth;
    const k = this.paid / this.price;

    // Canto (da sensación de bloque)
    roundRect(ctx, pad, pad + depth, w, h, r);
    ctx.fillStyle = '#1f86b8';
    ctx.fill();
    // Cara superior
    roundRect(ctx, pad, pad, w, h, r);
    ctx.fillStyle = '#3cc6f4';
    ctx.fill();

    // Progreso (de abajo hacia arriba)
    if (k > 0) {
      ctx.save();
      roundRect(ctx, pad, pad, w, h, r);
      ctx.clip();
      ctx.fillStyle = '#5ee07a';
      ctx.fillRect(pad, pad + h * (1 - k), w, h * k);
      ctx.restore();
    }

    // Brillo interior
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    roundRect(ctx, pad + 8, pad + 8, w - 16, h - 16, r - 8);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `52px ${FONT}`;
    ctx.fillText(this.icon, W / 2, pad + h * 0.2);
    // El precio también se achica si no entra (de 6 cifras en adelante)
    const price = String(this.remaining);
    let psize = 86;
    ctx.font = `900 ${psize}px ${FONT}`;
    while (psize > 40 && ctx.measureText(price).width > w - 30) ctx.font = `900 ${--psize}px ${FONT}`;
    strokeText(ctx, price, W / 2, pad + h * 0.53, { size: psize, fill: '#ffffff', stroke: '#1a6d96' });
    // Los textos largos se achican para entrar en la baldosa
    let size = 26;
    ctx.font = `900 ${size}px ${FONT}`;
    while (size > 16 && ctx.measureText(this.label).width > w - 34) ctx.font = `900 ${--size}px ${FONT}`;
    strokeText(ctx, this.label, W / 2, pad + h * 0.85, { size, fill: '#ffffff', stroke: '#1a6d96' });
  }
}

