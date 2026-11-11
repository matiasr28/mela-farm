// Game: dueño del renderer, la escena, la cámara, el audio y el loop principal.
// Todas las entidades se registran con game.add(obj) y reciben update(dt) cada frame.
import * as THREE from 'three';
import { Fx } from './Fx.js';
import { Input } from './Input.js';
import { Hud } from './Hud.js';
import { SaveSystem } from './Save.js';
import { AudioEngine } from './Audio.js';
import { World } from '../world/World.js';
import { Missions } from '../systems/Missions.js';
import { Chatter } from '../systems/Chatter.js';
import { CONFIG } from '../config.js';

/** Duración de un día completo en segundos de juego. */
const DAY_LENGTH = 480;
const _c1 = new THREE.Color();
const _c2 = new THREE.Color();
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
/** Momentos del día (t = fracción del ciclo). Entre uno y otro se mezcla suave. */
const DAY_KEYS = [
  { t: 0.0, icon: '☀️', sky: '#8fd6f5', hemi: '#fffaf0', ground: '#b08850', hemiI: 1.7, sun: '#fff0d6', sunI: 2.3, dir: V3(10, 22, 6) },
  { t: 0.45, icon: '☀️', sky: '#8fd6f5', hemi: '#fffaf0', ground: '#b08850', hemiI: 1.7, sun: '#fff0d6', sunI: 2.3, dir: V3(10, 22, 6) },
  { t: 0.55, icon: '🌇', sky: '#f4a46a', hemi: '#ffd2a8', ground: '#8a5a3a', hemiI: 1.35, sun: '#ff9a55', sunI: 1.9, dir: V3(20, 9, 4) },
  { t: 0.66, icon: '🌇', sky: '#e98a6a', hemi: '#ffc9a8', ground: '#7a4e3a', hemiI: 1.2, sun: '#ff8a50', sunI: 1.6, dir: V3(22, 7, 2) },
  { t: 0.74, icon: '🌙', sky: '#1d2a55', hemi: '#8796d6', ground: '#2e2c48', hemiI: 0.85, sun: '#a9b8ff', sunI: 0.6, dir: V3(-8, 20, 8) },
  { t: 0.9, icon: '🌙', sky: '#1d2a55', hemi: '#8796d6', ground: '#2e2c48', hemiI: 0.85, sun: '#a9b8ff', sunI: 0.6, dir: V3(-8, 20, 8) },
  { t: 0.96, icon: '🌅', sky: '#f2b8c6', hemi: '#ffe0e8', ground: '#a07a60', hemiI: 1.3, sun: '#ffc0a0', sunI: 1.6, dir: V3(-18, 10, 6) },
  { t: 1.0, icon: '☀️', sky: '#8fd6f5', hemi: '#fffaf0', ground: '#b08850', hemiI: 1.7, sun: '#fff0d6', sunI: 2.3, dir: V3(10, 22, 6) },
];

export const IS_TOUCH = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

export class Game {
  constructor(container) {
    // ---------- Renderer (más liviano en celulares) ----------
    this.renderer = new THREE.WebGLRenderer({ antialias: !IS_TOUCH || window.devicePixelRatio < 2, powerPreference: 'high-performance' });
    // Resolución adaptativa: arranca en la máxima y baja de a poco si la compu no llega (ver frame())
    this.maxPixelRatio = Math.min(window.devicePixelRatio, IS_TOUCH ? 1.75 : 2);
    this.pixelRatio = this.maxPixelRatio;
    this.frameMs = 16;
    this.prTimer = 0;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // ---------- Escena ----------
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#8fd6f5');
    this.scene.fog = new THREE.Fog('#8fd6f5', 45, 85);

    // ---------- Cámara isométrica (perspectiva con FOV bajo) ----------
    this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 200);
    this.cameraOffset = new THREE.Vector3(0, 16, 12);
    this.focus = new THREE.Vector3();

    // ---------- Luces cálidas ----------
    this.hemi = new THREE.HemisphereLight('#fffaf0', '#b08850', 1.7);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff0d6', 2.3);
    this.sun.castShadow = true;
    const sm = IS_TOUCH ? 1024 : 2048;
    this.sun.shadow.mapSize.set(sm, sm);
    const sc = this.sun.shadow.camera;
    sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 70;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 3;
    this.sunOffset = new THREE.Vector3(10, 22, 6); // dirección del sol (cambia con la hora)
    this.scene.add(this.sun, this.sun.target);

    // ---------- Sistemas ----------
    this.fx = new Fx(this.scene);
    this.input = new Input(this.renderer.domElement);
    this.hud = new Hud();
    this.audio = new AudioEngine(this);
    this.saveSystem = new SaveSystem(CONFIG.saveKey);

    // ---------- Estado compartido ----------
    this.money = 0;
    this.time = 0;
    this.updatables = [];   // objetos con update(dt)
    this.carriers = [];     // jugador + trabajadores (todo lo que transporta una pila)
    this.obstacles = [];    // AABBs {minX,maxX,minZ,maxZ} para colisiones del jugador
    this.flags = {};        // banderas de progreso (ej: flags.milk)
    this._dirty = false;
    this.saveTimer = 3;
    this.clock = new THREE.Clock();

    // ---------- Mundo ----------
    const saved = this.saveSystem.load();
    this.money = saved?.money ?? CONFIG.startMoney;
    this.incomeMult = 1;
    this.world = new World(this, saved);
    this.player = this.world.player;
    this.missions = new Missions(this, saved?.missions);
    this.chatter = new Chatter(this);
    this.hud.setMoney(this.money, true);
    this.hud.setFarm(this.world.farmLevel, this.incomeMult);
    this.updateCamera(0, true);

    this.setupUi();
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.onResize(), 200));
    window.addEventListener('pagehide', () => this.world.save());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.world.save(); });
  }

  setupUi() {
    // Evita gestos del navegador (zoom con dos dedos, menú contextual, doble tap)
    for (const ev of ['gesturestart', 'gesturechange', 'contextmenu']) {
      document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
    }
    document.addEventListener('dblclick', (e) => e.preventDefault());

    // El audio se habilita con cualquier toque (requisito de los navegadores móviles)
    window.addEventListener('pointerdown', () => this.audio.unlock());

    const hintText = IS_TOUCH ? 'Deslizá el dedo para mover a Mela' : 'Arrastrá con el mouse o usá WASD';
    this.hud.setHint(`${hintText}<br><small>🌽 Cosechá → 🐔 alimentá → 🥚 vendé</small>`);
    const sh = document.getElementById('splash-hint');
    if (sh) sh.textContent = IS_TOUCH ? '🎧 Mejor con sonido' : '🎧 Mejor con sonido · WASD o mouse';

    const splash = document.getElementById('splash');
    document.getElementById('play-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.audio.unlock();
      this.audio.play('unlock');
      splash?.classList.add('hidden');
      setTimeout(() => splash?.remove(), 500);
      setTimeout(() => this.chatter.playerSays('start'), 900);
    });

    const soundBtn = document.getElementById('sound-btn');
    const paintSound = () => { if (soundBtn) soundBtn.textContent = this.audio.muted ? '🔇' : '🔊'; };
    paintSound();
    soundBtn?.addEventListener('pointerdown', (e) => e.stopPropagation());
    soundBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.audio.unlock();
      this.audio.toggle();
      paintSound();
    });

    const resetBtn = document.getElementById('reset-btn');
    resetBtn?.addEventListener('pointerdown', (e) => e.stopPropagation());
    resetBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('¿Reiniciar la granja de Mela? Se perderá el progreso.')) {
        this.saveSystem.clear();
        this.world.resetting = true;
        location.reload();
      }
    });
  }

  // ---------- Registro de entidades ----------
  add(obj) { this.updatables.push(obj); return obj; }
  remove(obj) { obj._removed = true; this._dirty = true; }

  // ---------- Boosts temporales (ayudas de Matías) ----------
  addBoost(kind, seconds) {
    this.boosts ??= {};
    this.boosts[kind] = Math.max(this.boosts[kind] ?? 0, this.time) + seconds;
  }
  boostLeft(kind) { return Math.max(0, (this.boosts?.[kind] ?? 0) - this.time); }
  /** Multiplicador de velocidad de Mela (⚡ turbo). */
  speedMult() {
    return (this.boostLeft('speed') > 0 ? 1.35 : 1) * (this.boostLeft('love') > 0 ? 1.25 : 1);
  }
  /** Multiplicador de lo que pagan clientes y camión: granja × Contabilidad × 🏷️ promo × 💕 enamorada × 🎆 fiesta. */
  saleMult() {
    const acc = 1 + 0.05 * (this.world.upgrades?.accounting ?? 0);
    return this.incomeMult * acc * (this.boostLeft('sales') > 0 ? 1.25 : 1) * (this.boostLeft('love') > 0 ? 1.3 : 1)
      * (this.boostLeft('fiesta') > 0 ? 1.5 : 1);
  }
  /** Cuántos clientes llegan a las tiendas: 🎻 peña (×2) y 🌳 plaza del pueblo (×1,3). */
  shopSpawnMult() {
    return (this.boostLeft('pena') > 0 ? 2 : 1) * (this.world.plazaOn ? 1.3 : 1);
  }

  /** Bus de eventos simple (harvest, produce, sell, truck, earn, unlock) → misiones. */
  emit(name, data) {
    this.missions?.onEvent(name, data);
  }

  /** Pantalla de "¡Nueva granja!" tras el prestigio; recarga con la granja nueva. */
  showLevelUp(level, newItems = [], nextMult = null) {
    this.audio.play('levelup');
    this.fx.burst(this.player.position.clone().setY(1.5), 60);
    const mult = Math.round((nextMult ?? this.incomeMult + 0.5) * 100) / 100;
    const extra = newItems.map((t) => `<li>✨ ${t}</li>`).join('');
    const el = document.createElement('div');
    el.id = 'levelup';
    el.innerHTML = `
      <div class="lv-card">
        <div class="lv-title">¡Nueva granja!</div>
        <div class="lv-farm">🏡 Granja ${level}</div>
        <ul>
          <li>💰 Ingresos <b>x${mult}</b></li>
          <li>🎒 Conservás todo: construcciones, empleados, mejoras y plata</li>
          ${extra}
          <li>🔓 Mejoras con +2 niveles de tope</li>
        </ul>
        <button id="lv-go">¡A trabajar!</button>
      </div>`;
    document.body.appendChild(el);
    const go = el.querySelector('#lv-go');
    go.addEventListener('pointerdown', (e) => e.stopPropagation());
    go.addEventListener('click', () => location.reload());
  }

  // ---------- Economía ----------
  addMoney(n) {
    this.money += n;
    this.hud.setMoney(this.money);
    this.hud.bump();
  }
  spendMoney(n) {
    this.money = Math.max(0, this.money - n);
    this.hud.setMoney(this.money, true);
  }

  // ---------- Loop ----------
  start() {
    document.getElementById('loading')?.remove();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  frame() {
    const raw = this.clock.getDelta();
    const dt = Math.min(raw, 0.05);
    this.time += dt;
    this.adaptResolution(raw);

    // Los objetos agregados durante el loop se actualizan en el mismo frame.
    for (let i = 0; i < this.updatables.length; i++) {
      const u = this.updatables[i];
      if (!u._removed) u.update(dt);
    }
    if (this._dirty) {
      this.updatables = this.updatables.filter((u) => !u._removed);
      this._dirty = false;
    }

    this.fx.update(dt);
    this.hud.update(dt);
    this.hud.setBoosts(this.boostLeft('speed'), this.boostLeft('sales'), this.boostLeft('love'), this.boostLeft('pena'), this.boostLeft('fiesta'), this.boostLeft('horse'));
    this.updateDayCycle();
    this.updateCamera(dt);

    this.saveTimer -= dt;
    if (this.saveTimer <= 0) { this.saveTimer = 3; this.world.save(); }

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Si los cuadros tardan (menos de ~38 fps) baja la resolución interna de a 0,25 hasta 1;
   * si anda fluido, la vuelve a subir. Así los equipos lentos juegan sin tirones.
   */
  adaptResolution(raw) {
    if (raw > 0.25) return; // pestaña oculta o pausa: no cuenta
    this.frameMs += (raw * 1000 - this.frameMs) * 0.05;
    this.prTimer += raw;
    if (this.prTimer < 2) return;
    this.prTimer = 0;
    let pr = this.pixelRatio;
    if (this.frameMs > 26 && pr > 1) pr = Math.max(1, pr - 0.25);
    else if (this.frameMs < 18 && pr < this.maxPixelRatio) pr = Math.min(this.maxPixelRatio, pr + 0.25);
    if (pr !== this.pixelRatio) {
      this.pixelRatio = pr;
      this.renderer.setPixelRatio(pr);
    }
  }

  /**
   * Ciclo del día (DAY_LENGTH segundos): día → tarde → noche → amanecer → día.
   * Cambia el cielo, la niebla, la luz ambiente y el sol (color, fuerza y ángulo).
   */
  updateDayCycle() {
    const t = (this.time / DAY_LENGTH) % 1;
    let a = DAY_KEYS[DAY_KEYS.length - 1];
    let b = DAY_KEYS[0];
    for (let i = 0; i < DAY_KEYS.length - 1; i++) {
      if (t >= DAY_KEYS[i].t && t < DAY_KEYS[i + 1].t) { a = DAY_KEYS[i]; b = DAY_KEYS[i + 1]; break; }
    }
    const span = b.t - a.t;
    const u = span > 0 ? (t - a.t) / span : 0;
    const k = u * u * (3 - 2 * u); // transición suave
    const mix = (key) => _c1.set(a[key]).lerp(_c2.set(b[key]), k);
    this.scene.background.copy(mix('sky'));
    this.scene.fog.color.copy(this.scene.background);
    this.hemi.color.copy(mix('hemi'));
    this.hemi.groundColor.copy(mix('ground'));
    this.hemi.intensity = a.hemiI + (b.hemiI - a.hemiI) * k;
    this.sun.color.copy(mix('sun'));
    this.sun.intensity = a.sunI + (b.sunI - a.sunI) * k;
    this.sunOffset.lerpVectors(a.dir, b.dir, k);
    this.hud.setDayIcon(k < 0.5 ? a.icon : b.icon);
  }

  /** Cámara que sigue al jugador suavemente; también mueve el sol para sombras nítidas. */
  updateCamera(dt, snap = false) {
    const p = this.player.position;
    const k = snap ? 1 : 1 - Math.exp(-dt * 5);
    this.focus.x += (p.x - this.focus.x) * k;
    this.focus.z += (p.z - this.focus.z) * k;
    // En vertical (celular) alejamos la cámara para ver más alrededor
    const a = this.camera.aspect;
    const zoom = a < 0.65 ? 1.55 : a < 1 ? 1.3 : 1;
    const o = this.cameraOffset;
    this.camera.position.set(this.focus.x + o.x * zoom, o.y * zoom, this.focus.z + o.z * zoom);
    this.camera.lookAt(this.focus.x, 0.8, this.focus.z);
    const so = this.sunOffset;
    this.sun.position.set(this.focus.x + so.x, so.y, this.focus.z + so.z);
    this.sun.target.position.set(this.focus.x, 0, this.focus.z);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
