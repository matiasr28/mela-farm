// Valores de balance centralizados. Ajustá acá la dificultad / ritmo del juego.
export const CONFIG = {
  startMoney: 0,
  saveKey: 'melas-farm-save-v1',

  // Área jugable (el jugador no puede salir de este rectángulo)
  bounds: { minX: -19, maxX: 26, minZ: -16, maxZ: 13.4 },

  player: { speed: 5.5, capacity: 10, radius: 0.45 },

  // Tiempo entre ítems al depositar / recoger en una zona
  transferInterval: 0.08,

  field: { growTime: 7, harvestRadius: 1.5, harvestInterval: 0.1 },

  coop: { produceTime: 1.5, feederMax: 24, outputMax: 32 },
  barn: { produceTime: 2.2, feederMax: 24, outputMax: 24 },

  shop: { eggShelfMax: 24, milkShelfMax: 18, serveInterval: 0.22, spawnMin: 2.5, spawnMax: 5, queueSize: 6 },

  truck: { rewardMult: 1.6, returnTime: 5 },

  workers: { speed: 3.4 },
};
