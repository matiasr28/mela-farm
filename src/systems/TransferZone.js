// TransferZone: zona en el suelo donde un "carrier" (jugador o trabajador) deposita
// ítems de su pila en un sink (mode 'drop') o los recoge de una fuente (mode 'pickup').
//   sink   = { canAccept(type), receive(type, mesh) }   (Pile, Truck, Shop...)
//   source = { type, hasLanded(), give() }               (Pile)
import { GroundDecal, roundRect, FONT } from '../core/Labels.js';
import { CONFIG } from '../config.js';

export class TransferZone {
  constructor(game, {
    position, mode = 'drop', types = [], target, roles = ['player'],
    radius = 1.1, size = 2.0, interval = CONFIG.transferInterval, icon = null,
  }) {
    this.game = game;
    this.mode = mode;
    this.types = types;
    this.target = target;
    this.roles = roles;
    this.radius = radius;
    this.interval = interval;
    this.position = position.clone();
    this.enabled = true;
    this.timers = new Map();
    this.active = false;

    const color = '#3fd8ff';
    this.decal = new GroundDecal(size, (ctx, W, H, active) => {
      const p = 18;
      // Contorno cian discontinuo (relleno suave cuando hay alguien adentro)
      roundRect(ctx, p, p, W - 2 * p, H - 2 * p, 36);
      ctx.fillStyle = active ? 'rgba(63,216,255,0.35)' : 'rgba(63,216,255,0.08)';
      ctx.fill();
      ctx.setLineDash([34, 22]);
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.setLineDash([]);
      if (icon) {
        ctx.font = `100px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, W / 2, H / 2 + 6);
        return;
      }
      // Flecha: hacia abajo = dejar, hacia arriba = recoger
      ctx.save();
      ctx.translate(W / 2, H / 2);
      if (mode === 'pickup') ctx.rotate(Math.PI);
      ctx.beginPath();
      ctx.moveTo(-24, -52);
      ctx.lineTo(24, -52);
      ctx.lineTo(24, -2);
      ctx.lineTo(54, -2);
      ctx.lineTo(0, 54);
      ctx.lineTo(-54, -2);
      ctx.lineTo(-24, -2);
      ctx.closePath();
      ctx.lineJoin = 'round';
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    });
    this.decal.mesh.position.set(position.x, 0.025, position.z);
    game.scene.add(this.decal.mesh);
    game.add(this);
  }

  update(dt) {
    let present = false;
    if (this.enabled) {
      for (const c of this.game.carriers) {
        if (!this.roles.includes(c.role)) continue;
        const dx = c.position.x - this.position.x;
        const dz = c.position.z - this.position.z;
        if (dx * dx + dz * dz > this.radius * this.radius) { this.timers.delete(c); continue; }
        present = true;
        // El primer ítem sale apenas se entra a la zona
        let t = (this.timers.get(c) ?? this.interval) + dt;
        while (t >= this.interval) {
          if (!this.step(c)) { t = this.interval; break; }
          t -= this.interval;
        }
        this.timers.set(c, t);
      }
    }
    if (present !== this.active) {
      this.active = present;
      this.decal.redraw(present);
    }
    const s = present ? 1 + Math.sin(this.game.time * 10) * 0.03 : 1;
    this.decal.mesh.scale.set(s, s, 1);
    this.decal.mesh.visible = this.enabled;
  }

  /** Transfiere un ítem. Devuelve false si no hay nada para mover. */
  step(c) {
    if (this.mode === 'drop') {
      for (const type of this.types) {
        if (c.stack.countOf(type, true) > 0 && this.target.canAccept(type)) {
          const e = c.stack.take(type);
          this.target.receive(type, e.mesh);
          this.game.audio.play('drop', {
            pos: this.position, pitch: 0.85 + Math.random() * 0.3, volume: c.role === 'player' ? 1 : 0.5,
          });
          return true;
        }
      }
      return false;
    }
    const src = this.target;
    if (!src.hasLanded() || !c.stack.canAccept(src.type)) return false;
    const e = src.give();
    c.stack.receive(e.type, e.mesh);
    return true;
  }
}

