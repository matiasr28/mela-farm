// Hud: contador de dinero animado y pista inicial.
export class Hud {
  constructor() {
    this.moneyEl = document.getElementById('money-value');
    this.pill = document.getElementById('money');
    this.hint = document.getElementById('hint');
    this.displayed = 0;
    this.target = 0;
  }

  setHint(html) { if (this.hint) this.hint.innerHTML = html; }

  setFarm(level, mult) {
    const el = document.getElementById('farm-badge');
    if (el) el.textContent = mult > 1 ? `🏡 Granja ${level} · 💰 x${mult}` : `🏡 Granja ${level}`;
  }

  setMoney(v, instant = false) {
    this.target = v;
    if (instant) { this.displayed = v; this.render(); }
  }

  bump() {
    if (!this.pill) return;
    this.pill.classList.remove('bump');
    void this.pill.offsetWidth; // reinicia la animación CSS
    this.pill.classList.add('bump');
  }

  hideHint() {
    if (this.hint) setTimeout(() => this.hint.classList.add('hidden'), 4000);
  }

  update(dt) {
    if (this.displayed === this.target) return;
    const diff = this.target - this.displayed;
    const step = Math.sign(diff) * Math.max(1, Math.ceil(Math.abs(diff) * dt * 10));
    this.displayed = Math.abs(step) >= Math.abs(diff) ? this.target : this.displayed + step;
    this.render();
  }

  render() {
    if (this.moneyEl) this.moneyEl.textContent = Math.round(this.displayed).toLocaleString('es-AR');
  }
}
