# Prompt de Desarrollo de Juego: Replica Arcade Idle (Estilo My Perfect Hotel / Farm Arcade)

## Objetivo
Generar el código base y la arquitectura completa para construir un minijuego arcade de gestión, recolección y venta en 3D (*Arcade Idle*), inspirado en la mecánica del juego mostrado en el video.

---

## 1. Concepto y Visión General
* **Género:** Arcade Idle / Farm & Market Management 3D.
* **Perspectiva:** Vista isométrica / tercera persona superior fija.
* **Estilo Visual:** Low-poly o cartoon 3D, colores brillantes y accesibles.
* **Mecánica Central:** El jugador controla a un personaje en tiempo real utilizando un Joystick virtual para recolectar recursos, transportarlos apilados en su espalda, abastecer cadenas de producción y vender los productos a clientes o camiones para ganar dinero y desbloquear mejoras.

---

## 2. Controles y Física del Personaje
* **Movimiento:**
  * Control por Joystick virtual en pantalla (pantalla táctil o arrastrar ratón).
  * Movimiento suave en 8 direcciones con animación de caminata/carrera.
* **Mecánica de Apilado (Stacking System):**
  * Los recursos recolectados se apilan verticalmente en la espalda del personaje formando una columna dinámica.
  * Límite de carga inicial (ej. 10 unidades) ampliable mediante dinero.
  * Efecto visual de bamboleo (*Physics Wobble*) según la velocidad y movimiento del personaje.

---

## 3. Loop de Juego (Gameplay Loop) & Cadenas de Recursos

1. **Cosecha:**
   * El jugador o los empleados van al campo de maíz y cortan/recolectan maíz automáticamente al acercarse.
   * El maíz crece y se regenera con un temporizador.
2. **Alimentación y Producción:**
   * Llevar el maíz cosechado a la zona de las gallinas.
   * Al depositar el maíz en el alimentador, las gallinas consumen el recurso y producen **Huevos**.
3. **Punto de Venta 1 (Camión de Entregas):**
   * Llevar sacos de maíz o huevos al camión estacionado para completar pedidos específicos y recibir billetes.
4. **Punto de Venta 2 (Mostrador de Clientes):**
   * Llevar los huevos a la tienda/mostrador.
   * Los clientes (NPCs) hacen cola en el mostrador para comprar huevos.
   * Al atender a los clientes, estos dejan pilas de billetes verdes en el suelo.
5. **Recolección de Dinero:**
   * Pasar por encima de las pilas de billetes para recogerlos e incrementarlos en el contador global.

---

## 4. Sistema de Desbloqueos y Progresión (*Unlock Zones*)
* **Zonas de Interacción por Costo:**
  * Módulos circulares o cuadrados en el suelo con un precio flotante (ej. `$50`, `$70`, `$150`).
  * Al permanecer parado sobre la zona, el dinero del jugador se consume gradualmente llenando la barra de progreso hasta completar la compra.
* **Elementos Desbloqueables:**
  * **Trabajadores (Helpers):** NPCs automatizados que cosechan maíz o transportan recursos al mostrador.
  * **Maquinaria (Tractor/Cosechadora):** Herramientas automatizadas que aceleran la recolección masiva.
  * **Nuevas Áreas:** Desbloqueo de zonas adyacentes (ej. Granja de vacas para producción de leche).
  * **Mejoras de Capacidad:** Aumentar el límite de carga de la espalda y velocidad del personaje.

---

## 5. Requisitos de Código y Arquitectura
Por favor, proporciona el código estructurado incluyendo:

1. **PlayerController:** Movimiento por Joystick y detección de colisiones/trigger con zonas de recursos.
2. **StackManager:** Control del almacenamiento en espalda, posicionamiento `Vector3` de cada elemento en la pila y animaciones de entrada/salida.
3. **ResourceNode & ProductionUnit:** Lógica del cultivo (crecimiento), consumo de maíz por gallinas y generación de huevos.
4. **CustomerAI & QueueSystem:** IA simple de clientes que caminan hacia la fila, esperan su producto, pagan y se van.
5. **UnlockZone:** Sistema de transferencia progresiva de monedas del jugador al área de compra.

---

## Instrucciones adicionales para el LLM
* El juego va a estar hosteado en Vercel Free, así que tiene que ser hecho en HTML con Three.JS
* Genera scripts limpios, comentados y modulares para facilitar la integración.