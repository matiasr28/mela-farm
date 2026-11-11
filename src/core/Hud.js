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

  /**
   * Botón 💋: visible sólo mientras Matías pide un beso (con cuenta regresiva).
   * También responde a la tecla K en PC.
   */
  showKiss(show, onTap = null, seconds = 0) {
    if (!this.kissBtn) {
      this.kissBtn = document.getElementById('kiss-btn');
      this.kissTime = document.getElementById('kiss-time');
      const fire = (e) => { e?.stopPropagation(); if (this.kissShown) this.onKiss?.(); };
      this.kissBtn?.addEventListener('pointerdown', (e) => e.stopPropagation());
      this.kissBtn?.addEventListener('click', fire);
      window.addEventListener('keydown', (e) => { if (e.code === 'KeyK') fire(); });
    }
    this.kissShown = show;
    this.onKiss = onTap;
    this.kissBtn?.classList.toggle('show', show);
    if (show && this.kissTime) this.kissTime.textContent = `${Math.ceil(seconds)}s`;
  }

  /** Chips de boosts activos (⚡ turbo / 🏷️ promo / 💕 enamorada) con cuenta regresiva. */
  setBoosts(speed, sales, love = 0, pena = 0, fiesta = 0, horse = 0) {
    this.boostEl ??= document.getElementById('boosts');
    if (!this.boostEl) return;
    const parts = [];
    if (love > 0) parts.push(`💕 Enamorada ${Math.ceil(love)}s`);
    if (speed > 0) parts.push(`⚡ ${Math.ceil(speed)}s`);
    if (sales > 0) parts.push(`🏷️ +25% ${Math.ceil(sales)}s`);
    if (horse > 0) parts.push(`🐎 ${Math.ceil(horse)}s`);
    if (pena > 0) parts.push(`🎻 Peña ${Math.ceil(pena)}s`);
    if (fiesta > 0) parts.push(`🎆 Fiesta +50% ${Math.ceil(fiesta)}s`);
    const text = parts.join('  ');
    if (text !== this.lastBoost) {
      this.lastBoost = text;
      this.boostEl.textContent = text;
      this.boostEl.style.display = text ? 'block' : 'none';
    }
  }

  setFarm(level, mult) {
    this.farmText = mult > 1 ? `🏡 Granja ${level} · 💰 x${mult}` : `🏡 Granja ${level}`;
    this.paintBadge();
  }

  /** Momento del día (☀️ / 🌇 / 🌙 / 🌅) al lado de la granja. */
  setDayIcon(icon) {
    if (icon === this.dayIcon) return;
    this.dayIcon = icon;
    this.paintBadge();
  }

  paintBadge() {
    const el = document.getElementById('farm-badge');
    if (el) el.textContent = `${this.farmText ?? ''}${this.dayIcon ? ` · ${this.dayIcon}` : ''}`;
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
