# Mela's Farm 🌽🐔🥚

Tycoon arcade 3D de la granja de Mela, hecho con **HTML + Three.js** (módulos ES, sin build).
Jugable en PC y celular (joystick táctil), con música y efectos sintetizados en vivo (Web Audio, sin archivos).

## Jugar en local
Los módulos ES necesitan un servidor HTTP (abrir el `index.html` con doble clic no funciona):

```bash
npx serve .
# o
python -m http.server 8080
```

## Deploy en Vercel (Free)
Es un sitio 100% estático: importá la carpeta/repo en Vercel con **Framework Preset: Other**,
sin build command y con output directory `.`. O bien, desde la terminal: `npx vercel --prod`.

## Controles
- **Táctil / mouse:** arrastrá en cualquier parte de la pantalla (joystick flotante).
- **Teclado:** WASD o flechas.

## Loop de juego
1. Caminá por el **campo** → cosechás maíz automáticamente (se apila en la espalda).
2. Dejalo en el **comedero** (⬇) → las gallinas producen **huevos** en el pallet (⬆).
3. Llevá los huevos a la **tienda** (⬇) y parate en la **caja** (💲) para atender a la fila.
4. Pasá sobre los **billetes** para cobrar.
5. Parate sobre las **baldosas celestes con precio** para desbloquear: camión de pedidos,
   empleados (Tito, Pili, Lucho, Rosa, Beto, Sol, Nico, Juana), vacas, tractor, Zona Norte...

## Progresión
- **Mejoras por niveles:** Mochila, Botas, Ayudantes, Gallinas, Vacas, Fertilizante y Hornos.
  Cada compra sube un nivel y la baldosa reaparece más cara.
- **Zona Norte:** 🌾 trigo → 🍞 Panadería → Almacén (con su cajera y repartidor).
- **Granjas:** al comprar todo aparece la baldosa "Granja N+1". **Se conserva todo**
  (construcciones, empleados, mejoras y plata) y cada granja suma **ingresos +×0,5**,
  mejoras con +2 niveles de tope y contenido nuevo:

  | Granja | Contenido nuevo |
  |---|---|
  | 2 | 🎃 Zapallar → 🍯 Dulcería, 🎂 Pastelería (🥚 + 🥛 + 🌾) |
  | 3 | 🐑 Zona Este: ovejas (🧶) → 🧣 Tejeduría, 🎪 Feria, Pancho, Lola y Mateo |
  | 4 | 🍓 Frutillar → 🍦 Heladería (🍓 + 🥛), Ana |
  | 5 | 🍎 Manzanar → 🧃 Juguería, Toto |
  | 6+ | Una construcción especial por granja (Molino, Silo, Invernadero, Laguna, Fuente…): +20% ingresos |
- **Misiones:** objetivos cortos con premio (tarjeta arriba a la izquierda).
- **Charlas:** clientes, empleados y Mela conversan con globitos y "voces"; además dan pistas
  (ej. "¿Hay alguien en la caja?").

El progreso se guarda en `localStorage` (botón ⟲ para reiniciar todo).
En la consola del navegador: `game.addMoney(1000)` para probar.

## Arquitectura (`src/`)
| Archivo | Rol |
|---|---|
| `core/Game.js` | Renderer, escena, cámara, luces, loop, economía |
| `core/Input.js` | Joystick virtual + teclado |
| `core/Audio.js` | Música (loop country) y efectos sintetizados; mute guardado |
| `core/Fx.js` | Ítems volando en arco, tweens, textos flotantes, confeti |
| `core/Labels.js` | Sprites y calcomanías de suelo con Canvas 2D |
| `models/Models.js` | Todos los modelos low-poly (primitivas, con caché) + definición de ítems/precios |
| `entities/PlayerController.js` | Movimiento, colisiones AABB, límites, cartel MAX |
| `systems/StackManager.js` | Pila en la espalda: posiciones, entrada/salida animada, bamboleo con resorte |
| `systems/Pile.js` / `CashPile.js` | Almacenes en el mundo (grilla apilada) / billetes recolectables |
| `systems/TransferZone.js` | Zonas genéricas de depositar/recoger para jugador y trabajadores |
| `entities/ResourceNode.js` | Campos (maíz, trigo, zapallo): crecimiento y cosecha por proximidad |
| `entities/ProductionUnit.js` | Corral: animales consumen maíz y producen huevos/leche |
| `entities/Processor.js` | Talleres con receta (panadería, dulcería, pastelería) |
| `entities/CustomerAI.js` + `QueueSystem.js` + `Shop.js` | Clientes, fila y mostradores (Tienda / Almacén) |
| `entities/Truck.js` | Camión con pedidos de todos los productos disponibles |
| `entities/UnlockZone.js` | Pago progresivo para desbloquear |
| `entities/WorkerAI.js` / `Tractor.js` | Empleados con nombre y ayudantes automáticos |
| `systems/Missions.js` | Misiones con recompensa (escucha eventos del juego) |
| `systems/Chatter.js` | Diálogos entre personajes y pistas |
| `world/World.js` | Mapa, desbloqueos, mejoras por nivel, Zona Norte y prestigio |
| `config.js` | Todos los números de balance |
