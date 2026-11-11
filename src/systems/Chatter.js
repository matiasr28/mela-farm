// Chatter: los personajes conversan con globitos de diálogo y "voces" de balbuceo.
//  - Clientes que charlan en la fila, cajeros con clientes, empleados con Mela y entre ellos.
//  - Mela comenta lo que pasa (pila llena, desbloqueos, misiones).
//  - Pistas útiles: un cliente avisa si no hay nadie en la caja o si falta un producto.
// Un "talker" es cualquier objeto con { root, voice, bubbleY, name? }.
import { CanvasLabel, roundRect, FONT } from '../core/Labels.js';
import { ITEMS } from '../models/Models.js';
import { pick, rand, distXZ2 } from '../utils.js';

// ---------------------------------------------------------------------------
// Diálogos (cada entrada: [línea del 1º, línea del 2º]; {a} = nombre del 1º, {b} = del 2º)
// ---------------------------------------------------------------------------
const QUEUE_CHATS = [
  ['¡Qué fila larga!', 'Vale la pena, todo es fresquito.'],
  ['¿Viniste por los huevos?', '¡Sí! Son los mejores del pueblo.'],
  ['Mi abuela hacía tortas con estos huevos.', '¡La granja de Mela es un clásico!'],
  ['¿Probaste la leche de acá?', '¡Riquísima! Me llevo para toda la semana.'],
  ['Qué lindo día para venir a la granja.', '¡Ni una nube!'],
  ['¿Vos también venís todos los días?', 'Ya soy cliente VIP 😎'],
  ['Dicen que Mela se levanta a las cinco.', '¡Con razón le va tan bien!'],
  ['¿Viste las gallinas? ¡Son enormes!', 'Y re simpáticas.'],
  ['Hoy hago panqueques.', '¡Uh, invitame!'],
  ['¿Cuánto hace que abrió esta granja?', 'Poco, ¡y ya es famosa!'],
];
const ALMACEN_CHATS = [
  ['¡Ese pan huele increíble!', 'Recién salido del horno.'],
  ['¿Hay torta hoy?', '¡Ojalá! Es mi cumple 🎂'],
  ['El dulce de zapallo es mi debilidad.', '¡Con queso es lo más!'],
  ['Pan casero, como el de antes.', 'Para el mate de la tarde, ideal.'],
  ['Vine desde el pueblo de al lado.', '¡Yo también! Todos hablan de Mela.'],
];
const FERIA_CHATS = [
  ['¡Qué linda esta bufanda!', 'Tejida con lana de la granja.'],
  ['¿Probaste el helado de frutilla?', '¡Es el mejor del mundo! 🍦'],
  ['Un jugo de manzana, por favor.', '¡Recién exprimido!'],
  ['¡Esta feria está buenísima!', 'Mela pensó en todo.'],
  ['¿Las ovejas tienen nombre?', '¡Seguro que Mela se los puso!'],
];
const MERCADO_CHATS = [
  ['¿Probaste las medialunas de acá?', '¡Con un café son lo más! 🥐'],
  ['Aceite de girasol de la granja, ¡qué lujo!', 'Para las ensaladas, ideal.'],
  ['¿Viste el molino? ¡Es gigante!', '¡Ahí muelen la harina!'],
  ['Me llevo una docena de medialunas.', '¡Uh, ¿hay cumple?'],
  ['¡Qué lindos los girasoles!', 'Siempre miran para el sol 🌻'],
];
const PARADOR_CHATS = [
  ['¿Probaste el queso de cabra?', '¡Es lo más rico que hay! 🧀'],
  ['Vine solo por la pizza de Mela 🍕', '¡Yo también! Hay que esperar, pero vale la pena.'],
  ['¿Viste las cabritas en el cerro?', '¡Una se subió arriba del comedero!'],
  ['¡Qué vista linda hay desde acá arriba!', 'Se ve toda la granja.'],
  ['¿El silo ese es nuevo?', 'Sí, ahora entra mucho más alimento.'],
];
const KIOSCO_CHATS = [
  ['¿Probaste los alfajores de Mela?', '¡Mejores que los de la costa! 🍪'],
  ['Miel de las flores del invernadero 🍯', '¡Con razón es tan rica!'],
  ['Cuidado, ¡hay abejas por todos lados! 🐝', 'Tranqui, son re buenas.'],
  ['Me llevo una docena de alfajores.', '¿Para el viaje? ¡Buena idea!'],
  ['¡Qué lindo el invernadero!', 'Parece un arcoíris de tulipanes 🌷'],
];
const CANTINA_CHATS = [
  ['¿Viste los patitos en la laguna? 🦆', '¡Hay uno que no para de nadar en círculos!'],
  ['Unas empanadas de pescado, ¡qué invento!', '¡Son de lo más ricas! 🥟'],
  ['Frituras recién hechas 🍤', 'Con limoncito, ¡ideal!'],
  ['Dicen que acá se pesca con la mano.', '¡Mela se mete al agua y todo!'],
  ['¡Qué linda la laguna al atardecer!', 'La granja no para de crecer.'],
];
const PULPERIA_CHATS = [
  ['¿Llevás yerba para el mate? 🧉', '¡Siempre! Sin mate no arranco el día.'],
  ['Esta yerba es de acá, ¡del yerbal de Mela!', 'Con razón tiene tanto sabor.'],
  ['¿Hay dulce de leche? 🍮', '¡El mejor del país, dicen!'],
  ['¿Escuchaste el tren? 🚂', '¡Llega cargado y se va más cargado todavía!'],
  ['¿Viste a Mela a caballo? 🐎', '¡Parece una gaucha de verdad!'],
];
const BODEGON_CHATS = [
  ['¡Un choripán, por favor! 🥙', '¡Con chimichurri, que es lo mejor!'],
  ['Huele a asado desde la ruta 🔥', '¡Es la parrilla de Chacho!'],
  ['¿Probaste las pastas de Nonna Pina? 🍝', '¡Como las de mi abuela!'],
  ['¿Vamos a la peña después? 🎻', '¡Dale! Hoy toca zamba.'],
  ['Los novillos están hermosos 🐂', 'Ciro los cuida como a hijos.'],
];
const VINOTECA_CHATS = [
  ['¿Un malbec de la casa? 🍷', '¡Recién salido de la bodega!'],
  ['¿Viste el globo? 🎈', '¡Se ve toda la granja desde arriba!'],
  ['Vino y chocolate, ¡qué combinación! 🍫', 'Mela sabe lo que hace.'],
  ['¿Vamos a la hostería este finde? 🏡', '¡Ya reservé cabaña!'],
];
const CHOCO_CHATS = [
  ['¿Probaste el chocolate con maní? 🥜', '¡Es una locura!'],
  ['Una caja de bombones para mi mamá 🍫', '¡Qué lindo regalo!'],
  ['¿Te enteraste? ¡Mela y Matías se casan! 💍', '¡Qué emoción! 🥹'],
  ['La plaza del pueblo quedó hermosa 🌳', 'Ahora viene gente de todos lados.'],
];
const CASHIER_CHATS = [
  ['¡Hola! ¿Qué te llevás?', 'Lo de siempre, por favor.'],
  ['¡Bienvenido a lo de Mela!', '¡Gracias! Siempre tan amables.'],
  ['¿Algo más?', 'No, con eso estoy. ¡Gracias!'],
  ['¡Está todo fresquísimo, eh!', '¡Por eso vengo acá!'],
];
const MELA_CASHIER_CHATS = [
  ['¡Hola! Bienvenido a mi granja.', '¡Hola, Mela! Me encanta este lugar.'],
  ['¿Qué te llevás hoy?', 'Lo mejor que tengas 😄'],
  ['¡Gracias por venir!', '¡Volvemos mañana!'],
];
const WORKER_TO_MELA = {
  farmer: [
    ['¡Mela! El campo viene bárbaro este año.', '¡Genial, {a}! Seguí así.'],
    ['Hoy cosecho todo, ¡prometido!', '¡Esa es la actitud!'],
    ['¿Viste qué lindo crece todo?', '¡Gracias a vos, {a}!'],
  ],
  carrier: [
    ['¡Voy volando con la mercadería!', '¡Dale, {a}, que hay fila!'],
    ['¡Las estanterías no se llenan solas!', 'Gracias por la mano, {a}.'],
  ],
  trucker: [
    ['¡Mela! El camión sale completito 🚚', '¡Genial, {a}!'],
    ['Otro pedido despachado, jefa 📦', '¡Sos un crack, {a}!'],
  ],
  baker: [
    ['¡Mela! Las medialunas salen calentitas 🥐', '¡Qué rico, {a}!'],
    ['No para el horno, ¡qué ritmo!', '¡Vos sos el ritmo, {a}!'],
    ['¡Sale una pizza bien de muzza! 🍕', '¡Qué pinta, {a}!'],
    ['¡Alfajores recién bañados! 🍪', '¡Guardame uno, {a}!'],
    ['¡Salen empanadas para la Cantina! 🥟', '¡Qué olorcito, {a}!'],
  ],
  maid: [
    ['¡Mela! Las cabañas quedaron impecables ✨', '¡Gracias, {a}! Sos una genia.'],
    ['¡Necesito más sábanas, jefa! 🛏️', '¡Ya mando al Lavadero, {a}!'],
  ],
  shipper: [
    ['¡Mela! El barco sale completito 🚢', '¡Genial, {a}!'],
    ['Carga despachada, ¡rumbo al mundo! ⚓', '¡Sos un crack, {a}!'],
  ],
  waiter: [
    ['¡Mesa 3 servida, jefa! 🍽️', '¡Volando, {a}!'],
    ['Hoy dejaron una propina bárbara ⭐', '¡Porque sos un rayo, {a}!'],
  ],
  manager: [
    ['Mela, tranquila: este negocio lo manejo yo 📋', '¡Gracias, {a}! Sos lo más.'],
    ['Todo en orden por acá, jefa.', '¡Así da gusto, {a}!'],
    ['Las mesas llenas y la caja también 💵', '¡Excelente, {a}!'],
  ],
  cashier: [
    ['Mela, ¡hoy vendimos un montón!', '¡Sos una genia, {a}!'],
    ['La gente pregunta por vos, Mela.', '¡Mandales saludos!'],
  ],
};
const WORKER_CHATS = [
  ['¿Tomamos unos mates después?', '¡Dale! Yo llevo bizcochitos.'],
  ['¿Viste el tractor nuevo?', '¡Es una nave!'],
  ['Uf, qué calor.', 'Ánimo, {a}, ¡que la granja crece!'],
  ['Mela es la mejor jefa.', '¡Totalmente!'],
  ['¿Cuántas gallinas hay ya?', 'Perdí la cuenta 😅'],
  ['¡Buen día, {b}!', '¡Buen día, {a}! ¿Todo bien?'],
];
const NO_CASHIER = ['¿Hay alguien en la caja?', '¡Hola! ¿Me cobran? 🙋', 'Mela, ¿me atendés?'];
const MELA_LINES = {
  full: ['¡No me entra más!', '¡Uf, llena!', '¡A descargar!'],
  unlock: ['¡Quedó hermoso!', '¡La granja crece!', '¡Genial!', '¡Qué lindo!'],
  mission: ['¡Misión cumplida!', '¡Vamos todavía!', '¡Lo logré!'],
  start: ['¡Hola! Soy Mela. ¡A trabajar! 🌽', '¡Buen día, granja!'],
};

const LINE_TIME = 2.6;

/** Globito de diálogo que sigue la cabeza de un personaje. */
class SpeechBubble {
  constructor(game, talker, text, duration) {
    this.game = game;
    this.talker = talker;
    this.life = duration;
    this.age = 0;
    this.label = new CanvasLabel(512, 200, 1.05, (ctx, W, H) => SpeechBubble.draw(ctx, W, H, text, talker.name));
    this.label.sprite.center.set(0.5, 0); // ancla abajo, sobre la cabeza
    this.label.sprite.renderOrder = 60;
    game.scene.add(this.label.sprite);
    this.baseScale = this.label.sprite.scale.clone();
  }

  static draw(ctx, W, H, text, name) {
    ctx.font = `800 36px ${FONT}`;
    // Ajuste de línea
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(test).width > 440 && cur) { lines.push(cur); cur = w; } else cur = test;
    }
    if (cur) lines.push(cur);
    const shown = lines.slice(0, 3);
    const lineH = 42;
    const nameH = name ? 30 : 0;
    const bw = Math.min(W - 16, Math.max(...shown.map((l) => ctx.measureText(l).width), name ? 120 : 0) + 48);
    const bh = shown.length * lineH + 26 + nameH;
    const x = (W - bw) / 2;
    const y = H - bh - 22;
    roundRect(ctx, x, y + 4, bw, bh, 24);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fill();
    roundRect(ctx, x, y, bw, bh, 24);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(W / 2 - 14, y + bh - 1);
    ctx.lineTo(W / 2, H - 4);
    ctx.lineTo(W / 2 + 14, y + bh - 1);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (name) {
      ctx.font = `900 26px ${FONT}`;
      ctx.fillStyle = name === 'Mela' ? '#ff4f81' : '#2f7de1';
      ctx.fillText(name, W / 2, y + 26);
    }
    ctx.font = `800 36px ${FONT}`;
    ctx.fillStyle = '#2b3a55';
    shown.forEach((l, i) => ctx.fillText(l, W / 2, y + 13 + nameH + lineH * (i + 0.5)));
  }

  /** Devuelve false cuando hay que eliminarlo. */
  update(dt) {
    this.age += dt;
    const t = this.talker;
    if (this.age >= this.life || t.dead || !t.root.parent) return false;
    const p = t.root.position;
    this.label.sprite.position.set(p.x, t.bubbleY, p.z);
    // Aparece con rebote y se desvanece al final
    const k = Math.min(1, this.age / 0.18);
    const s = 0.6 + 0.4 * k + Math.sin(k * Math.PI) * 0.08;
    this.label.sprite.scale.set(this.baseScale.x * s, this.baseScale.y * s, 1);
    this.label.material.opacity = Math.min(1, (this.life - this.age) / 0.3);
    return true;
  }

  dispose() { this.label.dispose(); }
}

export class Chatter {
  constructor(game) {
    this.game = game;
    this.bubbles = [];
    this.convos = [];
    this.cooldown = 3;
    this.lastSay = {};
    game.add(this);
  }

  /** Muestra un globito sobre `talker` con su "voz". */
  say(talker, text, duration = LINE_TIME) {
    const old = this.bubbles.find((b) => b.talker === talker);
    if (old) { old.dispose(); this.bubbles.splice(this.bubbles.indexOf(old), 1); }
    this.bubbles.push(new SpeechBubble(this.game, talker, text, duration));
    this.game.audio.play(talker.isCat ? 'meow' : 'talk', { pos: talker.root.position, pitch: talker.voice ?? 1 });
  }

  /** Comentario de Mela ante un evento (con enfriamiento por tipo). */
  playerSays(kind) {
    const now = this.game.time;
    if ((this.lastSay[kind] ?? -99) + 10 > now) return;
    this.lastSay[kind] = now;
    const p = this.game.player;
    if (this.convos.some((c) => c.talkers.includes(p))) return;
    this.say(p, pick(MELA_LINES[kind]));
  }

  /** Conversación de varias líneas: [[talker, texto], ...] */
  startConvo(lines) {
    const talkers = [...new Set(lines.map((l) => l[0]))];
    talkers.forEach((t) => { t._talking = true; });
    const convo = { lines, i: 0, t: 0, talkers };
    this.convos.push(convo);
    return convo;
  }

  free(t) { return t && !t._talking && !t.dead; }

  update(dt) {
    // Globitos
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      if (!this.bubbles[i].update(dt)) { this.bubbles[i].dispose(); this.bubbles.splice(i, 1); }
    }
    // Conversaciones en curso
    for (let i = this.convos.length - 1; i >= 0; i--) {
      const c = this.convos[i];
      c.t -= dt;
      if (c.t > 0) continue;
      if (c.i >= c.lines.length || c.talkers.some((t) => t.dead)) {
        c.talkers.forEach((t) => { t._talking = false; });
        this.convos.splice(i, 1);
        continue;
      }
      const [who, text] = c.lines[c.i++];
      this.say(who, text);
      c.t = LINE_TIME + 0.2;
    }
    // Arrancar una charla nueva cada tanto
    this.cooldown -= dt;
    if (this.cooldown <= 0 && this.convos.length < 2) {
      this.cooldown = rand(4, 8);
      this.tryStart();
    }
  }

  // ---------------------------------------------------------------------------
  tryStart() {
    const builders = [
      () => this.hintConvo(), () => this.queueConvo(), () => this.cashierConvo(),
      () => this.workerMelaConvo(), () => this.workerWorkerConvo(), () => this.catConvo(),
      () => this.coupleConvo(),
    ];
    // Las pistas tienen prioridad; el resto se elige al azar
    const first = builders.shift();
    builders.sort(() => Math.random() - 0.5);
    for (const b of [first, ...builders]) {
      const lines = b();
      if (lines) { this.startConvo(lines); return; }
    }
  }

  shops() { return this.game.world.shops(); }
  near(t) { return distXZ2(t.root.position, this.game.player.position) < 16 * 16; }

  /** Pistas: nadie en la caja / falta un producto. */
  hintConvo() {
    for (const shop of this.shops()) {
      const f = shop.queue.front();
      if (!f?.atSlot || !this.free(f) || !this.near(f)) continue;
      if (!shop.cashierOn && shop.waitTime > 5) return [[f, pick(NO_CASHIER)]];
      const miss = shop.missingType();
      if (miss && shop.waitTime > 4) {
        const it = ITEMS[miss];
        return [[f, pick([`¡No quedan ${it.emoji}!`, `¿No hay ${it.name}? 🤔`, `Estoy esperando ${it.emoji}...`])]];
      }
    }
    return null;
  }

  queueConvo() {
    for (const shop of this.shops().sort(() => Math.random() - 0.5)) {
      const q = shop.queue.queue;
      for (let i = 1; i < q.length - 1; i++) {
        const a = q[i];
        const b = q[i + 1];
        if (a.atSlot && b.atSlot && this.free(a) && this.free(b) && this.near(a)) {
          const w = this.game.world;
          const pool = shop === w.shop2 ? ALMACEN_CHATS : shop === w.shop3 ? FERIA_CHATS : shop === w.shop4 ? MERCADO_CHATS : shop === w.shop5 ? PARADOR_CHATS : shop === w.shop6 ? KIOSCO_CHATS : shop === w.shop7 ? CANTINA_CHATS
            : shop === w.shop8 ? PULPERIA_CHATS : shop === w.shop9 ? BODEGON_CHATS : shop === w.shop10 ? VINOTECA_CHATS : shop === w.shop11 ? CHOCO_CHATS : QUEUE_CHATS;
          const [l1, l2] = pick(pool);
          return [[a, l1], [b, l2]];
        }
      }
    }
    return null;
  }

  cashierConvo() {
    const p = this.game.player;
    for (const shop of this.shops()) {
      const f = shop.queue.front();
      if (!f?.atSlot || !this.free(f) || !shop.cashierOn) continue;
      const atCashier = distXZ2(p.position, shop.cashierSpot) < 1.0;
      if (atCashier && this.free(p)) {
        const [l1, l2] = pick(MELA_CASHIER_CHATS);
        return [[p, l1], [f, l2]];
      }
      const cashier = this.game.world.workers.find((w) => w.role === 'cashier' && w.getShop() === shop);
      if (cashier && this.free(cashier) && this.near(cashier)) {
        const [l1, l2] = pick(CASHIER_CHATS);
        return [[cashier, l1], [f, l2]];
      }
    }
    return null;
  }

  workerMelaConvo() {
    const p = this.game.player;
    if (!this.free(p)) return null;
    const w = this.game.world.workers.find((x) => this.free(x) && distXZ2(x.position, p.position) < 4.5 * 4.5);
    if (!w) return null;
    const [l1, l2] = pick(WORKER_TO_MELA[w.talkRole ?? w.role] ?? WORKER_TO_MELA[w.role]);
    return [[w, fill(l1, w, p)], [p, fill(l2, w, p)]];
  }

  workerWorkerConvo() {
    const ws = this.game.world.workers.filter((w) => this.free(w) && this.near(w));
    for (let i = 0; i < ws.length; i++) {
      for (let j = i + 1; j < ws.length; j++) {
        if (distXZ2(ws[i].position, ws[j].position) < 5 * 5) {
          const [l1, l2] = pick(WORKER_CHATS);
          return [[ws[i], fill(l1, ws[i], ws[j])], [ws[j], fill(l2, ws[i], ws[j])]];
        }
      }
    }
    return null;
  }
}

const CAT_GREETS = {
  Pitanga: ['¡Hola, Pitanga! 😺', '¡Qué peludo está Pitanga!', 'Pitanga, ¡qué lindo collar!', '¿Me dejás acariciarte, Pitanga?'],
  Odin: ['¡Hola, Odin! 😺', '¡Odin, qué ojos celestes!', '¡Qué lindo gatito blanco!', 'Odin, ¿cuidás la tienda?'],
};
const MEOWS = ['Miau 💕', 'Miau~', 'Prrrr...', '¡Miau!', 'Mrrr 😺'];

Chatter.prototype.catConvo = function catConvo() {
  const w = this.game.world;
  const p = this.game.player;
  for (const cat of (w.cats ?? []).filter((c) => this.free(c) && this.near(c))) {
    // Mela pasa cerca del gato
    if (this.free(p) && distXZ2(p.position, cat.position) < 2.5 * 2.5) {
      return [[p, `¡Hola, ${cat.name}! 🐾`], [cat, pick(MEOWS)]];
    }
    if (!cat.atHome) continue;
    // Clientes de la fila de su tienda
    const c = cat.shop?.queue.queue.find((q) => q.atSlot && this.free(q) && distXZ2(q.position, cat.position) < 3.5 * 3.5);
    if (c) return [[c, pick(CAT_GREETS[cat.name] ?? ['¡Hola, gatito!'])], [cat, pick(MEOWS)]];
  }
  return null;
};

// ---------------------------------------------------------------------------
// Mela y Matías son pareja: cada tanto se dicen cosas tiernas (M = Matías, P = Mela)
// ---------------------------------------------------------------------------
const COUPLE_CHATS = [
  [['M', '¿Cómo va mi granjera favorita? 🌻'], ['P', '¡Mejor ahora que llegaste, amor!']],
  [['M', 'Te guardé el último mate 🧉'], ['P', '¡Sos un sol, Mati!']],
  [['P', '¿Ya te dije que sos el mejor administrador?'], ['M', 'Porque tengo la mejor jefa 💕']],
  [['P', 'Mati, ¿me querés?'], ['M', '¡Más que a los números! 📊💕']],
  [['M', 'Estás hermosa con olor a campo 😄'], ['P', '¡Jaja, qué tonto! Te quiero 💕']],
  [['P', 'Hoy a la noche, ¿pizza y peli?'], ['M', '¡Hecho! Yo invito 🍕']],
  [['M', 'Mela, ¿sabés qué es lo mejor de esta granja?'], ['P', '¿Las gallinas?'], ['M', '¡Vos! 💕']],
];
const TEASES = ['¡Uy, los tortolitos! 😏', '¡Qué lindos! 🥰', '¡Qué empalagosos! 🍯😂', '¡Ay, el amor! 💕'];

Chatter.prototype.coupleConvo = function coupleConvo() {
  const m = this.game.world.matias;
  const p = this.game.player;
  if (!m || !this.free(m) || !this.free(p) || Math.random() > 0.5) return null;
  if (!['roam', 'collect'].includes(m.state) || distXZ2(m.position, p.position) > 6 * 6) return null;
  const lines = pick(COUPLE_CHATS).map(([who, text]) => [who === 'M' ? m : p, text]);
  // A veces algún empleado cercano los carga
  const witness = this.game.world.workers.find((w) => this.free(w) && distXZ2(w.position, p.position) < 7 * 7);
  if (witness && Math.random() < 0.4) lines.push([witness, pick(TEASES)]);
  for (let i = 0; i < 3; i++) {
    this.game.fx.tween(0.4 + i * 0.5, null, () => {
      const mid = m.position.clone().lerp(p.position, 0.5).setY(2.2 + Math.random() * 0.3);
      this.game.fx.floatText('💕', mid);
    });
  }
  return lines;
};

function fill(text, a, b) {
  return text.replaceAll('{a}', a.name ?? '').replaceAll('{b}', b.name ?? '');
}

export { MELA_LINES };
