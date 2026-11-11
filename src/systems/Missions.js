// Missions: objetivos cortos con recompensa ("Vendé 10 🥚", "Completá 2 pedidos 🚚"...).
// Escuchan los eventos del juego (game.emit) y se muestran en una tarjeta arriba a la izquierda.
// Sólo se proponen misiones de cosas que la granja ya puede hacer (según game.flags).
import { ITEMS } from '../models/Models.js';
import { pick } from '../utils.js';

const TEMPLATES = [
  { kind: 'harvest', type: 'corn', base: 20 },
  { kind: 'harvest', type: 'wheat', base: 20, flags: ['wheat'] },
  { kind: 'harvest', type: 'pumpkin', base: 15, flags: ['pumpkin'] },
  { kind: 'produce', type: 'egg', base: 15 },
  { kind: 'produce', type: 'milk', base: 10, flags: ['milk'] },
  { kind: 'produce', type: 'bread', base: 10, flags: ['bread'] },
  { kind: 'produce', type: 'jam', base: 8, flags: ['jam'] },
  { kind: 'produce', type: 'cake', base: 5, flags: ['cake'] },
  { kind: 'sell', type: 'egg', base: 10 },
  { kind: 'sell', type: 'milk', base: 6, flags: ['milk'] },
  { kind: 'sell', type: 'bread', base: 6, flags: ['bread', 'shop2'] },
  { kind: 'sell', type: 'jam', base: 4, flags: ['jam', 'shop2'] },
  { kind: 'sell', type: 'cake', base: 3, flags: ['cake', 'shop2'] },
  { kind: 'harvest', type: 'strawberry', base: 15, flags: ['strawberry'] },
  { kind: 'harvest', type: 'apple', base: 15, flags: ['apple'] },
  { kind: 'produce', type: 'wool', base: 10, flags: ['wool'] },
  { kind: 'produce', type: 'scarf', base: 5, flags: ['scarf'] },
  { kind: 'produce', type: 'icecream', base: 5, flags: ['icecream'] },
  { kind: 'produce', type: 'juice', base: 6, flags: ['juice'] },
  { kind: 'sell', type: 'scarf', base: 3, flags: ['scarf', 'shop3'] },
  { kind: 'sell', type: 'icecream', base: 3, flags: ['icecream', 'shop3'] },
  { kind: 'sell', type: 'juice', base: 4, flags: ['juice', 'shop3'] },
  { kind: 'harvest', type: 'sunflower', base: 15, flags: ['sunflower'] },
  { kind: 'produce', type: 'oil', base: 6, flags: ['oil'] },
  { kind: 'produce', type: 'flour', base: 8, flags: ['flour'] },
  { kind: 'produce', type: 'croissant', base: 4, flags: ['croissant'] },
  { kind: 'sell', type: 'oil', base: 4, flags: ['oil', 'shop4'] },
  { kind: 'sell', type: 'croissant', base: 3, flags: ['croissant', 'shop4'] },
  { kind: 'harvest', type: 'grass', base: 15, flags: ['grass'] },
  { kind: 'produce', type: 'goatmilk', base: 10, flags: ['goatmilk'] },
  { kind: 'produce', type: 'cheese', base: 5, flags: ['cheese'] },
  { kind: 'produce', type: 'pizza', base: 3, flags: ['pizza'] },
  { kind: 'sell', type: 'cheese', base: 4, flags: ['cheese', 'shop5'] },
  { kind: 'sell', type: 'pizza', base: 2, flags: ['pizza', 'shop5'] },
  { kind: 'harvest', type: 'flower', base: 15, flags: ['flower'] },
  { kind: 'produce', type: 'honey', base: 8, flags: ['honey'] },
  { kind: 'produce', type: 'alfajor', base: 4, flags: ['alfajor'] },
  { kind: 'sell', type: 'honey', base: 4, flags: ['honey', 'shop6'] },
  { kind: 'sell', type: 'alfajor', base: 3, flags: ['alfajor', 'shop6'] },
  { kind: 'harvest', type: 'fish', base: 12, flags: ['fish'] },
  { kind: 'produce', type: 'friedfish', base: 5, flags: ['friedfish'] },
  { kind: 'produce', type: 'empanada', base: 6, flags: ['empanada'] },
  { kind: 'sell', type: 'friedfish', base: 3, flags: ['friedfish', 'shop7'] },
  { kind: 'sell', type: 'empanada', base: 4, flags: ['empanada', 'shop7'] },
  { kind: 'sell', type: 'breakfast', base: 3, flags: ['restaurant'] },
  { kind: 'sell', type: 'sandwich', base: 3, flags: ['restaurant'] },
  { kind: 'sell', type: 'stew', base: 3, flags: ['restaurant'] },
  { kind: 'sell', type: 'dessert', base: 3, flags: ['restaurant'] },
  // Granjas 11 a 20
  { kind: 'harvest', type: 'yerba', base: 15, flags: ['yerba'] },
  { kind: 'produce', type: 'mate', base: 6, flags: ['mate'] },
  { kind: 'sell', type: 'mate', base: 4, flags: ['mate', 'shop8'] },
  { kind: 'harvest', type: 'cane', base: 15, flags: ['cane'] },
  { kind: 'produce', type: 'sugar', base: 6, flags: ['sugar'] },
  { kind: 'produce', type: 'dulce', base: 4, flags: ['dulce'] },
  { kind: 'sell', type: 'dulce', base: 3, flags: ['dulce', 'shop8'] },
  { kind: 'harvest', type: 'tomato', base: 15, flags: ['tomato'] },
  { kind: 'produce', type: 'pasta', base: 5, flags: ['pasta'] },
  { kind: 'sell', type: 'tallarines', base: 3, flags: ['pasta', 'tomato', 'restaurant'] },
  { kind: 'produce', type: 'beef', base: 8, flags: ['beef'] },
  { kind: 'produce', type: 'chorizo', base: 5, flags: ['chorizo'] },
  { kind: 'produce', type: 'choripan', base: 4, flags: ['choripan'] },
  { kind: 'sell', type: 'choripan', base: 3, flags: ['choripan', 'shop9'] },
  { kind: 'sell', type: 'asado', base: 3, flags: ['beef', 'tomato', 'restaurant'] },
  { kind: 'harvest', type: 'cotton', base: 15, flags: ['cotton'] },
  { kind: 'produce', type: 'sheets', base: 5, flags: ['sheets'] },
  { kind: 'harvest', type: 'log', base: 12, flags: ['log'] },
  { kind: 'produce', type: 'plank', base: 6, flags: ['plank'] },
  { kind: 'produce', type: 'chair', base: 3, flags: ['chair'] },
  { kind: 'harvest', type: 'grape', base: 15, flags: ['grape'] },
  { kind: 'produce', type: 'wine', base: 4, flags: ['wine'] },
  { kind: 'sell', type: 'wine', base: 3, flags: ['wine', 'shop10'] },
  { kind: 'harvest', type: 'peanut', base: 15, flags: ['peanut'] },
  { kind: 'produce', type: 'chocolate', base: 4, flags: ['chocolate'] },
  { kind: 'sell', type: 'chocolate', base: 3, flags: ['chocolate', 'shop11'] },
  { kind: 'sell', type: 'chocotorta', base: 2, flags: ['chocolate', 'dulce', 'restaurant'] },
  { kind: 'truck', base: 2, flags: ['truck'] },
  { kind: 'earn', base: 120 },
  { kind: 'unlock', base: 2 },
];

const niceRound = (v) => (v < 100 ? Math.round(v / 5) * 5 : v < 1000 ? Math.round(v / 10) * 10 : Math.round(v / 50) * 50);

export class Missions {
  constructor(game, saved) {
    this.game = game;
    this.done = saved?.done ?? 0;
    this.current = saved?.current ?? null;
    this.el = document.getElementById('mission');
    this.render();
    if (!this.current) this.next();
  }

  serialize() { return { done: this.done, current: this.current }; }

  available() {
    const f = this.game.flags;
    return TEMPLATES.filter((t) => !t.flags || t.flags.every((x) => f[x]));
  }

  next() {
    const last = this.current;
    const pool = this.available().filter((t) => !last || t.kind !== last.kind || t.type !== last.type);
    const t = pick(pool);
    const scale = 1 + this.done * 0.2;
    const n = Math.min(t.base * 6, Math.max(1, Math.round(t.base * scale)));
    let per;
    switch (t.kind) {
      case 'harvest': per = 2.5; break;
      case 'produce': per = ITEMS[t.type].price * 1.2; break;
      case 'sell': per = ITEMS[t.type].price * 2; break;
      case 'truck': per = 40; break;
      case 'earn': per = 0.4; break;
      default: per = 50;
    }
    const reward = Math.max(20, niceRound(n * per * (1 + this.done * 0.08) * this.game.incomeMult));
    this.current = { kind: t.kind, type: t.type ?? null, n, progress: 0, reward };
    this.render();
  }

  /** Recibe eventos del juego: harvest/produce/sell/truck/earn/unlock. */
  onEvent(name, data = {}) {
    const m = this.current;
    if (!m || m.progress >= m.n || m.kind !== name) return;
    if (m.type && data.type !== m.type) return;
    const inc = name === 'sell' ? data.n ?? 1 : name === 'earn' ? data.amount ?? 0 : 1;
    m.progress = Math.min(m.n, m.progress + inc);
    this.render();
    if (m.progress >= m.n) {
      this.game.audio.play('happy');
      this.el?.classList.add('ready');
    }
  }

  claim() {
    const m = this.current;
    if (!m || m.progress < m.n) return;
    const g = this.game;
    g.addMoney(m.reward);
    g.audio.play('mission');
    g.fx.burst(g.player.position.clone().setY(1.5));
    g.fx.floatText(`+$${m.reward}`, g.player.position.clone().setY(2.8), '#ffe066');
    g.chatter?.playerSays('mission');
    try { navigator.vibrate?.(40); } catch { /* sin vibración */ }
    this.done++;
    this.current = null;
    this.el?.classList.remove('ready');
    this.next();
    g.world.save();
  }

  text(m) {
    const e = m.type ? ITEMS[m.type].emoji : '';
    switch (m.kind) {
      case 'harvest': return `Cosechá ${m.n} ${e}`;
      case 'produce': return `Producí ${m.n} ${e}`;
      case 'sell': return `Vendé ${m.n} ${e}`;
      case 'truck': return `Completá ${m.n} pedidos 🚚`;
      case 'earn': return `Juntá $${m.n}`;
      default: return `Comprá ${m.n} mejoras ✨`;
    }
  }

  render() {
    const el = this.el;
    const m = this.current;
    if (!el || !m) return;
    if (!this.built) {
      el.innerHTML = `
        <div class="m-head">📋 Misión <span class="m-num"></span></div>
        <div class="m-text"></div>
        <div class="m-bar"><div class="m-fill"></div><span class="m-count"></span></div>
        <button class="m-claim"></button>`;
      const btn = el.querySelector('.m-claim');
      btn.addEventListener('pointerdown', (e) => e.stopPropagation());
      btn.addEventListener('click', (e) => { e.stopPropagation(); this.claim(); });
      this.built = true;
    }
    const done = m.progress >= m.n;
    el.querySelector('.m-num').textContent = `#${this.done + 1}`;
    el.querySelector('.m-text').textContent = this.text(m);
    el.querySelector('.m-fill').style.width = `${(m.progress / m.n) * 100}%`;
    el.querySelector('.m-count').textContent = m.kind === 'earn' ? `$${m.progress}/${m.n}` : `${m.progress}/${m.n}`;
    const btn = el.querySelector('.m-claim');
    btn.textContent = done ? `¡Cobrar $${m.reward}!` : `Premio: $${m.reward}`;
    btn.disabled = !done;
    el.classList.toggle('ready', done);
  }
}
