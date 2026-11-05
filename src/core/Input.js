// Input: joystick virtual flotante (táctil o mouse arrastrando) + teclado (WASD / flechas).
// getDirection() devuelve {x, y} en espacio de pantalla, magnitud 0..1 (y positivo = abajo).

export class Input {
  constructor(target) {
    this.keys = new Set();
    this.radius = 60;
    this.joy = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };

    // DOM del joystick
    this.base = document.createElement('div');
    this.base.className = 'joy-base';
    this.knob = document.createElement('div');
    this.knob.className = 'joy-knob';
    this.base.appendChild(this.knob);
    document.body.appendChild(this.base);

    target.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', (e) => this.onUp(e));
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.release(); });
  }

  onDown(e) {
    if (this.joy.active) return;
    e.preventDefault();
    this.joy = { active: true, id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 };
    this.base.style.left = `${e.clientX}px`;
    this.base.style.top = `${e.clientY}px`;
    this.base.style.display = 'block';
    this.knob.style.transform = 'translate(0px, 0px)';
  }

  onMove(e) {
    if (!this.joy.active || e.pointerId !== this.joy.id) return;
    let dx = e.clientX - this.joy.ox;
    let dy = e.clientY - this.joy.oy;
    const len = Math.hypot(dx, dy);
    if (len > this.radius) { dx *= this.radius / len; dy *= this.radius / len; }
    this.joy.x = dx / this.radius;
    this.joy.y = dy / this.radius;
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  onUp(e) {
    if (e.pointerId !== this.joy.id) return;
    this.release();
  }

  release() {
    this.joy.active = false;
    this.joy.id = null;
    this.joy.x = this.joy.y = 0;
    this.base.style.display = 'none';
  }

  getDirection() {
    let x = 0;
    let y = 0;
    if (this.joy.active) {
      const m = Math.hypot(this.joy.x, this.joy.y);
      if (m > 0.12) {
        // Respuesta casi "digital": arriba de un poco de inclinación corre a full.
        const s = Math.min(1, (m - 0.12) / 0.5) / m;
        x = this.joy.x * s;
        y = this.joy.y * s;
      }
    }
    const k = this.keys;
    let kx = 0;
    let ky = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) ky -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) ky += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) kx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) kx += 1;
    if (kx || ky) {
      const m = Math.hypot(kx, ky);
      x = kx / m;
      y = ky / m;
    }
    return { x, y };
  }
}
