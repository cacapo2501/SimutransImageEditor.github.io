import { rgbToHsv } from './color-utils.js';

function hueDistance(h1, h2) {
  const d = Math.abs(h1 - h2) % 360;
  return Math.min(d, 360 - d);
}

// 平面図から有彩色ピクセルを「同じ色相 ±6°」かつ「8近傍連結」でグループ化
export function extractChromaticGroups(srcData, imgW, imgH) {
  const total = imgW * imgH;
  const hArr = new Float32Array(total);
  const sArr = new Float32Array(total);
  const vArr = new Float32Array(total);
  const valid = new Uint8Array(total);

  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    const r = srcData[idx];
    const g = srcData[idx + 1];
    const b = srcData[idx + 2];
    const a = srcData[idx + 3];

    if (a === 0) continue;
    if (r === 255 && g === 255 && b === 255) continue;
    if (r === 231 && g === 255 && b === 255) continue;

    const [h, sPct, vPct] = rgbToHsv(r, g, b);
    if (sPct >= 8) {
      hArr[i] = h;
      sArr[i] = sPct / 100.0;
      vArr[i] = vPct / 100.0;
      valid[i] = 1;
    }
  }

  const visited = new Uint8Array(total);
  const groups = [];
  const queue = new Int32Array(total);

  for (let i = 0; i < total; i++) {
    if (!valid[i] || visited[i]) continue;

    const seedHue = hArr[i];
    const pixels = [];
    let head = 0;
    let tail = 0;
    visited[i] = 1;
    queue[tail++] = i;

    while (head < tail) {
      const cur = queue[head++];
      const cx = cur % imgW;
      const cy = (cur - cx) / imgW;
      pixels.push({ x: cx, y: cy, h: hArr[cur], s: sArr[cur], v: vArr[cur] });

      for (let dy = -1; dy <= 1; dy++) {
        const ny = cy + dy;
        if (ny < 0 || ny >= imgH) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx;
          if (nx < 0 || nx >= imgW) continue;
          const nIdx = ny * imgW + nx;
          if (valid[nIdx] && !visited[nIdx] && hueDistance(seedHue, hArr[nIdx]) <= 6.0) {
            visited[nIdx] = 1;
            queue[tail++] = nIdx;
          }
        }
      }
    }

    groups.push({ id: groups.length, seedHue, pixels, partType: 'wing', quads3d: [] });
  }

  return groups;
}

// 3D寸法比から「垂直尾翼」「主翼・水平尾翼」「胴体」「エンジン」の4種へ自動分類
export function classifyAircraftGroups(groups, imgW, imgH, pixelLength, pixelHeight) {
  const scaleX = pixelLength / Math.max(1, imgW);
  const scaleZ = pixelLength / Math.max(1, imgH);

  groups.forEach((grp) => {
    let minX = imgW, maxX = -1, minY = imgH, maxY = -1;
    let minV = 1.0, maxV = 0.0;
    for (const p of grp.pixels) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
      if (p.v < minV) minV = p.v;
      if (p.v > maxV) maxV = p.v;
    }
    grp.bounds2d = { minX, maxX, minY, maxY };
    grp.spanX = (maxX - minX + 1) * scaleX;
    grp.spanZ = (maxY - minY + 1) * scaleZ;
    grp.spanY = (maxV - minV) * pixelHeight;
    grp.minV = minV;
    grp.maxV = maxV;
    grp.partType = null;
  });

  // 1. 垂直尾翼: 横幅 spanX が薄く、高さ変化 spanY が大きい縦板
  const thinXThresh = Math.max(3.5, pixelLength * 0.085);
  const tallYThresh = Math.max(3.0, pixelHeight * 0.22);
  for (const grp of groups) {
    if (grp.spanX <= thinXThresh && grp.spanY >= tallYThresh && grp.spanY > grp.spanX * 1.2) {
      grp.partType = 'vertical_stabilizer';
    }
  }

  // 2. 胴体: 未分類のうち前後長 spanZ が長く最大面積の円筒形
  const fuselageCands = groups.filter(g => g.partType === null && g.spanZ >= g.spanX * 1.3);
  if (fuselageCands.length > 0) {
    fuselageCands.sort((a, b) => (b.pixels.length - a.pixels.length) || (b.spanZ - a.spanZ));
    fuselageCands[0].partType = 'fuselage';
  } else {
    const rest = groups.filter(g => g.partType === null);
    if (rest.length > 0) {
      rest.sort((a, b) => b.pixels.length - a.pixels.length);
      rest[0].partType = 'fuselage';
    }
  }

  // 3. エンジン vs 主翼・水平尾翼
  const fuselage = groups.find(g => g.partType === 'fuselage');
  const fuselageW = fuselage ? fuselage.spanX : pixelLength * 0.15;

  for (const grp of groups) {
    if (grp.partType !== null) continue;
    if (grp.spanZ > grp.spanX * 1.25 && grp.spanX <= fuselageW * 1.3) {
      grp.partType = 'engine';
    } else {
      grp.partType = 'wing';
    }
  }
}

// グループ種別に応じた3D四角形ポリゴンメッシュ生成
export function buildGroup3DMeshes(groups, imgW, imgH, pixelLength, pixelHeight) {
  const scaleX = pixelLength / Math.max(1, imgW);
  const scaleZ = pixelLength / Math.max(1, imgH);
  const halfW = imgW / 2.0;
  const halfH = imgH / 2.0;

  for (const grp of groups) {
    if (grp.partType === 'fuselage' || grp.partType === 'engine') {
      grp.quads3d = buildCylinderQuads(grp, halfW, halfH, scaleX, scaleZ, pixelHeight);
    } else if (grp.partType === 'vertical_stabilizer') {
      grp.quads3d = buildVerticalFinQuads(grp, halfW, halfH, scaleX, scaleZ, pixelHeight);
    } else {
      grp.quads3d = buildWingQuads(grp, imgW, imgH, halfW, halfH, scaleX, scaleZ, pixelHeight);
    }
  }
}

function buildWingQuads(grp, imgW, imgH, halfW, halfH, scaleX, scaleZ, pixelHeight) {
  const quads = [];
  const vMap = new Map();
  for (const p of grp.pixels) {
    vMap.set(p.y * imgW + p.x, p.v);
  }
  const thick = Math.max(0.8, pixelHeight * 0.06);

  for (const p of grp.pixels) {
    const yC = p.v * pixelHeight;
    const vR = vMap.get(p.y * imgW + (p.x + 1));
    const vL = vMap.get(p.y * imgW + (p.x - 1));
    const vD = vMap.get((p.y + 1) * imgW + p.x);
    const vU = vMap.get((p.y - 1) * imgW + p.x);

    const dYdX = ((vR !== undefined ? vR : p.v) - (vL !== undefined ? vL : p.v)) * pixelHeight / (2 * scaleX);
    const dYdZ = ((vD !== undefined ? vD : p.v) - (vU !== undefined ? vU : p.v)) * pixelHeight / (2 * scaleZ);
    const nTop = [-dYdX, 1.0, -dYdZ];

    const x0 = (p.x - 0.5 - halfW) * scaleX;
    const x1 = (p.x + 0.5 - halfW) * scaleX;
    const z0 = (p.y - 0.5 - halfH) * scaleZ;
    const z1 = (p.y + 0.5 - halfH) * scaleZ;

    // 上水平面
    quads.push({
      verts: [[x0, yC, z0], [x1, yC, z0], [x1, yC, z1], [x0, yC, z1]],
      normal: nTop
    });

    // 外周縁の薄い壁面
    if (vL === undefined) {
      quads.push({ verts: [[x0, yC, z0], [x0, yC, z1], [x0, yC - thick, z1], [x0, yC - thick, z0]], normal: [-1, 0, 0] });
    }
    if (vR === undefined) {
      quads.push({ verts: [[x1, yC, z1], [x1, yC, z0], [x1, yC - thick, z0], [x1, yC - thick, z1]], normal: [1, 0, 0] });
    }
    if (vU === undefined) {
      quads.push({ verts: [[x1, yC, z0], [x0, yC, z0], [x0, yC - thick, z0], [x1, yC - thick, z0]], normal: [0, 0, -1] });
    }
    if (vD === undefined) {
      quads.push({ verts: [[x0, yC, z1], [x1, yC, z1], [x1, yC - thick, z1], [x0, yC - thick, z1]], normal: [0, 0, 1] });
    }
  }
  return quads;
}

function buildVerticalFinQuads(grp, halfW, halfH, scaleX, scaleZ, pixelHeight) {
  const quads = [];
  const rowMap = new Map();
  for (const p of grp.pixels) {
    if (!rowMap.has(p.y)) rowMap.set(p.y, { minX: p.x, maxX: p.x, maxV: p.v });
    const row = rowMap.get(p.y);
    if (p.x < row.minX) row.minX = p.x;
    if (p.x > row.maxX) row.maxX = p.x;
    if (p.v > row.maxV) row.maxV = p.v;
  }

  const ys = Array.from(rowMap.keys()).sort((a, b) => a - b);
  const baseBotY = grp.minV * pixelHeight;

  for (let i = 0; i < ys.length; i++) {
    const y0 = ys[i];
    const r0 = rowMap.get(y0);
    const y1 = i + 1 < ys.length ? ys[i + 1] : y0 + 1;
    const r1 = i + 1 < ys.length ? rowMap.get(y1) : r0;

    const xc0 = ((r0.minX + r0.maxX) / 2 - halfW) * scaleX;
    const xc1 = ((r1.minX + r1.maxX) / 2 - halfW) * scaleX;
    const hw0 = Math.max(0.55, ((r0.maxX - r0.minX + 1) * scaleX) / 2);
    const hw1 = Math.max(0.55, ((r1.maxX - r1.minX + 1) * scaleX) / 2);

    const z0 = (y0 - 0.5 - halfH) * scaleZ;
    const z1 = (y1 - 0.5 - halfH) * scaleZ;
    const top0 = r0.maxV * pixelHeight;
    const top1 = r1.maxV * pixelHeight;

    // 左壁面
    quads.push({
      verts: [[xc0 - hw0, top0, z0], [xc1 - hw1, top1, z1], [xc1 - hw1, baseBotY, z1], [xc0 - hw0, baseBotY, z0]],
      normal: [-1, 0, 0]
    });
    // 右壁面
    quads.push({
      verts: [[xc1 + hw1, top1, z1], [xc0 + hw0, top0, z0], [xc0 + hw0, baseBotY, z0], [xc1 + hw1, baseBotY, z1]],
      normal: [1, 0, 0]
    });
    // 上端縁
    const slopeZ = -(top1 - top0) / Math.max(0.1, z1 - z0);
    quads.push({
      verts: [[xc0 - hw0, top0, z0], [xc0 + hw0, top0, z0], [xc1 + hw1, top1, z1], [xc1 - hw1, top1, z1]],
      normal: [0, 1, slopeZ]
    });
  }
  return quads;
}

function buildCylinderQuads(grp, halfW, halfH, scaleX, scaleZ, pixelHeight) {
  const quads = [];
  const rowMap = new Map();
  for (const p of grp.pixels) {
    if (!rowMap.has(p.y)) rowMap.set(p.y, { minX: p.x, maxX: p.x, maxV: p.v });
    const row = rowMap.get(p.y);
    if (p.x < row.minX) row.minX = p.x;
    if (p.x > row.maxX) row.maxX = p.x;
    if (p.v > row.maxV) row.maxV = p.v;
  }

  const ys = Array.from(rowMap.keys()).sort((a, b) => a - b);
  const slices = ys.map((y, idx) => {
    const r = rowMap.get(y);
    const xc = ((r.minX + r.maxX) / 2 - halfW) * scaleX;
    const rad = Math.max(0.7, ((r.maxX - r.minX + 1) * scaleX) / 2);
    const topY = r.maxV * pixelHeight;
    const axisY = Math.max(rad * 0.4, topY - rad);
    const z = (idx === 0 ? y - 0.5 : (idx === ys.length - 1 ? y + 0.5 : y)) - halfH;
    return { xc, rad, axisY, z: z * scaleZ };
  });

  // 円筒の断面角度 (-125° 左下側面 〜 0° 頂上 〜 +125° 右下側面) を8分割
  const arcSteps = 8;
  const angMin = (-125 * Math.PI) / 180;
  const angMax = (125 * Math.PI) / 180;

  for (let i = 0; i < slices.length - 1; i++) {
    const s0 = slices[i];
    const s1 = slices[i + 1];
    const dz = Math.max(0.1, s1.z - s0.z);

    for (let k = 0; k < arcSteps; k++) {
      const a0 = angMin + ((angMax - angMin) * k) / arcSteps;
      const a1 = angMin + ((angMax - angMin) * (k + 1)) / arcSteps;
      const aMid = (a0 + a1) / 2;

      const sin0 = Math.sin(a0), cos0 = Math.cos(a0);
      const sin1 = Math.sin(a1), cos1 = Math.cos(a1);
      const sinM = Math.sin(aMid), cosM = Math.cos(aMid);

      const p00 = [s0.xc + s0.rad * sin0, s0.axisY + s0.rad * cos0, s0.z];
      const p01 = [s0.xc + s0.rad * sin1, s0.axisY + s0.rad * cos1, s0.z];
      const p11 = [s1.xc + s1.rad * sin1, s1.axisY + s1.rad * cos1, s1.z];
      const p10 = [s1.xc + s1.rad * sin0, s1.axisY + s1.rad * cos0, s1.z];

      const rDiff = (s1.rad - s0.rad) / dz;
      const yDiff = (s1.axisY - s0.axisY) / dz;
      const nzSlope = -(rDiff + cosM * yDiff);

      quads.push({
        verts: [p00, p01, p11, p10],
        normal: [sinM, cosM, nzSlope]
      });
    }
  }

  return quads;
}