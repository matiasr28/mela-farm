// Tractor: cosechadora automática. Recorre el campo surco por surco (patrón "cortacésped")
// y manda cada mazorca al cajón junto al campo, de donde el jugador la recoge.
import * as THREE from 'three';
import { createTractor } from '../models/Models.js';
import { lerpAngle } from '../utils.js';

export class Tractor {
  constructor(game, { field, crate, instant = false }) {
    this.game = game;
    this.field = field;
    this.crate = crate;
    this.model = createTractor();
    this.root = this.model.root;
    game.scene.add(this.root);

    // Recorrido: surcos alternando izquierda→derecha / derecha→izquierda
    this.waypoints = [];
    field.rowZ.forEach((z, i) => {
      const xs = [field.minX - 1.2, field.maxX + 1.2];
      if (i % 2) xs.reverse();
      for (const x of xs) this.waypoints.push(new THREE.Vector3(x, 0, z));
    });
    this.idx = 0;
    this.root.position.copy(this.waypoints[0]);
    this.yaw = Math.PI / 2;
    this.speed = 2.8;
    this.harvestTimer = 0;
    if (!instant) game.fx.popIn(this.root);
    game.add(this);
  }

  update(dt) {
    const time = this.game.time;
    if (this.crate.isFull) {
      // Cajón lleno: espera con el motor en marcha
      this.root.position.y = Math.sin(time * 30) * 0.015;
      return;
    }

    const p = this.root.position;
    const t = this.waypoints[this.idx];
    const dx = t.x - p.x;
    const dz = t.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.15) {
      this.idx = (this.idx + 1) % this.waypoints.length;
    } else {
      const step = Math.min(d, this.speed * dt);
      p.x += (dx / d) * step;
      p.z += (dz / d) * step;
      this.yaw = lerpAngle(this.yaw, Math.atan2(dx, dz), 1 - Math.exp(-dt * 6));
      this.root.rotation.y = this.yaw;
      for (const w of this.model.rear) w.rotation.x += step / 0.6;
      for (const w of this.model.front) w.rotation.x += step / 0.35;
    }
    this.model.reel.rotation.x += dt * 6;
    p.y = Math.sin(time * 30) * 0.015;

    this.harvestTimer -= dt;
    if (this.harvestTimer <= 0) {
      this.harvestTimer = 0.06;
      const plant = this.field.nearestGrown(p, 1.0);
      if (plant && this.crate.canAccept('corn')) this.field.harvest(plant, this.crate);
    }
  }
}
