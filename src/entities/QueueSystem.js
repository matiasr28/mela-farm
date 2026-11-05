// QueueSystem: fila ordenada de clientes sobre slots fijos.
// Cuando alguien sale, todos avanzan un lugar.
export class QueueSystem {
  /** @param {THREE.Vector3[]} slots  posiciones de la fila; slots[0] = frente al mostrador */
  constructor(slots) {
    this.slots = slots;
    this.queue = [];
  }

  get isFull() { return this.queue.length >= this.slots.length; }
  get length() { return this.queue.length; }

  front() { return this.queue[0] ?? null; }

  join(customer) {
    this.queue.push(customer);
    this.refresh();
  }

  leave(customer) {
    const i = this.queue.indexOf(customer);
    if (i >= 0) this.queue.splice(i, 1);
    this.refresh();
  }

  refresh() {
    this.queue.forEach((c, i) => c.setQueueTarget(this.slots[i], i));
  }
}
