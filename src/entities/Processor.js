// Processor: taller que transforma insumos en un producto según una receta.
//   Panadería:  🌾 → 🍞      Dulcería: 🎃 → 🥫      Pastelería: 🥚 + 🥛 + 🌾 → 🎂
// Los insumos se dejan en la mesa (zona ⬇) y el producto sale en el pallet (zona ⬆).
// Expone la misma interfaz que ProductionUnit (dropZone, pickupZone, outputPile, outputType)
// para que los trabajadores puedan usarlo sin cambios.
import * as THREE from 'three';
import { createWorkshop, createTable, createPallet, createItem, sphere, ITEMS } from '../models/Models.js';
import { Pile } from '../systems/Pile.js';
import { TransferZone } from '../systems/TransferZone.js';
import { makeTextSprite } from '../core/Labels.js';

export class Processor {
  /**
   * @param {object} opts
   * @param {Record<string, number>} opts.recipe  insumos por unidad producida, ej {egg:1, milk:1, wheat:1}
   * @param {string} opts.output  tipo de ítem producido
   */
  constructor(game, {
    position, recipe, output, produceTime = 3, name = 'TALLER', look = {}, inputMax = 20, outputMax = 20,
    outputPile = {}, inputRoles = ['player'], outputRoles = ['player'], model = null, labelY = 4.4,
  }) {
    this.game = game;
    this.recipe = recipe;
    this.outputType = output;
    this.produceTime = produceTime;
    this.speedMult = 1;
    this.timer = 0;
    this.working = 0;
    this.position = position.clone();

    // Edificio
    this.group = new THREE.Group();
    this.group.position.copy(position);
    game.scene.add(this.group);
    // Edificio propio (ej. el Molino) o el taller genérico
    this.building = model ? model() : createWorkshop(look);
    this.group.add(this.building);
    game.obstacles.push({ minX: position.x - 2.1, maxX: position.x + 2.1, minZ: position.z - 1.5, maxZ: position.z + 1.6 });

    const label = makeTextSprite(`${ITEMS[output].emoji} ${name}`, { color: '#ffffff', stroke: '#6b3a1a', worldHeight: 0.55 });
    label.sprite.position.set(position.x, labelY, position.z + 0.6);
    game.scene.add(label.sprite);

    // Mesa con una pila por insumo
    const types = Object.keys(recipe);
    const tableX = -1.4;
    const table = createTable(0.75 * types.length + 0.4);
    table.position.set(tableX, 0, 2.15);
    this.group.add(table);
    this.inputs = {};
    types.forEach((t, i) => {
      const off = (i - (types.length - 1) / 2) * 0.75;
      this.inputs[t] = new Pile(game, {
        position: new THREE.Vector3(position.x + tableX + off, 0.56, position.z + 2.15), type: t,
        cols: 1, rows: 2, spacing: [0.5, 0.36], max: inputMax, // dos columnas para que no quede una torre
      });
    });
    const sink = {
      canAccept: (t) => !!this.inputs[t]?.canAccept(t),
      receive: (t, m) => this.inputs[t].receive(t, m),
    };
    this.dropZone = new TransferZone(game, {
      position: new THREE.Vector3(position.x + tableX, 0, position.z + 3.75), mode: 'drop', types, target: sink, roles: inputRoles,
    });

    // Pallet de salida
    const pallet = createPallet();
    pallet.position.set(1.6, 0, 2.15);
    this.group.add(pallet);
    this.outputPile = new Pile(game, {
      position: new THREE.Vector3(position.x + 1.6, 0.15, position.z + 2.15), type: output, max: outputMax,
      cols: 2, rows: 2, spacing: [0.52, 0.48], ...outputPile,
    });
    this.pickupZone = new TransferZone(game, {
      position: new THREE.Vector3(position.x + 1.6, 0, position.z + 3.75), mode: 'pickup', target: this.outputPile, roles: outputRoles,
    });
    game.obstacles.push({
      minX: position.x + tableX - 0.5 * types.length, maxX: position.x + 2.3, minZ: position.z + 1.7, maxZ: position.z + 2.6,
    });

    this.door = new THREE.Vector3(position.x, 0.8, position.z + 1.5);
    this.smokeTimer = 0;
    game.add(this);
  }

  canProduce() {
    if (this.outputPile.isFull) return false;
    return Object.entries(this.recipe).every(([t, n]) => this.inputs[t].landedCount >= n);
  }

  update(dt) {
    if (this.canProduce()) {
      this.timer += dt * this.speedMult;
      if (this.timer >= this.produceTime) {
        this.timer = 0;
        this.produce();
      }
    } else {
      this.timer = Math.min(this.timer, this.produceTime * 0.5);
    }

    // Animación: el edificio "late" y sale humo de la chimenea mientras trabaja
    this.working = Math.max(0, this.working - dt);
    const k = this.working > 0 ? Math.sin(this.game.time * 14) * 0.015 : 0;
    this.building.scale.set(1 - k, 1 + k, 1 - k);
    // Aspas del molino: giran lento siempre y rápido mientras muele
    const spin = this.building.userData.spin;
    if (spin) spin.rotation.z += dt * (this.working > 0 ? 3.2 : 0.5);
    if (this.working > 0 && this.building.userData.chimney) {
      this.smokeTimer -= dt;
      if (this.smokeTimer <= 0) { this.smokeTimer = 0.35; this.puff(); }
    }
  }

  produce() {
    this.working = this.produceTime / this.speedMult + 0.4;
    // Los insumos entran al taller
    for (const [t, n] of Object.entries(this.recipe)) {
      for (let i = 0; i < n; i++) {
        const e = this.inputs[t].give();
        this.game.fx.fly(e.mesh, (out) => out.copy(this.door), {
          duration: 0.35, arc: 0.8, onDone: (m) => m.removeFromParent(),
        });
      }
    }
    // ...y sale el producto
    const mesh = createItem(this.outputType);
    mesh.position.copy(this.door);
    this.game.scene.add(mesh);
    this.outputPile.receive(this.outputType, mesh, { duration: 0.5, arc: 1.4 });
    this.game.audio.play('oven', { pos: this.position });
    this.game.emit('produce', { type: this.outputType });
  }

  puff() {
    const c = this.building.userData.chimney;
    const s = sphere(0.22, '#e8e8e8', this.position.x + c.x, c.y, this.position.z + c.z);
    s.castShadow = false;
    this.game.scene.add(s);
    const y0 = s.position.y;
    this.game.fx.tween(1.4, (u) => {
      s.position.y = y0 + u * 1.6;
      s.position.x += 0.004;
      s.scale.setScalar(0.6 + u * 1.2);
    }, () => s.removeFromParent());
  }
}
