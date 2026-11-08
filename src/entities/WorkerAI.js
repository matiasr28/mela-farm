// WorkerAI: ayudantes automáticos con máquina de estados simple.
//  - 'farmer'  : cosecha su campo hasta llenar la pila → lo lleva a su corral/taller.
//  - 'carrier' : junta productos de los pallets → repone las estanterías de su tienda.
//  - 'cashier' : se queda en la caja de su tienda atendiendo clientes.
//  - 'baker'   : abastece talleres de recetas mixtas (Facturería, Pastelería) desde pallets y campos.
// Las transferencias las hacen las propias zonas (TransferZone / ResourceNode):
// la IA sólo decide a dónde caminar y cuándo cambiar de estado.
import * as THREE from 'three';
import { Character } from './Character.js';
import { StackManager } from '../systems/StackManager.js';
import { CONFIG } from '../config.js';
import { lerpAngle, distXZ2 } from '../utils.js';

/** Looks y "voz" (tono del balbuceo) de cada empleado. */
export const LOOKS = {
  tito: { shirt: '#e8503f', overalls: '#3f6fb5', hair: '#6b3e26', hat: 'cap', hatColor: '#2f7de1', shoes: '#4a3020', voice: 0.75 },
  rosa: { shirt: '#ffffff', overalls: '#5a8f3c', hair: '#8b4a22', hairStyle: 'long', hat: 'straw', hatColor: '#f6d785', voice: 1.15 },
  lucho: { shirt: '#3fb6e8', pants: '#2b3a55', hair: '#1b1b1b', hat: 'cap', hatColor: '#ffb703', voice: 0.9 },
  pili: { shirt: '#e8503f', pants: '#2f5fa8', hair: '#d9541e', hairStyle: 'bun', skin: '#f6c8a0', voice: 1.25 },
  beto: { shirt: '#f4a261', overalls: '#7a5230', hair: '#cfcfcf', hat: 'straw', hatColor: '#e9c46a', voice: 0.65 },
  juana: { shirt: '#a29bfe', overalls: '#3f6fb5', hair: '#2b1d0e', hairStyle: 'ponytail', tie: '#ffd23f', voice: 1.2 },
  nico: { shirt: '#90be6d', pants: '#3d405b', hair: '#b5651d', hat: 'cap', hatColor: '#e8503f', voice: 0.95 },
  sol: { shirt: '#ffd23f', pants: '#264653', hair: '#111111', hairStyle: 'long', skin: '#c68642', voice: 1.3 },
  pancho: { shirt: '#5a8f3c', overalls: '#7a5230', hair: '#3d2b1f', hat: 'straw', hatColor: '#e9c46a', voice: 0.7 },
  lola: { shirt: '#ff8fab', pants: '#3d405b', hair: '#f7d55c', hairStyle: 'bun', voice: 1.3 },
  mateo: { shirt: '#ff9f1c', pants: '#2b3a55', hair: '#6b3e26', hat: 'cap', hatColor: '#3fa7e0', voice: 0.95 },
  ana: { shirt: '#e8304a', overalls: '#3f72c0', hair: '#b5651d', hairStyle: 'ponytail', tie: '#ffffff', voice: 1.2 },
  toto: { shirt: '#7bcc45', overalls: '#264653', hair: '#cfcfcf', hat: 'cap', hatColor: '#e2483d', voice: 0.8 },
  chela: { shirt: '#ffcc1a', overalls: '#5a8f3c', hair: '#3d2b1f', hairStyle: 'long', hat: 'straw', hatColor: '#f6d785', voice: 1.2 },
  facu: { shirt: '#4f86c6', overalls: '#7a5230', hair: '#d4a373', hat: 'cap', hatColor: '#ffcc1a', voice: 0.85 },
  mirta: { shirt: '#c77dff', pants: '#3d405b', hair: '#cfcfcf', hairStyle: 'bun', skin: '#f2c299', voice: 1.15 },
  rulo: { shirt: '#e76f51', pants: '#264653', hair: '#111111', voice: 1.0 },
  dora: { shirt: '#ffffff', pants: '#ff7aa2', hair: '#8b4a22', hairStyle: 'bun', hat: 'cap', hatColor: '#ff7aa2', voice: 1.25 },
  nina: { shirt: '#f4a261', overalls: '#5a8f3c', hair: '#111111', hairStyle: 'ponytail', hat: 'straw', hatColor: '#f6d785', skin: '#e0ac69', voice: 1.2 },
  coco: { shirt: '#2ec4b6', pants: '#3d405b', hair: '#6b3e26', hat: 'cap', hatColor: '#ffcf4a', voice: 0.9 },
  lali: { shirt: '#ffcf4a', pants: '#264653', hair: '#d9541e', hairStyle: 'long', voice: 1.3 },
  tano: { shirt: '#ffffff', pants: '#2e8b57', hair: '#2b1d0e', hat: 'cap', hatColor: '#d9412e', shoes: '#2b2b2b', voice: 0.75 },
  lucio: { shirt: '#ffffff', pants: '#c98b4a', hair: '#d4a373', hat: 'straw', hatColor: '#ffe28a', voice: 0.85 },
  male: { shirt: '#ff5d8f', pants: '#3d405b', hair: '#2b1d0e', hairStyle: 'bun', voice: 1.25 },
  tomi: { shirt: '#ffcf3a', pants: '#2b3a55', hair: '#b5651d', hat: 'cap', hatColor: '#2b2b2b', voice: 1.0 },
  gringo: { shirt: '#ffffff', pants: '#5a3220', hair: '#f7d55c', hat: 'cap', hatColor: '#c98b4a', shoes: '#2b2b2b', voice: 0.8 },
  cacho: { shirt: '#3a86ff', overalls: '#ffb703', hair: '#cfcfcf', hat: 'straw', hatColor: '#e9c46a', voice: 0.7 },
  rosita: { shirt: '#ff8fab', pants: '#ffffff', hair: '#8b4a22', hairStyle: 'bun', hat: 'cap', hatColor: '#ffffff', voice: 1.25 },
  nelly: { shirt: '#4cc9f0', pants: '#3d405b', hair: '#111111', hairStyle: 'long', skin: '#c68642', voice: 1.2 },
  juanchi: { shirt: '#2e8b57', pants: '#264653', hair: '#d4a373', hat: 'cap', hatColor: '#4cc9f0', voice: 1.0 },
  fito: { shirt: '#ffffff', pants: '#2b2b2b', hair: '#111111', hat: 'cap', hatColor: '#ffffff', shoes: '#2b2b2b', voice: 0.9 },
  pipo: { shirt: '#ffffff', pants: '#2b2b2b', hair: '#6b3e26', tie: '#2b2b2b', shoes: '#2b2b2b', voice: 1.05 },
  // Encargados de la Gerencia (uno por negocio)
  beba: { shirt: '#7b2cbf', pants: '#2b2b2b', hair: '#cfcfcf', hairStyle: 'bun', tie: '#ffcf3a', voice: 1.2 },
  tota: { shirt: '#0077b6', pants: '#2b2b2b', hair: '#d9541e', hairStyle: 'bun', tie: '#ffffff', voice: 1.15 },
  chola: { shirt: '#ffb703', pants: '#2b2b2b', hair: '#3d2b1f', hairStyle: 'long', tie: '#5a3220', skin: '#c68642', voice: 1.2 },
  marta: { shirt: '#2f4f7f', pants: '#2b2b2b', hair: '#cfcfcf', hairStyle: 'bun', tie: '#e8503f', skin: '#f2c299', voice: 1.1 },
  raul: { shirt: '#5c4033', pants: '#2b2b2b', hair: '#3d2b1f', tie: '#ffd23f', voice: 0.7 },
  vicky: { shirt: '#7b2cbf', pants: '#2b2b2b', hair: '#f7d55c', hairStyle: 'long', tie: '#ffffff', voice: 1.3 },
  ernesto: { shirt: '#264653', pants: '#2b2b2b', hair: '#111111', tie: '#e76f51', skin: '#c68642', voice: 0.8 },
  pocha: { shirt: '#c1121f', pants: '#2b2b2b', hair: '#6b3e26', hairStyle: 'ponytail', tie: '#ffffff', voice: 1.2 },
  julio: { shirt: '#ffffff', pants: '#3d405b', hair: '#cfcfcf', hat: 'cap', hatColor: '#ffffff', shoes: '#2b2b2b', voice: 0.7 },
  ramon: { shirt: '#d9473b', pants: '#2f4f7f', hair: '#4a3020', hat: 'cap', hatColor: '#ffffff', shoes: '#3a2a1e', voice: 0.6 },
};

export class WorkerAI {
  /**
   * @param {object} opts
   * @param {'farmer'|'carrier'|'cashier'} opts.role
   * @param {string} opts.name   nombre visible en las charlas (Tito, Rosa...)
   * @param {() => object} [opts.field]    farmer: campo que cosecha
   * @param {() => object} [opts.unit]     farmer: corral/taller al que lleva lo cosechado
   * @param {() => object[]} [opts.sources] carrier: talleres/corrales de donde junta
   * @param {() => object} [opts.shop]     carrier/cashier: tienda que atiende
   * @param {() => object[]} [opts.targets] baker: talleres que abastece
   */
  constructor(game, world, { role, name, position, field, unit, sources, shop, targets, errand, instant = false }) {
    this.game = game;
    this.world = world;
    this.role = role;
    this.name = name;
    this.getField = field;
    this.getUnit = unit;
    this.getSources = sources;
    this.getShop = shop;
    this.getTargets = targets;
    this.getErrand = errand; // granjero: () => ({ type, from, to }) — insumo extra que lleva entre cosechas
    this.fetching = false;
    this.home = position.clone();

    const key = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); // "Ramón" → "ramon"
    const look = LOOKS[key] ?? LOOKS.tito;
    this.character = new Character(look);
    this.root = this.character.root;
    this.root.position.copy(position);
    game.scene.add(this.root);
    if (!instant) game.fx.popIn(this.root);

    // Datos para el sistema de charlas
    this.voice = look.voice ?? 1;
    this.bubbleY = 2.35;

    this.position = this.root.position;
    this.baseCapacity = role === 'trucker' ? 10 : role === 'carrier' || role === 'baker' || role === 'manager' ? 8 : role === 'waiter' ? 4 : 6;
    this.stack = new StackManager(game, this.character.frontAnchor, this.baseCapacity);
    this.stack.onLand = () => game.audio.play('pop', { pos: this.position, volume: 0.5 });
    this.canHarvest = role === 'farmer';
    this.harvestTypes = role === 'farmer' ? [field().type] : null;
    this.applyBonus();

    this.state = role === 'farmer' ? 'gather' : role === 'trucker' || role === 'baker' || role === 'manager' ? 'load' : 'pickup';
    this.job = null;
    this.noProgress = 0;
    this.lastCount = 0;
    this.target = this.position.clone();
    this.retarget = 0;
    this.wait = 0;
    this.source = null;
    this.yaw = 0;
    this.vx = 0;
    this.vz = 0;

    if (role === 'cashier') shop().hasCashier = true;
    game.carriers.push(this);
    game.add(this);
  }

  /** Aplica la mejora "Ayudantes" (velocidad y capacidad). */
  applyBonus() {
    const lvl = this.world.workerBonus || 0;
    this.speed = CONFIG.workers.speed + lvl * 0.35;
    this.stack.capacity = this.baseCapacity + lvl * 2;
  }

  update(dt) {
    if (this.role === 'farmer') this.thinkFarmer(dt);
    else if (this.role === 'carrier') this.thinkCarrier(dt);
    else if (this.role === 'trucker') this.thinkTrucker(dt);
    else if (this.role === 'baker' || this.role === 'manager') this.thinkBaker(dt); // encargado: misma lógica, más destinos
    else if (this.role === 'waiter') this.thinkWaiter(dt);
    else this.target.copy(this.getShop().cashierSpot);
    this.moveTowards(dt);
  }

  // ---------------------------------------------------------------------------
  // Camionero: lee el pedido del camión, junta lo que falta y lo carga.
  // ---------------------------------------------------------------------------
  thinkTrucker(dt) {
    const truck = this.world.truck;
    const waiting = truck && truck.state === 'waiting' && truck.doneTimer < 0;
    const remaining = (t) => (truck.order[t] ?? 0) - (truck.delivered[t] ?? 0);

    // Progreso de carga (si no junta nada por un rato, entrega lo que tiene)
    if (this.stack.count !== this.lastCount) { this.lastCount = this.stack.count; this.noProgress = 0; } else this.noProgress += dt;

    if (this.state === 'deliver') {
      this.canHarvest = false;
      this.target.copy(truck?.dropZone.position ?? this.idleSpot());
      if (this.stack.count === 0) { this.state = 'load'; this.job = null; return; }
      const useful = waiting && this.stack.items.some((e) => e.landed && truck.canAccept(e.type));
      if (!useful && this.noProgress > 4) this.discard(); // lo que sobra va al depósito
      return;
    }

    // state 'load'
    if (!waiting) {
      this.canHarvest = false;
      if (this.stack.count > 0) this.state = 'deliver';
      else this.target.copy(this.idleSpot());
      return;
    }
    if (!this.job || remaining(this.job.type) - this.stack.count <= 0) {
      this.job = this.pickJob(truck);
      this.noProgress = 0;
    }
    if (!this.job) {
      this.canHarvest = false;
      if (this.stack.count > 0) this.state = 'deliver'; else this.target.copy(this.idleSpot());
      return;
    }
    const { type } = this.job;
    // Lleva exactamente lo que falta (sin pasarse de su capacidad)
    const cap = this.baseCapacity + (this.world.workerBonus || 0) * 2;
    this.stack.capacity = Math.max(this.stack.count, Math.min(cap, remaining(type)));
    if (this.stack.isFull || (this.stack.count > 0 && this.noProgress > 3)) { this.state = 'deliver'; return; }

    if (this.job.field) {
      this.canHarvest = true;
      this.harvestTypes = [type];
      const plant = this.job.field.nearestGrown(this.position);
      if (plant) this.target.copy(plant.position);
      else this.target.set(this.job.field.center.x + this.job.field.halfW + 0.8, 0, this.job.field.center.z);
    } else {
      this.canHarvest = false;
      this.target.copy(this.job.unit.pickupZone.position);
    }
    if (this.noProgress > 8) this.job = null; // probar con otro producto
  }

  /** Elige el próximo producto del pedido y de dónde sacarlo (pallet, cajón del tractor o campo). */
  pickJob(truck) {
    const w = this.world;
    const units = [...w.animalUnits(), ...w.processors()];
    if (w.crate) units.unshift({ outputType: 'corn', outputPile: w.crate, pickupZone: w.crateZone });
    const types = Object.keys(truck.order).filter((t) => truck.order[t] - (truck.delivered[t] ?? 0) - this.stack.countOf(t) > 0);
    let fallback = null;
    for (const t of types) {
      const unit = units.find((u) => u.outputType === t && u.outputPile.hasLanded());
      if (unit) return { type: t, unit };
      const field = w.fields().find((f) => f.type === t && f.nearestGrown(this.position));
      if (field) return { type: t, field };
      fallback ??= units.find((u) => u.outputType === t) ? { type: t, unit: units.find((u) => u.outputType === t) }
        : w.fields().find((f) => f.type === t) ? { type: t, field: w.fields().find((f) => f.type === t) } : null;
    }
    return fallback;
  }

  idleSpot() { return new THREE.Vector3(-14.2, 0, 11.4); }

  // ---------------------------------------------------------------------------
  // Panadero: mira qué insumo le falta a cada taller de receta mixta, lo junta
  // (pallet o campo) y lo deja en la mesa. Lleva sólo lo que entra en la mesa,
  // así nunca se queda trabado con la pila llena de algo que no se puede dejar.
  // ---------------------------------------------------------------------------
  thinkBaker(dt) {
    if (this.stack.count !== this.lastCount) { this.lastCount = this.stack.count; this.noProgress = 0; } else this.noProgress += dt;

    if (this.state === 'deliver') {
      this.canHarvest = false;
      const dest = this.job?.dest;
      if (!dest || this.stack.count === 0) { this.state = 'load'; this.job = null; return; }
      this.target.copy(dest.dropZone.position);
      if (distXZ2(this.position, this.target) > 0.6) this.noProgress = 0; // camina: no cuenta como trabado
      else if (this.noProgress > 4) this.discard(); // alguien llenó la mesa mientras venía
      return;
    }

    // state 'load'
    if (!this.job) { this.job = this.pickBakerJob(); this.noProgress = 0; }
    if (!this.job) {
      this.canHarvest = false;
      this.target.copy(this.home);
      return;
    }
    const { type, dest } = this.job;
    const pile = dest.inputs[type];
    const cap = this.baseCapacity + (this.world.workerBonus || 0) * 2;
    const room = pile.max - pile.count;
    this.stack.capacity = Math.max(this.stack.count, Math.min(cap, room));
    if (this.stack.count === 0 && room <= 0) { this.job = null; return; }
    if (this.stack.isFull || (this.stack.count > 0 && this.noProgress > 3)) { this.state = 'deliver'; return; }

    if (this.job.field) {
      this.canHarvest = true;
      this.harvestTypes = [type];
      const plant = this.job.field.nearestGrown(this.position);
      if (plant) this.target.copy(plant.position);
      else this.target.set(this.job.field.center.x + this.job.field.halfW + 0.8, 0, this.job.field.center.z);
    } else {
      this.canHarvest = false;
      this.target.copy(this.job.unit.pickupZone.position);
      if (distXZ2(this.position, this.target) > 0.6) this.noProgress = 0; // camina: no cuenta como trabado
    }
    if (this.stack.count === 0 && this.noProgress > 8) this.job = null; // probar con otro insumo
  }

  /** Insumo más escaso entre los talleres a cargo, con una fuente disponible (pallet o campo). */
  pickBakerJob() {
    const w = this.world;
    const units = [...w.animalUnits(), ...w.processors()];
    const options = [];
    for (const [di, dest] of this.getTargets().filter(Boolean).entries()) {
      for (const [type, pile] of Object.entries(dest.inputs)) {
        if (pile.count >= pile.max - 1) continue;
        const owner = dest.owner ?? dest;
        let unit = units.find((u) => u.outputType === type && u !== owner && u.outputPile.hasLanded());
        const field = !unit && w.fields().find((f) => f.type === type && f.nearestGrown(this.position));
        let waitBias = 0;
        // Si ese insumo se acabó del todo, va igual a esperarlo al pallet (otros lo levantan apenas sale)
        if (!unit && !field && pile.count === 0) {
          unit = units.find((u) => u.outputType === type && u !== owner);
          waitBias = 0.3;
        }
        // Panadero: el primer taller de la lista tiene prioridad. Encargado: va a lo más vacío.
        const bias = this.role === 'manager' ? 0.02 : 0.15;
        if (unit || field) options.push({ type, dest, unit, field, score: pile.count / pile.max + di * bias + waitBias + Math.random() * 0.05 });
      }
    }
    options.sort((a, b) => a.score - b.score);
    return options[0] ?? null;
  }

  // ---------------------------------------------------------------------------
  // Mozo (Restaurante): busca platos en el pasaplatos y los lleva a la mesa que los pidió.
  // ---------------------------------------------------------------------------
  thinkWaiter(dt) {
    const r = this.world.restaurant;
    if (!r) return;
    if (this.stack.count !== this.lastCount) { this.lastCount = this.stack.count; this.noProgress = 0; } else this.noProgress += dt;
    const atPass = distXZ2(this.position, r.passZone.position) < 0.6;
    const ready = Object.values(r.pass).some((p) => p.hasLanded());
    // Si todavía hay platos listos, termina de cargar antes de salir
    if (this.stack.count > 0 && atPass && ready && !this.stack.isFull) { this.target.copy(r.passZone.position); return; }
    if (this.stack.count > 0) {
      const d = r.dinerFor(this);
      if (d) {
        this.target.copy(d.table.serve);
        this.noProgress = Math.min(this.noProgress, 1); // mientras tenga a quién servir, no está trabado
        return;
      }
      // Nadie quiere lo que lleva (lo sirvió Mela): espera en el pasaplatos y, si nadie lo pide, lo descarta
      this.target.copy(r.passZone.position);
      if (this.noProgress > 8) this.discard();
      return;
    }
    // Manos vacías: al pasaplatos si hay algo, si no a su lugar
    this.target.copy(ready ? r.passZone.position : this.home);
  }

  /** Lo que ya no sirve para el pedido se "guarda en el depósito" (desaparece). */
  discard() {
    for (const e of [...this.stack.items]) {
      if (!e.landed) continue;
      const t = this.stack.take(e.type);
      if (t) this.game.fx.popOut(t.mesh);
    }
    this.noProgress = 0;
  }

  thinkFarmer(dt) {
    const field = this.getField();
    const unit = this.getUnit();

    if (this.state === 'gather') {
      if (this.stack.isFull) {
        this.state = 'deliver';
      } else {
        this.retarget -= dt;
        if (this.retarget <= 0) {
          this.retarget = 0.25;
          const p = field.nearestGrown(this.position);
          if (p) this.target.copy(p.position);
          else if (this.stack.count > 0) this.state = 'deliver';
          else this.target.set(field.center.x + field.halfW + 0.8, 0, field.center.z); // espera al costado
        }
      }
    }
    if (this.state === 'deliver') {
      this.target.copy(unit.dropZone.position);
      const atDrop = distXZ2(this.position, this.target) < 0.6;
      if (this.stack.count !== this.lastCount || !atDrop) { this.lastCount = this.stack.count; this.noProgress = 0; } else this.noProgress += dt;
      // La mesa está llena porque falta el otro insumo: va a buscarlo con lo que tiene en la mano
      if (this.stack.count > 0 && this.noProgress > 2 && this.errandNeeded()) { this.state = 'fetch'; this.noProgress = 0; }
      else if (this.stack.count === 0) {
        this.state = this.errandNeeded() ? 'fetch' : 'gather';
        this.retarget = 0;
        this.noProgress = 0;
      }
    }
    if (this.state === 'gather' && this.stack.count === 0 && !field.nearestGrown(this.position) && this.errandNeeded()) {
      this.state = 'fetch'; // mientras crece el campo, hace el mandado
      this.noProgress = 0;
    }
    if (this.state === 'fetch' || this.state === 'bring') this.thinkErrand(dt);
  }

  /** ¿Hace falta el insumo extra (ej. leche para la Heladería) y hay de dónde sacarlo? */
  errandNeeded() {
    const e = this.getErrand?.();
    if (!e?.from || !e?.to) return false;
    const pile = e.to.inputs?.[e.type];
    if (!pile || pile.count >= pile.max / 2) return false;
    // No hace falta que haya producto apoyado justo ahora: otros (ej. Lucho con la leche) lo levantan
    // apenas sale, así que va igual y espera un rato en el pallet.
    return e.from.outputPile.hasLanded() || !this.errandFailed || this.game.time - this.errandFailed > 12;
  }

  /** Mandado: junta el insumo extra del pallet y lo deja en la mesa del taller. */
  thinkErrand(dt) {
    const e = this.getErrand();
    const pile = e.to.inputs[e.type];
    if (this.stack.count !== this.lastCount) { this.lastCount = this.stack.count; this.noProgress = 0; } else this.noProgress += dt;
    this.canHarvest = false;
    const done = () => {
      this.state = 'gather'; this.fetching = false; this.canHarvest = true; this.retarget = 0;
      this.stack.capacity = this.baseCapacity + (this.world.workerBonus || 0) * 2;
    };

    if (this.state === 'fetch') {
      const cap = this.baseCapacity + (this.world.workerBonus || 0) * 2;
      // Puede traer cosecha en la mano (si la mesa estaba llena): sólo cuenta lo que junta del mandado
      const got = this.stack.countOf(e.type);
      const want = Math.max(1, Math.min(cap, pile.max - pile.count));
      this.stack.capacity = this.stack.count - got + Math.max(got, want);
      this.fetching = true;
      this.target.copy(e.from.pickupZone.position);
      // Los tiempos de espera cuentan recién al llegar al pallet (no mientras camina)
      if (distXZ2(this.position, this.target) > 0.6) { this.noProgress = 0; return; }
      // Espera a juntar la carga (el viaje es largo): se va lleno o si no sale nada nuevo por un rato
      if (got >= want || (got > 0 && this.noProgress > 4)) { this.state = 'bring'; this.fetching = false; this.noProgress = 0; }
      else if (got === 0 && this.noProgress > 6) { this.errandFailed = this.game.time; if (this.stack.count) this.state = 'bring'; else done(); } // no salió nada
      return;
    }
    // bring
    this.fetching = false;
    this.target.copy(e.to.dropZone.position);
    if (this.stack.count === 0) done();
    else if (distXZ2(this.position, this.target) > 0.6) this.noProgress = 0;
    else if (this.noProgress > 4) { this.discard(); done(); } // la mesa se llenó mientras venía
  }

  thinkCarrier(dt) {
    const shop = this.getShop();
    const sources = this.getSources().filter(Boolean);

    if (this.state === 'pickup') {
      if (!this.source) {
        // Elige la fuente con más producto útil (lo que entra en la estantería); las vacías van primero
        let best = null;
        let bestScore = -1;
        for (const s of sources) {
          const shelf = shop.piles[s.outputType];
          if (!shelf || shelf.count >= shelf.max) continue;
          const room = shelf.max - shelf.count;
          const score = Math.min(s.outputPile.landedCount, room) + (shelf.count === 0 ? 4 : 0) + Math.random() * 0.5;
          if (score > bestScore) { best = s; bestScore = score; }
        }
        this.source = best;
        this.wait = 0;
        if (!best) {
          this.target.copy(shop.dropZone.position).add(new THREE.Vector3(-1.2, 0, 1.2));
          return;
        }
      }
      // Junta sólo lo que entra en la estantería (si no, se queda trabado con sobrante en la mano)
      const shelf = shop.piles[this.source.outputType];
      const cap = this.baseCapacity + (this.world.workerBonus || 0) * 2;
      this.stack.capacity = Math.max(this.stack.count, 1, Math.min(cap, shelf.max - shelf.count));
      this.noProgress = 0;
      this.target.copy(this.source.pickupZone.position);
      if (distXZ2(this.position, this.target) < 0.3) {
        this.wait += dt;
        const empty = !this.source.outputPile.hasLanded();
        if (this.stack.isFull || (this.stack.count > 0 && empty && this.wait > 1.2)) this.state = 'deliver';
        else if (this.stack.count === 0 && empty && this.wait > 2.5) this.source = null; // probar otra fuente
      }
    }
    if (this.state === 'deliver') {
      this.target.copy(shop.dropZone.position);
      // Sólo cuenta como "trabado" si ya llegó a la estantería y no puede dejar nada
      const atShelf = distXZ2(this.position, this.target) < 0.6;
      if (this.stack.count !== this.lastCount || !atShelf) { this.lastCount = this.stack.count; this.noProgress = 0; } else this.noProgress += dt;
      if (this.stack.count > 0 && this.noProgress > 6) this.discard(); // la estantería se llenó mientras venía
      if (this.stack.count === 0) { this.state = 'pickup'; this.source = null; }
    }
  }

  moveTowards(dt) {
    const dx = this.target.x - this.position.x;
    const dz = this.target.z - this.position.z;
    const d = Math.hypot(dx, dz);
    let moving = false;
    if (d > 0.08) {
      const step = Math.min(d, this.speed * dt);
      this.position.x += (dx / d) * step;
      this.position.z += (dz / d) * step;
      this.vx = (dx / d) * this.speed;
      this.vz = (dz / d) * this.speed;
      this.yaw = lerpAngle(this.yaw, Math.atan2(dx, dz), 1 - Math.exp(-dt * 10));
      moving = true;
    } else {
      this.vx = this.vz = 0;
      if (this.role === 'cashier') this.yaw = lerpAngle(this.yaw, 0, 1 - Math.exp(-dt * 8));
    }
    this.root.rotation.y = this.yaw;
    this.character.animate(dt, moving ? this.speed / CONFIG.player.speed : 0, { carryFront: this.stack.count > 0 });
    this.stack.update(dt, this.vx, this.vz, this.yaw);
  }
}
