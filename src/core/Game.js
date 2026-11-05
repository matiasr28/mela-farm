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

export const IS_TOUCH = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

export class Game {
  constructor(container) {
    // ---------- Renderer (más liviano en celulares) ----------
    this.renderer = new THREE.WebGLRenderer({ antialias: !IS_TOUCH || window.devicePixelRatio < 2, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_TOUCH ? 1.75 : 2));
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
    this.scene.add(new THREE.HemisphereLight('#fffaf0', '#b08850', 1.7));
    this.sun = new THREE.DirectionalLight('#fff0d6', 2.3);
    this.sun.castShadow = true;
    const sm = IS_TOUCH ? 1024 : 2048;
    this.sun.shadow.mapSize.set(sm, sm);
    const sc = this.sun.shadow.camera;
    sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 70;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 3;
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

  /** Bus de eventos simple (harvest, produce, sell, truck, earn, unlock) → misiones. */
  emit(name, data) {
    this.missions?.onEvent(name, data);
  }

  /** Pantalla de "¡Nueva granja!" tras el prestigio; recarga con la granja nueva. */
  showLevelUp(level) {
    this.audio.play('levelup');
    this.fx.burst(this.player.position.clone().setY(1.5), 60);
    const mult = 1 + 0.5 * (level - 1);
    const extra = level === 2 ? '<li>🎃 Zapallar, 🍯 Dulcería y 🎂 Pastelería</li>' : '<li>✨ Mejoras con más niveles</li>';
    const el = document.createElement('div');
    el.id = 'levelup';
    el.innerHTML = `
      <div class="lv-card">
        <div class="lv-title">¡Nueva granja!</div>
        <div class="lv-farm">🏡 Granja ${level}</div>
        <ul>
          <li>💰 Ingresos <b>x${mult}</b></li>
          ${extra}
          <li>📋 Las misiones siguen</li>
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
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;

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
    this.updateCamera(dt);

    this.saveTimer -= dt;
    if (this.saveTimer <= 0) { this.saveTimer = 3; this.world.save(); }

    this.renderer.render(this.scene, this.camera);
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
    this.sun.position.set(this.focus.x + 10, 22, this.focus.z + 6);
    this.sun.target.position.set(this.focus.x, 0, this.focus.z);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
