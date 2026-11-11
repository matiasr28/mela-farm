# Cambios: Granjas 11 a 20, caballo, día y noche

Resumen de todo lo que se agregó y cambió en esta tanda de trabajo.

## Granjas nuevas (11 a 20)

El mapa crece hacia afuera con cinco zonas nuevas, cada una con su cerco, su tierra y la vegetación que se saca al abrirla.

| Zona | Ubicación | Granja |
|---|---|---|
| 🧉 Zona Sur | cruzando la ruta | 11 |
| 🍅 La Chacra | lejano oeste | 13 |
| 🏡 Las Lomas | lejano este | 15 |
| 🌲 Las Sierras | lejano norte | 16 |
| ⚓ La Costa | al sur, hasta el río | 18 |

| Granja | Contenido | Especial (+20% de ingresos) |
|---|---|---|
| 11 | 🍃 Yerbal → 🧉 Secadero, 🏪 Pulpería. Tarefera Chiche, Cajero Tincho, Repartidora Yoli | 🚂 **Estación**: un tren trae pedidos grandes (paga ×2,4) |
| 12 | 🎋 Cañaveral → 🍬 Ingenio → 🍮 Dulce de leche (🥛 + 🍬). Cañero Pepe, Doña Elsa | 🐎 **Caballeriza**: Mela sale a cabalgar (ver más abajo) |
| 13 | 🍅 Huerta (Quique lleva los tomates a la despensa del Restaurante), 🍝 Fábrica de Pastas (🥣 + 🥚) con Nonna Pina. Plato nuevo: 🍜 tallarines con tuco | 💧 **Tanque australiano**: riego, todos los campos +30% |
| 14 | 🐂 Novillos (🌿 del potrero → 🥩) → 🌭 Carnicería → 🥙 Parrilla (🌭 + 🍞), 🏪 Bodegón. Gaucho Ciro, Parrillero Chacho, Nati, Gaspar. Mejora Novillos+. Plato nuevo: 🍖 asado | 🎻 **Peña folklórica**: cada ~4 min, 45 s con el doble de clientes |
| 15 | 🏡 **Hostería**: los huéspedes hacen check-in, pagan y van a su cabaña; al irse la dejan para limpiar con 🛏️ sábanas (☁️ Algodonal → Lavadero). Lavandera Tere, Mucama Mabel, Conserje Lucía. Mejora Más cabañas (hasta 8) | 🏊 **Pileta**: más huéspedes |
| 16 | 🌲 Pinar → 🪵 Aserradero → 🪑 Carpintería. Una cabaña amueblada paga +50%. Hachero Moncho, Carpintero Fermín | 🚡 **Aerosilla**: Mela viaja por el aire entre la Hostería y Las Sierras |
| 17 | 🍇 Viñedo → 🍷 Bodega, 🏪 Vinoteca. Flor, Santi, Cami. **Maridaje**: con 🍷 en la despensa, cada plato del Restaurante paga +40% | 🎈 **Globo aerostático**: paseos que dejan plata al aterrizar |
| 18 | ⚓ Puerto: barcos que piden productos caros y pagan ×4. Despachante Héctor | 🏗️ **Grúa**: carga sola en el barco lo que se deje en el 📦 depósito |
| 19 | 🥜 Manisero → 🍫 Chocolatería (🍬 + 🥛 + 🥜), 🏪 Casa de Chocolates. Plato nuevo: 🍰 chocotorta | 🌳 **Plaza del pueblo**: +30% de clientes en todas las tiendas |
| 20 | 🏛️ Estancia Mela y 💍 **la boda de Mela y Matías** | 🎆 **Fiesta de la Cosecha**: cada ~5 min, 60 s con ventas +50% |
| 21+ | Se repiten los especiales (+20% cada uno) | |

- **Gerencia 📋** para los negocios nuevos: Pulpería (Aldo), Bodegón (Ramona), Hostería (Susana), Vinoteca (Pedro) y Casa de Chocolates (Irma).
- **La boda:** todos los empleados se sientan en el jardín de la estancia, Mela y Matías se dan el sí, se besan y hay fuegos artificiales. Después cada uno vuelve a su trabajo.
- **Sin créditos:** el juego sigue en la Granja 21 en adelante.
- **Misiones y charlas** nuevas para todos los productos, tiendas y empleados.

## Balance

| | Hasta la Granja 10 | Desde la Granja 11 |
|---|---|---|
| Ingresos por granja | +×0,5 | +×0,75 |
| Precios | ×1,3 por granja | ×1,15 por granja |
| Mudanza | ×1,6 por granja | ×1,35 por granja |

Medido como costo de la granja contra lo que rinde, pasa de ~134 mil (Granja 10) a ~400–470 mil (Granjas 14 a 20). Con las fórmulas viejas, la Granja 20 habría llegado a ~2,4 millones.

## Ajustes de esta tanda

- **👟 Botas:** tope fijo de 10 niveles en todas las granjas (antes subía +2 por granja). Velocidad máxima 10,5. Las partidas que estaban más arriba quedan en 10.
- **🐎 Caballo como bonus:** en la Caballeriza hay una baldosa 🐎. Mela sale a cabalgar **75 s** (+1,6 de velocidad y +10 de carga). Después el caballo se cansa, Mela sigue a pie y el caballo descansa **90 s** antes de poder salir de nuevo.
- **💍 Ropa de la boda:** el velo se pone en la ceremonia y se saca al terminar la luna de miel (~1 minuto). Ya no es permanente.
- **🌇 Día y noche:** un día completo dura 8 minutos de juego (☀️ día → 🌇 tarde → 🌙 noche → 🌅 amanecer). Cambian el cielo, la luz y el ángulo del sol. El momento del día se ve al lado del cartel de la granja.

## Partidas guardadas

Las partidas que ya estaban en la Granja 11 o más tenían especiales repetidos ("Molino 2", "Silo 2"…). Al cargarlas, esos especiales pasan a ser las construcciones nuevas y reciben automáticamente la zona que necesitan.

## Archivos

| Archivo | Qué cambió |
|---|---|
| `src/world/Expansion.js` (nuevo) | Granjas 11 a 20: zonas, construcciones, empleados, especiales, caballo y boda |
| `src/models/ModelsExtra.js` (nuevo) | Ítems, cultivos, animales y construcciones nuevas |
| `src/entities/Hostel.js` (nuevo) | Hostería: huéspedes, cabañas y recepción |
| `src/world/World.js` | Balance por granja, especiales, gerencias, migración de partidas, cerco con huecos, paisaje, tope de botas |
| `src/entities/Truck.js` | Generalizado para el tren y el barco |
| `src/entities/Restaurant.js` | Platos nuevos según la granja, despensa en dos filas, maridaje |
| `src/entities/WorkerAI.js` | Looks de los empleados nuevos, mucama, despachante, lugares en la boda |
| `src/entities/PlayerController.js` | Montar y bajar del caballo, aerosilla, velo |
| `src/core/Game.js` / `Hud.js` | Ciclo de día y noche, bonus de peña, fiesta y caballo |
| `src/entities/ResourceNode.js`, `ProductionUnit.js` | Cultivos nuevos y novillos |
| `src/systems/Missions.js`, `Chatter.js` | Misiones y charlas nuevas |
| `src/entities/Shop.js`, `MatiasAI.js`, `UnlockZone.js`, `systems/TransferZone.js` | Más clientes con peña y plaza; Matías cobra en las pilas nuevas; nada se cobra ni se transfiere durante la aerosilla |
| `README.md` | Tabla de granjas, balance, día y noche, arquitectura |

## Cómo se probó

En Chrome automático (sin ventana):

- Se compró todo en orden hasta la Granja 20, con la boda incluida (143 compras), sin errores.
- Se recargó esa partida y se recorrieron todas las zonas con capturas.
- Se simularon 5 minutos de juego con los empleados trabajando: el tren, el barco y los huéspedes funcionan, y las cabañas se ensucian y se limpian en ciclo.
- Se probaron la aerosilla, el caballo (montar, cansarse, descansar), la migración de partidas viejas y la pantalla de Granja 11.

Queda sin medir el rendimiento real en el celular: la Granja 20 tiene ~5.100 objetos en escena, contra ~2.800 en la Granja 10.

## Comandos útiles (consola del navegador)

```js
// Ver la tarde / la noche
game.time = 0.6 * 480
game.time = 0.8 * 480

// Plata para probar
game.addMoney(1000000)
```
