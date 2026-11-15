// 飛行機の平面図を8方向に展開するマクロ (Pak64AircraftMapper)

function buildAircraftAffine(imgW, imgH, degree, length, sqrtCoeff = 0.8) {
  const rad = (degree * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const pixelLength = Math.pow(length / 96, sqrtCoeff) * 96;
  const sx = pixelLength / Math.max(1, imgW);
  const sy = pixelLength / Math.max(1, imgH);

  let deg = degree % 360;
  if (deg < 0) deg += 360;

  let slot = 0;
  if (deg === 45) slot = 0;
  else if (deg === 0) slot = 1;
  else if (deg === 315) slot = 2;
  else if (deg === 270) slot = 3;
  else if (deg === 225) slot = 4;
  else if (deg === 180) slot = 5;
  else if (deg === 135) slot = 6;
  else if (deg === 90) slot = 7;

  const tx = slot * 96 + 48;
  const ty = 71;

  const ox = -imgW / 2;
  const oy = -imgH / 2;

  const a00 = cos * sx;
  const a01 = sin * sy;
  const a02 = cos * sx * ox + sin * sy * oy + tx;

  const a10 = -0.5 * sin * sx;
  const a11 = 0.5 * cos * sy;
  const a12 = 0.5 * (-sin * sx * ox + cos * sy * oy) + ty;

  return { a00, a01, a02, a10, a11, a12 };
}

export function parseAircraftParamsFromName(filename) {
  if (!filename) return null;
  const m = filename.match(/bp(\d{3})h(\d{3})/i);
  if (!m) return null;
  return {
    length: parseInt(m[1], 10) / 10,
    height: parseInt(m[2], 10) / 10
  };
}

export function mapAircraftPlanTo8Dirs(srcImg, rawLength = 39.5, rawHeight = 12.5, rawSqrtCoeff = 0.8) {
  const imgW = srcImg.naturalWidth || srcImg.width;
  const imgH = srcImg.naturalHeight || srcImg.height;
  const length = Math.max(1, parseFloat(rawLength) || 39.5);
  const height = Math.max(0.1, parseFloat(rawHeight) || 12.5);
  const sqrtCoeff = Math.max(0.1, parseFloat(rawSqrtCoeff) || 0.8);

  const sCanvas = document.createElement('canvas');
  sCanvas.width = imgW;
  sCanvas.height = imgH;
  const sCtx = sCanvas.getContext('2d');
  sCtx.imageSmoothingEnabled = false;
  sCtx.drawImage(srcImg, 0, 0);
  const srcData = sCtx.getImageData(0, 0, imgW, imgH).data;

  const outW = 96 * 8;
  const outH = 96;
  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext('2d');
  const outImgData = outCtx.createImageData(outW, outH);
  const outData = outImgData.data;

  for (let i = 0; i < outW * outH; i++) {
    outData[i * 4] = 231;
    outData[i * 4 + 1] = 255;
    outData[i * 4 + 2] = 255;
    outData[i * 4 + 3] = 255;
  }

  const pixelHeight = Math.pow(height / 96, sqrtCoeff) * 96;

  for (let deg = 0; deg < 360; deg += 45) {
    const { a00, a01, a02, a10, a11, a12 } = buildAircraftAffine(imgW, imgH, deg, length, sqrtCoeff);

    for (let x = 0; x < imgW; x++) {
      for (let y = 0; y < imgH; y++) {
        const idx = (y * imgW + x) * 4;
        const r = srcData[idx];
        const g = srcData[idx + 1];
        const b = srcData[idx + 2];
        const a = srcData[idx + 3];

        if (a === 0 || (r === 255 && g === 255 && b === 255 && a === 255)) continue;

        let zVal = 0;
        if (r !== 0) zVal = r;
        if (g !== 0) zVal = g;
        if (b !== 0) zVal = b;

        const plotHeight = (pixelHeight * zVal) / 255;
        const tx = a00 * x + a01 * y + a02;
        const ty = a10 * x + a11 * y + a12;

        const px = Math.trunc(tx);
        const py = Math.trunc(ty - plotHeight);

        if (px >= 0 && px < outW && py >= 0 && py < outH) {
          const oIdx = (py * outW + px) * 4;
          outData[oIdx] = r > 0 ? 255 : 0;
          outData[oIdx + 1] = g > 0 ? 255 : 0;
          outData[oIdx + 2] = b > 0 ? 255 : 0;
          outData[oIdx + 3] = 255;
        }
      }
    }
  }

  outCtx.putImageData(outImgData, 0, 0);
  return outCanvas;
}

export class AircraftMapperController {
  constructor(app) {
    this.app = app;
  }

  bindEvents() {
    const btnRun = document.getElementById('btn-aircraft-map');
    if (btnRun) btnRun.onclick = () => this.applyToBase();
  }

  syncParamsFromFilename(filename) {
    const parsed = parseAircraftParamsFromName(filename);
    if (!parsed) return;
    const inpLen = document.getElementById('inp-aircraft-length');
    const inpH = document.getElementById('inp-aircraft-height');
    if (inpLen) inpLen.value = parsed.length.toFixed(1);
    if (inpH) inpH.value = parsed.height.toFixed(1);
  }

  applyToBase() {
    const app = this.app;
    if (!app.baseImage) {
      alert('先にベース画像（飛行機平面図PNG）を読み込んでください。');
      return;
    }

    const length = parseFloat(document.getElementById('inp-aircraft-length')?.value) || 39.5;
    const height = parseFloat(document.getElementById('inp-aircraft-height')?.value) || 12.5;
    const coeff = parseFloat(document.getElementById('inp-aircraft-coeff')?.value) || 0.8;

    const outCanvas = mapAircraftPlanTo8Dirs(app.baseImage, length, height, coeff);
    const nextName = app.baseName
      .replace(/^bp\d{3}h\d{3}_/i, '')
      .replace(/\.png$/i, '_prepredef.png');

    app.applyBaseImage(outCanvas, nextName, { resetMask: true });
    app.markDirty();
    app.zoomFit();
    app.render();

    const status = document.getElementById('lbl-aircraft-status');
    if (status) {
      status.textContent = `展開完了: 768×96px (全長:${length}m / 全高:${height}m)`;
    }
  }
}