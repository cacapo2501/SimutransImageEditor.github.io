// HSVカラー制御点からのグレースケールグラデーション生成モジュール

function pilRgbToHsv(r, g, b) {
  const maxc = Math.max(r, g, b);
  const minc = Math.min(r, g, b);
  const v = maxc;
  if (maxc === 0) return [0, 0, 0];

  const delta = maxc - minc;
  const s = Math.floor((255 * delta) / maxc);
  if (delta === 0) return [0, 0, v];

  let hFloat;
  if (r === maxc) {
    hFloat = (g - b) / delta;
  } else if (g === maxc) {
    hFloat = 2.0 + (b - r) / delta;
  } else {
    hFloat = 4.0 + (r - g) / delta;
  }
  if (hFloat < 0) hFloat += 6.0;
  const h = Math.floor((hFloat * 255.0) / 6.0);
  return [h, s, v];
}

class PlanarGradient {
  constructor(x1, y1, x2, y2) {
    const length = Math.hypot(x2 - x1, y2 - y1) || 1;
    const ux = (x2 - x1) / length;
    const uy = (y2 - y1) / length;
    this.nx = -uy;
    this.ny = ux;
    this.stops = [];
  }

  addStop(x, y, brightness) {
    const pos = this.nx * x + this.ny * y;
    this.stops = this.stops.filter(item => Math.abs(item.pos - pos) > 1e-12);
    this.stops.push({ pos, brightness });
    this.stops.sort((a, b) => a.pos - b.pos);
  }

  getBrightness(x, y) {
    if (this.stops.length === 0) return 0;
    const pos = this.nx * x + this.ny * y;
    if (pos <= this.stops[0].pos) return this.stops[0].brightness;
    const last = this.stops[this.stops.length - 1];
    if (pos >= last.pos) return last.brightness;

    for (let i = 0; i < this.stops.length - 1; i++) {
      const s0 = this.stops[i];
      const s1 = this.stops[i + 1];
      if (Math.abs(pos - s0.pos) <= 1e-12) return s0.brightness;
      if (Math.abs(pos - s1.pos) <= 1e-12) return s1.brightness;
      if (s0.pos < pos && pos < s1.pos) {
        const w = (pos - s0.pos) / (s1.pos - s0.pos);
        return s0.brightness * (1.0 - w) + s1.brightness * w;
      }
    }
    return last.brightness;
  }
}

function processSubImageData(srcData, subW, subH) {
  const out = new Uint8ClampedArray(subW * subH * 4);
  for (let i = 0; i < subW * subH; i++) {
    out[i * 4] = 231;
    out[i * 4 + 1] = 255;
    out[i * 4 + 2] = 255;
    out[i * 4 + 3] = 255;
  }

  const dicPaint = new Map();
  const dicControl = new Map();

  for (let x = 0; x < subW; x++) {
    for (let y = 0; y < subH; y++) {
      const idx = (y * subW + x) * 4;
      const r = srcData[idx];
      const g = srcData[idx + 1];
      const b = srcData[idx + 2];
      const a = srcData[idx + 3];

      if (a === 0 || (r === 231 && g === 255 && b === 255)) continue;

      const [h, s, v] = pilRgbToHsv(r, g, b);
      if (s === 0) {
        out[idx] = r;
        out[idx + 1] = g;
        out[idx + 2] = b;
        out[idx + 3] = 255;
      } else if (s >= 125 && s <= 129) {
        if (!dicPaint.has(h)) dicPaint.set(h, []);
        dicPaint.get(h).push([x, y]);
      } else if (s >= 253) {
        if (!dicControl.has(h)) dicControl.set(h, []);
        dicControl.get(h).push([x, y, v]);
        if (!dicPaint.has(h)) dicPaint.set(h, []);
        dicPaint.get(h).push([x, y]);
      }
    }
  }

  let appliedHues = 0;
  dicControl.forEach((arrCtrl, h) => {
    const subStops = new Map();
    let curGrad = null;

    for (let i = 0; i < arrCtrl.length; i++) {
      let registered = false;
      for (let j = i + 1; j < arrCtrl.length; j++) {
        if (arrCtrl[i][2] === arrCtrl[j][2]) {
          if (curGrad === null) {
            curGrad = new PlanarGradient(arrCtrl[i][0], arrCtrl[i][1], arrCtrl[j][0], arrCtrl[j][1]);
            curGrad.addStop(arrCtrl[i][0], arrCtrl[i][1], arrCtrl[i][2]);
            registered = true;
            break;
          }
        }
      }
      if (!registered) {
        subStops.set(arrCtrl[i][2], [arrCtrl[i][0], arrCtrl[i][1]]);
      }
    }

    if (!curGrad && arrCtrl.length >= 2) {
      curGrad = new PlanarGradient(arrCtrl[0][0], arrCtrl[0][1], arrCtrl[1][0], arrCtrl[1][1]);
      subStops.clear();
      for (const [cx, cy, cv] of arrCtrl) {
        subStops.set(cv, [cx, cy]);
      }
    }

    if (!curGrad) return;

    subStops.forEach(([sx, sy], brightness) => {
      curGrad.addStop(sx, sy, brightness);
    });

    const arrPaint = dicPaint.get(h) || [];
    for (let i = 0; i < arrPaint.length; i++) {
      const [px, py] = arrPaint[i];
      const curB = Math.max(0, Math.min(255, Math.trunc(curGrad.getBrightness(px, py))));
      const oIdx = (py * subW + px) * 4;
      out[oIdx] = curB;
      out[oIdx + 1] = curB;
      out[oIdx + 2] = curB;
      out[oIdx + 3] = 255;
    }
    appliedHues++;
  });

  return { data: out, appliedHues };
}

export function generateGradientOnBase(srcImg, split8Dirs = true) {
  const w = srcImg.naturalWidth || srcImg.width;
  const h = srcImg.naturalHeight || srcImg.height;

  const sCanvas = document.createElement('canvas');
  sCanvas.width = w;
  sCanvas.height = h;
  const sCtx = sCanvas.getContext('2d');
  sCtx.imageSmoothingEnabled = false;
  sCtx.drawImage(srcImg, 0, 0);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext('2d');

  const divisions = (split8Dirs && w >= 8 && w % 8 === 0) ? 8 : 1;
  const subW = Math.floor(w / divisions);
  let totalHues = 0;

  for (let i = 0; i < divisions; i++) {
    const sx = subW * i;
    const subImgData = sCtx.getImageData(sx, 0, subW, h);
    const { data, appliedHues } = processSubImageData(subImgData.data, subW, h);
    totalHues += appliedHues;
    outCtx.putImageData(new ImageData(data, subW, h), sx, 0);
  }

  return { canvas: outCanvas, divisions, totalHues };
}

export class GradientGeneratorController {
  constructor(app) {
    this.app = app;
  }

  bindEvents() {
    const btnRun = document.getElementById('btn-gradient-generate');
    if (btnRun) btnRun.onclick = () => this.applyToBase();
  }

  applyToBase() {
    const app = this.app;
    if (!app.baseImage) {
      alert('先にグラデーション制御点付きのベース画像を読み込んでください。');
      return;
    }

    const split8 = Boolean(document.getElementById('chk-gradient-split8')?.checked);
    const { canvas, divisions, totalHues } = generateGradientOnBase(app.baseImage, split8);

    const nextName = app.baseName.replace(/_predef\.png$/i, '_def.png');
    app.applyBaseImage(canvas, nextName, { resetMask: true, resetDat: false, isTransform: true });
    app.markDirty();
    app.render();

    const status = document.getElementById('lbl-gradient-status');
    if (status) {
      status.textContent = `生成完了 (${divisions}分割処理 / 検出色相グループ: ${totalHues}件)`;
    }
  }
}