import { computeAircraftShade, buildShadeColorConfig, assignPartMaskColors, fillQuad2D } from './aircraft-3d-shade.js';
import { extractChromaticGroups, classifyAircraftGroups, buildGroup3DMeshes } from './aircraft-3d-groups.js';
import { loadImageAsync } from './project-io.js';

export function parseAircraftParamsFromName(filename) {
  if (!filename) return null;
  const m = filename.match(/bp(\d{3})h(\d{3})/i);
  if (!m) return null;
  return {
    length: parseInt(m[1], 10) / 10,
    height: parseInt(m[2], 10) / 10
  };
}

function getSlotForDegree(degree) {
  let deg = degree % 360;
  if (deg < 0) deg += 360;
  if (deg === 45) return 0;
  if (deg === 0) return 1;
  if (deg === 315) return 2;
  if (deg === 270) return 3;
  if (deg === 225) return 4;
  if (deg === 180) return 5;
  if (deg === 135) return 6;
  return 7; // 90 deg
}

function mapLegacyMonochromeFallback(srcData, imgW, imgH, length, height, sqrtCoeff, outBase, outMask, outW, outH) {
  const pixelLen = Math.pow(length / 96, sqrtCoeff) * 96;
  const pixelH = Math.pow(height / 96, sqrtCoeff) * 96;
  const sx = pixelLen / Math.max(1, imgW);
  const sy = pixelLen / Math.max(1, imgH);

  for (let deg = 0; deg < 360; deg += 45) {
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const tx = getSlotForDegree(deg) * 96 + 48;
    const ty = 71;

    for (let x = 0; x < imgW; x++) {
      for (let y = 0; y < imgH; y++) {
        const idx = (y * imgW + x) * 4;
        const r = srcData[idx], g = srcData[idx + 1], b = srcData[idx + 2], a = srcData[idx + 3];
        if (a === 0 || (r === 255 && g === 255 && b === 255)) continue;

        let zVal = 0;
        if (r !== 0) zVal = r;
        if (g !== 0) zVal = g;
        if (b !== 0) zVal = b;

        const lx = (x - imgW / 2) * sx;
        const lz = (y - imgH / 2) * sy;
        const rx = cos * lx + sin * lz;
        const rz = -sin * lx + cos * lz;
        const px = Math.trunc(tx + rx);
        const py = Math.trunc(ty + 0.5 * rz - (pixelH * zVal) / 255);

        if (px >= 0 && px < outW && py >= 0 && py < outH) {
          const oIdx = (py * outW + px) * 4;
          outBase[oIdx] = r > 0 ? 255 : 0;
          outBase[oIdx + 1] = g > 0 ? 255 : 0;
          outBase[oIdx + 2] = b > 0 ? 255 : 0;
          outBase[oIdx + 3] = 255;

          outMask[oIdx] = 128;
          outMask[oIdx + 1] = 128;
          outMask[oIdx + 2] = 128;
          outMask[oIdx + 3] = 255;
        }
      }
    }
  }
}

export function mapAircraftPlanTo8Dirs(srcImg, rawOpts = {}) {
  const imgW = srcImg.naturalWidth || srcImg.width;
  const imgH = srcImg.naturalHeight || srcImg.height;
  const length = Math.max(1, parseFloat(rawOpts.length) || 39.5);
  const height = Math.max(0.1, parseFloat(rawOpts.height) || 12.5);
  const sqrtCoeff = Math.max(0.1, parseFloat(rawOpts.sqrtCoeff) || 0.8);
  const shadeCfg = buildShadeColorConfig(rawOpts);

  const sCanvas = document.createElement('canvas');
  sCanvas.width = imgW;
  sCanvas.height = imgH;
  const sCtx = sCanvas.getContext('2d');
  sCtx.imageSmoothingEnabled = false;
  sCtx.drawImage(srcImg, 0, 0);
  const srcData = sCtx.getImageData(0, 0, imgW, imgH).data;

  const outW = 96 * 8;
  const outH = 96;
  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = outW;
  baseCanvas.height = outH;
  const baseCtx = baseCanvas.getContext('2d');
  const baseImgData = baseCtx.createImageData(outW, outH);
  const baseData = baseImgData.data;

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = outW;
  maskCanvas.height = outH;
  const maskCtx = maskCanvas.getContext('2d');
  const maskImgData = maskCtx.createImageData(outW, outH);
  const maskData = maskImgData.data;

  for (let i = 0; i < outW * outH; i++) {
    const idx = i * 4;
    baseData[idx] = 231; baseData[idx + 1] = 255; baseData[idx + 2] = 255; baseData[idx + 3] = 255;
    maskData[idx] = 231; maskData[idx + 1] = 255; maskData[idx + 2] = 255; maskData[idx + 3] = 255;
  }

  const pixelLength = Math.pow(length / 96, sqrtCoeff) * 96;
  const pixelHeight = Math.pow(height / 96, sqrtCoeff) * 96;

  const groups = extractChromaticGroups(srcData, imgW, imgH);
  if (groups.length === 0) {
    mapLegacyMonochromeFallback(srcData, imgW, imgH, length, height, sqrtCoeff, baseData, maskData, outW, outH);
    baseCtx.putImageData(baseImgData, 0, 0);
    maskCtx.putImageData(maskImgData, 0, 0);
    return { baseCanvas, maskCanvas, groupCount: 0, summary: '単色モード展開' };
  }

  classifyAircraftGroups(groups, imgW, imgH, pixelLength, pixelHeight);
  buildGroup3DMeshes(groups, imgW, imgH, pixelLength, pixelHeight);
  assignPartMaskColors(groups);

  for (let deg = 0; deg < 360; deg += 45) {
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const tx = getSlotForDegree(deg) * 96 + 48;
    const ty = 71;

    const projectedGroups = groups.map((grp) => {
      let sumDepth = 0;
      let minScreenY = Infinity;
      let vCount = 0;

      const projQuads = grp.quads3d.map((q) => {
        let qDepth = 0;
        const pts2d = q.verts.map(([lx, ly, lz]) => {
          const rx = cos * lx + sin * lz;
          const rz = -sin * lx + cos * lz;
          const sx = tx + rx;
          const sy = ty + 0.5 * rz - ly;
          const depth = rz + 0.02 * ly;

          sumDepth += depth;
          if (sy < minScreenY) minScreenY = sy;
          vCount++;
          qDepth += depth;
          return [sx, sy];
        });

        const [nx0, ny0, nz0] = q.normal;
        const wNx = cos * nx0 + sin * nz0;
        const wNy = ny0;
        const wNz = -sin * nx0 + cos * nz0;
        const grayVal = computeAircraftShade(wNx, wNy, wNz, shadeCfg);

        return { pts2d, grayVal, depth: qDepth / 4 };
      });

      projQuads.sort((a, b) => a.depth - b.depth);

      return {
        maskRgb: grp.maskRgb,
        avgDepth: vCount > 0 ? sumDepth / vCount : 0,
        minScreenY,
        projQuads
      };
    });

    projectedGroups.sort((a, b) => (a.avgDepth - b.avgDepth) || (a.minScreenY - b.minScreenY));

    for (const pg of projectedGroups) {
      for (const pq of pg.projQuads) {
        const [q0, q1, q2, q3] = pq.pts2d;
        fillQuad2D(baseData, maskData, outW, outH, q0, q1, q2, q3, pq.grayVal, pg.maskRgb);
      }
    }
  }

  baseCtx.putImageData(baseImgData, 0, 0);
  maskCtx.putImageData(maskImgData, 0, 0);

  const counts = { fuselage: 0, wing: 0, vertical_stabilizer: 0, engine: 0 };
  groups.forEach(g => { counts[g.partType] = (counts[g.partType] || 0) + 1; });
  const summary = `胴体:${counts.fuselage} / 翼:${counts.wing} / 垂直尾翼:${counts.vertical_stabilizer} / エンジン:${counts.engine}`;

  return { baseCanvas, maskCanvas, groupCount: groups.length, summary };
}

export class AircraftMapperController {
  constructor(app, pickFileFn) {
    this.app = app;
    this.pickFileFn = pickFileFn;
    this.planCanvas = null;
    this.planName = 'bp395h125_aircraft.png';
  }

  bindEvents() {
    document.getElementById('btn-aircraft-load-plan')?.addEventListener('click', async () => {
      const f = await this.pickFileFn('.png');
      if (f) await this.loadPlanFromFile(f);
    });
    document.getElementById('btn-aircraft-new-plan')?.addEventListener('click', () => {
      this.createNewPlan(64, 64, true);
    });
    document.getElementById('btn-aircraft-edit-plan')?.addEventListener('click', () => {
      this.openPlanInPaintEditor();
    });
    document.getElementById('btn-aircraft-save-plan')?.addEventListener('click', () => {
      this.savePlanPng();
    });
    document.getElementById('btn-aircraft-map')?.addEventListener('click', () => {
      this.generate8Dirs();
    });
  }

  syncParamsFromFilename(filename) {
    const parsed = parseAircraftParamsFromName(filename);
    if (!parsed) return;
    const inpLen = document.getElementById('inp-aircraft-length');
    const inpH = document.getElementById('inp-aircraft-height');
    if (inpLen) inpLen.value = parsed.length.toFixed(1);
    if (inpH) inpH.value = parsed.height.toFixed(1);
  }

  setPlanCanvas(canvas, name = null) {
    this.planCanvas = canvas;
    if (name) {
      this.planName = name;
      this.syncParamsFromFilename(name);
    }
    const info = document.getElementById('lbl-aircraft-plan-info');
    if (info && this.planCanvas) {
      info.textContent = `平面定義画像: ${this.planName} (${this.planCanvas.width}×${this.planCanvas.height}px)`;
    }
  }

  async loadPlanFromFile(file) {
    if (!file) return;
    const img = await loadImageAsync(URL.createObjectURL(file));
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);
    this.setPlanCanvas(c, file.name);
  }

  createNewPlan(w = 64, h = 64, openPaint = true) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    this.setPlanCanvas(c, 'bp395h125_new_plan.png');
    if (openPaint) {
      this.openPlanInPaintEditor();
    }
  }

  openPlanInPaintEditor() {
    if (!this.planCanvas) {
      this.createNewPlan(64, 64, false);
    }
    this.app.paintEditor.open('aircraftPlan');
  }

  savePlanPng() {
    if (!this.planCanvas) {
      alert('保存する平面定義画像が読み込まれていません。');
      return;
    }
    this.planCanvas.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = this.planName.toLowerCase().endsWith('.png') ? this.planName : `${this.planName}.png`;
      a.click();
    }, 'image/png');
  }

  generate8Dirs() {
    const app = this.app;
    if (!this.planCanvas) {
      alert('先に「📂 平面定義画像を開く」または「🆕 新規平面図」から平面定義画像を用意してください。');
      return;
    }

    const opts = {
      length: parseFloat(document.getElementById('inp-aircraft-length')?.value) || 39.5,
      height: parseFloat(document.getElementById('inp-aircraft-height')?.value) || 12.5,
      sqrtCoeff: parseFloat(document.getElementById('inp-aircraft-coeff')?.value) || 0.8,
      topColor: document.getElementById('inp-aircraft-col-top')?.value || '#CCCCCC',
      leftWallColor: document.getElementById('inp-aircraft-col-left')?.value || '#B2B2B2',
      rightWallColor: document.getElementById('inp-aircraft-col-right')?.value || '#808080',
      sunColor: document.getElementById('inp-aircraft-col-sun')?.value || '#FFFFFF'
    };

    const { baseCanvas, maskCanvas, summary } = mapAircraftPlanTo8Dirs(this.planCanvas, opts);
    const baseOutName = this.planName
      .replace(/^bp\d{3}h\d{3}_/i, '')
      .replace(/\.png$/i, '_def.png');
    const maskOutName = baseOutName.replace(/_def\.png$/i, '_paint.png');

    app.applyBaseImage(baseCanvas, baseOutName, { resetMask: false });
    app.applyMaskImage(maskCanvas, maskOutName);
    app.markDirty();
    app.zoomFit();
    app.render();

    const status = document.getElementById('lbl-aircraft-status');
    if (status) {
      status.textContent = `完了 (768×96px) | ${summary}`;
    }
  }
}