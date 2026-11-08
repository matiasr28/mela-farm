// ResourceNode: campo de cultivo (maíz, trigo o zapallos). Cada planta crece con un
// temporizador; cualquier carrier con canHarvest que camine por el campo cosecha
// automáticamente la planta madura más cercana (si su `harvestTypes` lo permite).
import * as THREE from 'three';
import {
  createCornPlant, createWheatPlant, createPumpkinPlant, createStrawberryPlant, createAppleTree, createSunflowerPlant, createGrassPlant, createFlowerPlant, createFishSpot, createItem, mat, C,
} from '../models/Models.js';
import { CONFIG } from '../config.js';
import { bakeGroup, bakeTemplate, BAKED_MAT } from '../core/Bake.js';

const _v = new THREE.Vector3();

const CROPS = {
  corn: { plant: createCornPlant, soil: C.soil, furrow: C.soilDark },
  wheat: { plant: createWheatPlant, soil: '#a5733f', furrow: '#8a5c30' },
  pumpkin: { plant: createPumpkinPlant, soil: '#7d5233', furrow: '#65411f' },
  strawberry: { plant: createStrawberryPlant, soil: '#8a5a3a', furrow: '#6e4426' },
  apple: { plant: createAppleTree, soil: '#7fae4a', furrow: '#6c9a3c' },
  sunflower: { plant: createSunflowerPlant, soil: '#7a4f2e', furrow: '#5f3c21' },
  grass: { plant: createGrassPlant, soil: '#8a6a3a', furrow: '#6f5530' },
  flower: { plant: createFlowerPlant, soil: '#6b4a2e', furrow: '#553a22', variants: 5 },
  fish: { plant: createFishSpot, soil: '#5fb3e0', furrow: '#4a9fd0' }, // orilla de la laguna (agua bajita)
};

/**
 * Planta armada con dos meshes horneados (mata + fruto), con la geometría compartida entre todas
 * las del mismo cultivo: un campo de 30 plantas pasa de ~300 piezas a 60. Las flores tienen
 * variantes de color.
 */
const plantParts = new Map();
function plantFromTemplate(type, crop) {
  const variant = crop.variants ? Math.floor(Math.random() * crop.variants) : 0;
  const key = `${type}:${variant}`;
  let t = plantParts.get(key);
  if (!t) {
    const sample = crop.plant(variant);
    const cob = sample.cob;
    cob.parent.remove(cob);
    // Si el fruto es un grupo, se hornean sus piezas en el espacio del grupo y el mesh nuevo
    // hereda la posición/giro del grupo (así se puede animar igual que antes).
    const isGroup = cob.children.length > 0;
    const pos = cob.position.clone();
    const rot = cob.rotation.clone();
    const scale = cob.scale.clone();
    t = {
      body: bakeTemplate(`plant:${key}`, () => sample.group),
      cob: bakeTemplate(`cob:${key}`, () => { const g = new THREE.Group(); g.add(...(isGroup ? [...cob.children] : [cob])); return g; }),
      pos, rot, scale, isGroup,
    };
    plantParts.set(key, t);
  }
  const group = new THREE.Group();
  const bodyMesh = new THREE.Mesh(t.body, BAKED_MAT);
  bodyMesh.castShadow = bodyMesh.receiveShadow = true;
  group.add(bodyMesh);
  const cob = new THREE.Mesh(t.cob, BAKED_MAT);
  cob.castShadow = true;
  if (t.isGroup) { cob.position.copy(t.pos); cob.rotation.copy(t.rot); cob.scale.copy(t.scale); }
  group.add(cob);
  return { group, cob };
}

export class ResourceNode {
  constructor(game, { type = 'corn', center, cols = 6, rows = 5, spacing = 1.5, growTime = CONFIG.field.growTime }) {
    this.game = game;
    this.type = type;
    this.center = center.clone();
    this.growTime = growTime;
    this.growMult = 1;
    this.halfW = ((cols - 1) * spacing) / 2 + 0.9;
    this.halfD = ((rows - 1) * spacing) / 2 + 0.9;
    this.rowZ = [];
    const crop = CROPS[type];

    // Tierra arada + surcos
    this.group = new THREE.Group();
    game.scene.add(this.group);
    const soil = new THREE.Mesh(new THREE.BoxGeometry(this.halfW * 2, 0.12, this.halfD * 2), mat(crop.soil));
    soil.position.set(center.x, 0.0, center.z);
    soil.receiveShadow = true;
    this.group.add(soil);

    this.plants = [];
    for (let r = 0; r < rows; r++) {
      const z = center.z + (r - (rows - 1) / 2) * spacing;
      this.rowZ.push(z);
      const furrow = new THREE.Mesh(new THREE.BoxGeometry(this.halfW * 2 - 0.4, 0.04, 0.5), mat(crop.furrow));
      furrow.position.set(center.x, 0.07, z);
      furrow.receiveShadow = true;
      this.group.add(furrow);
      for (let c = 0; c < cols; c++) {
        const { group, cob } = plantFromTemplate(type, crop);
        const pos = new THREE.Vector3(center.x + (c - (cols - 1) / 2) * spacing, 0.06, z);
        group.position.copy(pos);
        group.rotation.y = Math.random() * Math.PI * 2;
        this.group.add(group);
        this.plants.push({ group, cob, position: pos, grown: true, t: growTime, phase: Math.random() * 6 });
      }
    }

    bakeGroup(this.group, { keep: this.plants.map((p) => p.group) });
    this.timers = new Map();
    game.add(this);
  }

  get minX() { return this.center.x - this.halfW; }
  get maxX() { return this.center.x + this.halfW; }

  contains(pos, pad = 0) {
    return Math.abs(pos.x - this.center.x) < this.halfW + pad && Math.abs(pos.z - this.center.z) < this.halfD + pad;
  }

  update(dt) {
    const time = this.game.time;

    // Crecimiento y vaivén con el viento
    for (const p of this.plants) {
      if (!p.grown) {
        p.t += dt * this.growMult;
        const k = Math.min(1, p.t / this.growTime);
        p.group.scale.set(0.45 + 0.55 * k, 0.12 + 0.88 * k, 0.45 + 0.55 * k);
        p.cob.visible = k > 0.8;
        if (k >= 1) {
          p.grown = true;
          this.game.fx.tween(0.3, (u) => {
            if (!p.grown) return;
            const s = 1 + Math.sin(u * Math.PI) * 0.15;
            p.group.scale.set(s, s, s);
          });
        }
      }
      p.group.rotation.z = Math.sin(time * 1.7 + p.phase) * 0.04;
      // Los peces listos para pescar saltan en el agua
      if (this.type === 'fish' && p.grown) p.cob.position.y = Math.max(0, Math.sin(time * 2.6 + p.phase)) * 0.35;
    }

    // Cosecha automática por proximidad
    for (const c of this.game.carriers) {
      const allowed = c.canHarvest && (!c.harvestTypes || c.harvestTypes.includes(this.type));
      if (!allowed || !this.contains(c.position, 0.8)) { this.timers.delete(c); continue; }
      let t = (this.timers.get(c) ?? 0) - dt;
      if (t <= 0) {
        t = 0;
        if (c.stack.canAccept(this.type)) {
          const p = this.nearestGrown(c.position, CONFIG.field.harvestRadius);
          if (p) { this.harvest(p, c.stack); t = CONFIG.field.harvestInterval; }
        }
      }
      this.timers.set(c, t);
    }
  }

  /** Cosecha la planta y manda el producto volando al sink (pila del carrier o cajón). */
  harvest(p, sink) {
    p.cob.getWorldPosition(_v);
    p.grown = false;
    p.t = 0;
    p.cob.visible = false;
    p.group.scale.set(0.45, 0.12, 0.45);
    const mesh = createItem(this.type);
    mesh.position.copy(_v);
    this.game.scene.add(mesh);
    sink.receive(this.type, mesh);
    this.game.audio.play('harvest', { pos: p.position, volume: sink === this.game.player?.stack ? 1 : 0.4 });
    this.game.emit('harvest', { type: this.type });
  }

  nearestGrown(pos, maxDist = Infinity) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const p of this.plants) {
      if (!p.grown) continue;
      const dx = p.position.x - pos.x;
      const dz = p.position.z - pos.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }
}
