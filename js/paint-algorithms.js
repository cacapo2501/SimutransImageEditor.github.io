import { hexToRgb } from './color-utils.js';

// 連続直線描画 (Bresenhamアルゴリズム)
export function drawLineContinuous(x0, y0, x1, y1, setPixel) {
  let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let curX = x0, curY = y0;

  while (true) {
    setPixel(curX, curY);
    if (curX === x1 && curY === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; curX += sx; }
    if (e2 <= dx) { err += dx; curY += sy; }
  }
}

// 4近傍塗りつぶし (Flood Fill)
export function floodFill(ctx, width, height, startX, startY, fillHex, selectionMask = null) {
  if (selectionMask && !selectionMask[startY * width + startX]) return;

  const imgData = ctx.getImageData(0, 0, width, height);
  const d = imgData.data;
  const startIdx = (startY * width + startX) * 4;
  const [sr, sg, sb, sa] = [d[startIdx], d[startIdx + 1], d[startIdx + 2], d[startIdx + 3]];
  const [fr, fg, fb] = hexToRgb(fillHex);
  if (sr === fr && sg === fg && sb === fb && sa === 255) return;

  const queue = [[startX, startY]];
  const visited = new Uint8Array(width * height);
  visited[startY * width + startX] = 1;

  while (queue.length > 0) {
    const [cx, cy] = queue.pop();
    const idx = (cy * width + cx) * 4;
    d[idx] = fr; d[idx + 1] = fg; d[idx + 2] = fb; d[idx + 3] = 255;

    const neighbors = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const nPos = ny * width + nx;
      if (visited[nPos]) continue;
      if (selectionMask && !selectionMask[nPos]) continue;

      const nIdx = nPos * 4;
      if (d[nIdx] === sr && d[nIdx + 1] === sg && d[nIdx + 2] === sb && d[nIdx + 3] === sa) {
        visited[nPos] = 1;
        queue.push([nx, ny]);
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

// 自動選択マスク生成 (Magic Wand)
export function magicWandMask(ctx, width, height, startX, startY) {
  const d = ctx.getImageData(0, 0, width, height).data;
  const sIdx = (startY * width + startX) * 4;
  const [sr, sg, sb] = [d[sIdx], d[sIdx + 1], d[sIdx + 2]];

  const mask = new Uint8Array(width * height);
  const queue = [[startX, startY]];
  mask[startY * width + startX] = 1;

  while (queue.length > 0) {
    const [cx, cy] = queue.pop();
    const neighbors = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const nPos = ny * width + nx;
      if (mask[nPos]) continue;

      const nIdx = nPos * 4;
      if (d[nIdx] === sr && d[nIdx + 1] === sg && d[nIdx + 2] === sb) {
        mask[nPos] = 1;
        queue.push([nx, ny]);
      }
    }
  }
  return mask;
}

// 同色選択マスク生成
export function colorSelectMask(ctx, width, height, startX, startY) {
  const d = ctx.getImageData(0, 0, width, height).data;
  const sIdx = (startY * width + startX) * 4;
  const [sr, sg, sb] = [d[sIdx], d[sIdx + 1], d[sIdx + 2]];

  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    if (d[i * 4] === sr && d[i * 4 + 1] === sg && d[i * 4 + 2] === sb) {
      mask[i] = 1;
    }
  }
  return mask;
}

// 多角形選択マスク生成 (Ray-casting + 外周ピクセル補完)
export function rasterizePolygonMask(width, height, polyPoints) {
  const mask = new Uint8Array(width * height);
  if (polyPoints.length < 3) return mask;

  const pts = polyPoints.map(([px, py]) => [px + 0.5, py + 0.5]);
  for (let y = 0; y < height; y++) {
    const py = y + 0.5;
    for (let x = 0; x < width; x++) {
      const px = x + 0.5;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i][0], yi = pts[i][1];
        const xj = pts[j][0], yj = pts[j][1];
        const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      if (inside) mask[y * width + x] = 1;
    }
  }

  for (let i = 0; i < polyPoints.length; i++) {
    const [x0, y0] = polyPoints[i];
    const [x1, y1] = polyPoints[(i + 1) % polyPoints.length];
    drawLineContinuous(x0, y0, x1, y1, (lx, ly) => {
      if (lx >= 0 && lx < width && ly >= 0 && ly < height) {
        mask[ly * width + lx] = 1;
      }
    });
  }
  return mask;
}

// テキストピクセル焼き込み
export function renderTextPixels(width, height, text, fontSize, x, y, drawPixelFn) {
  const tCanvas = document.createElement('canvas');
  tCanvas.width = width;
  tCanvas.height = height;
  const tCtx = tCanvas.getContext('2d');
  tCtx.font = `${fontSize}px monospace`;
  tCtx.fillStyle = '#FFFFFF';
  tCtx.textBaseline = 'top';
  tCtx.fillText(text, x, y);

  const tData = tCtx.getImageData(0, 0, width, height).data;
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const idx = (py * width + px) * 4;
      if (tData[idx + 3] > 64) {
        drawPixelFn(px, py);
      }
    }
  }
}

// 選択範囲ハイライトと境界エッジ描画
export function drawSelectionOverlay(oCtx, width, height, selectionMask) {
  if (!selectionMask) return;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!selectionMask[idx]) continue;

      const isEdge =
        x === 0 || !selectionMask[idx - 1] ||
        x === width - 1 || !selectionMask[idx + 1] ||
        y === 0 || !selectionMask[idx - width] ||
        y === height - 1 || !selectionMask[idx + width];

      oCtx.fillStyle = isEdge ? 'rgba(0, 230, 255, 0.85)' : 'rgba(0, 150, 255, 0.25)';
      oCtx.fillRect(x, y, 1, 1);
    }
  }
}

// 補助線（直交グリッド）＆ ベースタイル菱形表示
export function drawGuidesOverlay(oCtx, width, height, zoomLevel, opts) {
  const lineW = 1 / Math.max(1, zoomLevel);

  // 1. 等間隔直交補助線
  if (opts.showGrid && opts.gridStep >= 1) {
    oCtx.save();
    oCtx.lineWidth = lineW;
    oCtx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    oCtx.beginPath();

    for (let x = opts.gridStep; x < width; x += opts.gridStep) {
      oCtx.moveTo(x, 0);
      oCtx.lineTo(x, height);
    }
    for (let y = opts.gridStep; y < height; y += opts.gridStep) {
      oCtx.moveTo(0, y);
      oCtx.lineTo(width, y);
    }
    oCtx.stroke();
    oCtx.restore();
  }

  // 2. ベースタイルのアイソメトリック菱形格子
  if (opts.showIsoTile && opts.isoTileW >= 4 && opts.isoTileH >= 2) {
    const Tw = opts.isoTileW;
    const Th = opts.isoTileH;
    const m = Th / Tw;
    const anchorX = width / 2;
    const anchorY = height;

    oCtx.save();
    oCtx.lineWidth = lineW;
    oCtx.strokeStyle = 'rgba(255, 170, 0, 0.35)';
    oCtx.beginPath();

    const c1Base = anchorY + m * anchorX;
    const k1Start = Math.floor(-c1Base / Th);
    const k1End = Math.ceil((height + m * width - c1Base) / Th);
    for (let k = k1Start; k <= k1End; k++) {
      const c1 = c1Base + k * Th;
      oCtx.moveTo(0, c1);
      oCtx.lineTo(width, c1 - m * width);
    }

    const c2Base = anchorY - m * anchorX;
    const k2Start = Math.floor((-m * width - c2Base) / Th);
    const k2End = Math.ceil((height - c2Base) / Th);
    for (let k = k2Start; k <= k2End; k++) {
      const c2 = c2Base + k * Th;
      oCtx.moveTo(0, c2);
      oCtx.lineTo(width, c2 + m * width);
    }
    oCtx.stroke();

    // 最下段1タイルの基準菱形枠を強調表示
    oCtx.lineWidth = lineW * 1.5;
    oCtx.strokeStyle = 'rgba(0, 230, 255, 0.8)';
    oCtx.beginPath();
    oCtx.moveTo(anchorX, anchorY);
    oCtx.lineTo(anchorX + Tw / 2, anchorY - Th / 2);
    oCtx.lineTo(anchorX, anchorY - Th);
    oCtx.lineTo(anchorX - Tw / 2, anchorY - Th / 2);
    oCtx.closePath();
    oCtx.stroke();

    oCtx.restore();
  }
}
