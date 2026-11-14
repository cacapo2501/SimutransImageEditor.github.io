import { hexToRgb } from './color-utils.js';

function hexToRgba(hex, alpha = 1.0) {
  const [r, g, b] = hexToRgb(hex || '#FFFFFF');
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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

// 多角形選択マスク生成
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

// Simutrans標準アイソメトリックタイル (Tw x Th, 実効高 = Th - 1, 上下端1行=4px) の境界座標キャッシュ
let cachedIsoKey = '';
let cachedIsoData = { effH: 31, border: [] };

function getSimutransTileData(Tw, Th) {
  const key = `${Tw}x${Th}`;
  if (cachedIsoKey === key) return cachedIsoData;

  const effH = Math.max(1, Th - 1);
  const halfW = Tw / 2;
  const halfH = Th / 2;
  const step = Tw / Th;
  const fill = new Uint8Array(Tw * effH);

  for (let y = 0; y < effH; y++) {
    const dy = y < halfH ? y : (effH - 1 - y);
    const wHalf = Math.max(1, Math.round((dy + 1) * step));
    const xStart = Math.max(0, Math.floor(halfW - wHalf));
    const xEnd = Math.min(Tw - 1, Math.ceil(halfW + wHalf) - 1);
    for (let x = xStart; x <= xEnd; x++) {
      fill[y * Tw + x] = 1;
    }
  }

  const border = [];
  for (let y = 0; y < effH; y++) {
    for (let x = 0; x < Tw; x++) {
      if (!fill[y * Tw + x]) continue;
      if (
        x === 0 || !fill[y * Tw + (x - 1)] ||
        x === Tw - 1 || !fill[y * Tw + (x + 1)] ||
        y === 0 || !fill[(y - 1) * Tw + x] ||
        y === effH - 1 || !fill[(y + 1) * Tw + x]
      ) {
        border.push([x, y]);
      }
    }
  }

  cachedIsoKey = key;
  cachedIsoData = { effH, border };
  return cachedIsoData;
}

// 画像左下 (0, height) を基準としたSimutransタイル敷き詰め描画（ペイント＆メイン画面共通）
export function drawSimutransIsoTiles(ctx, width, height, isoTileW, isoTileH, isoColor = '#FFAA00') {
  if (!isoTileW || !isoTileH || isoTileW < 4 || isoTileH < 2) return;

  const Tw = Math.floor(isoTileW);
  const Th = Math.floor(isoTileH);
  const halfW = Tw / 2;
  const halfH = Th / 2;
  const { effH, border: borderPixels } = getSimutransTileData(Tw, Th);

  const baseTileX = 0;
  const baseTileY = height - effH;
  const maxSpan = Math.ceil(width / halfW) + Math.ceil(height / halfH) + 2;

  ctx.fillStyle = hexToRgba(isoColor, 0.55);
  for (let u = -maxSpan; u <= maxSpan; u++) {
    for (let v = -maxSpan; v <= maxSpan; v++) {
      if (u === 0 && v === 0) continue;
      const tileX = Math.round(baseTileX + (u - v) * halfW);
      const tileY = Math.round(baseTileY - (u + v) * halfH);

      if (tileX < 0 || tileY + effH > height) continue;
      if (tileX >= width || tileY + effH <= 0) continue;

      for (let i = 0; i < borderPixels.length; i++) {
        const px = tileX + borderPixels[i][0];
        const py = tileY + borderPixels[i][1];
        if (px >= 0 && px < width && py >= 0 && py < height) {
          ctx.fillRect(px, py, 1, 1);
        }
      }
    }
  }

  ctx.fillStyle = hexToRgba(isoColor, 0.95);
  for (let i = 0; i < borderPixels.length; i++) {
    const px = baseTileX + borderPixels[i][0];
    const py = baseTileY + borderPixels[i][1];
    if (px >= 0 && px < width && py >= 0 && py < height) {
      ctx.fillRect(px, py, 1, 1);
    }
  }
}

// ピクセルパーフェクト補助線（直交グリッド）＆ 画像左下基準Simutransタイル敷き詰め描画
export function drawGuidesOverlay(oCtx, width, height, zoomLevel, opts) {
  if (opts.showGrid && opts.gridStep >= 1) {
    oCtx.fillStyle = hexToRgba(opts.gridColor || '#00FF66', 0.75);
    const step = Math.max(1, Math.floor(opts.gridStep));
    for (let x = step; x < width; x += step) {
      oCtx.fillRect(x, 0, 1, height);
    }
    for (let y = step; y < height; y += step) {
      oCtx.fillRect(0, y, width, 1);
    }
  }

  if (opts.showIsoTile) {
    drawSimutransIsoTiles(oCtx, width, height, opts.isoTileW, opts.isoTileH, opts.isoColor);
  }
}