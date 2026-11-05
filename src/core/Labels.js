// Labels: sprites y calcomanías de suelo dibujadas con Canvas 2D.
import * as THREE from 'three';

export const FONT = '"Nunito", "Segoe UI", Arial, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Texto con borde (contorno) centrado. */
export function strokeText(ctx, text, x, y, { size = 40, fill = '#fff', stroke = '#24432a', weight = 900 } = {}) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.18;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/**
 * Burbuja de pedido: blanca con franja verde abajo y "colita".
 * entries: [{ emoji, text, done }]
 */
export function drawOrderBubble(ctx, W, H, entries) {
  const pad = 8;
  const tail = 20;
  const bh = H - pad - tail;
  ctx.save();
  // sombra
  roundRect(ctx, pad, pad + 5, W - 2 * pad, bh, 28);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fill();
  // cuerpo
  roundRect(ctx, pad, pad, W - 2 * pad, bh, 28);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = '#62d36f';
  ctx.fillRect(pad, pad + bh * 0.72, W - 2 * pad, bh);
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(W / 2 - 16, pad + bh - 1);
  ctx.lineTo(W / 2, H - 2);
  ctx.lineTo(W / 2 + 16, pad + bh - 1);
  ctx.fillStyle = '#62d36f';
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cy = pad + bh * 0.42;
  const slotW = (W - 2 * pad) / Math.max(1, entries.length);
  entries.forEach((e, i) => {
    const cx = pad + slotW * (i + 0.5);
    ctx.font = `${Math.min(58, bh * 0.5)}px ${FONT}`;
    ctx.fillStyle = '#000';
    ctx.fillText(e.emoji, e.text ? cx - slotW * 0.2 : cx, cy);
    if (e.text) {
      strokeText(ctx, e.text, cx + slotW * 0.2, cy + 2, {
        size: Math.min(46, bh * 0.4), fill: e.done ? '#2fb24d' : '#2b3a55', stroke: '#ffffff',
      });
    }
  });
}

/** Sprite (siempre mira a cámara) con un canvas redibujable. */
export class CanvasLabel {
  constructor(width, height, worldHeight, draw) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.material = new THREE.SpriteMaterial({ map: this.texture, transparent: true, depthTest: false, depthWrite: false });
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.renderOrder = 50;
    this.sprite.scale.set((worldHeight * width) / height, worldHeight, 1);
    this.draw = draw;
    this.redraw();
  }

  redraw(...args) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.draw(this.ctx, this.canvas.width, this.canvas.height, ...args);
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.sprite.removeFromParent();
    this.texture.dispose();
    this.material.dispose();
  }
}

export function makeTextSprite(text, { color = '#ffffff', stroke = '#24432a', size = 64, worldHeight = 0.7 } = {}) {
  const tmp = document.createElement('canvas').getContext('2d');
  tmp.font = `900 ${size}px ${FONT}`;
  const w = Math.ceil(tmp.measureText(text).width + size * 0.7);
  const h = Math.ceil(size * 1.4);
  return new CanvasLabel(w, h, worldHeight, (ctx, W, H) => strokeText(ctx, text, W / 2, H / 2, { size, fill: color, stroke }));
}

/** Plano horizontal en el suelo con textura de canvas (zonas, desbloqueos). */
export class GroundDecal {
  constructor(size, draw, res = 256) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = res;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.material = new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.03;
    this.mesh.renderOrder = 1;
    this.draw = draw;
    this.redraw();
  }

  redraw(...args) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.draw(this.ctx, this.canvas.width, this.canvas.height, ...args);
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.texture.dispose();
    this.material.dispose();
  }
}
