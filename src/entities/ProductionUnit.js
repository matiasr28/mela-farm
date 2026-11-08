// ProductionUnit: corral con animales que consumen un insumo del comedero y producen
// un producto en el pallet de salida (gallinas: maíz → huevos, vacas: maíz → leche).
import * as THREE from 'three';
import {
  createChicken, createCow, createSheep, createGoat, createBee, createHiveHouse, createCoopHouse, createBarnHouse, createTrough, createPallet,
  createFenceLine, createItem, mat,
} from '../models/Models.js';
import { Pile } from '../systems/Pile.js';
import { bakeGroup } from '../core/Bake.js';
import { TransferZone } from '../systems/TransferZone.js';
import { rand, pick, lerpAngle } from '../utils.js';

const _v = new THREE.Vector3();

export class ProductionUnit {
  constructor(game, {
    position, size = [7, 5], inputType = 'corn', outputType = 'egg', produceTime = 1.5,
    feederMax = 24, outputMax = 32, animal = 'chicken', animalCount = 4, house = 'coop',
    outputPile = {}, inputRoles = ['player'], outputRoles = ['player'], floorColor = '#d8c27a',
  }) {
    this.game = game;
    this.inputType = inputType;
    this.outputType = outputType;
    this.produceTime = produceTime;
    this.speedMult = 1;
    this.animalKind = animal;
    this.timer = 0;

    const [w, d] = size;
    this.halfW = w / 2;
    this.halfD = d / 2;
    this.group = new THREE.Group();
    this.group.position.copy(position);
    game.scene.add(this.group);

    // Piso del corral
    const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), mat(floorColor));
    floor.position.y = 0.01;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Cerco (4 lados) + obstáculos para el jugador
    const hw = w / 2;
    const hd = d / 2;
    this.group.add(createFenceLine(-hw, -hd, hw, -hd));
    this.group.add(createFenceLine(-hw, hd, hw, hd));
    this.group.add(createFenceLine(-hw, -hd, -hw, hd));
    this.group.add(createFenceLine(hw, -hd, hw, hd));
    const px = position.x;
    const pz = position.z;
    const t = 0.15;
    this.obstacles = [
      { minX: px - hw - t, maxX: px + hw + t, minZ: pz - hd - t, maxZ: pz - hd + t },
      { minX: px - hw - t, maxX: px + hw + t, minZ: pz + hd - t, maxZ: pz + hd + t },
      { minX: px - hw - t, maxX: px - hw + t, minZ: pz - hd - t, maxZ: pz + hd + t },
      { minX: px + hw - t, maxX: px + hw + t, minZ: pz - hd - t, maxZ: pz + hd + t },
    ];

    // Casita al fondo
    const h = house === 'barn' ? createBarnHouse() : house === 'hive' ? createHiveHouse() : createCoopHouse();
    h.position.set(house === 'barn' ? -hw + 2.0 : -hw + 1.6, 0, -hd + 1.3);
    this.group.add(h);

    // Comedero (afuera, al frente-izquierda) y pallet de salida (frente-derecha)
    const feederLocal = new THREE.Vector3(-hw + 1.5, 0, hd + 0.55);
    const outLocal = new THREE.Vector3(hw - 1.5, 0, hd + 0.6);
    const trough = createTrough();
    trough.position.copy(feederLocal);
    this.group.add(trough);
    const pallet = createPallet();
    pallet.position.copy(outLocal);
    this.group.add(pallet);
    const feederWorld = feederLocal.clone().add(position);
    const outWorld = outLocal.clone().add(position);
    this.obstacles.push(
      { minX: feederWorld.x - 1.0, maxX: feederWorld.x + 1.0, minZ: feederWorld.z - 0.4, maxZ: feederWorld.z + 0.4 },
      { minX: outWorld.x - 0.65, maxX: outWorld.x + 0.65, minZ: outWorld.z - 0.5, maxZ: outWorld.z + 0.5 },
    );
    game.obstacles.push(...this.obstacles);

    this.feederPile = new Pile(game, {
      position: feederWorld.clone().setY(0.4), type: inputType, cols: 3, rows: 2, max: feederMax, spacing: [0.55, 0.24],
    });
    this.outputPile = new Pile(game, {
      position: outWorld.clone().setY(0.15), type: outputType, max: outputMax, ...outputPile,
    });

    this.dropZone = new TransferZone(game, {
      position: feederWorld.clone().add(new THREE.Vector3(0, 0, 1.45)), mode: 'drop', types: [inputType],
      target: this.feederPile, roles: inputRoles,
    });
    this.pickupZone = new TransferZone(game, {
      position: outWorld.clone().add(new THREE.Vector3(0, 0, 1.45)), mode: 'pickup',
      target: this.outputPile, roles: outputRoles,
    });

    bakeGroup(this.group); // piso, cerco, casita, comedero y pallet: un solo mesh
    this.animals = [];
    this.addAnimals(animalCount, true);
    game.add(this);
  }

  /** Punto aleatorio dentro del corral (zona delantera, lejos de la casita). */
  randomSpot(out) {
    return out.set(rand(-this.halfW + 0.7, this.halfW - 0.7), 0, rand(-this.halfD + 2.4, this.halfD - 0.6));
  }

  addAnimals(n, instant = false) {
    for (let i = 0; i < n; i++) {
      const a = this.animalKind === 'cow' ? createCow() : this.animalKind === 'sheep' ? createSheep()
        : this.animalKind === 'goat' ? createGoat() : this.animalKind === 'bee' ? createBee() : createChicken();
      bakeGroup(a.body, { keep: a.wings ?? [] });
      this.randomSpot(a.root.position);
      a.root.rotation.y = rand(0, Math.PI * 2);
      this.group.add(a.root);
      if (!instant) this.game.fx.popIn(a.root);
      this.animals.push({
        ...a,
        target: this.randomSpot(new THREE.Vector3()),
        wait: rand(0, 2),
        hop: 0,
        phase: rand(0, 6),
        speed: this.animalKind === 'chicken' ? 1.1 : this.animalKind === 'bee' ? 1.4 : 0.7,
      });
    }
  }

  update(dt) {
    // ---- Animales deambulando ----
    for (const a of this.animals) {
      const p = a.root.position;
      const dx = a.target.x - p.x;
      const dz = a.target.z - p.z;
      const dist = Math.hypot(dx, dz);
      let walking = false;
      if (a.wait > 0) {
        a.wait -= dt;
      } else if (dist < 0.1) {
        a.wait = rand(0.5, 3);
        this.randomSpot(a.target);
      } else {
        const step = Math.min(dist, a.speed * dt);
        p.x += (dx / dist) * step;
        p.z += (dz / dist) * step;
        a.root.rotation.y = lerpAngle(a.root.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-dt * 6));
        walking = true;
      }
      a.phase += dt * (walking ? 12 : 2);
      a.hop = Math.max(0, a.hop - dt);
      const hopY = a.hop > 0 ? Math.sin((a.hop / 0.35) * Math.PI) * 0.35 : 0;
      if (a.wings) {
        // Abejas: vuelan bajito, suben y bajan y aletean rápido
        a.body.position.y = 0.75 + Math.sin(a.phase * 0.35) * 0.18 + hopY;
        const flap = Math.sin(this.game.time * 45 + a.phase) * 0.7;
        a.wings[0].rotation.z = flap;
        a.wings[1].rotation.z = -flap;
        continue;
      }
      a.body.position.y = (walking ? Math.abs(Math.sin(a.phase)) * 0.06 : 0) + hopY;
      a.body.rotation.x = walking ? 0 : Math.sin(a.phase) * 0.05; // picoteo / respiración
    }

    // ---- Producción ----
    const interval = this.produceTime / this.speedMult;
    if (this.feederPile.hasLanded() && !this.outputPile.isFull && this.animals.length) {
      this.timer += dt;
      if (this.timer >= interval) {
        this.timer = 0;
        this.produce();
      }
    } else {
      this.timer = Math.min(this.timer, interval);
    }
  }

  produce() {
    const a = pick(this.animals);
    a.hop = 0.35;
    a.root.getWorldPosition(_v);
    const animalPos = _v.clone();
    const sound = { cow: 'moo', sheep: 'baa', goat: 'baa', bee: 'buzz' }[this.animalKind] ?? 'cluck';
    this.game.audio.play(sound, { pos: animalPos });

    // El animal "come" un ítem del comedero
    const food = this.feederPile.give();
    this.game.fx.fly(food.mesh, (out) => out.copy(animalPos).setY(0.5), {
      duration: 0.35,
      arc: 0.8,
      onDone: (m) => m.removeFromParent(),
    });

    // ...y genera el producto, que vuela al pallet
    const mesh = createItem(this.outputType);
    mesh.position.copy(animalPos).setY(0.6);
    this.game.scene.add(mesh);
    this.outputPile.receive(this.outputType, mesh, { duration: 0.5, arc: 1.8 });
    this.game.emit('produce', { type: this.outputType });
  }
}
