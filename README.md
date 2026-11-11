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
  (construcciones, empleados, mejoras y plata) y cada granja suma **ingresos +×0,5**
  (+×0,75 desde la 11), mejoras con +2 niveles de tope y contenido nuevo. Los precios suben
  ×1,3 por granja hasta la 10 y ×1,15 desde la 11 (la mudanza: ×1,6 y ×1,35):

  | Granja | Contenido nuevo |
  |---|---|
  | 2 | 🎃 Zapallar → 🥫 Dulcería, 🎂 Pastelería (🥚 + 🥛 + 🌾) y la Pastelera Dora que la abastece |
  | 3 | 🐑 Zona Este: ovejas (🧶) → 🧣 Tejeduría, 🎪 Feria, Pancho, Lola y Mateo |
  | 4 | 🍓 Frutillar → 🍦 Heladería (🍓 + 🥛), Ana |
  | 5 | 🍎 Manzanar → 🧃 Juguería, Toto |
  | 6 | 🌻 Zona Oeste: Girasoles → 🧴 Aceitera, 🌬️ Molino (🌾🌾 → 🥣, +20% ingresos), 🥐 Facturería (🥣 + 🧴 + 🥚), 🧺 Mercado, Chela, Facu, Mirta, Rulo y el Panadero Julio (abastece Facturería y Pastelería) |
  | 7 | 🐐 Los Cerros (el cerco se corre al norte): 🌿 Pastizal → 🐐 Cabras (🍶 leche de cabra) → 🧀 Quesería (🍶🍶), 🍕 Pizzería (🥣 + 🧀 + 🧴), 🏪 Parador, 🏗️ Silo (+50% en comederos y pallets, +20% ingresos), mejora Cabritas, Nina, Coco, Lali y el Pizzero Tano |
  | 8 | 🌷 Las Flores (el cerco se corre al este): 🌷 Invernadero (cultiva tulipanes, +20% ingresos) → 🐝 Colmenas (🍯 miel) → 🍪 Alfajorería (🥣 + 🍯 + 🥛), 🏪 Kiosco, mejora Abejas, Lucio, Male, Tomi, el Alfajorero Gringo y Gerencia del Kiosco |
  | 9 | 🦆 La Laguna (el cerco se corre al norte otra vez): 🦆 Laguna (patos y orilla de pesca 🐟, +20% ingresos) → 🍤 Freiduría (🐟🐟 + 🥚) y 🥟 Rotisería (🐟 + 🥣), 🏪 Cantina, mejora Cañas, Cacho, Nelly, Juanchi, la Cocinera Rosita y Gerencia de la Cantina |
  | 10 | 🍽️ Restaurante: los comensales se sientan y piden 🥞 (🥐 + 🥛), 🥪 (🍞 + 🧀), 🍲 (🐟 + 🎃) o 🍨 (🎂 + 🍦); la cocina cocina sólo lo pedido con lo que haya en la despensa, Mela o el Mozo Pipo lo llevan a la mesa y, si llega rápido, dejan propina ⭐. Ayudante Fito, mejora Más mesas, ⛲ Fuente (más comensales, +20% ingresos) y Gerencia del Restaurante |
  | 11 | 🧉 **Zona Sur** (cruzando la ruta): 🍃 Yerbal → 🧉 Secadero, 🏪 Pulpería, Tarefera Chiche, Tincho y Yoli. 🚂 **Estación**: un tren trae pedidos grandes (paga ×2,4) |
  | 12 | 🎋 Cañaveral → 🍬 Ingenio → 🍮 Dulce de leche (🥛 + 🍬), Cañero Pepe y Doña Elsa. 🐎 **Caballeriza**: parándose en la baldosa 🐎, Mela sale a cabalgar 75 s (+velocidad, +10 de carga); después el caballo se cansa y descansa 90 s |
  | 13 | 🍅 **La Chacra** (lejano oeste): huerta (Quique lleva los tomates a la despensa del Restaurante), 🍝 Fábrica de Pastas (🥣 + 🥚) con Nonna Pina, plato 🍜 tallarines con tuco. 💧 **Tanque australiano**: riego, campos +30% |
  | 14 | 🐂 Novillos (🌿 del potrero → 🥩) → 🌭 Carnicería → 🥙 Parrilla (🌭 + 🍞), 🏪 Bodegón, Gaucho Ciro, Parrillero Chacho, Nati y Gaspar, mejora Novillos+, plato 🍖 asado. 🎻 **Peña folklórica**: cada ~4 min, 45 s con el doble de clientes |
  | 15 | 🏡 **Las Lomas** (lejano este): **Hostería** — los huéspedes hacen check-in, pagan y van a su cabaña; al irse la dejan para limpiar con 🛏️ sábanas (☁️ Algodonal → Lavadero). Lavandera Tere, Mucama Mabel, Conserje Lucía, mejora Más cabañas. 🏊 **Pileta**: más huéspedes |
  | 16 | 🌲 **Las Sierras** (lejano norte): Pinar → 🪵 Aserradero → 🪑 Carpintería; una cabaña amueblada paga +50%. Hachero Moncho y Carpintero Fermín. 🚡 **Aerosilla**: parada en la estación, Mela viaja por el aire entre la Hostería y Las Sierras |
  | 17 | 🍇 Viñedo → 🍷 Bodega, 🏪 Vinoteca, Flor, Santi y Cami. **Maridaje**: con 🍷 en la despensa, cada plato del Restaurante paga +40%. 🎈 **Globo aerostático**: paseos que dejan plata al aterrizar |
  | 18 | ⚓ **La Costa** (hasta el río): Puerto con barcos que piden productos caros y pagan ×4, Despachante Héctor. 🏗️ **Grúa**: carga sola en el barco lo que se deje en el 📦 depósito |
  | 19 | 🥜 Manisero → 🍫 Chocolatería (🍬 + 🥛 + 🥜), 🏪 Casa de Chocolates, plato 🍰 chocotorta. 🌳 **Plaza del pueblo**: +30% de clientes en todas las tiendas |
  | 20 | 🏛️ **Estancia Mela** y 💍 **la boda de Mela y Matías**: todos los empleados vienen al jardín, se dan el sí, se besan, fuegos artificiales; Mela lleva velo durante la ceremonia y la luna de miel. 🎆 **Fiesta de la Cosecha**: cada ~5 min, 60 s con ventas +50% |
  | 21+ | Se repiten los especiales (Molino 2, Silo 2…): +20% ingresos |
- **Pitanga y Odin:** los gatos de la granja. Viven en los mostradores (Pitanga arriba, Odin al
  lado), de vez en cuando salen a pasear y los clientes los saludan.
- **Gerencia (📋, una por negocio):** baldosa al lado de cada tienda (Tienda, Almacén, Feria, Mercado, Parador, Kiosco, Cantina, Restaurante,
  Pulpería, Bodegón, Hostería, Vinoteca y Casa de Chocolates),
  con 3 niveles caros para que el negocio funcione solo: **1)** encargado/a que cubre lo que más falta
  (mesas, estantería o comederos), **2)** caja propia (las ventas entran directo, sin juntar billetes) y
  **3)** a full (+40% de velocidad en sus talleres y corrales). Se habilita con cajero y repartidor del negocio.
- **Matías, el administrador** (después de la cajera): recorre tiendas y talleres, charla con
  todos y a veces reta en broma a algún empleado. Cada tanto acompaña a Mela (sin frenarla) y
  le da una ayuda: ⚡ turbo de velocidad, 🏷️ promo (+25% ventas) o 💵 propina.
  Mejoras: 💼 **Cobranza** (junta solo la plata de las pilas, +3%/nivel), 📊 **Contabilidad**
  (+5% ventas/nivel) y 🤝 **Ayuda** (viene más seguido y sus ayudas rinden más).
- **Mela y Matías son pareja:** cada tanto se dicen cosas tiernas. Cada 5–8 minutos Matías pide
  un beso: aparece el botón 💋 (abajo a la derecha, o tecla K) durante 8 s. Si lo tocás se dan un
  beso (sin frenar el juego) y Mela queda 💕 **Enamorada** 30 s: +25% velocidad y +30% ventas.
- **Camionero Ramón** ($1500): lee el pedido del camión, junta lo que falta (pallets, cajón del
  tractor o cosechando) y lo carga solo.
- **Día y noche:** cada 8 minutos pasa un día entero (☀️ día → 🌇 tarde → 🌙 noche → 🌅 amanecer):
  cambian el cielo, la luz y el ángulo del sol. El momento del día se ve al lado de la granja.
- **Misiones:** objetivos cortos con premio (tarjeta arriba a la izquierda).
- **Charlas:** clientes, empleados y Mela conversan con globitos y "voces"; además dan pistas
  (ej. "¿Hay alguien en la caja?").

El progreso se guarda en `localStorage` (botón ⟲ para reiniciar todo).
En la consola del navegador: `game.addMoney(1000)` para probar.

## Arquitectura (`src/`)
| Archivo | Rol |
|---|---|
| `core/Game.js` | Renderer (con resolución adaptativa si los cuadros tardan), escena, cámara, luces, loop, economía |
| `core/Bake.js` | "Horneado": fusiona las primitivas de cada modelo en un mesh con color por vértice (personajes por partes, ítems y plantas desde plantillas, decoración por zonas del mapa). Pasó de ~42.000 objetos a ~2.800 en la Granja 10 |
| `core/Input.js` | Joystick virtual + teclado |
| `core/Audio.js` | Música (loop country) y efectos sintetizados; mute guardado |
| `core/Fx.js` | Ítems volando en arco, tweens, textos flotantes, confeti |
| `core/Labels.js` | Sprites y calcomanías de suelo con Canvas 2D |
| `models/Models.js` | Todos los modelos low-poly (primitivas, con caché): personajes, frentes de tienda (tarima, estantes, toldo y cartel), patios de talleres, deck del restaurante + definición de ítems/precios |
| `entities/PlayerController.js` | Movimiento, colisiones AABB, límites, cartel MAX |
| `systems/StackManager.js` | Pila en la espalda: posiciones, entrada/salida animada, bamboleo con resorte |
| `systems/Pile.js` / `CashPile.js` | Almacenes en el mundo (grilla apilada) / billetes recolectables |
| `systems/TransferZone.js` | Zonas genéricas de depositar/recoger para jugador y trabajadores |
| `entities/ResourceNode.js` | Campos (maíz, trigo, zapallo): crecimiento y cosecha por proximidad |
| `entities/ProductionUnit.js` | Corral: animales consumen maíz y producen huevos/leche |
| `entities/Processor.js` | Talleres con receta (panadería, dulcería, pastelería, molino, aceitera, facturería) |
| `entities/Restaurant.js` | Restaurante (Granja 10): mesas, comensales, despensa, cocina, pasaplatos y propina |
| `entities/CustomerAI.js` + `QueueSystem.js` + `Shop.js` | Clientes, fila y mostradores (esperan hasta que haya lo que pidieron)  |
| `entities/Truck.js` | Camión con pedidos de todos los productos disponibles (también el tren de la Estación y el barco del Puerto) |
| `entities/UnlockZone.js` | Pago progresivo para desbloquear |
| `entities/WorkerAI.js` / `Tractor.js` | Empleados con nombre (granjeros, repartidores, cajeros, camionero/despachante, panaderos, mozo, mucama) y tractor. Ana, Pancho y Ciro además hacen "mandados" (🥛 a la Heladería, 🧶 a la Tejeduría, 🥩 a la Carnicería) |
| `systems/Missions.js` | Misiones con recompensa (escucha eventos del juego) |
| `systems/Chatter.js` | Diálogos entre personajes y pistas |
| `world/World.js` | Mapa, desbloqueos, mejoras por nivel, Zona Norte, prestigio y balance por granja |
| `world/Expansion.js` | Granjas 11 a 20 (se mezcla en World): zonas nuevas, construcciones, especiales y la boda |
| `models/ModelsExtra.js` | Ítems, cultivos, animales y construcciones de las Granjas 11 a 20 |
| `entities/Hostel.js` | Hostería (Granja 15): huéspedes, cabañas sucias/limpias/amuebladas y recepción |
| `config.js` | Todos los números de balance |
