// Guardado local (localStorage). Todo en try/catch: el juego funciona aunque esté bloqueado.
export class SaveSystem {
  constructor(key) { this.key = key; }

  load() {
    try { return JSON.parse(localStorage.getItem(this.key)) || null; } catch { return null; }
  }

  save(data) {
    try { localStorage.setItem(this.key, JSON.stringify(data)); } catch { /* sin almacenamiento */ }
  }

  clear() {
    try { localStorage.removeItem(this.key); } catch { /* sin almacenamiento */ }
  }
}
